import './styles.css';
import { t } from './i18n.js';
import { store, applyAppTheme } from './store.js';
import { el, loadingState, toast } from './components.js';
import { registerSW } from './pwa.js';
import { seedIfNeeded } from './seed.js';

applyAppTheme();
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (store.appTheme === 'system') applyAppTheme();
  });
}
document.documentElement.lang = store.lang;
registerSW();

const app = document.getElementById('app');
let cleanup = null;

const nav = {
  go(tab) { location.hash = `#/${tab}`; },
  details(id) { location.hash = `#/book/${id}`; },
  reader(id) { location.hash = `#/read/${id}`; },
  rerender() { render(); },
};

function shell({ fullscreen = false, tab = '' } = {}) {
  app.innerHTML = '';
  if (!fullscreen) {
    const bar = el(`<header class="appbar">
      <span class="logo"><img src="./icons/icon-192.png" alt="BookWeb" onerror="this.remove();this.parentElement.textContent='B'" /></span>
      <h1>${t('appName')}<small>${t('appTagline')}</small></h1>
      <span class="spacer"></span>
      <button class="iconbtn" data-act="lang" aria-label="Language / Ngôn ngữ">${store.lang === 'vi' ? '🇬🇧' : '🇻🇳'}</button>
    </header>`);
    bar.querySelector('[data-act="lang"]').addEventListener('click', () => {
      store.setLang(store.lang === 'vi' ? 'en' : 'vi');
      render();
    });
    app.appendChild(bar);
  }
  const main = el(`<main${fullscreen ? ' style="max-width:100%;padding:0 0 90px"' : ''}></main>`);
  app.appendChild(main);
  if (!fullscreen) {
    const tabs = [
      ['home', '🏠', t('home')],
      ['library', '📚', t('library')],
      ['settings', '⚙️', t('settings')],
    ];
    const bn = el(`<nav class="bottomnav" aria-label="main"></nav>`);
    tabs.forEach(([key, icon, label]) => {
      const b = el(`<button ${tab === key ? 'aria-current="page"' : ''}><span class="ic">${icon}</span><span>${label}</span></button>`);
      b.addEventListener('click', () => nav.go(key));
      bn.appendChild(b);
    });
    app.appendChild(bn);
  }
  return main;
}

async function render() {
  try { if (typeof cleanup === 'function') await cleanup(); } catch { /* ignore */ }
  cleanup = null;
  window.scrollTo(0, 0);

  const hash = location.hash || '#/home';
  const [, route, param] = hash.split('/');

  if (route === 'read' && param) {
    const main = shell({ fullscreen: true });
    const { renderReader } = await import('./views-reader.js');
    cleanup = await renderReader(main, nav, decodeURIComponent(param));
    return;
  }
  if (route === 'book' && param) {
    const main = shell({ tab: 'library' });
    const { renderDetails } = await import('./views-details.js');
    await renderDetails(main, nav, decodeURIComponent(param));
    return;
  }
  if (route === 'library') {
    const main = shell({ tab: 'library' });
    const { renderLibrary } = await import('./views-library.js');
    await renderLibrary(main, nav);
    return;
  }
  if (route === 'settings') {
    const main = shell({ tab: 'settings' });
    const { renderSettings } = await import('./views-settings.js');
    await renderSettings(main, nav);
    return;
  }
  const main = shell({ tab: 'home' });
  const { renderHome } = await import('./views-home.js');
  await renderHome(main, nav);
}

window.addEventListener('hashchange', render);

// Boot: seed samples on first run, then render.
(async function boot() {
  if (!location.hash) location.hash = '#/home';
  if (!store.seeded) {
    const main = shell({ tab: 'home' });
    main.appendChild(loadingState(t('seedLoading')));
    const added = await seedIfNeeded().catch(() => false);
    if (added) setTimeout(() => toast(t('samplesSeeded')), 400);
  }
  await render();
})();
