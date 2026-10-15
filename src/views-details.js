import { t } from './i18n.js';
import { db } from './db.js';
import { escapeHtml, formatBytes, formatDate, formatPercent } from './store.js';
import { el, openSheet, toast } from './components.js';

export async function renderDetails(root, nav, bookId) {
  const book = await db.getBook(bookId);
  if (!book) {
    root.appendChild(el(`<div class="card empty"><div class="big">❓</div><h2>${escapeHtml(t('unableToOpen'))}</h2>
      <button class="btn" onclick="location.hash='#/library'">← ${escapeHtml(t('backToLibrary'))}</button></div>`));
    return;
  }
  const p = await db.getProgress(bookId);
  const pct = p?.percent ?? 0;
  const statusKey = p?.status === 'finished' ? 'finished' : p?.status === 'reading' ? 'reading' : 'notStarted';

  const wrap = el(`<div>
    <button class="btn small" data-act="back" style="margin-bottom:12px">← ${escapeHtml(t('back'))}</button>
    <section class="card">
      <div class="detail-head">
        <div class="detail-cover">${book.cover ? `<img src="${book.cover}" alt="" />` : escapeHtml((book.title || '?')[0].toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <h2 style="font-size:19px;line-height:1.3">${escapeHtml(book.title)}</h2>
          <p class="muted" style="margin:4px 0">${escapeHtml(book.author || t('unknownAuthor'))}</p>
          <p><span class="chip" style="pointer-events:none;font-size:12px;min-height:32px">${escapeHtml(book.format)}</span></p>
        </div>
      </div>
      <div class="progressbar" style="margin-top:14px"><i style="width:${Math.round(pct * 100)}%"></i></div>
      <div class="progressline"><span>${escapeHtml(t('progress'))}</span><b>${formatPercent(pct)}</b></div>
      <dl class="kv">
        <dt>${escapeHtml(t('status'))}</dt><dd>${escapeHtml(t(statusKey))}</dd>
        <dt>${escapeHtml(t('fileSize'))}</dt><dd>${escapeHtml(formatBytes(book.size))}</dd>
        <dt>${escapeHtml(t('addedOn'))}</dt><dd>${escapeHtml(formatDate(book.createdAt))}</dd>
        <dt>${escapeHtml(t('lastRead'))}</dt><dd>${p?.lastReadAt ? escapeHtml(formatDate(p.lastReadAt)) : escapeHtml(t('never'))}</dd>
      </dl>
      <div class="actions">
        <button class="btn primary" data-act="read">📖 ${escapeHtml(pct > 0 ? t('continueReading') : t('readBook'))}</button>
        ${p?.status === 'finished'
          ? `<button class="btn" data-act="unfinish">↩ ${escapeHtml(t('markReading'))}</button>`
          : `<button class="btn" data-act="finish">✓ ${escapeHtml(t('markFinished'))}</button>`}
        <button class="btn danger" data-act="delete">🗑 ${escapeHtml(t('removeFromLibrary'))}</button>
      </div>
    </section>
  </div>`);

  wrap.querySelector('[data-act="back"]').addEventListener('click', () => history.back());
  wrap.querySelector('[data-act="read"]').addEventListener('click', () => nav.reader(book.id));
  const finishBtn = wrap.querySelector('[data-act="finish"]');
  if (finishBtn) finishBtn.addEventListener('click', async () => {
    await db.putProgress({ bookId: book.id, percent: 1, status: 'finished', locator: p?.locator || null, updatedAt: Date.now(), lastReadAt: Date.now() });
    nav.rerender();
  });
  const unfinishBtn = wrap.querySelector('[data-act="unfinish"]');
  if (unfinishBtn) unfinishBtn.addEventListener('click', async () => {
    await db.putProgress({ bookId: book.id, percent: Math.min(pct, 0.99), status: 'reading', locator: p?.locator || null, updatedAt: Date.now(), lastReadAt: Date.now() });
    nav.rerender();
  });
  wrap.querySelector('[data-act="delete"]').addEventListener('click', () => {
    const s = el(`<div><h2>🗑 ${escapeHtml(t('removeFromLibrary'))}</h2>
      <p>${escapeHtml(t('confirmDelete'))}</p>
      <div class="actions"><button class="btn danger" data-ok>🗑 ${escapeHtml(t('del'))}</button>
      <button class="btn" data-no>${escapeHtml(t('cancel'))}</button></div></div>`);
    const { close } = openSheet(s);
    s.querySelector('[data-no]').addEventListener('click', close);
    s.querySelector('[data-ok]').addEventListener('click', async () => {
      await db.deleteBook(book.id);
      close(); toast('🗑 ✓'); nav.go('library');
    });
  });
  root.appendChild(wrap);
}
