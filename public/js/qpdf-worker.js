'use strict';

importScripts('../vendor/qpdf.js');

let qpdfPromise;

async function getQpdf() {
  if (!qpdfPromise) {
    if (typeof Module !== 'function') throw new Error('The PDF security engine could not be loaded.');
    qpdfPromise = Module({
      locateFile: file => new URL(`../vendor/${file}`, self.location.href).href,
      noInitialRun: true,
      print: () => {},
      printErr: () => {}
    });
  }
  return qpdfPromise;
}

self.onmessage = async event => {
  const { id, mode, bytes, password } = event.data;
  try {
    const qpdf = await getQpdf();
    const inputPath = `/docxmaster-${id}-input.pdf`;
    const outputPath = `/docxmaster-${id}-output.pdf`;
    qpdf.FS.writeFile(inputPath, new Uint8Array(bytes));

    const args = mode === 'protect'
      ? ['--encrypt', password, password, '256', '--', inputPath, outputPath]
      : ['--decrypt', inputPath, outputPath, `--password=${password}`];
    const status = qpdf.callMain(args);
    let output;
    try { output = qpdf.FS.readFile(outputPath); }
    catch (_) { output = null; }
    if (status !== 0 || !output || !output.length) {
      throw new Error(mode === 'unlock'
        ? 'Could not unlock this PDF. Check the current password and try again.'
        : 'Could not protect this PDF. Check the file and try again.');
    }

    const result = output.slice().buffer;
    self.postMessage({ id, bytes: result }, [result]);
    qpdf.FS.unlink(inputPath);
    qpdf.FS.unlink(outputPath);
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : 'The PDF could not be processed.' });
  }
};
