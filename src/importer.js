// Import pipeline: File/Blob/URL -> detect -> extract meta -> persist to IndexedDB.
import { db, fileHash, uid } from './db.js';
import { detectFormat, titleFromName } from './parsers/detect.js';

export async function importBlob(blob, fileName, source = 'local') {
  const format = await detectFormat(blob, fileName);
  const hash = await fileHash(blob, fileName);
  const existing = (await db.allBooks()).find((b) => b.hash === hash);
  if (existing) {
    const err = new Error('duplicate');
    err.code = 'DUPLICATE';
    err.existingId = existing.id;
    throw err;
  }
  const { title, author, cover } = await extractMeta(blob, fileName, format);
  const book = {
    id: uid(),
    title: title || titleFromName(fileName),
    author: author || '',
    format,
    mime: blob.type || '',
    fileName,
    size: blob.size,
    hash,
    source,
    cover: cover || null, // dataURL (small) or null
    file: blob,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.putBook(book);
  await db.putProgress({
    bookId: book.id, percent: 0, status: 'not_started',
    locator: null, updatedAt: Date.now(), lastReadAt: null,
  });
  return book;
}

export async function importUrl(url) {
  const clean = String(url).trim();
  if (!/^https:\/\//i.test(clean)) throw new Error('url');
  const res = await fetch(clean);
  if (!res.ok) throw new Error('url');
  const blob = await res.blob();
  const name = clean.split('?')[0].split('/').pop() || 'book';
  return importBlob(blob, decodeURIComponent(name), 'url');
}

async function extractMeta(blob, fileName, format) {
  const fallbackTitle = titleFromName(fileName);
  try {
    if (format === 'EPUB') {
      const { parseEpub } = await import('./parsers/epub.js');
      const parsed = await parseEpub(blob);
      let cover = null;
      if (parsed.meta.coverUrl) {
        cover = await blobUrlToDataUrl(parsed.meta.coverUrl, 320).catch(() => null);
      }
      const title = parsed.meta.title || fallbackTitle;
      const author = parsed.meta.author || '';
      parsed.revoke();
      return { title, author, cover };
    }
    if (format === 'PDF') {
      const { openPdf } = await import('./parsers/pdf.js');
      const { doc, meta } = await openPdf(blob);
      let cover = null;
      try {
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(320, Math.floor(viewport.width));
        canvas.height = Math.floor(canvas.width * viewport.height / viewport.width);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: canvas.width / viewport.width }) }).promise;
        cover = canvas.toDataURL('image/jpeg', 0.7);
      } catch { /* no thumb */ }
      try { await doc.destroy(); } catch { /* ignore */ }
      return { title: meta.title || fallbackTitle, author: meta.author || '', cover };
    }
    if (format === 'DOCX') {
      const { parseDocx } = await import('./parsers/docx.js');
      const parsed = await parseDocx(blob, fallbackTitle);
      return { title: parsed.meta.title || fallbackTitle, author: parsed.meta.author || '', cover: null };
    }
    if (format === 'MD' || format === 'TXT' || format === 'HTML') {
      const text = await blob.slice(0, 20000).text();
      const first = text.split('\n').map((l) => l.trim()).find((l) => l && !/^#{0,3}\s*$/.test(l)) || '';
      const clean = first.replace(/^#+\s*/, '').replace(/[*_`]/g, '').slice(0, 120);
      return { title: clean || fallbackTitle, author: '', cover: null };
    }
    if (format === 'CBZ') {
      const { parseCbz } = await import('./parsers/cbz.js');
      const parsed = await parseCbz(blob);
      let cover = null;
      if (parsed.images[0]) cover = await blobUrlToDataUrl(parsed.images[0].url, 320).catch(() => null);
      parsed.revoke();
      return { title: fallbackTitle, author: '', cover };
    }
    if (format === 'IMAGE') {
      const url = URL.createObjectURL(blob);
      const cover = await blobUrlToDataUrl(url, 320).catch(() => null);
      URL.revokeObjectURL(url);
      return { title: fallbackTitle, author: '', cover };
    }
  } catch (e) {
    console.warn('meta extract failed, using fallback', e);
  }
  return { title: fallbackTitle, author: '', cover: null };
}

function blobUrlToDataUrl(url, maxW = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.max(1, Math.floor(img.naturalWidth * scale));
        const h = Math.max(1, Math.floor(img.naturalHeight * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.72));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}
