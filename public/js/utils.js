/* Browser helpers: thumbnails, PDF previews and client-side PDF-to-JPG conversion. */
(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const Utils = {
    formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    },

    readBuffer(file) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read ' + file.name));
        r.readAsArrayBuffer(file);
      });
    },

    async loadPdfJs(file) {
      const buf = await Utils.readBuffer(file);
      try {
        // isEvalSupported:false closes a known pdf.js script-injection hole (CVE-2024-4367).
        return await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
      } catch (e) {
        if (e && e.name === 'PasswordException') {
          throw new Error('Password protected');
        }
        throw new Error('Could not preview this file');
      }
    },

    async renderThumb(pdfjsDoc, scale) {
      const page = await pdfjsDoc.getPage(1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const url = canvas.toDataURL('image/jpeg', 0.7);
      canvas.width = canvas.height = 0;
      return url;
    },

    async convertPdfToJpg(file, quality, onProgress) {
      const pdf = await Utils.loadPdfJs(file);
      const totalPages = pdf.numPages;
      const settings = {
        standard: { dpi: 100, quality: 0.72 },
        high: { dpi: 150, quality: 0.84 },
        max: { dpi: 220, quality: 0.92 }
      }[quality] || { dpi: 150, quality: 0.84 };
      const pageCount = Math.min(pdf.numPages, 200);
      const baseName = file.name.replace(/\.pdf$/i, '') || 'document';
      const files = [];

      try {
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: settings.dpi / 72 });
          const width = Math.ceil(viewport.width);
          const height = Math.ceil(viewport.height);
          if (width * height > 100000000) throw new Error(`Page ${i} is too large to render in this browser.`);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('This browser could not create an image canvas.');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, width, height);
            await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
            const blob = await new Promise((resolve, reject) => canvas.toBlob(
              value => value ? resolve(value) : reject(new Error(`Could not create JPG for page ${i}.`)),
              'image/jpeg',
              settings.quality
            ));
            files.push({ name: `${baseName}-page-${i}.jpg`, blob, size: blob.size });
          } finally {
            canvas.width = canvas.height = 0;
            page.cleanup();
          }
          if (onProgress) onProgress(i / pageCount, `Converting page ${i} of ${pageCount}`);
        }
      } finally {
        await pdf.destroy();
      }

      return {
        files,
        note: totalPages > pageCount ? `Only the first ${pageCount} pages were converted.` : ''
      };
    },

    async runQpdf(file, mode, password) {
      const bytes = await Utils.readBuffer(file);
      return new Promise((resolve, reject) => {
        const worker = new Worker('js/qpdf-worker.js');
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const finish = (fn, value) => {
          worker.terminate();
          fn(value);
        };
        worker.onmessage = event => {
          if (event.data.id !== id) return;
          if (event.data.error) return finish(reject, new Error(event.data.error));
          finish(resolve, event.data.bytes);
        };
        worker.onerror = () => finish(reject, new Error('The PDF security engine failed to start. Please try again.'));
        worker.postMessage({ id, mode, bytes, password }, [bytes]);
      });
    }
  };

  window.Utils = Utils;
})();
