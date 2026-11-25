'use strict';

// Vercel serves `public` as the static output directory. The local Express
// server normally exposes this shared browser/server tool registry separately.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'public', 'shared');
fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'shared', 'tools-meta.js'),
  path.join(targetDir, 'tools-meta.js')
);
fs.copyFileSync(
  path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js'),
  path.join(root, 'public', 'vendor', 'jszip.min.js')
);
const qpdfDist = path.join(root, 'node_modules', '@neslinesli93', 'qpdf-wasm', 'dist');
fs.copyFileSync(path.join(qpdfDist, 'qpdf.js'), path.join(root, 'public', 'vendor', 'qpdf.js'));
fs.copyFileSync(path.join(qpdfDist, 'qpdf.wasm'), path.join(root, 'public', 'vendor', 'qpdf.wasm'));
const licensesDir = path.join(root, 'public', 'licenses');
fs.mkdirSync(licensesDir, { recursive: true });
fs.copyFileSync(
  path.join(root, 'node_modules', '@neslinesli93', 'qpdf-wasm', 'LICENSE'),
  path.join(licensesDir, 'qpdf-wasm-LICENSE.txt')
);
console.log('Prepared Vercel static output in public/.');
