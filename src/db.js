// Tiny IndexedDB wrapper — books + progress. No dependencies, local-only.
const DB_NAME = 'bookweb';
const DB_VERSION = 1;

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('books')) {
          const s = d.createObjectStore('books', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!d.objectStoreNames.contains('progress')) {
          d.createObjectStore('progress', { keyPath: 'bookId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => console.warn('[bookweb] IDB blocked');
    });
  }
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async putBook(book) {
    const d = await openDb();
    await reqToPromise(d.transaction('books', 'readwrite').objectStore('books').put(book));
  },
  async getBook(id) {
    const d = await openDb();
    return reqToPromise(d.transaction('books', 'readonly').objectStore('books').get(id));
  },
  async allBooks() {
    const d = await openDb();
    return reqToPromise(d.transaction('books', 'readonly').objectStore('books').getAll());
  },
  async deleteBook(id) {
    const d = await openDb();
    await new Promise((resolve, reject) => {
      const t = d.transaction(['books', 'progress'], 'readwrite');
      t.objectStore('books').delete(id);
      t.objectStore('progress').delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },
  async clearAll() {
    const d = await openDb();
    await new Promise((resolve, reject) => {
      const t = d.transaction(['books', 'progress'], 'readwrite');
      t.objectStore('books').clear();
      t.objectStore('progress').clear();
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },
  async putProgress(p) {
    const d = await openDb();
    await reqToPromise(d.transaction('progress', 'readwrite').objectStore('progress').put(p));
  },
  async getProgress(bookId) {
    const d = await openDb();
    return reqToPromise(d.transaction('progress', 'readonly').objectStore('progress').get(bookId));
  },
  async allProgress() {
    const d = await openDb();
    return reqToPromise(d.transaction('progress', 'readonly').objectStore('progress').getAll());
  },
};

// SHA-256 hex for duplicate detection (async, falls back to size+name hash).
export async function fileHash(blob, name) {
  try {
    const buf = await blob.slice(0, 2 * 1024 * 1024).arrayBuffer();
    const extra = new TextEncoder().encode(`|${name}|${blob.size}|${blob.type}`);
    const merged = new Uint8Array(buf.byteLength + extra.byteLength);
    merged.set(new Uint8Array(buf), 0);
    merged.set(extra, buf.byteLength);
    const digest = await crypto.subtle.digest('SHA-256', merged);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 2166136261;
    const s = `${name}|${blob.size}|${blob.type}`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `fallback-${(h >>> 0).toString(16)}`;
  }
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
