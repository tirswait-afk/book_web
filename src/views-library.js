import { t } from './i18n.js';
import { db } from './db.js';
import { escapeHtml } from './store.js';
import { el, bookCard, emptyState, openSheet, toast, loadingState } from './components.js';
import { importBlob, importUrl } from './importer.js';

let q = '', filter = 'all', sort = 'recent';

export async function renderLibrary(root, nav) {
  const wrap = el(`<div></div>`);

  // Toolbar
  const bar = el(`<div class="searchbar">
    <input type="search" aria-label="${escapeHtml(t('search'))}" placeholder="${escapeHtml(t('searchPlaceholder'))}" value="${escapeHtml(q)}" />
    <button class="btn primary" data-act="add" aria-label="${escapeHtml(t('addDocument'))}">＋</button>
  </div>`);
  const input = bar.querySelector('input');
  input.addEventListener('input', () => { q = input.value; refresh(); });
  bar.querySelector('[data-act="add"]').addEventListener('click', () => openAddSheet(nav, refresh));
  wrap.appendChild(bar);

  const chips = el(`<div class="chips" role="group" aria-label="${escapeHtml(t('sort'))}"></div>`);
  const defs = [
    ['all', t('all')], ['reading', t('reading')],
    ['finished', t('finished')], ['not_started', t('notStarted')],
  ];
  defs.forEach(([v, label]) => {
    const c = el(`<button class="chip" aria-pressed="${filter === v}">${escapeHtml(label)}</button>`);
    c.addEventListener('click', () => {
      filter = v;
      chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', 'true');
      refresh();
    });
    chips.appendChild(c);
  });
  wrap.appendChild(chips);

  const sortRow = el(`<div class="row" style="justify-content:flex-end;margin-bottom:10px">
    <label class="muted" style="font-size:13px" for="sortsel">${escapeHtml(t('sort'))}</label>
  </div>`);
  const sel = el(`<select id="sortsel" style="min-height:40px;border-radius:10px;border:1px solid var(--outline);background:var(--surface);color:var(--on-surface);padding:0 10px">
    <option value="recent">${escapeHtml(t('sortRecent'))}</option>
    <option value="newest">${escapeHtml(t('sortNewest'))}</option>
    <option value="title">${escapeHtml(t('sortTitle'))}</option>
    <option value="author">${escapeHtml(t('sortAuthor'))}</option>
  </select>`);
  sel.value = sort;
  sel.addEventListener('change', () => { sort = sel.value; refresh(); });
  sortRow.appendChild(sel);
  wrap.appendChild(sortRow);

  const list = el(`<div></div>`);
  wrap.appendChild(list);
  root.appendChild(wrap);

  async function refresh() {
    list.innerHTML = '';
    list.appendChild(loadingState(t('search')));
    const [books, progresses] = await Promise.all([db.allBooks(), db.allProgress()]);
    const pmap = new Map(progresses.map((p) => [p.bookId, p]));
    const needle = q.trim().toLowerCase();
    let items = books.filter((b) => {
      const p = pmap.get(b.id);
      const st = p?.status || 'not_started';
      if (filter !== 'all' && st !== filter) return false;
      if (!needle) return true;
      return (b.title || '').toLowerCase().includes(needle) || (b.author || '').toLowerCase().includes(needle);
    });
    const lastRead = (b) => pmap.get(b.id)?.lastReadAt || pmap.get(b.id)?.updatedAt || b.updatedAt || 0;
    if (sort === 'recent') items.sort((a, b) => lastRead(b) - lastRead(a));
    else if (sort === 'newest') items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else if (sort === 'title') items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    else if (sort === 'author') items.sort((a, b) => String(a.author || '').localeCompare(String(b.author || '')));
    list.innerHTML = '';
    if (!books.length) {
      list.appendChild(emptyState('📚', t('emptyLibrary'), t('emptyLibraryHint'), t('addDocument'), () => openAddSheet(nav, refresh)));
      return;
    }
    if (!items.length) {
      list.appendChild(emptyState('🔍', t('emptySearch'), t('emptySearchHint')));
      return;
    }
    const grid = el(`<div class="grid"></div>`);
    items.forEach((b) => grid.appendChild(bookCard(b, pmap.get(b.id), (id) => nav.details(id))));
    list.appendChild(grid);
  }
  await refresh();
}

function openAddSheet(nav, refresh) {
  const fileInput = el(`<input type="file" class="sr" accept=".epub,.pdf,.txt,.md,.markdown,.html,.htm,.docx,.cbz,.zip,.jpg,.jpeg,.png,.webp,.gif" multiple />`);
  document.body.appendChild(fileInput);
  const sheet = el(`<div>
    <h2>＋ ${escapeHtml(t('addDocument'))}</h2>
    <p class="muted" style="font-size:13px">EPUB · PDF · TXT · MD · HTML · DOCX · CBZ · Ảnh</p>
    <div class="actions">
      <button class="btn primary" data-act="device">📁 ${escapeHtml(t('fromDevice'))}</button>
      <button class="btn" data-act="url">🔗 ${escapeHtml(t('fromUrl'))}</button>
    </div>
    <div data-slot="url" style="display:none">
      <div class="field"><label>URL</label><input type="url" placeholder="${escapeHtml(t('importUrlPlaceholder'))}" /></div>
      <button class="btn primary block" data-act="go">⬇ ${escapeHtml(t('importUrlTitle'))}</button>
    </div>
    <div data-slot="status" style="margin-top:10px"></div>
  </div>`);

  const { close } = openSheet(sheet);
  const status = sheet.querySelector('[data-slot="status"]');
  const say = (msg) => { status.innerHTML = ''; if (msg) status.appendChild(el(`<p class="muted">${escapeHtml(msg)}</p>`)); };

  sheet.querySelector('[data-act="device"]').addEventListener('click', () => fileInput.click());
  sheet.querySelector('[data-act="url"]').addEventListener('click', () => {
    const s = sheet.querySelector('[data-slot="url"]');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
  });
  sheet.querySelector('[data-act="go"]').addEventListener('click', async () => {
    const url = sheet.querySelector('input[type="url"]').value;
    say(t('importing'));
    try {
      const book = await importUrl(url);
      toast(t('importSuccess'));
      fileInput.remove(); close(); refresh?.(); nav.details(book.id);
    } catch {
      say(t('urlFetchFailed'));
    }
  });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    if (!files.length) { fileInput.remove(); return; }
    say(t('importing'));
    let ok = 0, lastId = null;
    for (const f of files) {
      try {
        const book = await importBlob(f, f.name, 'local');
        ok++; lastId = book.id;
      } catch (e) {
        if (e.code === 'DUPLICATE') { toast(t('duplicateBook')); lastId = e.existingId; }
        else toast(`${t('importFailed')}: ${f.name}`);
      }
    }
    fileInput.remove(); close(); refresh?.();
    if (ok) toast(t('importSuccess'));
    if (lastId && files.length === 1) nav.details(lastId);
  });
}
