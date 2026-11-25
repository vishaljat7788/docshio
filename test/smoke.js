'use strict';
/* End-to-end smoke test. Starts the server on a random port and exercises every tool. */
process.env.PORT = '0';
process.env.MAX_FILE_MB = '8';
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'docxmaster-test-' + process.pid);

const assert = require('assert');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { start } = require('../server');

let base;
const results = [];
const skipped = [];

function hasBinary(name) {
  const result = spawnSync(name, ['-v'], { stdio: 'ignore', timeout: 5000 });
  return !result.error && result.status === 0;
}

async function makePdf(label, pages) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) d.addPage([400, 500]).drawText(`${label} page ${i}`, { x: 50, y: 250, size: 24, font: f });
  return Buffer.from(await d.save());
}

async function makeBigPdf() {
  const jpg = await sharp({ create: { width: 2000, height: 2000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } })
    .jpeg({ quality: 95 }).toBuffer();
  const d = await PDFDocument.create();
  const img = await d.embedJpg(jpg);
  d.addPage([600, 600]).drawImage(img, { x: 0, y: 0, width: 600, height: 600 });
  return Buffer.from(await d.save());
}

async function makeIccPdf() {
  const jpg = await sharp({ create: { width: 1200, height: 1200, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } })
    .jpeg({ quality: 95 }).toBuffer();
  const profiledJpg = await sharp(jpg).withIccProfile('srgb').jpeg().toBuffer();
  const icc = (await sharp(profiledJpg).metadata()).icc;
  const d = await PDFDocument.create();
  const image = await d.embedJpg(jpg);
  d.addPage([600, 600]).drawImage(image, { x: 0, y: 0, width: 600, height: 600 });
  await d.flush();
  const PDFName = require('pdf-lib/cjs/core/objects/PDFName').default;
  const PDFNumber = require('pdf-lib/cjs/core/objects/PDFNumber').default;
  const profileRef = d.context.register(d.context.stream(icc, d.context.obj({ N: PDFNumber.of(3) })));
  d.context.lookup(image.ref).dict.set(PDFName.of('ColorSpace'), d.context.obj([PDFName.of('ICCBased'), profileRef]));
  return Buffer.from(await d.save());
}

async function call(tool, files, options) {
  const form = new FormData();
  for (const f of files) form.append('files', new Blob([f.data], { type: f.type || 'application/pdf' }), f.name);
  if (options) form.append('options', JSON.stringify(options));
  const res = await fetch(`${base}/api/tools/${tool}`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function download(token, which) {
  const res = await fetch(`${base}/api/download/${token}/${which}`);
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
}

const pageCount = async buf => (await PDFDocument.load(buf)).getPageCount();

async function test(name, fn) {
  try { await fn(); results.push([name, true]); console.log('  ok   ', name); }
  catch (e) { results.push([name, false]); console.log('  FAIL ', name, '\n        ', e.message); }
}

function skip(name, reason) {
  skipped.push(name);
  console.log('  skip ', name, `(${reason})`);
}

(async () => {
  const server = await start();
  base = `http://127.0.0.1:${server.address().port}`;
  const A = { name: 'a.pdf', data: await makePdf('A', 5) };
  const B = { name: 'b.pdf', data: await makePdf('B', 2) };
  const png = { name: 'p.png', type: 'image/png', data: await sharp({ create: { width: 300, height: 200, channels: 4, background: '#0a0' } }).png().toBuffer() };
  const jpg = { name: 'j.jpg', type: 'image/jpeg', data: await sharp({ create: { width: 200, height: 400, channels: 3, background: '#00a' } }).jpeg().toBuffer() };

  console.log('Tools');
  await test('merge 5+2 pages = 7', async () => {
    const r = await call('merge', [A, B], {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 7);
  });

  await test('split ranges 1-2,5 gives two files', async () => {
    const r = await call('split', [A], { mode: 'ranges', ranges: '1-2,5' });
    assert.equal(r.body.files.length, 2);
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 2);
    assert.equal(await pageCount((await download(r.body.token, 1)).buf), 1);
  });

  await test('split every page gives 5 files + zip download', async () => {
    const r = await call('split', [A], { mode: 'each' });
    assert.equal(r.body.files.length, 5);
    const z = await download(r.body.token, 'zip');
    assert.equal(z.status, 200);
    assert.equal(z.buf.subarray(0, 2).toString(), 'PK');
  });

  await test('split rejects out-of-range page', async () => {
    const r = await call('split', [A], { mode: 'ranges', ranges: '9' });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /outside this document/);
  });

  await test('remove pages 2,4-5 leaves 2', async () => {
    const r = await call('remove', [A], { pages: '2,4-5' });
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 2);
  });

  await test('rotate pages 1-2 by 90', async () => {
    const r = await call('rotate', [A], { angle: '90', scope: 'custom', pages: '1-2' });
    const d = await PDFDocument.load((await download(r.body.token, 0)).buf);
    assert.deepEqual(d.getPages().map(p => p.getRotation().angle), [90, 90, 0, 0, 0]);
  });

  await test('watermark keeps page count', async () => {
    const r = await call('watermark', [A], { text: 'DRAFT', size: 60, opacity: 30, angle: 45, color: '#ff0000' });
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 5);
  });

  await test('watermark rejects non-Latin text politely', async () => {
    const hindi = String.fromCodePoint(0x0939, 0x093f, 0x0902, 0x0926, 0x0940);
    const r = await call('watermark', [A], { text: hindi });
    assert.equal(r.status, 400);
  });

  await test('page numbers', async () => {
    const r = await call('page-numbers', [A], { position: 'bottom-right', format: 'page-n-of-total', start: 1, size: 11 });
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 5);
  });

  if (hasBinary('pdftoppm')) {
    await test('pdf to jpg returns 5 real JPEGs', async () => {
      const r = await call('pdf-to-jpg', [A], { quality: 'standard' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.files.length, 5);
      const f = await download(r.body.token, 0);
      assert.equal(f.buf[0], 0xff); assert.equal(f.buf[1], 0xd8);
    });
  } else {
    skip('pdf to jpg returns 5 real JPEGs', 'Poppler (pdftoppm) is not installed');
  }

  await test('images to PDF (fit sizes)', async () => {
    const r = await call('jpg-to-pdf', [png, jpg], { size: 'fit' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = await PDFDocument.load((await download(r.body.token, 0)).buf);
    assert.deepEqual(d.getPages().map(p => [Math.round(p.getWidth()), Math.round(p.getHeight())]), [[300, 200], [200, 400]]);
  });

  await test('images to PDF (A4 auto orientation)', async () => {
    const r = await call('jpg-to-pdf', [png, jpg], { size: 'a4', orientation: 'auto', margin: '18' });
    const d = await PDFDocument.load((await download(r.body.token, 0)).buf);
    assert.deepEqual(d.getPages().map(p => [Math.round(p.getWidth()), Math.round(p.getHeight())]), [[842, 595], [595, 842]]);
  });

  await test('compress shrinks an image-heavy PDF', async () => {
    const big = { name: 'big.pdf', data: await makeBigPdf() };
    const r = await call('compress', [big], { level: 'strong' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.files[0].size < big.data.length, 'output not smaller');
    assert.match(r.body.files[0].note, /smaller/);
  });

  await test('compress still returns a PDF when it cannot reduce size', async () => {
    const small = { name: 'small.pdf', data: await makePdf('Small', 1) };
    const r = await call('compress', [small], { level: 'medium' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const output = await download(r.body.token, 0);
    assert.equal(output.status, 200);
    assert.equal(await pageCount(output.buf), 1);
  });

  await test('compress handles ICCBased image color spaces', async () => {
    const iccPdf = { name: 'icc.pdf', data: await makeIccPdf() };
    const r = await call('compress', [iccPdf], { level: 'medium' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.files[0].size < iccPdf.data.length * 0.8, 'ICCBased image was not compressed');
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 1);
  });

  await test('compress targets a requested size in KB', async () => {
    const targetPdf = { name: 'target.pdf', data: await makeIccPdf() };
    const r = await call('compress', [targetPdf], { goal: 'target', targetSize: 200, targetUnit: 'kb' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.files[0].size <= 200 * 1024, `target missed: ${r.body.files[0].size} bytes`);
    assert.match(r.body.files[0].note, /Target 200 KB reached/);
    assert.equal(await pageCount((await download(r.body.token, 0)).buf), 1);
  });

  await test('compress accepts a requested size in MB', async () => {
    const targetPdf = { name: 'target-mb.pdf', data: await makeIccPdf() };
    const r = await call('compress', [targetPdf], { goal: 'target', targetSize: 1, targetUnit: 'mb' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.files[0].size <= 1024 * 1024, `target missed: ${r.body.files[0].size} bytes`);
    assert.match(r.body.files[0].note, /Target 1 MB reached/);
  });

  console.log('Security and errors');
  await test('fake PDF (text renamed .pdf) is rejected', async () => {
    const r = await call('merge', [{ name: 'x.pdf', data: Buffer.from('hello world') }, B], {});
    assert.equal(r.status, 400);
    assert.match(r.body.error, /not a PDF/);
  });

  await test('non-image is rejected by images tool', async () => {
    const r = await call('jpg-to-pdf', [{ name: 'x.png', type: 'image/png', data: Buffer.from('nope') }], { size: 'fit' });
    assert.equal(r.status, 400);
  });

  await test('oversized file gets 413', async () => {
    const huge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(9 * 1024 * 1024)]);
    const r = await call('merge', [{ name: 'huge.pdf', data: huge }, B], {});
    assert.equal(r.status, 413);
  });

  await test('unknown tool gives 404', async () => {
    assert.equal((await call('does-not-exist', [A], {})).status, 404);
  });

  await test('prototype-pollution style tool id gives 404', async () => {
    assert.equal((await call('__proto__', [A], {})).status, 404);
  });

  await test('invalid select option is rejected', async () => {
    const r = await call('rotate', [A], { angle: '45', scope: 'all' });
    assert.equal(r.status, 400);
  });

  await test('merge needs two files', async () => {
    assert.equal((await call('merge', [A], {})).status, 400);
  });

  await test('bad / traversal download tokens give 404', async () => {
    for (const t of ['nothex', '../../etc', '%2e%2e%2f%2e%2e%2fetc%2fpasswd', 'a'.repeat(32)]) {
      assert.equal((await download(t, 0)).status, 404, t);
    }
  });

  await test('download index out of range gives 404', async () => {
    const r = await call('merge', [A, B], {});
    assert.equal((await download(r.body.token, 99)).status, 404);
    assert.equal((await download(r.body.token, '1abc')).status, 404);
  });

  await test('qpdf WebAssembly protects and unlocks a PDF', async () => {
    const createQpdf = require('@neslinesli93/qpdf-wasm');
    const qpdf = await createQpdf({
      locateFile: () => require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
      noInitialRun: true,
      print: () => {},
      printErr: () => {}
    });
    qpdf.FS.writeFile('/smoke-input.pdf', A.data);
    assert.equal(qpdf.callMain(['--encrypt', 'test-pass', 'test-pass', '256', '--', '/smoke-input.pdf', '/smoke-protected.pdf']), 0);
    const protectedPdf = Buffer.from(qpdf.FS.readFile('/smoke-protected.pdf'));
    assert.match(protectedPdf.toString('latin1'), /\/Encrypt/);
    qpdf.FS.writeFile('/smoke-protected.pdf', protectedPdf);
    assert.equal(qpdf.callMain(['--decrypt', '/smoke-protected.pdf', '/smoke-unlocked.pdf', '--password=test-pass']), 0);
    assert.equal(await pageCount(Buffer.from(qpdf.FS.readFile('/smoke-unlocked.pdf'))), 5);
  });

  await test('security headers are set', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  await test('shared tool list is served to the browser', async () => {
    const res = await fetch(`${base}/shared/tools-meta.js`);
    assert.equal(res.status, 200);
  });

  server.close();
  const failed = results.filter(r => !r[1]).length;
  console.log(`\n${results.length - failed}/${results.length} passed; ${skipped.length} skipped`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
