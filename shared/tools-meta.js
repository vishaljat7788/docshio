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
    { id: 'convert-to', label: 'Convert to PDF' },
    { id: 'convert-from', label: 'Convert from PDF' },
    { id: 'edit', label: 'Edit' }
  ];

  const tools = [
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
    { id: 'unlock-pdf', title: 'Unlock PDF', group: 'edit', kind: 'pdf', accept: '.pdf,application/pdf', blurb: 'Remove a password from a PDF you are authorized to access using qpdf.', action: 'Unlock PDF', options: [{ key: 'password', label: 'Current password', type: 'password', value: '', maxLength: 100 }] }
  ];

  return { groups, tools };
});
