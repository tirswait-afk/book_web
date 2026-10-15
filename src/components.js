import { t } from './i18n.js';
import { escapeHtml, formatPercent } from './store.js';

export function el(html) {
  const tmp = document.createElement('template');
  tmp.innerHTML = html.trim();
  return tmp.content.firstElementChild;
}

export function toast(msg, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const d = el(`<div class="toast" role="status"></div>`);
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

export function openSheet(html) {
  const overlay = el(`<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"></div></div>`);
  overlay.querySelector('.sheet').appendChild(typeof html === 'string' ? el(html) : html);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(overlay);
  return { overlay, close };
}

export function bookCard(book, progress, onOpen) {
  const pct = progress?.percent ?? 0;
  const initial = escapeHtml((book.title || '?').trim().charAt(0).toUpperCase() || '?');
  const card = el(`
    <button class="bookcard" aria-label="${escapeHtml(book.title)}">
      <span class="cover">
        ${book.cover ? `<img loading="lazy" src="${book.cover}" alt="" />` : `<span class="fallback">${initial}</span>`}
        <span class="badge">${escapeHtml(book.format)}</span>
      </span>
      <span class="meta">
        <b>${escapeHtml(book.title)}</b>
        <span>${escapeHtml(book.author || t('unknownAuthor'))}</span>
        <span class="progressbar"><i style="width:${Math.round(pct * 100)}%"></i></span>
        <span class="progressline"><span>${formatPercent(pct)}</span></span>
      </span>
    </button>`);
  card.addEventListener('click', () => onOpen(book.id));
  return card;
}

export function emptyState(icon, title, hint, actionLabel, onAction) {
  const d = el(`<div class="card empty">
    <div class="big">${icon}</div>
    <h2>${escapeHtml(title)}</h2>
    <p class="muted">${escapeHtml(hint)}</p>
  </div>`);
  if (actionLabel) {
    const b = el(`<button class="btn primary block">${escapeHtml(actionLabel)}</button>`);
    b.addEventListener('click', onAction);
    d.appendChild(b);
  }
  return d;
}

export function loadingState(msg) {
  return el(`<div class="card loading"><div class="spinner"></div><p class="muted">${escapeHtml(msg || '')}</p></div>`);
}
