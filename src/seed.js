// First-run sample books (bundled in /samples, stored into IndexedDB).
import { importBlob } from './importer.js';
import { store } from './store.js';

const SAMPLES = [
  { url: './samples/chao-mung-bookweb-vi.md', name: 'chao-mung-bookweb-vi.md' },
  { url: './samples/welcome-to-bookweb-en.md', name: 'welcome-to-bookweb-en.md' },
  { url: './samples/truyen-kieu-trich-doan-vi.txt', name: 'truyen-kieu-trich-doan-vi.txt' },
  { url: './samples/bookweb-demo-epub-vi.epub', name: 'bookweb-demo-epub-vi.epub' },
];

export async function seedIfNeeded(onStep) {
  if (store.seeded) return false;
  let added = 0;
  for (const s of SAMPLES) {
    try {
      onStep?.(s.name);
      const res = await fetch(s.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      await importBlob(blob, s.name, 'sample');
      added++;
    } catch (e) {
      console.warn('seed failed for', s.name, e);
    }
  }
  store.setSeeded();
  return added > 0;
}
