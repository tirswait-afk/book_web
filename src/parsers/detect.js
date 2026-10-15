// Format detection by extension + magic bytes (like NoCap FormatSniffer, simplified).
export const FORMATS = ['EPUB', 'PDF', 'TXT', 'MD', 'HTML', 'DOCX', 'CBZ', 'IMAGE'];

export function extOf(name = '') {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/);
  return m ? m[1] : '';
}

export async function detectFormat(blob, name = '') {
  const ext = extOf(name);
  const byExt = { epub: 'EPUB', pdf: 'PDF', txt: 'TXT', md: 'MD', markdown: 'MD', html: 'HTML', htm: 'HTML', docx: 'DOCX', cbz: 'CBZ', zip: 'CBZ', jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', webp: 'IMAGE', gif: 'IMAGE' };
  if (byExt[ext]) {
    // Disambiguate zip: EPUB vs DOCX vs CBZ by content
    if (ext === 'zip') return sniffZip(blob);
    return byExt[ext];
  }
  // Magic bytes fallback
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const ascii = (i, n) => String.fromCharCode(...head.slice(i, i + n));
  if (ascii(0, 4) === '%PDF') return 'PDF';
  if (head[0] === 0x50 && head[1] === 0x4b) return sniffZip(blob); // PK zip family
  if (head[0] === 0xff && head[1] === 0xd8) return 'IMAGE';
  if (ascii(1, 3) === 'PNG') return 'IMAGE';
  const textHead = await blob.slice(0, 2048).text().catch(() => '');
  if (/<!doctype html|<html/i.test(textHead)) return 'HTML';
  return 'TXT';
}

async function sniffZip(blob) {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files);
    if (names.some((n) => n.toLowerCase() === 'mimetype' || n.startsWith('META-INF/container'))) {
      const mt = zip.file('mimetype');
      if (mt) {
        const t = (await mt.async('string')).trim();
        if (t.includes('epub')) return 'EPUB';
      } else {
        return 'EPUB';
      }
    }
    if (names.some((n) => n.startsWith('word/document'))) return 'DOCX';
    const imgs = names.filter((n) => /\.(jpe?g|png|webp|gif)$/i.test(n));
    if (imgs.length > 0) return 'CBZ';
  } catch { /* fallthrough */ }
  return 'CBZ';
}

export function titleFromName(name = 'Untitled') {
  return String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}
