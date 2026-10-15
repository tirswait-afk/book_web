// Minimal EPUB parser: JSZip + OPF/NCX. Renders chapters sequentially with blob image URLs.
export async function parseEpub(blob) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);
  const get = (p) => zip.file(p);

  // 1. container.xml -> OPF path
  const containerFile = get('META-INF/container.xml');
  if (!containerFile) throw new Error('Bad EPUB: missing container.xml');
  const containerXml = await containerFile.async('string');
  const cDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  const rootfile = cDoc.getElementsByTagName('rootfile')[0];
  const opfPath = rootfile?.getAttribute('full-path');
  if (!opfPath) throw new Error('Bad EPUB: missing OPF');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. OPF: metadata + manifest + spine (getElementsByTagName: namespace-safe)
  const opfXml = await get(opfPath).async('string');
  const opf = new DOMParser().parseFromString(opfXml, 'application/xml');
  const tagText = (names) => {
    for (const n of names) {
      const v = opf.getElementsByTagName(n)[0]?.textContent?.trim();
      if (v) return v;
    }
    return '';
  };
  const title = tagText(['dc:title', 'title']) || 'Untitled';
  const author = tagText(['dc:creator', 'creator']) || '';
  const manifest = {};
  const manifestEl = opf.getElementsByTagName('manifest')[0];
  if (manifestEl) {
    [...manifestEl.getElementsByTagName('item')].forEach((it) => {
      manifest[it.getAttribute('id')] = {
        href: it.getAttribute('href'),
        type: it.getAttribute('media-type') || '',
      };
    });
  }
  const spineEl = opf.getElementsByTagName('spine')[0];
  const spine = spineEl ? [...spineEl.getElementsByTagName('itemref')].map((r) => r.getAttribute('idref')) : [];

  // 3. Cover lookup
  let coverUrl = null;
  try {
    const metas = [...opf.getElementsByTagName('meta')];
    const coverMeta = metas.find((m) => m.getAttribute('name') === 'cover');
    const coverId = coverMeta?.getAttribute('content');
    const coverItem = (coverId && manifest[coverId]) || Object.values(manifest).find((m) => /cover/i.test(m.href) && m.type.startsWith('image/'));
    if (coverItem) {
      const cf = get(opfDir + decodeURIComponent(coverItem.href));
      if (cf) {
        const b = await cf.async('blob');
        coverUrl = URL.createObjectURL(new Blob([b], { type: coverItem.type || 'image/jpeg' }));
      }
    }
  } catch { /* no cover */ }

  // 4. TOC (NCX or NAV)
  const toc = [];
  const ncxItem = Object.values(manifest).find((m) => m.type.includes('ncx'));
  if (ncxItem) {
    try {
      const ncxXml = await get(opfDir + decodeURIComponent(ncxItem.href)).async('string');
      const ncx = new DOMParser().parseFromString(ncxXml, 'application/xml');
      [...ncx.getElementsByTagName('navPoint')].forEach((np) => {
        const label = np.getElementsByTagName('text')[0]?.textContent?.trim();
        const src = np.getElementsByTagName('content')[0]?.getAttribute('src');
        if (label && src) toc.push({ title: label.slice(0, 140), src });
      });
    } catch { /* ignore */ }
  }

  // 5. Chapters: resolve each spine item, inline images as blob URLs, sanitize
  const blobCache = new Map(); // zipPath -> objectURL
  async function imgUrl(zipPath, mime) {
    if (blobCache.has(zipPath)) return blobCache.get(zipPath);
    const f = get(zipPath);
    if (!f) return null;
    const b = await f.async('blob');
    const u = URL.createObjectURL(new Blob([b], { type: mime || 'image/jpeg' }));
    blobCache.set(zipPath, u);
    return u;
  }

  const chapters = [];
  for (let i = 0; i < spine.length; i++) {
    const item = manifest[spine[i]];
    if (!item) continue;
    const rawHref = decodeURIComponent(item.href);
    const file = get(opfDir + rawHref);
    if (!file) continue;
    const raw = await file.async('string');
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed, form').forEach((n) => n.remove());
    // images
    const imgs = [...doc.querySelectorAll('img')];
    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:') || /^https?:/i.test(src)) continue;
      const base = rawHref.includes('/') ? rawHref.slice(0, rawHref.lastIndexOf('/') + 1) : '';
      const resolved = normalizePath(opfDir + base + decodeURIComponent(src.split('#')[0]));
      const u = await imgUrl(resolved);
      if (u) img.setAttribute('src', u);
      else img.removeAttribute('src');
      img.setAttribute('loading', 'lazy');
    }
    // strip event handlers + js links
    doc.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((a) => {
        if (a.name.toLowerCase().startsWith('on')) el.removeAttribute(a.name);
        if ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    const body = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
    const h1 = doc.querySelector('h1,h2')?.textContent?.trim().slice(0, 140) || '';
    chapters.push({ id: `ch-${i}`, title: h1 || `Chương ${i + 1}`, html: body, href: rawHref });
    if (chapters.length >= 400) break; // safety cap
  }
  if (!chapters.length) throw new Error('EPUB has no readable chapters');

  // Map NCX toc entries to chapter ids by href prefix
  const mappedToc = toc.slice(0, 300).map((e, i) => {
    const clean = e.src.split('#')[0].toLowerCase();
    const idx = chapters.findIndex((c) => c.href.toLowerCase().endsWith(clean.split('/').pop()));
    return { id: idx >= 0 ? chapters[idx].id : `ch-${Math.min(i, chapters.length - 1)}`, title: e.title, level: 1 };
  });
  // Fallback TOC from chapter headings
  const finalToc = mappedToc.length ? mappedToc : chapters.filter((c) => c.title).slice(0, 100).map((c) => ({ id: c.id, title: c.title, level: 1 }));

  return {
    meta: { title, author, coverUrl },
    chapters,
    toc: finalToc,
    revoke() { blobCache.forEach((u) => URL.revokeObjectURL(u)); if (coverUrl) URL.revokeObjectURL(coverUrl); },
  };
}

function normalizePath(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '.' || seg === '') { if (seg === '' && parts.length === 0) continue; if (seg === '.') continue; }
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}
