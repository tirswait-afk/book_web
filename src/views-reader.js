import { t } from './i18n.js';
import { db } from './db.js';
import { store, escapeHtml, formatPercent } from './store.js';
import { el, openSheet, toast, loadingState } from './components.js';

export async function renderReader(root, nav, bookId) {
  const book = await db.getBook(bookId);
  if (!book) {
    root.appendChild(el(`<div class="card empty"><div class="big">❓</div><h2>${escapeHtml(t('unableToOpen'))}</h2></div>`));
    return () => {};
  }
  const saved = await db.getProgress(bookId);

  const shell = el(`<div class="readertheme-${store.readerTheme}"></div>`);
  root.appendChild(shell);
  shell.appendChild(loadingState(t('importing')));

  const kind = book.format === 'PDF' ? 'pdf'
    : (book.format === 'CBZ' || book.format === 'IMAGE') ? 'image' : 'text';

  let cleanup = () => {};
  try {
    if (kind === 'text') cleanup = await mountTextReader(shell, book, saved);
    else if (kind === 'pdf') cleanup = await mountPdfReader(shell, book, saved);
    else cleanup = await mountImageReader(shell, book, saved);
  } catch (e) {
    console.error(e);
    shell.innerHTML = '';
    shell.appendChild(el(`<div class="card empty"><div class="big">📕</div><h2>${escapeHtml(t('unableToOpen'))}</h2>
      <p class="muted">${escapeHtml(String(e?.message || ''))}</p></div>`));
  }
  // Mark as reading on open
  if (saved?.status === 'not_started') {
    await db.putProgress({ bookId, percent: saved?.percent || 0, status: 'reading', locator: saved?.locator || null, updatedAt: Date.now(), lastReadAt: Date.now() });
  } else if (saved) {
    await db.putProgress({ ...saved, status: saved.status === 'finished' ? 'finished' : 'reading', lastReadAt: Date.now() });
  }
  return cleanup;
}

/* ================= TEXT READER ================= */
async function mountTextReader(shell, book, saved) {
  // Parse by format
  let chapters, toc, meta = {}, revoke = () => {};
  if (book.format === 'EPUB') {
    const { parseEpub } = await import('./parsers/epub.js');
    const parsed = await parseEpub(book.file);
    chapters = parsed.chapters; toc = parsed.toc; meta = parsed.meta; revoke = parsed.revoke;
  } else if (book.format === 'DOCX') {
    const { parseDocx } = await import('./parsers/docx.js');
    const parsed = await parseDocx(book.file, book.title);
    chapters = parsed.chapters; toc = parsed.toc; meta = parsed.meta;
  } else {
    const text = await book.file.text();
    if (book.format === 'MD') {
      const { parseMarkdown } = await import('./parsers/text.js');
      ({ chapters, toc } = parseMarkdown(text, book.title));
    } else if (book.format === 'HTML') {
      const { parseHtml } = await import('./parsers/text.js');
      ({ chapters, toc } = parseHtml(text, book.title));
    } else {
      const { parseTxt } = await import('./parsers/text.js');
      ({ chapters, toc } = parseTxt(text, book.title));
    }
  }

  shell.innerHTML = '';
  const top = el(`<div class="reader-top">
    <button class="iconbtn light" data-act="back" aria-label="${escapeHtml(t('back'))}">←</button>
    <div class="title"><b>${escapeHtml(book.title)}</b><span data-slot="sub">${escapeHtml(book.author || book.format)}</span></div>
    <button class="iconbtn light" data-act="toc" aria-label="${escapeHtml(t('toc'))}">☰</button>
    <button class="iconbtn light" data-act="find" aria-label="${escapeHtml(t('searchInBook'))}">🔍</button>
    <button class="iconbtn light" data-act="aa" aria-label="${escapeHtml(t('readerSettings'))}">Aa</button>
  </div>`);
  const doc = el(`<div class="reader-wrap"><article class="reader-doc"></article></div>`);
  const article = doc.querySelector('article');
  chapters.forEach((ch, i) => {
    const sec = el(`<section id="${ch.id}"></section>`);
    sec.innerHTML = ch.html;
    article.appendChild(sec);
    if (i < chapters.length - 1) article.appendChild(el(`<hr class="chapter-gap" />`));
  });
  // scope images: already blob/data or remote; keep remote (needs net) but lazy
  article.querySelectorAll('img').forEach((img) => img.setAttribute('loading', 'lazy'));

  const bottom = el(`<div class="reader-bottom">
    <button class="iconbtn light" data-act="prev" aria-label="${escapeHtml(t('prev'))}" style="min-width:44px;min-height:44px">‹</button>
    <input type="range" min="0" max="1000" value="0" aria-label="${escapeHtml(t('progress'))}" />
    <span class="pct">0%</span>
    <button class="iconbtn light" data-act="next" aria-label="${escapeHtml(t('next'))}" style="min-width:44px;min-height:44px">›</button>
  </div>`);
  shell.append(top, doc, bottom);
  applyReaderPrefs(article, shell);

  const slider = bottom.querySelector('input');
  const pctEl = bottom.querySelector('.pct');
  const sub = top.querySelector('[data-slot="sub"]');

  // Restore position
  const applyLocator = () => {
    const loc = saved?.locator;
    if (loc?.type === 'text' && Number.isFinite(loc.ratio)) {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.round(max * loc.ratio));
    }
  };
  requestAnimationFrame(() => setTimeout(applyLocator, 80));

  // Progress save (throttled)
  let saveTimer = null, lastRatio = -1;
  const computeRatio = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return 1;
    return Math.min(1, Math.max(0, window.scrollY / max));
  };
  const currentChapter = () => {
    const secs = [...article.querySelectorAll('section[id]')];
    let cur = secs[0]?.id;
    for (const s of secs) {
      if (s.getBoundingClientRect().top <= 120) cur = s.id;
      else break;
    }
    return cur;
  };
  const onScroll = () => {
    const r = computeRatio();
    slider.value = String(Math.round(r * 1000));
    pctEl.textContent = formatPercent(r);
    if (Math.abs(r - lastRatio) < 0.005) return;
    lastRatio = r;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const prev = await db.getProgress(book.id);
      await db.putProgress({
        bookId: book.id,
        percent: r,
        status: r >= 0.995 ? 'finished' : 'reading',
        locator: { type: 'text', ratio: r, chapterId: currentChapter() },
        updatedAt: Date.now(), lastReadAt: Date.now(),
      });
      void prev;
    }, 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  slider.addEventListener('input', () => {
    const r = Number(slider.value) / 1000;
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, Math.round(max * r));
  });
  const step = (dir) => window.scrollBy({ top: dir * innerHeight * 0.85, behavior: 'smooth' });
  bottom.querySelector('[data-act="prev"]').addEventListener('click', () => step(-1));
  bottom.querySelector('[data-act="next"]').addEventListener('click', () => step(1));
  top.querySelector('[data-act="back"]').addEventListener('click', async () => {
    await flushSave();
    history.back();
  });
  async function flushSave() {
    clearTimeout(saveTimer);
    const r = computeRatio();
    await db.putProgress({
      bookId: book.id, percent: r, status: r >= 0.995 ? 'finished' : 'reading',
      locator: { type: 'text', ratio: r, chapterId: currentChapter() },
      updatedAt: Date.now(), lastReadAt: Date.now(),
    });
  }

  // TOC drawer
  top.querySelector('[data-act="toc"]').addEventListener('click', () => {
    openDrawer(t('toc'), (body) => {
      if (!toc.length) { body.appendChild(el(`<p class="muted">${escapeHtml(t('noToc'))}</p>`)); return () => {}; }
      toc.forEach((e) => {
        const b = el(`<button class="tocitem lv${Math.min(3, e.level || 1)}">${escapeHtml(e.title)}</button>`);
        b.addEventListener('click', () => {
          document.getElementById(e.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          closeDrawer();
        });
        body.appendChild(b);
      });
      return () => {};
    });
  });

  // Find drawer
  top.querySelector('[data-act="find"]').addEventListener('click', () => {
    openDrawer(t('searchInBook'), (body) => {
      const box = el(`<div class="searchbar"><input type="search" placeholder="${escapeHtml(t('searchInBookPlaceholder'))}" /></div>`);
      const results = el(`<div></div>`);
      body.append(box, results);
      const input = box.querySelector('input');
      setTimeout(() => input.focus(), 50);
      let lastMarks = [];
      const clearMarks = () => {
        lastMarks.forEach((m) => {
          const parent = m.parentNode;
          parent.replaceChild(document.createTextNode(m.textContent), m);
          parent.normalize();
        });
        lastMarks = [];
      };
      input.addEventListener('input', () => {
        clearMarks(); results.innerHTML = '';
        const needle = input.value.trim();
        if (needle.length < 2) return;
        const hits = findInArticle(article, needle, 60);
        if (!hits.length) { results.appendChild(el(`<p class="muted">${escapeHtml(t('noResults'))}</p>`)); return; }
        // highlight in place (first 200 occurrences max)
        lastMarks = highlightInArticle(article, needle, 200);
        hits.forEach((h, i) => {
          const b = el(`<button class="resultitem">${i + 1}. …${h.snippet}…</button>`);
          b.addEventListener('click', () => {
            const mark = lastMarks[h.markIndex];
            if (mark) { mark.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            closeDrawer();
          });
          results.appendChild(b);
        });
      });
      return () => {};
    });
  });

  // Reader settings
  top.querySelector('[data-act="aa"]').addEventListener('click', () => {
    openReaderSettings(() => applyReaderPrefs(article, shell));
  });

  void meta; void sub;
  return () => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(saveTimer);
    try { revoke(); } catch { /* ignore */ }
  };
}

function findInArticle(article, needle, maxResults) {
  const out = [];
  const low = needle.toLowerCase();
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let markIndex = 0;
  for (const node of nodes) {
    const text = node.textContent;
    const tl = text.toLowerCase();
    let from = 0, idx;
    while ((idx = tl.indexOf(low, from)) >= 0 && out.length < maxResults) {
      const start = Math.max(0, idx - 40), end = Math.min(text.length, idx + needle.length + 40);
      const snippet = escapeHtml(text.slice(start, end)).replace(
        escapeHtml(text.slice(idx, idx + needle.length)),
        `<mark>${escapeHtml(text.slice(idx, idx + needle.length))}</mark>`
      );
      out.push({ snippet, markIndex: markIndex++ });
      from = idx + needle.length;
      if (markIndex > 500) break;
    }
    if (out.length >= maxResults) break;
  }
  return out;
}

function highlightInArticle(article, needle, cap) {
  const marks = [];
  const low = needle.toLowerCase();
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.parentElement?.closest('script,style')) continue;
    nodes.push(n);
  }
  for (const node of nodes) {
    if (marks.length >= cap) break;
    const text = node.textContent;
    const idx = text.toLowerCase().indexOf(low);
    if (idx < 0) continue;
    const frag = document.createDocumentFragment();
    let rest = text, restLow = text.toLowerCase(), first = true;
    while (rest && marks.length < cap) {
      const i = restLow.indexOf(low);
      if (i < 0) { frag.appendChild(document.createTextNode(rest)); break; }
      if (i > 0) frag.appendChild(document.createTextNode(rest.slice(0, i)));
      const m = document.createElement('span');
      m.className = 'found';
      m.textContent = rest.slice(i, i + needle.length);
      frag.appendChild(m); marks.push(m);
      rest = rest.slice(i + needle.length); restLow = restLow.slice(i + needle.length);
      if (first) { first = false; }
    }
    node.parentNode.replaceChild(frag, node);
  }
  return marks;
}

/* ================= PDF READER ================= */
async function mountPdfReader(shell, book, saved) {
  const { openPdf } = await import('./parsers/pdf.js');
  const { doc, numPages } = await openPdf(book.file);
  shell.innerHTML = '';
  let page = saved?.locator?.type === 'pdf' && saved.locator.page ? Math.min(numPages, Math.max(1, saved.locator.page)) : 1;
  let scale = 1.4;

  const top = el(`<div class="reader-top">
    <button class="iconbtn light" data-act="back" aria-label="${escapeHtml(t('back'))}">←</button>
    <div class="title"><b>${escapeHtml(book.title)}</b><span>${escapeHtml(t('pdfHint'))}</span></div>
    <button class="iconbtn light" data-act="zin" aria-label="${escapeHtml(t('zoomIn'))}">＋</button>
    <button class="iconbtn light" data-act="zout" aria-label="${escapeHtml(t('zoomOut'))}">－</button>
  </div>`);
  const stage = el(`<div class="reader-wrap"><div class="pdfpage"><canvas></canvas></div>
    <p class="muted" style="text-align:center">${escapeHtml(t('page'))} <b data-slot="pg">1</b> / ${numPages}</p></div>`);
  const canvas = stage.querySelector('canvas');
  const bottom = el(`<div class="reader-bottom">
    <button class="iconbtn light" data-act="prev" aria-label="${escapeHtml(t('prev'))}" style="min-width:44px;min-height:44px">‹</button>
    <input type="range" min="1" max="${numPages}" value="${page}" aria-label="${escapeHtml(t('page'))}" />
    <span class="pct"></span>
    <button class="iconbtn light" data-act="next" aria-label="${escapeHtml(t('next'))}" style="min-width:44px;min-height:44px">›</button>
  </div>`);
  shell.append(top, stage, bottom);
  const slider = bottom.querySelector('input');
  const pctEl = bottom.querySelector('.pct');
  const pgEl = stage.querySelector('[data-slot="pg"]');

  let renderTask = null;
  async function render() {
    pgEl.textContent = String(page);
    slider.value = String(page);
    const pct = numPages <= 1 ? 1 : page / numPages;
    pctEl.textContent = formatPercent(pct);
    try { renderTask?.cancel(); } catch { /* ignore */ }
    const p = await doc.getPage(page);
    const viewport = p.getViewport({ scale });
    const maxW = Math.min(760, stage.clientWidth || 760);
    const fit = viewport.width > maxW ? maxW / viewport.width : 1;
    const vp = p.getViewport({ scale: scale * fit });
    canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
    renderTask = p.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    try { await renderTask.promise; } catch (e) { if (e?.name !== 'RenderingCancelledException') throw e; }
  }
  const save = async () => {
    const pct = numPages <= 1 ? 1 : page / numPages;
    await db.putProgress({
      bookId: book.id, percent: pct, status: page >= numPages ? 'finished' : 'reading',
      locator: { type: 'pdf', page }, updatedAt: Date.now(), lastReadAt: Date.now(),
    });
  };
  let saveT = null;
  const scheduleSave = () => { clearTimeout(saveT); saveT = setTimeout(save, 500); };

  const go = async (n) => { page = Math.min(numPages, Math.max(1, n)); await render(); scheduleSave(); };
  bottom.querySelector('[data-act="prev"]').addEventListener('click', () => go(page - 1));
  bottom.querySelector('[data-act="next"]').addEventListener('click', () => go(page + 1));
  slider.addEventListener('input', () => go(Number(slider.value)));
  top.querySelector('[data-act="zin"]').addEventListener('click', async () => { scale = Math.min(3, scale + 0.25); await render(); });
  top.querySelector('[data-act="zout"]').addEventListener('click', async () => { scale = Math.max(0.6, scale - 0.25); await render(); });
  top.querySelector('[data-act="back"]').addEventListener('click', async () => { await save(); history.back(); });
  // keyboard
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') go(page + 1);
    if (e.key === 'ArrowLeft') go(page - 1);
  };
  window.addEventListener('keydown', onKey);
  await render();
  return async () => {
    window.removeEventListener('keydown', onKey);
    clearTimeout(saveT);
    try { await doc.destroy(); } catch { /* ignore */ }
  };
}

/* ================= IMAGE READER ================= */
async function mountImageReader(shell, book, saved) {
  let images, revoke;
  if (book.format === 'IMAGE') {
    const { singleImage } = await import('./parsers/cbz.js');
    ({ images, revoke } = singleImage(book.file));
  } else {
    const { parseCbz } = await import('./parsers/cbz.js');
    ({ images, revoke } = await parseCbz(book.file));
  }
  shell.innerHTML = '';
  const top = el(`<div class="reader-top">
    <button class="iconbtn light" data-act="back" aria-label="${escapeHtml(t('back'))}">←</button>
    <div class="title"><b>${escapeHtml(book.title)}</b><span>${escapeHtml(t('imageBookHint'))}</span></div>
  </div>`);
  const stage = el(`<div class="reader-wrap imgpage"></div>`);
  images.forEach((im, i) => {
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = `${i + 1}`;
    img.src = im.url;
    stage.appendChild(img);
  });
  const bottom = el(`<div class="reader-bottom">
    <input type="range" min="0" max="1000" value="0" aria-label="${escapeHtml(t('progress'))}" />
    <span class="pct">0%</span>
  </div>`);
  shell.append(top, stage, bottom);
  const slider = bottom.querySelector('input');
  const pctEl = bottom.querySelector('.pct');
  const ratio = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max <= 0 ? 1 : Math.min(1, Math.max(0, window.scrollY / max));
  };
  // restore
  requestAnimationFrame(() => setTimeout(() => {
    const loc = saved?.locator;
    if (loc?.type === 'image' && Number.isFinite(loc.ratio)) {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.round(max * loc.ratio));
    }
  }, 120));
  let timer = null;
  const onScroll = () => {
    const r = ratio();
    slider.value = String(Math.round(r * 1000));
    pctEl.textContent = formatPercent(r);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await db.putProgress({
        bookId: book.id, percent: r, status: r >= 0.995 ? 'finished' : 'reading',
        locator: { type: 'image', ratio: r }, updatedAt: Date.now(), lastReadAt: Date.now(),
      });
    }, 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  slider.addEventListener('input', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, Math.round(max * Number(slider.value) / 1000));
  });
  top.querySelector('[data-act="back"]').addEventListener('click', async () => {
    const r = ratio();
    await db.putProgress({
      bookId: book.id, percent: r, status: r >= 0.995 ? 'finished' : 'reading',
      locator: { type: 'image', ratio: r }, updatedAt: Date.now(), lastReadAt: Date.now(),
    });
    history.back();
  });
  onScroll();
  return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); try { revoke(); } catch { /* ignore */ } };
}

/* ================= shared bits ================= */
function applyReaderPrefs(article, shell) {
  shell.className = `readertheme-${store.readerTheme}`;
  article.style.fontSize = `${store.fontSize}px`;
  article.classList.toggle('serif', store.typeface === 'serif');
  article.classList.toggle('sans', store.typeface !== 'serif');
  article.classList.toggle('justify', store.align === 'justify');
  article.classList.toggle('left', store.align !== 'justify');
}

function openReaderSettings(onChange) {
  const sheet = el(`<div>
    <h2>Aa ${escapeHtml(t('readerSettings'))}</h2>
    <div class="field"><label>${escapeHtml(t('colorTheme'))}</label>
      <div class="seg" data-k="theme">
        <button data-v="light" aria-pressed="false">☀️ ${escapeHtml(t('light'))}</button>
        <button data-v="sepia" aria-pressed="false">📜 ${escapeHtml(t('sepia'))}</button>
        <button data-v="dark" aria-pressed="false">🌙 ${escapeHtml(t('dark'))}</button>
      </div></div>
    <div class="field"><label>${escapeHtml(t('fontSize'))}: <b data-slot="fs">${store.fontSize}</b>px</label>
      <div class="row"><button class="btn small" data-act="dec">A－</button>
      <input type="range" min="14" max="24" step="1" value="${store.fontSize}" style="flex:1;accent-color:var(--primary)" aria-label="${escapeHtml(t('fontSize'))}" />
      <button class="btn small" data-act="inc">A＋</button></div></div>
    <div class="field"><label>${escapeHtml(t('typeface'))}</label>
      <div class="seg" data-k="face">
        <button data-v="serif" aria-pressed="false">${escapeHtml(t('serif'))}</button>
        <button data-v="sans" aria-pressed="false">${escapeHtml(t('sansSerif'))}</button>
      </div></div>
    <div class="field"><label>${escapeHtml(t('textAlign'))}</label>
      <div class="seg" data-k="align">
        <button data-v="left" aria-pressed="false">⬅ ${escapeHtml(t('alignLeft'))}</button>
        <button data-v="justify" aria-pressed="false">☰ ${escapeHtml(t('alignJustify'))}</button>
      </div></div>
  </div>`);
  const { close } = openSheet(sheet);
  const paint = () => {
    sheet.querySelectorAll('[data-k="theme"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === store.readerTheme)));
    sheet.querySelectorAll('[data-k="face"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === store.typeface)));
    sheet.querySelectorAll('[data-k="align"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === store.align)));
    sheet.querySelector('[data-slot="fs"]').textContent = String(store.fontSize);
    sheet.querySelector('input[type="range"]').value = String(store.fontSize);
  };
  paint();
  sheet.querySelector('[data-k="theme"]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setReaderTheme(b.dataset.v); paint(); onChange();
  });
  sheet.querySelector('[data-k="face"]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setTypeface(b.dataset.v); paint(); onChange();
  });
  sheet.querySelector('[data-k="align"]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setAlign(b.dataset.v); paint(); onChange();
  });
  const range = sheet.querySelector('input[type="range"]');
  range.addEventListener('input', () => { store.setFontSize(Number(range.value)); paint(); onChange(); });
  sheet.querySelector('[data-act="dec"]').addEventListener('click', () => { store.setFontSize(store.fontSize - 1); paint(); onChange(); });
  sheet.querySelector('[data-act="inc"]').addEventListener('click', () => { store.setFontSize(store.fontSize + 1); paint(); onChange(); });
  void close;
}

let drawerEl = null;
export function openDrawer(title, mount) {
  closeDrawer();
  drawerEl = el(`<div class="drawer open" role="dialog" aria-label="${escapeHtml(title)}">
    <div class="scrim"></div>
    <div class="panel"><h2 style="margin:0 0 10px;font-size:17px">${escapeHtml(title)}</h2><div data-body></div></div>
  </div>`);
  drawerEl.querySelector('.scrim').addEventListener('click', closeDrawer);
  document.body.appendChild(drawerEl);
  mount(drawerEl.querySelector('[data-body]'));
}
export function closeDrawer() { drawerEl?.remove(); drawerEl = null; }
