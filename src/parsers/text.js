// TXT / Markdown / HTML -> sanitized chapter HTML + TOC. No deps.
import { escapeHtml } from '../store.js';

export function parseTxt(text, title = '') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const paras = [];
  let buf = [];
  const flush = () => {
    const s = buf.join(' ').trim();
    if (s) paras.push(`<p>${escapeHtml(s)}</p>`);
    buf = [];
  };
  // First non-empty line becomes H1 if doc has no other structure
  let firstDone = false;
  for (const ln of lines) {
    if (!ln.trim()) { flush(); continue; }
    if (!firstDone && !title) { paras.push(`<h1>${escapeHtml(ln.trim())}</h1>`); firstDone = true; continue; }
    firstDone = true;
    // ALL-CAPS short lines -> h2 (chapter-ish)
    if (ln.trim().length < 80 && ln.trim() === ln.trim().toUpperCase() && /[A-ZÀ-Ỹ]{3,}/.test(ln)) {
      flush(); paras.push(`<h2>${escapeHtml(ln.trim())}</h2>`);
    } else buf.push(ln.trim());
  }
  flush();
  const html = paras.join('\n') || `<p>${escapeHtml(String(text).slice(0, 4000))}</p>`;
  return { chapters: [{ id: 'c0', title, html }], toc: [] };
}

export function parseMarkdown(src, title = '') {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let inCode = false, codeBuf = [];
  let listOpen = false;
  let paraBuf = [];

  const inline = (s) => {
    let e = escapeHtml(s);
    e = e.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
    e = e.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    e = e.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    e = e.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    e = e.replace(/`([^`]+)`/g, '<code>$1</code>');
    return e;
  };
  const flushPara = () => {
    if (paraBuf.length) { out.push(`<p>${inline(paraBuf.join(' '))}</p>`); paraBuf = []; }
  };
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };

  lines.forEach((ln, idx) => {
    if (/^```/.test(ln.trim())) {
      if (inCode) { out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushPara(); closeList(); inCode = true; }
      return;
    }
    if (inCode) { codeBuf.push(ln); return; }
    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length, text = h[2].trim();
      const id = `h-${idx}`;
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      if (level <= 3) toc.push({ id, title: text, level });
      return;
    }
    if (/^\s*---+\s*$/.test(ln)) { flushPara(); closeList(); out.push('<hr/>'); return; }
    if (/^\s*>\s?/.test(ln)) { flushPara(); closeList(); out.push(`<blockquote>${inline(ln.replace(/^\s*>\s?/, ''))}</blockquote>`); return; }
    const li = ln.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      return;
    }
    const ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) { flushPara(); closeList(); out.push(`<p>${inline(ln.trim())}</p>`); return; }
    if (/^\s*\|.*\|\s*$/.test(ln)) { // minimal table row -> paragraph (keep simple, avoid broken tables)
      if (/^\s*\|[\s:|-]+\|\s*$/.test(ln)) return;
      flushPara(); closeList();
      const cells = ln.split('|').map((c) => c.trim()).filter(Boolean);
      out.push(`<p class="md-row">${cells.map(inline).join(' · ')}</p>`);
      return;
    }
    if (!ln.trim()) { flushPara(); closeList(); return; }
    paraBuf.push(ln.trim());
  });
  flushPara(); closeList();
  if (inCode && codeBuf.length) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  return { chapters: [{ id: 'c0', title, html: out.join('\n') }], toc };
}

// Sanitize + extract body of an HTML doc. Resolves relative <img> only for blob docs (none here).
export function parseHtml(src, title = '') {
  const doc = new DOMParser().parseFromString(String(src), 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, form, nav, footer.header-site').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc') el.removeAttribute(a.name);
      if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
  });
  const root = doc.body || doc.documentElement;
  // Collect headings for TOC
  const toc = [];
  root.querySelectorAll('h1,h2,h3').forEach((h, i) => {
    const id = h.id || `hx-${i}`;
    h.id = id;
    toc.push({ id, title: (h.textContent || '').trim().slice(0, 120), level: Number(h.tagName[1]) });
  });
  return { chapters: [{ id: 'c0', title, html: root.innerHTML }], toc: toc.slice(0, 200) };
}
