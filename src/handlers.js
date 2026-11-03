'use strict';
/*
 * One async function per tool.
 *   handler(files, options, { scratch }) -> [{ name, data: Buffer, note? }]
 * `files` are { path, name, size }. `options` were already validated.
 */
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');
const zlib = require('zlib');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, degrees, rgb, EncryptedPDFError } = require('pdf-lib');
const PDFRawStream = require('pdf-lib/cjs/core/objects/PDFRawStream').default;
const PDFArray = require('pdf-lib/cjs/core/objects/PDFArray').default;
const PDFName = require('pdf-lib/cjs/core/objects/PDFName').default;
const PDFNumber = require('pdf-lib/cjs/core/objects/PDFNumber').default;

const { UserError } = require('./errors');
const { clamp, parseRanges, baseName, hexToRgb, formatSize } = require('./utils');

const execFileP = promisify(execFile);

const MAX_RENDER_PAGES = parseInt(process.env.MAX_RENDER_PAGES || '200', 10);
const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_SECONDS || '120', 10) * 1000;
const MAX_IMAGE_PIXELS = 100e6;

const pdfBytes = async doc => Buffer.from(await doc.save());

/* ------------------------------------------------------------ helpers */
async function loadPdf(file) {
  const buf = await fs.readFile(file.path);
  try {
    return await PDFDocument.load(buf);
  } catch (e) {
    if (e instanceof EncryptedPDFError || /encrypt/i.test(String(e.message))) {
      throw new UserError(`"${file.name}" is password protected. Remove the password first.`);
    }
    throw new UserError(`"${file.name}" could not be opened. It may be damaged.`);
  }
}

async function runBinary(cmd, args, missingMessage) {
  try {
    return await execFileP(cmd, args, {
      timeout: TOOL_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (e) {
    if (e.code === 'ENOENT') throw new UserError(missingMessage, 501);
    if (e.killed) throw new UserError('This file took too long to process. Try a smaller file.', 408);
    const err = new Error(`${cmd} failed: ${String(e.stderr || e.message).slice(0, 500)}`);
    err.stderr = String(e.stderr || '');
    throw err;
  }
}

async function imageForPdf(file) {
  const opts = { limitInputPixels: MAX_IMAGE_PIXELS };
  let meta;
  try {
    meta = await sharp(file.path, opts).metadata();
  } catch (e) {
    throw new UserError(`"${file.name}" is not an image this server can read.`);
  }
  // .rotate() with no arguments applies the EXIF orientation.
  const pipeline = sharp(file.path, opts).rotate();
  try {
    if (meta.hasAlpha) {
      const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
      return { data, kind: 'png', width: info.width, height: info.height };
    }
    const { data, info } = await pipeline
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 92 })
      .toBuffer({ resolveWithObject: true });
    return { data, kind: 'jpg', width: info.width, height: info.height };
  } catch (e) {
    throw new UserError(`"${file.name}" could not be converted.`);
  }
}

/* ------------------------------------------------------------ handlers */
const handlers = new Map();

handlers.set('merge', async files => {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await loadPdf(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return [{ name: 'merged.pdf', data: await pdfBytes(out) }];
});

handlers.set('split', async (files, o) => {
  const src = await loadPdf(files[0]);
  const total = src.getPageCount();
  const base = baseName(files[0].name);

  if (o.mode === 'each') {
    const results = [];
    for (let i = 0; i < total; i++) {
      const doc = await PDFDocument.create();
      const [p] = await doc.copyPages(src, [i]);
      doc.addPage(p);
      results.push({ name: `${base}-page-${i + 1}.pdf`, data: await pdfBytes(doc) });
    }
    return results;
  }

  if (o.mode === 'single') {
    const idx = parseRanges(o.ranges, total, false);
    const doc = await PDFDocument.create();
    (await doc.copyPages(src, idx)).forEach(p => doc.addPage(p));
    return [{ name: `${base}-extracted.pdf`, data: await pdfBytes(doc) }];
  }

  const groups = parseRanges(o.ranges, total, true);
  const labels = o.ranges.replace(/\s+/g, '').split(',').filter(Boolean);
  const results = [];
  for (let g = 0; g < groups.length; g++) {
    const doc = await PDFDocument.create();
    (await doc.copyPages(src, groups[g])).forEach(p => doc.addPage(p));
    results.push({ name: `${base}-${labels[g]}.pdf`, data: await pdfBytes(doc) });
  }
  return results;
});

handlers.set('remove', async (files, o) => {
  const doc = await loadPdf(files[0]);
  const total = doc.getPageCount();
  const remove = new Set(parseRanges(o.pages, total, false));
  if (remove.size >= total) throw new UserError('You cannot remove every page.');
  const keep = doc.getPageIndices().filter(i => !remove.has(i));
  const out = await PDFDocument.create();
  (await out.copyPages(doc, keep)).forEach(p => out.addPage(p));
  return [{ name: `${baseName(files[0].name)}-edited.pdf`, data: await pdfBytes(out) }];
});

handlers.set('rotate', async (files, o) => {
  const doc = await loadPdf(files[0]);
  const total = doc.getPageCount();
  const idx = o.scope === 'all' ? doc.getPageIndices() : parseRanges(o.pages, total, false);
  const add = parseInt(o.angle, 10);
  const pages = doc.getPages();
  idx.forEach(i => {
    const cur = pages[i].getRotation().angle || 0;
    pages[i].setRotation(degrees((cur + add) % 360));
  });
  return [{ name: `${baseName(files[0].name)}-rotated.pdf`, data: await pdfBytes(doc) }];
});

handlers.set('jpg-to-pdf', async (files, o) => {
  const out = await PDFDocument.create();
  const sizes = { a4: [595.28, 841.89], letter: [612, 792] };

  for (const f of files) {
    const { data, kind, width, height } = await imageForPdf(f);
    const img = kind === 'png' ? await out.embedPng(data) : await out.embedJpg(data);

    if (o.size === 'fit') {
      out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
      continue;
    }

    let [pw, ph] = sizes[o.size];
    const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && width > height);
    if (landscape) [pw, ph] = [ph, pw];
    const m = parseInt(o.margin, 10);
    const k = Math.min((pw - m * 2) / width, (ph - m * 2) / height);
    const w = width * k, h = height * k;
    out.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return [{ name: 'images.pdf', data: await pdfBytes(out) }];
});

handlers.set('pdf-to-jpg', async (files, o, ctx) => {
  const dpi = { standard: 100, high: 150, max: 220 }[o.quality];
  const q = { standard: 75, high: 85, max: 92 }[o.quality];
  const prefix = path.join(ctx.scratch, 'pg');

  try {
    await runBinary('pdftoppm', [
      '-jpeg', '-jpegopt', `quality=${q}`, '-r', String(dpi),
      '-l', String(MAX_RENDER_PAGES), files[0].path, prefix
    ], 'PDF to JPG is not available on this server (poppler-utils is not installed).');
  } catch (e) {
    if (/password/i.test(e.stderr || '')) throw new UserError(`"${files[0].name}" is password protected. Remove the password first.`);
    if (!(e instanceof UserError)) throw new UserError(`"${files[0].name}" could not be converted. It may be damaged.`);
    throw e;
  }

  const names = (await fs.readdir(ctx.scratch))
    .map(n => ({ n, m: /^pg-(\d+)\.jpg$/.exec(n) }))
    .filter(x => x.m)
    .sort((a, b) => parseInt(a.m[1], 10) - parseInt(b.m[1], 10));
  if (!names.length) throw new UserError('No pages could be converted from this PDF.');

  const base = baseName(files[0].name);
  const results = [];
  for (const [i, x] of names.entries()) {
    results.push({ name: `${base}-page-${i + 1}.jpg`, data: await fs.readFile(path.join(ctx.scratch, x.n)) });
  }
  if (results.length === MAX_RENDER_PAGES) {
    results[0].note = `Only the first ${MAX_RENDER_PAGES} pages were converted.`;
  }
  return results;
});

handlers.set('compress', async (files, o, ctx) => {
  const preset = {
    light: { max: 2000, quality: 72 },
    medium: { max: 1600, quality: 52 },
    strong: { max: 1200, quality: 38 }
  }[o.level];
  const targetBytes = o.goal === 'target'
    ? Number(o.targetSize) * (o.targetUnit === 'mb' ? 1024 * 1024 : 1024)
    : null;
  const targetLabel = targetBytes === null ? null : `${o.targetSize} ${o.targetUnit.toUpperCase()}`;
  if (targetBytes !== null && files[0].size <= targetBytes) {
    return [{
      name: `${baseName(files[0].name)}-compressed.pdf`,
      data: await fs.readFile(files[0].path),
      note: `Already below the ${targetLabel} target (${formatSize(files[0].size)}).`
    }];
  }
  let doc;
  const images = [];

  try {
    doc = await loadPdf(files[0]);
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      const dict = object.dict;
      let filter;
      try { filter = dict.lookup(PDFName.of('Filter')); }
      catch (_) { continue; }

      // Re-compress Flate streams losslessly. This also helps PDFs whose page
      // content or images are already encoded with FlateDecode.
      if (filter?.toString() === '/FlateDecode') {
        try {
          const packed = zlib.deflateSync(zlib.inflateSync(object.getContents()), { level: 9 });
          if (packed.length < object.getContentsSize()) object.contents = packed;
        } catch (_) { /* Leave unsupported or damaged streams untouched. */ }
        continue;
      }

      try {
        const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName);
        const colorSpace = dict.get(PDFName.of('ColorSpace'));
        let sourceProfile;
        if (subtype?.toString() !== '/Image' || filter?.toString() !== '/DCTDecode') continue;
        if (colorSpace instanceof PDFArray && colorSpace.get(0)?.toString() === '/ICCBased') {
          const profileStream = doc.context.lookup(colorSpace.get(1));
          if (!(profileStream instanceof PDFRawStream)) continue;
          const channels = profileStream.dict.lookup(PDFName.of('N'))?.asNumber();
          const profileFilter = profileStream.dict.lookup(PDFName.of('Filter'))?.toString();
          if (channels !== 3 || (profileFilter && profileFilter !== '/FlateDecode')) continue;
          sourceProfile = Buffer.from(profileStream.getContents());
          if (profileFilter === '/FlateDecode') sourceProfile = zlib.inflateSync(sourceProfile);
          if (sourceProfile.length > 65519 || sourceProfile.toString('ascii', 36, 40) !== 'acsp') continue;
        } else if (colorSpace && !['/DeviceRGB', '/DeviceGray'].includes(colorSpace.toString())) {
          continue;
        }
        if (dict.has(PDFName.of('Decode')) || dict.has(PDFName.of('DecodeParms'))) continue;

        let source = Buffer.from(object.getContents());
        if (sourceProfile && source[0] === 0xff && source[1] === 0xd8) {
          const signature = Buffer.from('ICC_PROFILE\0', 'ascii');
          const marker = Buffer.alloc(4 + signature.length + 2 + sourceProfile.length);
          marker[0] = 0xff; marker[1] = 0xe2;
          marker.writeUInt16BE(marker.length - 2, 2);
          signature.copy(marker, 4);
          marker[4 + signature.length] = 1;
          marker[5 + signature.length] = 1;
          source = Buffer.concat([source.subarray(0, 2), marker, source.subarray(2)]);
        }
        const metadata = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
        if (!metadata.width || !metadata.height) continue;
        images.push({ object, dict, source, originalSize: object.getContentsSize(), sourceProfile });
      } catch (_) {
        // Leave an image Sharp cannot safely decode untouched and continue.
      }
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError(`"${files[0].name}" could not be compressed. It may be damaged, protected, or contain an unsupported image format.`);
  }

  const settings = targetBytes === null ? [preset] : [
    preset,
    { max: 1600, quality: 48 },
    { max: 1450, quality: 44 },
    { max: 1300, quality: 40 },
    { max: 1150, quality: 36 },
    { max: 1000, quality: 30 },
    { max: 800, quality: 24 },
    { max: 620, quality: 18 },
    { max: 450, quality: 12 },
    { max: 300, quality: 8 },
    { max: 240, quality: 6 },
    { max: 180, quality: 4 },
    { max: 140, quality: 2 },
    { max: 100, quality: 1 }
  ];
  let data;
  for (const setting of settings) {
    for (const image of images) {
      try {
        const result = await sharp(image.source, { limitInputPixels: MAX_IMAGE_PIXELS })
          .resize({ width: setting.max, height: setting.max, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: setting.quality, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        if (result.data.length >= image.originalSize) continue;
        if (image.bestSize && result.data.length >= image.bestSize) continue;

        image.bestSize = result.data.length;
        image.object.contents = result.data;
        image.dict.set(PDFName.of('Width'), PDFNumber.of(result.info.width));
        image.dict.set(PDFName.of('Height'), PDFNumber.of(result.info.height));
        if (image.sourceProfile) image.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      } catch (_) { /* Keep the best valid version of this image. */ }
    }
    try { data = Buffer.from(await doc.save({ useObjectStreams: true })); }
    catch (_) { throw new UserError(`"${files[0].name}" could not be saved after compression.`); }
    if (targetBytes === null || data.length <= targetBytes) break;
  }
  const before = files[0].size, after = data.length;
  if (after >= before) {
    return [{
      name: `${baseName(files[0].name)}-compressed.pdf`,
      data: await fs.readFile(files[0].path),
      note: targetBytes === null
        ? 'This PDF is already optimized; no further size reduction was possible.'
        : `Could not reach ${targetLabel}; the PDF could not be reduced with these settings.`
    }];
  }
  let note = `${formatSize(before)} → ${formatSize(after)} (${Math.round((1 - after / before) * 100)}% smaller)`;
  if (targetBytes !== null) {
    note = after <= targetBytes
      ? `Target ${targetLabel} reached: ${formatSize(after)}.`
      : `Target ${targetLabel} not reached; smallest result: ${formatSize(after)}.`;
  }
  return [{
    name: `${baseName(files[0].name)}-compressed.pdf`,
    data,
    note
  }];
});

handlers.set('watermark', async (files, o) => {
  const text = o.text.trim();
  if (!text) throw new UserError('Enter the watermark text.');
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = clamp(Number(o.size), 10, 200);
  const angle = Number(o.angle) || 0;
  const theta = angle * Math.PI / 180;

  let w;
  try { w = font.widthOfTextAtSize(text, size); }
  catch (e) { throw new UserError('The watermark text has characters this font cannot draw. Use English letters and numbers.'); }
  const h = font.heightAtSize(size);
  const color = hexToRgb(o.color);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const dx = w / 2, dy = h / 3;
    // Text origin is its bottom-left corner, so shift back by half the rotated size.
    const x = width / 2 - (dx * Math.cos(theta) - dy * Math.sin(theta));
    const y = height / 2 - (dx * Math.sin(theta) + dy * Math.cos(theta));
    page.drawText(text, { x, y, size, font, color, opacity: clamp(Number(o.opacity), 5, 100) / 100, rotate: degrees(angle) });
  }
  return [{ name: `${baseName(files[0].name)}-watermarked.pdf`, data: await pdfBytes(doc) }];
});

handlers.set('page-numbers', async (files, o) => {
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const start = Math.max(0, Math.floor(Number(o.start)) || 0);
  const size = clamp(Number(o.size), 6, 36);
  const total = pages.length + start - 1;
  const margin = 28;

  pages.forEach((page, i) => {
    const n = start + i;
    const label = {
      'n': `${n}`,
      'page-n': `Page ${n}`,
      'n-of-total': `${n} of ${total}`,
      'page-n-of-total': `Page ${n} of ${total}`
    }[o.format];
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(label, size);
    const [v, hAlign] = o.position.split('-');
    const x = hAlign === 'left' ? margin : hAlign === 'right' ? width - margin - tw : (width - tw) / 2;
    const y = v === 'top' ? height - margin : margin - size / 2;
    page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return [{ name: `${baseName(files[0].name)}-numbered.pdf`, data: await pdfBytes(doc) }];
});

// Office conversions use LibreOffice in headless mode. The same handler is
// deliberately used for PDF exports; LibreOffice reports unsupported formats
// as a normal conversion failure rather than producing a misleading file.
for (const id of ['pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf']) {
  handlers.set(id, async (files, _o, ctx) => {
    const tool = require('../shared/tools-meta').tools.find(t => t.id === id);
    const ext = path.extname(files[0].name).toLowerCase();
    const inputExts = id === 'html-to-pdf' ? ['.html', '.htm'] : id.startsWith('pdf-') ? ['.pdf'] : id.startsWith('word-') ? ['.doc', '.docx'] : id.startsWith('powerpoint-') ? ['.ppt', '.pptx'] : ['.xls', '.xlsx'];
    if (!inputExts.includes(ext)) throw new UserError(`Choose a supported ${inputExts.join(' or ')} file.`);
    // Multer stores uploads under random extensionless names. Office import
    // filters rely on a recognizable filename extension, so stage a safe copy.
    const inputName = `${baseName(files[0].name)}${ext}`;
    const inputPath = path.join(ctx.scratch, inputName);
    await fs.copyFile(files[0].path, inputPath);
    try {
      const officeCommand = process.platform === 'win32'
        ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.com')
        : 'libreoffice';
      const profileUrl = pathToFileURL(path.join(ctx.scratch, 'lo-profile')).href;
      const args = [`-env:UserInstallation=${profileUrl}`, '--headless'];
      if (id === 'pdf-to-word') args.push('--infilter=writer_pdf_import');
      if (id === 'pdf-to-powerpoint') args.push('--infilter=impress_pdf_import');
      args.push('--convert-to', tool.ext, '--outdir', ctx.scratch, inputPath);
      await runBinary(officeCommand, args, 'Office conversion is unavailable on this server (LibreOffice is not installed).');
    } catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError('This file could not be converted. Check that LibreOffice supports this input and output format.');
    }
    const outName = `${baseName(files[0].name)}.${tool.ext}`;
    const outPath = path.join(ctx.scratch, outName);
    try { return [{ name: outName, data: await fs.readFile(outPath) }]; }
    catch (_) { throw new UserError('The converter could not create this output format.'); }
  });
}

handlers.set('edit-pdf', async (files, o) => {
  const text = o.text.trim();
  if (!text) throw new UserError('Enter the text to add.');
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const page of doc.getPages()) page.drawText(text, { x: 36, y: 36, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
  return [{ name: `${baseName(files[0].name)}-edited.pdf`, data: await pdfBytes(doc) }];
});

handlers.set('sign-pdf', async (files, o) => {
  const text = o.text.trim();
  if (!text) throw new UserError('Enter a signature name.');
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.TimesRomanItalic);
  for (const page of doc.getPages()) page.drawText(text, { x: 48, y: 48, size: 22, font, color: rgb(0.12, 0.2, 0.55) });
  return [{ name: `${baseName(files[0].name)}-signed.pdf`, data: await pdfBytes(doc), note: 'Typed signature added. This is not a certificate-based digital signature.' }];
});

for (const [id, mode] of [['protect-pdf', 'encrypt'], ['unlock-pdf', 'decrypt']]) {
  handlers.set(id, async (files, o, ctx) => {
    if (!o.password) throw new UserError('Enter a password.');
    const out = path.join(ctx.scratch, `${baseName(files[0].name)}-${mode === 'encrypt' ? 'protected' : 'unlocked'}.pdf`);
    const args = mode === 'encrypt'
      ? ['--encrypt', o.password, o.password, '256', '--', files[0].path, out]
      : ['--decrypt', files[0].path, out, '--password=' + o.password];
    try { await runBinary('qpdf', args, 'Password tools are unavailable on this server (qpdf is not installed).'); }
    catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError(mode === 'decrypt' ? 'Could not unlock this PDF. Check the password.' : 'Could not encrypt this PDF.');
    }
    return [{ name: path.basename(out), data: await fs.readFile(out) }];
  });
}

module.exports = { handlers };
