import { t } from './i18n.js';
import { db } from './db.js';
import { escapeHtml, formatPercent } from './store.js';
import { el, bookCard } from './components.js';

export async function renderHome(root, nav) {
  const [books, progresses] = await Promise.all([db.allBooks(), db.allProgress()]);
  const pmap = new Map(progresses.map((p) => [p.bookId, p]));

  // Continue reading: most recent reading status
  const reading = progresses
    .filter((p) => p.status === 'reading')
    .sort((a, b) => (b.lastReadAt || b.updatedAt || 0) - (a.lastReadAt || a.updatedAt || 0))[0];
  const readingBook = reading ? books.find((b) => b.id === reading.bookId) : null;

  const finished = progresses.filter((p) => p.status === 'finished').length;
  const inReading = progresses.filter((p) => p.status === 'reading').length;

  const wrap = el(`<div></div>`);

  // Continue card
  const cont = el(`<section class="card" aria-label="${escapeHtml(t('continueReading'))}">
    <h2>📖 ${escapeHtml(t('continueReading'))}</h2>
  </section>`);
  if (readingBook && reading) {
    const pct = reading.percent ?? 0;
    const row = el(`<div class="continue">
      <div class="cover">${readingBook.cover ? `<img src="${readingBook.cover}" alt="" />` : escapeHtml((readingBook.title || '?')[0].toUpperCase())}</div>
      <div style="flex:1;min-width:0">
        <b>${escapeHtml(readingBook.title)}</b><br/>
        <span class="muted" style="font-size:13px">${escapeHtml(readingBook.author || t('unknownAuthor'))} · ${escapeHtml(readingBook.format)}</span>
        <div class="progressbar"><i style="width:${Math.round(pct * 100)}%"></i></div>
        <div class="progressline"><span>${formatPercent(pct)}</span></div>
        <div class="row" style="margin-top:8px">
          <button class="btn primary small" data-act="read">▶ ${escapeHtml(t('continueReading'))}</button>
        </div>
      </div>
    </div>`);
    row.querySelector('[data-act="read"]').addEventListener('click', () => nav.reader(readingBook.id));
    cont.appendChild(row);
  } else {
    cont.appendChild(el(`<p class="muted">${escapeHtml(t('noContinue'))}</p>`));
    const b = el(`<button class="btn small">📚 ${escapeHtml(t('openLibrary'))}</button>`);
    b.addEventListener('click', () => nav.go('library'));
    cont.appendChild(b);
  }
  wrap.appendChild(cont);

  // Stats
  wrap.appendChild(el(`<section class="card"><div class="statrow">
    <div class="stat"><b>${books.length}</b><span>${escapeHtml(t('statsLibrary'))}</span></div>
    <div class="stat"><b>${inReading}</b><span>${escapeHtml(t('statsReading'))}</span></div>
    <div class="stat"><b>${finished}</b><span>${escapeHtml(t('statsFinished'))}</span></div>
  </div></section>`));

  // Recently added
  const head = el(`<div class="row" style="justify-content:space-between;margin:6px 2px 10px">
    <h2 style="margin:0;font-size:17px">🆕 ${escapeHtml(t('newBooks'))}</h2>
  </div>`);
  if (books.length > 4) {
    const all = el(`<button class="btn small">${escapeHtml(t('seeAll'))}</button>`);
    all.addEventListener('click', () => nav.go('library'));
    head.appendChild(all);
  }
  wrap.appendChild(head);
  const recent = [...books].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  if (!recent.length) {
    const { emptyState } = await import('./components.js');
    wrap.appendChild(emptyState('📚', t('emptyLibrary'), t('emptyLibraryHint'), t('addDocument'), () => nav.go('library')));
  } else {
    const grid = el(`<div class="grid"></div>`);
    recent.forEach((b) => grid.appendChild(bookCard(b, pmap.get(b.id), (id) => nav.details(id))));
    wrap.appendChild(grid);
  }
  root.appendChild(wrap);
}
