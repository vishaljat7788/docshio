/*
 * Single source of truth for the tool list.
 * Loaded by the browser (window.TOOL_META) and by the server (require).
 * The server also uses `options` to validate everything the browser sends.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TOOL_META = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const groups = [
    { id: 'organize', label: 'Organize' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'photos', label: 'Photo tools' },
    { id: 'convert-to', label: 'Convert to PDF' },
    { id: 'convert-from', label: 'Convert from PDF' },
    { id: 'edit', label: 'Edit' }
  ];

  const tools = [
    { id: 'organize-pdf', title: 'Organize PDF', group: 'organize', kind: 'pdf', blurb: 'Reorder PDF pages by entering the page numbers in the order you want.', action: 'Organize PDF', options: [{ key: 'order', label: 'Page order', type: 'text', value: '1,2,3', maxLength: 2000, hint: 'Example: 3,1,2. Each page must appear once.' }] },
    { id: 'repair-pdf', title: 'Repair PDF', group: 'optimize', kind: 'pdf', blurb: 'Rewrite a damaged PDF structure when its contents can still be recovered.', action: 'Repair PDF', options: [] },
    { id: 'crop-pdf', title: 'Crop PDF', group: 'edit', kind: 'pdf', blurb: 'Crop the same margin from every page of your PDF.', action: 'Crop PDF', options: [{ key: 'margin', label: 'Margin to crop (points)', type: 'number', value: 24, min: 0, max: 300, hint: 'PDF points; 72 points equal one inch.' }] },
    { id: 'compare-pdf', title: 'Compare PDF', group: 'organize', kind: 'pdf', multiple: true, min: 2, blurb: 'Extract and compare the text in two PDF files.', action: 'Compare PDFs', options: [] },
    { id: 'pdf-to-markdown', title: 'PDF to Markdown', group: 'convert-from', kind: 'pdf', blurb: 'Extract selectable PDF text into a Markdown file.', action: 'Convert to Markdown', options: [] },
    { id: 'pdf-forms', title: 'PDF Forms', group: 'edit', kind: 'pdf', blurb: 'List interactive form fields found in a PDF.', action: 'Inspect PDF forms', options: [] },
    { id: 'ocr-pdf', title: 'OCR PDF', group: 'optimize', kind: 'pdf', blurb: 'Recognize text in scanned pages and add a searchable text layer.', action: 'Run OCR', options: [] },
    { id: 'pdf-to-pdfa', title: 'PDF to PDF/A', group: 'convert-from', kind: 'pdf', blurb: 'Convert a PDF to the PDF/A-2b archival format.', action: 'Convert to PDF/A', options: [] },
    { id: 'redact-pdf', title: 'Redact PDF', group: 'edit', kind: 'pdf', blurb: 'Permanently cover selected areas and flatten every page to remove the underlying text.', action: 'Redact PDF', options: [{ key: 'regions', label: 'Redaction areas', type: 'text', value: '', maxLength: 4000, hint: 'One per line: page,x,y,width,height in PDF points, from the bottom-left. Example: 1,72,400,180,24' }] },
    { id: 'ai-summarizer', title: 'AI Summarizer', group: 'optimize', kind: 'pdf', blurb: 'Create a short local extractive summary from selectable PDF text. Files stay on this server.', action: 'Summarize PDF', options: [{ key: 'length', label: 'Summary length', type: 'select', value: 'balanced', choices: [['short', 'Short'], ['balanced', 'Balanced'], ['detailed', 'Detailed']] }] },
    { id: 'translate-pdf', title: 'Translate PDF', group: 'convert-from', kind: 'pdf', blurb: 'Translate selectable English PDF text into Hindi with an offline server model. The output is a newly typeset PDF.', action: 'Translate to Hindi', options: [] },
    {
      id: 'merge', title: 'Merge PDF', group: 'organize', kind: 'pdf',
      blurb: 'Combine several PDFs into one, in the order you choose.',
      multiple: true, min: 2, reorder: true, action: 'Merge PDFs',
      options: []
    },
    {
      id: 'split', title: 'Split PDF', group: 'organize', kind: 'pdf',
      blurb: 'Cut a PDF into separate files by page range or one file per page.',
      multiple: false, action: 'Split PDF',
      options: [
        {
          key: 'mode', label: 'How to split', type: 'select', value: 'ranges',
          choices: [
            ['ranges', 'Custom ranges, one file per range'],
            ['single', 'Custom ranges, all in one file'],
            ['each', 'Every page as its own file']
          ]
        },
        {
          key: 'ranges', label: 'Page ranges', type: 'text', value: '1-3,5',
          hint: 'Use commas and dashes, for example 1-3,5,8-',
          showIf: o => o.mode !== 'each'
        }
      ]
    },
    {
      id: 'remove', title: 'Remove pages', group: 'organize', kind: 'pdf',
      blurb: 'Delete the pages you do not need and keep the rest.',
      multiple: false, action: 'Remove pages',
      options: [
        { key: 'pages', label: 'Pages to remove', type: 'text', value: '2', hint: 'For example 2,4-6' }
      ]
    },
    {
      id: 'rotate', title: 'Rotate PDF', group: 'organize', kind: 'pdf',
      blurb: 'Turn all pages, or only some, by 90, 180 or 270 degrees.',
      multiple: false, action: 'Rotate PDF',
      options: [
        {
          key: 'angle', label: 'Rotate clockwise by', type: 'select', value: '90',
          choices: [['90', '90 degrees'], ['180', '180 degrees'], ['270', '270 degrees']]
        },
        {
          key: 'scope', label: 'Pages', type: 'select', value: 'all',
          choices: [['all', 'All pages'], ['custom', 'Only some pages']]
        },
        {
          key: 'pages', label: 'Which pages', type: 'text', value: '1', hint: 'For example 1,3-5',
          showIf: o => o.scope === 'custom'
        }
      ]
    },
    {
      id: 'jpg-to-pdf', title: 'Images to PDF', group: 'convert-to', kind: 'image',
      blurb: 'Turn JPG, PNG, WebP or GIF images into one PDF.',
      multiple: true, min: 1, reorder: true, action: 'Create PDF',
      options: [
        {
          key: 'size', label: 'Page size', type: 'select', value: 'fit',
          choices: [['fit', 'Same as image'], ['a4', 'A4'], ['letter', 'US Letter']]
        },
        {
          key: 'orientation', label: 'Orientation', type: 'select', value: 'auto',
          choices: [['auto', 'Automatic'], ['portrait', 'Portrait'], ['landscape', 'Landscape']],
          showIf: o => o.size !== 'fit'
        },
        {
          key: 'margin', label: 'Margin', type: 'select', value: '0',
          choices: [['0', 'None'], ['18', 'Small'], ['36', 'Medium']],
          showIf: o => o.size !== 'fit'
        }
      ]
    },
    {
      id: 'pdf-to-jpg', title: 'PDF to JPG', group: 'convert-from', kind: 'pdf',
      blurb: 'Save every page of a PDF as a JPG image.',
      multiple: false, action: 'Convert to JPG',
      options: [
        {
          key: 'quality', label: 'Image quality', type: 'select', value: 'high',
          choices: [['standard', 'Standard (smaller files)'], ['high', 'High'], ['max', 'Maximum']]
        }
      ]
    },
    {
      id: 'compress', title: 'Compress PDF', group: 'optimize', kind: 'pdf',
      blurb: 'Reduce the file size of your PDF and keep the text selectable.',
      multiple: false, action: 'Compress PDF',
      options: [
        {
          key: 'goal', label: 'Compression goal', type: 'select', value: 'quality',
          choices: [
            ['quality', 'Choose compression level'],
            ['target', 'Set target file size']
          ]
        },
        {
          key: 'level', label: 'Compression level', type: 'select', value: 'medium',
          showIf: options => options.goal === 'quality',
          choices: [
            ['light', 'Light (best quality)'],
            ['medium', 'Medium'],
            ['strong', 'Strong (smallest file)']
          ]
        },
        { key: 'targetSize', label: 'Target size', type: 'number', value: 200, min: 0.1, max: 500, step: 'any', showIf: options => options.goal === 'target', hint: 'Best effort; very small targets may reduce image quality.' },
        {
          key: 'targetUnit', label: 'Size unit', type: 'select', value: 'kb',
          showIf: options => options.goal === 'target',
          choices: [['kb', 'KB'], ['mb', 'MB']]
        }
      ]
    },
    {
      id: 'watermark', title: 'Add watermark', group: 'edit', kind: 'pdf',
      blurb: 'Stamp text such as DRAFT or CONFIDENTIAL across every page.',
      multiple: false, action: 'Add watermark',
      options: [
        { key: 'text', label: 'Watermark text', type: 'text', value: 'CONFIDENTIAL', maxLength: 60, hint: 'English letters, numbers and common symbols only' },
        { key: 'size', label: 'Font size', type: 'number', value: 60, min: 10, max: 200 },
        { key: 'opacity', label: 'Opacity (%)', type: 'number', value: 25, min: 5, max: 100 },
        { key: 'angle', label: 'Angle (degrees)', type: 'number', value: 45, min: 0, max: 360 },
        { key: 'color', label: 'Colour', type: 'color', value: '#888888' }
      ]
    },
    {
      id: 'page-numbers', title: 'Page numbers', group: 'edit', kind: 'pdf',
      blurb: 'Add page numbers to every page of your PDF.',
      multiple: false, action: 'Add page numbers',
      options: [
        {
          key: 'position', label: 'Position', type: 'select', value: 'bottom-center',
          choices: [
            ['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'],
            ['top-center', 'Top centre'], ['top-right', 'Top right'], ['top-left', 'Top left']
          ]
        },
        {
          key: 'format', label: 'Format', type: 'select', value: 'n',
          choices: [['n', '1, 2, 3'], ['page-n', 'Page 1'], ['n-of-total', '1 of 10'], ['page-n-of-total', 'Page 1 of 10']]
        },
        { key: 'start', label: 'Start numbering at', type: 'number', value: 1, min: 0, max: 9999 },
        { key: 'size', label: 'Font size', type: 'number', value: 11, min: 6, max: 36 }
      ]
    },
    { id: 'pdf-to-word', title: 'PDF to Word', group: 'convert-from', kind: 'office', accept: '.pdf,application/pdf', ext: 'docx', sourceExt: 'pdf', blurb: 'Convert a PDF to an editable Word document.', action: 'Convert to Word', options: [] },
    { id: 'pdf-to-powerpoint', title: 'PDF to PowerPoint', group: 'convert-from', kind: 'office', accept: '.pdf,application/pdf', ext: 'pptx', sourceExt: 'pdf', blurb: 'Convert a PDF into PowerPoint slides.', action: 'Convert to PowerPoint', options: [] },
    { id: 'pdf-to-excel', title: 'PDF to Excel', group: 'convert-from', kind: 'office', accept: '.pdf,application/pdf', ext: 'xlsx', sourceExt: 'pdf', blurb: 'Convert PDF tables into an Excel workbook.', action: 'Convert to Excel', options: [] },
    { id: 'word-to-pdf', title: 'Word to PDF', group: 'convert-to', kind: 'office', accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'pdf', sourceExt: 'docx', blurb: 'Convert Word documents to PDF.', action: 'Convert to PDF', options: [] },
    { id: 'powerpoint-to-pdf', title: 'PowerPoint to PDF', group: 'convert-to', kind: 'office', accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pdf', sourceExt: 'pptx', blurb: 'Convert presentations to PDF.', action: 'Convert to PDF', options: [] },
    { id: 'excel-to-pdf', title: 'Excel to PDF', group: 'convert-to', kind: 'office', accept: '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'pdf', sourceExt: 'xlsx', blurb: 'Convert spreadsheets to PDF.', action: 'Convert to PDF', options: [] },
    { id: 'html-to-pdf', title: 'HTML to PDF', group: 'convert-to', kind: 'html', accept: '.html,.htm,text/html', ext: 'pdf', sourceExt: 'html', blurb: 'Convert an HTML file to a PDF document.', action: 'Convert to PDF', options: [] },
    { id: 'edit-pdf', title: 'Edit PDF', group: 'edit', kind: 'pdf', accept: '.pdf,application/pdf', blurb: 'Add a text annotation to every page of a PDF.', action: 'Add text', options: [{ key: 'text', label: 'Text to add', type: 'text', value: 'Your note', maxLength: 100 }] },
    { id: 'sign-pdf', title: 'Sign PDF', group: 'edit', kind: 'pdf', accept: '.pdf,application/pdf', blurb: 'Add a typed signature to every page. This is not a digital certificate signature.', action: 'Add signature', options: [{ key: 'text', label: 'Signature', type: 'text', value: 'Your Name', maxLength: 60 }] },
    { id: 'protect-pdf', title: 'Protect PDF', group: 'edit', kind: 'pdf', accept: '.pdf,application/pdf', blurb: 'Encrypt a PDF with a password using qpdf.', action: 'Protect PDF', options: [{ key: 'password', label: 'Password', type: 'password', value: '', maxLength: 100 }] },
    { id: 'unlock-pdf', title: 'Unlock PDF', group: 'edit', kind: 'pdf', accept: '.pdf,application/pdf', blurb: 'Remove a password from a PDF you are authorized to access using qpdf.', action: 'Unlock PDF', options: [{ key: 'password', label: 'Current password', type: 'password', value: '', maxLength: 100 }] },
    { id: 'photo-resizer', title: 'Photo Resizer', group: 'photos', kind: 'image', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Resize a photo to the exact pixel dimensions you need.', action: 'Resize photo', options: [
      { key: 'width', label: 'Width (pixels)', type: 'number', value: 800, min: 1, max: 5000 },
      { key: 'height', label: 'Height (pixels)', type: 'number', value: 800, min: 1, max: 5000 },
      { key: 'fit', label: 'Fit', type: 'select', value: 'cover', choices: [['cover', 'Crop to fill'], ['contain', 'Fit inside with padding'], ['fill', 'Stretch to exact size']] },
      { key: 'format', label: 'Output format', type: 'select', value: 'jpeg', choices: [['jpeg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']] }
    ] },
    { id: 'signature-resizer', title: 'Signature Resizer', group: 'photos', kind: 'image', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Resize a scanned signature and keep its transparent background when available.', action: 'Resize signature', options: [
      { key: 'width', label: 'Width (pixels)', type: 'number', value: 400, min: 1, max: 3000 },
      { key: 'height', label: 'Height (pixels)', type: 'number', value: 150, min: 1, max: 3000 },
      { key: 'format', label: 'Output format', type: 'select', value: 'png', choices: [['png', 'PNG (transparent)'], ['jpeg', 'JPG'], ['webp', 'WebP']] }
    ] },
    { id: 'photo-background-remover', title: 'Photo Background Remover', group: 'photos', kind: 'image', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Separate a centered subject from its background. Works best when the full subject is visible and stands out from the background.', action: 'Remove background', options: [
      { key: 'detail', label: 'Segmentation detail', type: 'select', value: '5', choices: [['3', 'Quick'], ['5', 'Balanced'], ['7', 'More edge detail']] }
    ] },
    { id: 'passport-photo-maker', title: 'Passport Photo Maker', group: 'photos', kind: 'image', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Crop a portrait to a common passport photo size with a clean white background.', action: 'Make passport photo', options: [
      { key: 'size', label: 'Photo size', type: 'select', value: '35x45', choices: [['35x45', '35 × 45 mm (413 × 531 px)'], ['2x2', '2 × 2 in (600 × 600 px)'], ['custom', 'Custom pixels']] },
      { key: 'width', label: 'Width (pixels)', type: 'number', value: 413, min: 100, max: 1200, showIf: o => o.size === 'custom' },
      { key: 'height', label: 'Height (pixels)', type: 'number', value: 531, min: 100, max: 1600, showIf: o => o.size === 'custom' }
    ] },
    { id: 'image-to-kb', title: 'Image to 20KB / 50KB', group: 'photos', kind: 'image', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Compress a photo to a 20 KB or 50 KB maximum JPG file size.', action: 'Compress image', options: [
      { key: 'target', label: 'Maximum file size', type: 'select', value: '50', choices: [['20', '20 KB'], ['50', '50 KB']] }
    ] },
    { id: 'photo-signature-combiner', title: 'Photo & Signature Combiner', group: 'photos', kind: 'image', multiple: true, min: 2, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', blurb: 'Place a portrait photo beside your signature on one white image.', action: 'Combine photo & signature', options: [
      { key: 'width', label: 'Canvas width (pixels)', type: 'select', value: '900', choices: [['600', '600 px'], ['900', '900 px'], ['1200', '1200 px']] }
    ] }
  ];

  return { groups, tools };
});
