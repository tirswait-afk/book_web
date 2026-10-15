// CBZ/ZIP of images + single IMAGE -> [{url, name}]. Caller must revoke URLs.
const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export async function parseCbz(blob) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);
  const entries = Object.values(zip.files)
    .filter((f) => !f.dir && IMG_RE.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!entries.length) throw new Error('No images in archive');
  const urls = [];
  for (const e of entries.slice(0, 600)) {
    const b = await e.async('blob');
    const mime = mimeOf(e.name);
    urls.push({ url: URL.createObjectURL(new Blob([b], { type: mime })), name: e.name.split('/').pop() });
  }
  return { images: urls, revoke() { urls.forEach((x) => URL.revokeObjectURL(x.url)); } };
}

export function singleImage(blob) {
  const url = URL.createObjectURL(blob);
  return { images: [{ url, name: 'cover' }], revoke() { URL.revokeObjectURL(url); } };
}

function mimeOf(name) {
  const ext = name.split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' }[ext] || 'image/jpeg';
}
