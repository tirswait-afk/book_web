// Service worker registration (works in dev + build; silent if unsupported).
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const isLocalhost = /localhost|127\.0\.0\.1|\.e2b\.app$/.test(location.hostname) || location.hostname.endsWith('.e2b.app');
  window.addEventListener('load', async () => {
    try {
      // In dev, SW still helps preview offline shell; skip if file missing.
      await navigator.serviceWorker.register('./sw.js');
      console.log('[bookweb] SW registered', { isLocalhost });
    } catch (e) {
      console.warn('[bookweb] SW skip', e);
    }
  });
}
