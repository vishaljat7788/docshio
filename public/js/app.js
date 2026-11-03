/* UI: hash routing, home grid, tool screen. Files are sent to the Node server for processing. */
(function () {
  const U = window.Utils;
  const TOOLS = window.TOOL_META.tools;
  const GROUPS = window.TOOL_META.groups;
  const PAGES = {
    about: { title: 'About Us', description: 'Learn about Docshio and the tools we build.' },
    terms: { title: 'Terms & Conditions', description: 'The terms for using Docshio PDF tools.' },
    privacy: { title: 'Privacy Policy', description: 'What happens to files and information you share with Docshio.' },
    faq: { title: 'Frequently Asked Questions', description: 'Quick answers about using Docshio.' },
    contact: { title: 'Contact Us', description: 'Get help with Docshio and PDF processing.' }
  };
  const SUPPORT_EMAIL = 'pagewise@gmail.com';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  let toastTimer;
  const navToggle = document.getElementById('nav-toggle');
  const siteNav = document.getElementById('site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') !== 'true';
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      siteNav.classList.toggle('open', open);
    });
    siteNav.addEventListener('click', e => {
      if (!e.target.closest('a')) return;
      siteNav.querySelectorAll('details[open]').forEach(menu => { menu.open = false; });
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Open navigation');
    });
    document.addEventListener('click', e => {
      const target = e.target;
      siteNav.querySelectorAll('details[open]').forEach(menu => {
        if (!menu.contains(target)) menu.open = false;
      });
      if (!siteNav.contains(target) && !navToggle.contains(target) && siteNav.classList.contains('open')) {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open navigation');
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const search = document.getElementById('tool-search');
    if (search) { e.preventDefault(); search.focus(); }
  });

  const ICONS = {
    'merge': '<path d="M5 4h6v6H5zM13 14h6v6h-6zM8 10v3a3 3 0 0 0 3 3h2"/>',
    'split': '<path d="M12 3v18M4 8l4-4 4 4M20 16l-4 4-4-4"/>',
    'remove': '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    'rotate': '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
    'jpg-to-pdf': '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    'pdf-to-jpg': '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 17l2-3 2 2 2-3"/>',
    'compress': '<path d="M12 3v7M9 7l3 3 3-3M12 21v-7M9 17l3-3 3 3M4 12h16"/>',
    'watermark': '<path d="M4 18L18 4M7 20l13-13M3 14L14 3"/>',
    'page-numbers': '<path d="M6 3h12v18H6zM10 17h4"/>',
    'pdf-to-word': '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
    'pdf-to-powerpoint': '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4"/>',
    'pdf-to-excel': '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6M12 12v7"/>',
    'word-to-pdf': '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12l1 5 2-4 2 4 1-5"/>',
    'powerpoint-to-pdf': '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 17v-5h2a1.5 1.5 0 0 1 0 3h-2"/>',
    'excel-to-pdf': '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12l4 5M14 12l-4 5"/>',
    'html-to-pdf': '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 6l-4 12"/>',
    'edit-pdf': '<path d="m4 16 10-10 4 4L8 20H4zM12 8l4 4M4 20h16"/>',
    'sign-pdf': '<path d="M4 18c3-5 4-7 5-6s-1 5 1 5 3-6 4-6 0 5 2 5c1 0 2-1 4-2M5 21h14"/>',
    'protect-pdf': '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
    'unlock-pdf': '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2M12 14v3"/>'
  };

  function icon(id) {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ''}</svg>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }

  /* ------------------------------------------------------------ routing */
  function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const tool = TOOLS.find(t => t.id === id);
    const page = PAGES[id];
    if (tool) renderTool(tool); else if (page) renderInfoPage(id, page); else renderHome();
    window.scrollTo(0, 0);
    document.title = tool ? `${tool.title} – Docshio` : page ? `${page.title} – Docshio` : 'Docshio – free online PDF tools';
    document.querySelectorAll('.site-nav a').forEach(link => {
      const current = link.getAttribute('href') === `#/${id}`;
      link.classList.toggle('current', current);
      if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.site-nav .nav-dropdown').forEach(menu => {
      menu.classList.toggle('has-current', Boolean(menu.querySelector(`a[href="#/${CSS.escape(id)}"]`)));
    });
  }

  function renderInfoPage(id, page) {
    const content = {
      about: `<section class="info-card"><span class="info-eyebrow">ABOUT DOCSHIO</span><h2>PDF tasks, made simpler.</h2><p>Docshio brings everyday PDF tools together in one straightforward place. Merge, split, convert, compress and edit documents from your browser.</p><p>Choose a tool, add your file, and download the result when processing is complete. No account is needed.</p><div class="info-callout"><b>Built around your files</b><span>Files are processed by the Docshio server and scheduled for deletion after the retention period shown on this site.</span></div><a class="go info-cta" href="#/">Explore all tools</a></section>`,
      terms: `<section class="info-card"><span class="info-eyebrow">LAST UPDATED: OCTOBER 30, 2026</span><h2>Using Docshio</h2><p>By using Docshio, you agree to these terms. If you do not agree, please do not use the service.</p><h3>Your files and permissions</h3><p>Only upload files you own or have permission to process. You are responsible for the files you upload and for checking that downloaded results are suitable for your needs.</p><h3>Service and results</h3><p>Docshio provides PDF processing tools as available. Conversion results can vary with the file, its formatting, and the software used. Some tools may be unavailable when a required server component is not installed or is temporarily offline.</p><h3>Acceptable use</h3><p>Do not use Docshio to violate another person's rights, upload files unlawfully, interfere with the service, or attempt to access another person's files or download links.</p><h3>Availability and changes</h3><p>Tools may change or become unavailable. We may update these terms when the service changes. Continued use after an update means you accept the revised terms.</p><h3>Contact</h3><p>Questions about these terms? <a href="#/contact">Contact Docshio</a>.</p></section>`,
      privacy: `<section class="info-card"><span class="info-eyebrow">LAST UPDATED: OCTOBER 30, 2026</span><h2>Your files stay yours.</h2><p>This policy explains what Docshio handles when you use its PDF tools.</p><h3>Files you upload</h3><p>When you run most tools, your selected files are sent to the Docshio server for processing. PDF to JPG, Protect PDF and Unlock PDF run in your browser, so those PDFs stay on your device. Server uploads are removed after processing. Downloadable results are kept temporarily and are scheduled for deletion after 30 minutes by default. The retention period may be changed by the site operator.</p><h3>Technical information</h3><p>Docshio does not require an account. The server applies request limits by IP address to protect the service. This rate-limit information is held in server memory. The site does not use advertising or analytics trackers.</p><h3>How files are processed</h3><p>Processing happens on the Docshio server using its installed PDF and document tools. Files are not intentionally sent to an external conversion service.</p><h3>Your choices</h3><p>Do not upload a file if you are not comfortable having it temporarily processed by this server. Download your result before its link expires.</p><h3>Questions</h3><p>For privacy questions, <a href="#/contact">contact Docshio</a>.</p></section>`,
      faq: `<section class="info-card faq-card"><span class="info-eyebrow">HELP CENTER</span><h2>Frequently asked questions</h2><details><summary>Are Docshio tools free to use?</summary><p>There is no account requirement. Tools are available through this website, subject to its file size and request limits.</p></details><details><summary>How long are my files kept?</summary><p>Temporary uploads are removed after processing. Download links expire after 30 minutes by default, when output files are scheduled for deletion.</p></details><details><summary>Why did a conversion fail?</summary><p>Some conversions need additional software on the server, and complex layouts may not convert perfectly. Try a smaller or unlocked file, or choose another available format.</p></details><details><summary>Can I use Docshio on my phone?</summary><p>Yes. The site layout adapts to mobile screens. You can choose a file from your device or drag and drop one on supported browsers.</p></details><details><summary>Can I recover an expired download?</summary><p>Expired results are removed. Run the tool again with your original file to create a new download.</p></details><details><summary>How do I get help?</summary><p>Visit the <a href="#/contact">Contact Us</a> page.</p></details></section>`,
      contact: `<section class="info-card contact-card"><span class="info-eyebrow">WE'RE HERE TO HELP</span><h2>Contact Docshio</h2><p>Need help with a tool or have feedback? Send a message and include the tool name and a short description of what happened. Please do not send passwords or sensitive documents.</p><div class="contact-placeholder"><span class="contact-icon">✉</span><span><b>Email support</b><a href="mailto:${SUPPORT_EMAIL}?subject=Docshio%20support">${SUPPORT_EMAIL}</a></span></div><a class="ghost" href="#/faq">Browse frequently asked questions</a></section>`
    }[id];
    app.innerHTML = `<div class="info-page"><a class="back" href="#/">All tools</a><header class="info-header"><span class="info-badge">DOCSHIO</span><h1>${esc(page.title)}</h1><p>${esc(page.description)}</p></header>${content}</div>`;
  }

  /* ------------------------------------------------------------ home */
  function renderHome() {
    const groups = GROUPS.map(g => {
      const items = TOOLS.filter(t => t.group === g.id);
      if (!items.length) return '';
      return `
        <section class="group group-${g.id}" id="group-${g.id}">
          <div class="group-heading"><div><span class="group-kicker">DOCSHIO TOOLS</span><h2>${g.label}</h2></div><span class="group-count">${items.length} tools</span></div>
          <div class="tiles">
            ${items.map(t => `
              <a class="tile" href="#/${t.id}">
                <span class="tile-top"><span class="tile-icon">${icon(t.id)}</span><span class="tile-arrow" aria-hidden="true">&#8599;</span></span>
                <span class="tile-title">${esc(t.title)}</span>
                <span class="tile-blurb">${esc(t.blurb)}</span>
              </a>`).join('')}
          </div>
        </section>`;
    }).join('');

    app.innerHTML = `
      <section class="hero">
        <span class="hero-badge"><span class="badge-dot"></span> YOUR EVERYDAY PDF TOOLKIT</span>
        <h1>Everything you need to work with <span>PDFs.</span></h1>
        <p>Simple tools to merge, convert, compress and edit your documents. Choose a tool and get it done in a few clicks.</p>
        <label class="tool-search"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg><input id="tool-search" type="search" placeholder="Search PDF tools..." autocomplete="off" aria-label="Search PDF tools"><kbd>/</kbd></label>
        <div class="hero-trust"><span><b>✓</b> Fast and easy</span><span><b>✓</b> Files auto-deleted</span><span><b>✓</b> No account needed</span></div>
      </section>
      <div class="tool-directory" id="tool-directory">${groups}<p class="no-tools" id="no-tools" hidden>No tools match that search. Try another name.</p></div>`;

    const search = app.querySelector('#tool-search');
    const sections = [...app.querySelectorAll('.group')];
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      sections.forEach(section => {
        const cards = [...section.querySelectorAll('.tile')];
        let inGroup = 0;
        cards.forEach(card => {
          const match = !query || card.textContent.toLowerCase().includes(query);
          card.hidden = !match;
          if (match) inGroup++, visible++;
        });
        section.hidden = !inGroup;
      });
      app.querySelector('#no-tools').hidden = visible > 0;
    });
    search.addEventListener('keydown', e => {
      if (e.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); }
    });
  }

  /* ------------------------------------------------------------ tool screen */
  function renderTool(tool) {
    const state = { files: [], opts: {}, busy: false, job: null, localUrls: [], zipUrl: null };
    tool.options.forEach(o => { state.opts[o.key] = o.value; });
    const isPdf = tool.kind === 'pdf';
    const accept = tool.accept || (isPdf ? '.pdf,application/pdf' : '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif');

    app.innerHTML = `
      <div class="tool">
        <a class="back" href="#/">All tools</a>
        <h1>${esc(tool.title)}</h1>
        <p class="lede">${esc(tool.blurb)}</p>
        <div class="workspace">
          <div class="left">
            <div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose files">
              <strong>${tool.multiple ? 'Choose files' : 'Choose a file'}</strong>
              <span>or drop ${tool.multiple ? 'them' : 'it'} here</span>
              <input type="file" id="picker" hidden accept="${accept}" ${tool.multiple ? 'multiple' : ''}>
            </div>
            <ul class="files" id="files"></ul>
          </div>
          <aside class="right">
            <div id="options"></div>
            <button class="go" id="go" disabled>${esc(tool.action)}</button>
            <div class="progress" id="progress" hidden>
              <div class="bar-track" id="bartrack"><div class="bar-fill" id="barfill"></div></div>
              <span id="progresstext"></span>
            </div>
            <p class="error" id="error" role="alert" hidden></p>
          </aside>
        </div>
        <section class="results" id="results" hidden></section>
      </div>`;

    const drop = app.querySelector('#drop');
    const picker = app.querySelector('#picker');
    const listEl = app.querySelector('#files');
    const optsEl = app.querySelector('#options');
    const goBtn = app.querySelector('#go');
    const errEl = app.querySelector('#error');
    const progEl = app.querySelector('#progress');
    const track = app.querySelector('#bartrack');
    const fill = app.querySelector('#barfill');
    const progText = app.querySelector('#progresstext');
    const resultsEl = app.querySelector('#results');

    /* ---- file intake */
    drop.addEventListener('click', () => picker.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } });
    picker.addEventListener('change', () => { addFiles([...picker.files]); picker.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));

    function accepted(file) {
      if (isPdf) return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (tool.kind === 'office' || tool.kind === 'html') return tool.accept.split(',').some(x => x.startsWith('.') && file.name.toLowerCase().endsWith(x));
      return /^image\/(jpeg|png|webp|gif)$/.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    }

    function addFiles(list) {
      showError('');
      clearResults();
      const ok = list.filter(accepted);
      if (ok.length < list.length) toast('Some files were skipped because they are the wrong type.');
      if (!ok.length) return;
      if (!tool.multiple) releaseThumbs(), state.files = [];
      for (const file of ok) {
        const item = { file, id: Math.random().toString(36).slice(2), pages: null, thumb: null };
        state.files.push(item);
        makeThumb(item);
      }
      renderFiles();
    }

    function releaseThumbs() {
      state.files.forEach(f => { if (f.thumb && f.thumb.startsWith('blob:')) URL.revokeObjectURL(f.thumb); });
    }

    async function makeThumb(item) {
      try {
        if (isPdf) {
          const doc = await U.loadPdfJs(item.file);
          item.pages = doc.numPages;
          item.thumb = await U.renderThumb(doc, 0.35);
        } else if (tool.kind !== 'image') {
          item.thumbLabel = item.file.name.split('.').pop().slice(0, 4).toUpperCase();
        } else {
          item.thumb = URL.createObjectURL(item.file);
        }
      } catch (e) {
        item.thumbError = e.message;
      }
      renderFiles();
    }

    /* ---- file list */
    function renderFiles() {
      listEl.innerHTML = state.files.map((f, i) => `
        <li class="file" data-id="${f.id}">
          <span class="thumb">${f.thumb ? `<img src="${f.thumb}" alt="">` : (f.thumbLabel ? `<span class="thumb-label">${esc(f.thumbLabel)}</span>` : (f.thumbError ? '' : '<span class="thumb-wait"></span>'))}</span>
          <span class="meta">
            <span class="fname">${esc(f.file.name)}</span>
            <span class="fsub">${U.formatSize(f.file.size)}${f.pages ? ` Â· ${f.pages} page${f.pages > 1 ? 's' : ''}` : ''}${f.thumbError ? ` Â· <em class="bad">${esc(f.thumbError)}</em>` : ''}</span>
          </span>
          <span class="file-actions">
            ${tool.reorder ? `
              <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&#8593;</button>
              <button class="icon-btn" data-act="down" ${i === state.files.length - 1 ? 'disabled' : ''} aria-label="Move down">&#8595;</button>` : ''}
            <button class="icon-btn" data-act="remove" aria-label="Remove ${esc(f.file.name)}">&#10005;</button>
          </span>
        </li>`).join('');
      updateGo();
    }

    listEl.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('.file').dataset.id;
      const i = state.files.findIndex(f => f.id === id);
      const act = btn.dataset.act;
      if (act === 'remove') {
        const [r] = state.files.splice(i, 1);
        if (r.thumb && r.thumb.startsWith('blob:')) URL.revokeObjectURL(r.thumb);
      } else if (act === 'up' && i > 0) {
        [state.files[i - 1], state.files[i]] = [state.files[i], state.files[i - 1]];
      } else if (act === 'down' && i < state.files.length - 1) {
        [state.files[i + 1], state.files[i]] = [state.files[i], state.files[i + 1]];
      }
      clearResults();
      renderFiles();
    });

    /* ---- options */
    function renderOptions() {
      optsEl.innerHTML = tool.options
        .filter(o => !o.showIf || o.showIf(state.opts))
        .map(o => {
          const id = 'opt-' + o.key;
          let control;
          if (o.type === 'select') {
            control = `<select id="${id}" data-key="${o.key}">${o.choices.map(([v, l]) =>
              `<option value="${esc(v)}" ${String(state.opts[o.key]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
          } else if (o.type === 'number') {
            control = `<input id="${id}" data-key="${o.key}" type="number" value="${esc(state.opts[o.key])}" min="${o.min ?? ''}" max="${o.max ?? ''}" step="${o.step ?? '1'}">`;
          } else if (o.type === 'color') {
            control = `<input id="${id}" data-key="${o.key}" type="color" value="${esc(state.opts[o.key])}">`;
          } else {
            control = `<input id="${id}" data-key="${o.key}" type="${o.type === 'password' ? 'password' : 'text'}" value="${esc(state.opts[o.key])}" autocomplete="${o.type === 'password' ? 'new-password' : 'off'}" ${o.maxLength ? `maxlength="${o.maxLength}"` : ''}>`;
          }
          return `<div class="field"><label for="${id}">${esc(o.label)}</label>${control}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</div>`;
        }).join('');
    }

    optsEl.addEventListener('input', e => {
      const key = e.target.dataset.key;
      if (!key) return;
      state.opts[key] = e.target.value;
      clearResults();
    });
    optsEl.addEventListener('change', e => {
      if (!e.target.dataset.key) return;
      if (tool.options.some(o => o.showIf)) {
        const active = document.activeElement && document.activeElement.id;
        renderOptions();
        if (active) { const el = document.getElementById(active); if (el) el.focus(); }
      }
    });

    function updateGo() {
      const min = tool.min || 1;
      goBtn.disabled = state.busy || state.files.length < min;
      goBtn.textContent = state.files.length && state.files.length < min
        ? `Add ${min - state.files.length} more file${min - state.files.length > 1 ? 's' : ''}`
        : tool.action;
    }

    /* ---- run: upload to the server */
    function upload() {
      return new Promise((resolve, reject) => {
        const form = new FormData();
        state.files.forEach(f => form.append('files', f.file, f.file.name));
        form.append('options', JSON.stringify(state.opts));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/tools/${encodeURIComponent(tool.id)}`);
        xhr.responseType = 'json';
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setProgress(e.loaded / e.total * 0.8, 'Uploading');
        };
        xhr.upload.onload = () => setProgress(null, 'Processing');
        xhr.onerror = () => reject(new Error('Could not reach the server. Check your connection and try again.'));
        xhr.ontimeout = () => reject(new Error('The server took too long to respond.'));
        xhr.timeout = 5 * 60 * 1000;
        xhr.onload = () => {
          const body = xhr.response;
          if (xhr.status >= 200 && xhr.status < 300 && body && body.token) return resolve(body);
          reject(new Error((body && body.error) || `The server returned an error (${xhr.status}).`));
        };
        xhr.send(form);
      });
    }

    goBtn.addEventListener('click', async () => {
      showError('');
      clearResults();
      state.busy = true;
      updateGo();
      progEl.hidden = false;
      setProgress(0, 'Uploading');
      try {
        if (tool.id === 'pdf-to-jpg') {
          setProgress(0, 'Preparing PDF');
          const result = await U.convertPdfToJpg(state.files[0].file, state.opts.quality, setProgress);
          showLocalResults(result, {
            singleTitle: 'Your JPG is ready',
            pluralTitle: 'JPG images are ready',
            footer: 'Converted in your browser. Your PDF stays on this device.'
          });
        } else if (tool.id === 'protect-pdf' || tool.id === 'unlock-pdf') {
          const password = String(state.opts.password || '');
          if (!password) throw new Error(tool.id === 'protect-pdf' ? 'Enter a password.' : 'Enter the current password.');
          setProgress(0, tool.id === 'protect-pdf' ? 'Encrypting PDF' : 'Unlocking PDF');
          const original = state.files[0].file;
          const baseName = original.name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'document';
          const mode = tool.id === 'protect-pdf' ? 'protect' : 'unlock';
          const bytes = await U.runQpdf(original, mode, password);
          const outputName = `${baseName}-${mode === 'protect' ? 'protected' : 'unlocked'}.pdf`;
          showLocalResults({
            files: [{ name: outputName, blob: new Blob([bytes], { type: 'application/pdf' }), size: bytes.byteLength }],
            note: mode === 'protect' ? 'Protected with 256-bit AES encryption.' : 'Password protection removed.'
          }, {
            singleTitle: mode === 'protect' ? 'Your protected PDF is ready' : 'Your unlocked PDF is ready',
            footer: 'Processed in your browser. Your PDF stays on this device.',
            includeZip: false
          });
        } else {
          const job = await upload();
          state.job = job;
          showResults(job);
        }
      } catch (err) {
        showError(err.message || 'Something went wrong.');
      } finally {
        state.busy = false;
        progEl.hidden = true;
        updateGo();
      }
    });

    function setProgress(frac, text) {
      if (frac === null) {
        track.classList.add('indeterminate');
      } else {
        track.classList.remove('indeterminate');
        fill.style.width = Math.round(frac * 100) + '%';
      }
      progText.textContent = text || '';
    }

    function showError(msg) {
      errEl.hidden = !msg;
      errEl.textContent = msg || '';
    }

    function clearResults() {
      state.localUrls.forEach(url => URL.revokeObjectURL(url));
      state.localUrls = [];
      if (state.zipUrl) URL.revokeObjectURL(state.zipUrl);
      state.zipUrl = null;
      resultsEl.hidden = true;
      resultsEl.innerHTML = '';
    }

    async function showLocalResults(result, view = {}) {
      const total = result.files.reduce((sum, file) => sum + file.size, 0);
      const files = result.files.map(file => {
        const url = URL.createObjectURL(file.blob);
        state.localUrls.push(url);
        return { ...file, url };
      });
      if (view.includeZip !== false) {
        try {
          const zip = new JSZip();
          files.forEach(file => zip.file(file.name, file.blob));
          const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          state.zipUrl = URL.createObjectURL(zipBlob);
        } catch (_) {
          state.zipUrl = null;
        }
      }
      resultsEl.hidden = false;
      resultsEl.innerHTML = `
        <h2>${files.length === 1 ? esc(view.singleTitle || 'Your file is ready') : `${files.length} ${esc(view.pluralTitle || 'files are ready')}`}</h2>
        ${result.note ? `<p class="note">${esc(result.note)}</p>` : ''}
        <ul class="out">
          ${files.map(file => `
            <li>
              <span class="fname">${esc(file.name)}</span>
              <span class="fsub">${U.formatSize(file.size)}</span>
              <a class="ghost" href="${file.url}" download="${esc(file.name)}">Download</a>
            </li>`).join('')}
        </ul>
        ${state.zipUrl ? `<div class="out-actions"><a class="go" href="${state.zipUrl}" download="${esc(files[0].name.replace(/-page-1\.jpg$/, ''))}-images.zip">Download all as ZIP (${U.formatSize(total)})</a></div>` : ''}
        <p class="fsub">${esc(view.footer || 'Processed in your browser. Your file stays on this device.')}</p>`;
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showResults(job) {
      const files = job.files;
      const total = files.reduce((s, f) => s + f.size, 0);
      const url = i => `/api/download/${job.token}/${i}`;
      const note = files.find(f => f.note);
      resultsEl.hidden = false;
      resultsEl.innerHTML = `
        <h2>${files.length === 1 ? 'Your file is ready' : `${files.length} files are ready`}</h2>
        ${note ? `<p class="note">${esc(note.note)}</p>` : ''}
        <ul class="out">
          ${files.map((f, i) => `
            <li>
              <span class="fname">${esc(f.name)}</span>
              <span class="fsub">${U.formatSize(f.size)}</span>
              ${files.length > 1 ? `<a class="ghost" href="${url(i)}" download>Download</a>` : ''}
            </li>`).join('')}
        </ul>
        <div class="out-actions">
          ${files.length > 1
            ? `<a class="go" href="${url('zip')}" download>Download all as ZIP (${U.formatSize(total)})</a>`
            : `<a class="go" href="${url(0)}" download>Download</a>`}
        </div>
        <p class="fsub">These files are deleted from the server in ${job.expiresInMinutes} minutes.</p>`;
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    renderOptions();
    renderFiles();
  }

  window.addEventListener('hashchange', route);
  route();
})();
