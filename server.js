'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const JSZip = require('jszip');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const META = require('./shared/tools-meta');
const { handlers } = require('./src/handlers');
const { sanitizeOptions } = require('./src/options');
const { UserError } = require('./src/errors');
const { cleanName, fixEncoding } = require('./src/utils');

/* ------------------------------------------------------------ config */
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '50', 10);
const MAX_FILES = 20;
const JOB_TTL_MS = parseInt(process.env.JOB_TTL_MINUTES || '30', 10) * 60 * 1000;
const RATE_LIMIT_PER_10_MIN = parseInt(process.env.RATE_LIMIT || '60', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'docxmaster');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const JOB_DIR = path.join(DATA_DIR, 'jobs');

const toolById = new Map(META.tools.map(t => [t.id, t]));

/* ------------------------------------------------------------ app */
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      workerSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: RATE_LIMIT_PER_10_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' }
});

const upload = multer({
  dest: UPLOAD_DIR, // random file names; the original name is never used as a path
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES, fields: 10, fieldSize: 10 * 1024, parts: MAX_FILES + 10 }
});

/* ------------------------------------------------------------ static files */
app.use('/shared', express.static(path.join(__dirname, 'shared'), { maxAge: '1h' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

/* ------------------------------------------------------------ run a tool */
function findTool(req, res, next) {
  const tool = toolById.get(String(req.params.id));
  if (!tool || !handlers.has(tool.id)) return res.status(404).json({ error: 'Unknown tool.' });
  req.tool = tool;
  next();
}

async function looksLikePdf(file) {
  const fh = await fs.open(file.path, 'r');
  try {
    const { buffer, bytesRead } = await fh.read(Buffer.alloc(1024), 0, 1024, 0);
    return buffer.subarray(0, bytesRead).includes('%PDF-');
  } finally {
    await fh.close();
  }
}

async function saveJob(toolId, results) {
  const token = crypto.randomBytes(16).toString('hex');
  const dir = path.join(JOB_DIR, token);
  await fs.mkdir(dir, { recursive: true });
  const files = [];
  for (const [i, r] of results.entries()) {
    await fs.writeFile(path.join(dir, `${i}.bin`), r.data);
    files.push({ name: cleanName(r.name), size: r.data.length, note: r.note });
  }
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ tool: toolId, files }));
  return { token, files, expiresInMinutes: Math.round(JOB_TTL_MS / 60000) };
}

app.post('/api/tools/:id', apiLimiter, findTool, upload.array('files', MAX_FILES), async (req, res, next) => {
  const tool = req.tool;
  const uploaded = req.files || [];
  let scratch;
  try {
    const files = uploaded.map(f => ({
      path: path.resolve(f.path),
      name: cleanName(fixEncoding(f.originalname)),
      size: f.size
    }));

    if (!files.length) throw new UserError('Choose a file first.');
    if (!tool.multiple && files.length > 1) throw new UserError('This tool works on one file at a time.');
    if (files.length < (tool.min || 1)) throw new UserError(`Add at least ${tool.min} files.`);

    if (tool.kind === 'pdf') {
      for (const f of files) {
        if (!(await looksLikePdf(f))) throw new UserError(`"${f.name}" is not a PDF file.`);
      }
    }

    let rawOptions = {};
    try { rawOptions = req.body && req.body.options ? JSON.parse(req.body.options) : {}; }
    catch (e) { throw new UserError('Invalid options.'); }
    const options = sanitizeOptions(tool, rawOptions);

    scratch = await fs.mkdtemp(path.join(UPLOAD_DIR, 'work-'));
    const results = await handlers.get(tool.id)(files, options, { scratch });
    res.json(await saveJob(tool.id, results));
  } catch (err) {
    next(err);
  } finally {
    await Promise.allSettled(uploaded.map(f => fs.rm(f.path, { force: true })));
    if (scratch) await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
});

/* ------------------------------------------------------------ downloads */
async function readJob(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    const dir = path.join(JOB_DIR, token);
    const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
    return { dir, ...meta };
  } catch (e) {
    return null;
  }
}

app.get('/api/download/:token/:which', async (req, res, next) => {
  try {
    const job = await readJob(String(req.params.token));
    if (!job) return res.status(404).json({ error: 'This download has expired. Please run the tool again.' });

    if (req.params.which === 'zip') {
      const zip = new JSZip();
      const used = new Set();
      for (const [i, f] of job.files.entries()) {
        let name = f.name, n = 1;
        while (used.has(name)) {
          const dot = f.name.lastIndexOf('.');
          name = dot > 0 ? `${f.name.slice(0, dot)}-${++n}${f.name.slice(dot)}` : `${f.name}-${++n}`;
        }
        used.add(name);
        zip.file(name, await fs.readFile(path.join(job.dir, `${i}.bin`)));
      }
      res.attachment(`${job.tool}-files.zip`).type('application/zip');
      return zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' }).pipe(res);
    }

    if (!/^\d{1,4}$/.test(req.params.which)) return res.status(404).json({ error: 'File not found.' });
    const idx = parseInt(req.params.which, 10);
    const f = job.files[idx];
    if (!f) return res.status(404).json({ error: 'File not found.' });
    res.download(path.join(job.dir, `${idx}.bin`), f.name, err => { if (err && !res.headersSent) next(err); });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------ errors */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const msg = {
      LIMIT_FILE_SIZE: `A file is too large. The limit is ${MAX_FILE_MB} MB per file.`,
      LIMIT_FILE_COUNT: `You can upload up to ${MAX_FILES} files at once.`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.'
    }[err.code] || 'The upload was rejected.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong while processing your file.' });
});

/* ------------------------------------------------------------ cleanup */
async function removeOld(dir, maxAgeMs) {
  let names = [];
  try { names = await fs.readdir(dir); } catch (e) { return; }
  const now = Date.now();
  for (const name of names) {
    const p = path.join(dir, name);
    const st = await fs.stat(p).catch(() => null);
    if (st && now - st.mtimeMs > maxAgeMs) await fs.rm(p, { recursive: true, force: true }).catch(() => {});
  }
}

async function start() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(JOB_DIR, { recursive: true });
  await removeOld(UPLOAD_DIR, 0);          // leftovers from a previous crash
  await removeOld(JOB_DIR, JOB_TTL_MS);
  setInterval(() => {
    removeOld(JOB_DIR, JOB_TTL_MS);
    removeOld(UPLOAD_DIR, 60 * 60 * 1000);
  }, 5 * 60 * 1000).unref();

  return app.listen(PORT, () => {
    console.log(`DocxMaster is running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { app, start };
