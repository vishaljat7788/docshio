'use strict';
const { rgb } = require('pdf-lib');
const { UserError } = require('./errors');

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Parse "1-3, 5, 8-" into 0-based page indexes.
 * With keepGroups=true returns one array per comma-separated part.
 */
function parseRanges(text, total, keepGroups) {
  const clean = String(text || '').replace(/\s+/g, '');
  if (!clean) throw new UserError('Enter at least one page or range, for example 1-3,5.');
  const groups = [];
  for (const part of clean.split(',')) {
    if (!part) continue;
    const m = part.match(/^(\d{0,6})-(\d{0,6})$/) || part.match(/^(\d{1,6})$/);
    if (!m) throw new UserError(`"${part.slice(0, 20)}" is not a valid page range.`);
    let start, end;
    if (m.length === 2) {
      start = end = parseInt(m[1], 10);
    } else {
      start = m[1] === '' ? 1 : parseInt(m[1], 10);
      end = m[2] === '' ? total : parseInt(m[2], 10);
    }
    if (start < 1 || end < 1 || start > total || end > total) {
      throw new UserError(`Page range ${part} is outside this document (it has ${total} pages).`);
    }
    if (start > end) throw new UserError(`Range ${part} goes backwards.`);
    const g = [];
    for (let i = start; i <= end; i++) g.push(i - 1);
    groups.push(g);
  }
  if (!groups.length) throw new UserError('Enter at least one page or range.');
  return keepGroups ? groups : groups.flat();
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, '');
}

/** Make a user-supplied file name safe to echo back and to use inside a zip. */
function cleanName(name) {
  let n = String(name || 'file')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (!n) n = 'file';
  return n.length > 120 ? n.slice(0, 120) : n;
}

/** multer reports names as latin1; browsers send UTF-8. */
function fixEncoding(name) {
  try { return Buffer.from(String(name), 'latin1').toString('utf8'); }
  catch (e) { return String(name); }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

module.exports = { clamp, parseRanges, baseName, cleanName, fixEncoding, hexToRgb, formatSize };
