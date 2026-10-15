// Global settings + small helpers (localStorage for prefs, IndexedDB for books).
import { getLang, setLang } from './i18n.js';

const K = {
  appTheme: 'bookweb.appTheme',       // light | dark | sepia | system
  readerTheme: 'bookweb.readerTheme', // light | dark | sepia
  fontSize: 'bookweb.fontSize',        // 14..24
  typeface: 'bookweb.typeface',        // serif | sans
  align: 'bookweb.align',              // left | justify
  seeded: 'bookweb.seeded.v1',
};

function read(k, fallback) {
  const v = localStorage.getItem(k);
  return v == null ? fallback : v;
}

export const store = {
  get lang() { return getLang(); },
  setLang(v) { setLang(v); },

  get appTheme() { return read(K.appTheme, 'system'); },
  setAppTheme(v) { localStorage.setItem(K.appTheme, v); applyAppTheme(); },

  get readerTheme() { return read(K.readerTheme, 'sepia'); },
  setReaderTheme(v) { localStorage.setItem(K.readerTheme, v); },

  get fontSize() { const n = parseInt(read(K.fontSize, '18'), 10); return Number.isFinite(n) ? Math.min(24, Math.max(14, n)) : 18; },
  setFontSize(n) { localStorage.setItem(K.fontSize, String(n)); },

  get typeface() { return read(K.typeface, 'serif'); },
  setTypeface(v) { localStorage.setItem(K.typeface, v); },

  get align() { return read(K.align, 'justify'); },
  setAlign(v) { localStorage.setItem(K.align, v); },

  get seeded() { return localStorage.getItem(K.seeded) === '1'; },
  setSeeded() { localStorage.setItem(K.seeded, '1'); },
  clearSeeded() { localStorage.removeItem(K.seeded); },
};

export function applyAppTheme() {
  const pref = store.appTheme;
  let mode = pref;
  if (pref === 'system') {
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = mode === 'dark' ? '#0F172A' : mode === 'sepia' ? '#FBF0D9' : '#050B20';
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString(store.lang === 'vi' ? 'vi-VN' : 'en-US'); }
  catch { return ''; }
}

export function formatPercent(p) {
  if (!Number.isFinite(p)) return '0%';
  return `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
