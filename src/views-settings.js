import { t, getLang } from './i18n.js';
import { db } from './db.js';
import { store, escapeHtml } from './store.js';
import { el, openSheet, toast } from './components.js';

export async function renderSettings(root, nav) {
  const books = await db.allBooks();
  const wrap = el(`<div></div>`);

  // Language
  const langCard = el(`<section class="card">
    <h2>🌐 ${escapeHtml(t('appLanguage'))}</h2>
    <p class="muted" style="font-size:13px">${escapeHtml(t('langApplies'))}</p>
    <div class="seg" style="display:flex;border:1px solid var(--outline);border-radius:12px;overflow:hidden">
      <button data-v="vi" style="flex:1;border:0;min-height:48px;font-weight:700;background:${getLang() === 'vi' ? 'var(--primary);color:var(--on-primary)' : 'var(--surface);color:var(--on-surface)'}">🇻🇳 Tiếng Việt</button>
      <button data-v="en" style="flex:1;border:0;min-height:48px;font-weight:700;background:${getLang() === 'en' ? 'var(--primary);color:var(--on-primary)' : 'var(--surface);color:var(--on-surface)'}">🇬🇧 English</button>
    </div>
  </section>`);
  langCard.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    store.setLang(b.dataset.v);
    nav.rerender();
  }));
  wrap.appendChild(langCard);

  // App theme
  const themeCard = el(`<section class="card">
    <h2>🎨 ${escapeHtml(t('appTheme'))}</h2>
    <div class="seg">
      <button data-v="light" aria-pressed="${store.appTheme === 'light'}">☀️ ${escapeHtml(t('light'))}</button>
      <button data-v="sepia" aria-pressed="${store.appTheme === 'sepia'}">📜 ${escapeHtml(t('sepia'))}</button>
      <button data-v="dark" aria-pressed="${store.appTheme === 'dark'}">🌙 ${escapeHtml(t('dark'))}</button>
      <button data-v="system" aria-pressed="${store.appTheme === 'system'}">📱 ${escapeHtml(t('systemTheme'))}</button>
    </div>
  </section>`);
  themeCard.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    store.setAppTheme(b.dataset.v);
    nav.rerender();
  }));
  wrap.appendChild(themeCard);

  // Reader defaults
  const readerCard = el(`<section class="card">
    <h2>Aa ${escapeHtml(t('readerDefaults'))}</h2>
    <div class="field"><label>${escapeHtml(t('colorTheme'))}</label>
      <div class="seg" data-k="theme">
        <button data-v="light">☀️ ${escapeHtml(t('light'))}</button>
        <button data-v="sepia">📜 ${escapeHtml(t('sepia'))}</button>
        <button data-v="dark">🌙 ${escapeHtml(t('dark'))}</button>
      </div></div>
    <div class="field"><label>${escapeHtml(t('fontSize'))}: <b>${store.fontSize}px</b></label>
      <div class="row"><button class="btn small" data-act="dec">A－</button>
      <button class="btn small" data-act="inc">A＋</button></div></div>
    <div class="field"><label>${escapeHtml(t('typeface'))}</label>
      <div class="seg" data-k="face">
        <button data-v="serif">${escapeHtml(t('serif'))}</button>
        <button data-v="sans">${escapeHtml(t('sansSerif'))}</button>
      </div></div>
  </section>`);
  const paintReader = () => {
    readerCard.querySelectorAll('[data-k="theme"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === store.readerTheme)));
    readerCard.querySelectorAll('[data-k="face"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === store.typeface)));
  };
  paintReader();
  readerCard.querySelector('[data-k="theme"]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setReaderTheme(b.dataset.v); paintReader();
  });
  readerCard.querySelector('[data-k="face"]').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.setTypeface(b.dataset.v); paintReader();
  });
  readerCard.querySelector('[data-act="dec"]').addEventListener('click', () => { store.setFontSize(store.fontSize - 1); nav.rerender(); });
  readerCard.querySelector('[data-act="inc"]').addEventListener('click', () => { store.setFontSize(store.fontSize + 1); nav.rerender(); });
  wrap.appendChild(readerCard);

  // PWA install
  const pwaCard = el(`<section class="card">
    <h2>📲 ${escapeHtml(t('installApp'))}</h2>
    <p class="muted" style="font-size:14px">${escapeHtml(t('installHint'))}</p>
    <p class="muted" style="font-size:13px">display-mode: <b>${window.matchMedia('(display-mode: standalone)').matches ? 'standalone ✓' : 'browser'}</b></p>
  </section>`);
  wrap.appendChild(pwaCard);

  // Storage
  const totalBytes = books.reduce((s, b) => s + (b.size || 0), 0);
  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  const storageCard = el(`<section class="card">
    <h2>💾 ${escapeHtml(t('storage'))}</h2>
    <p class="muted" style="font-size:14px">${escapeHtml(t('storageInfo'))}</p>
    <p>📚 <b>${books.length}</b> · ~<b>${mb} MB</b></p>
    <button class="btn danger block" data-act="erase">🗑 ${escapeHtml(t('eraseAll'))}</button>
  </section>`);
  storageCard.querySelector('[data-act="erase"]').addEventListener('click', () => {
    const s = el(`<div><h2>⚠️ ${escapeHtml(t('eraseAll'))}</h2><p>${escapeHtml(t('confirmErase'))}</p>
      <div class="actions"><button class="btn danger" data-ok>🗑 ${escapeHtml(t('del'))}</button>
      <button class="btn" data-no>${escapeHtml(t('cancel'))}</button></div></div>`);
    const { close } = openSheet(s);
    s.querySelector('[data-no]').addEventListener('click', close);
    s.querySelector('[data-ok]').addEventListener('click', async () => {
      await db.clearAll();
      store.clearSeeded();
      close(); toast('🗑 ✓'); nav.rerender();
    });
  });
  wrap.appendChild(storageCard);

  // About
  wrap.appendChild(el(`<section class="card">
    <h2>ℹ️ ${escapeHtml(t('about'))}</h2>
    <dl class="kv">
      <dt>BookWeb</dt><dd>v0.1.0 · PWA offline</dd>
      <dt>${escapeHtml(t('readerEngine'))}</dt><dd style="font-weight:400;font-size:13px">${escapeHtml(t('readerEngineValue'))}</dd>
    </dl>
    <p class="muted" style="font-size:13px">${escapeHtml(t('originNote'))}</p>
  </section>`));

  root.appendChild(wrap);
}
