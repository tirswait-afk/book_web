// Basic DOCX -> HTML (paragraphs + headings + bold/italic). Images skipped in v1.
export async function parseDocx(blob, title = '') {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(blob);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Bad DOCX');
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  const paras = [...doc.getElementsByTagName('w:p')];
  const htmlParts = [];
  const toc = [];
  paras.forEach((p, i) => {
    const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
    const runs = [...p.getElementsByTagName('w:r')].map((r) => {
      const t = [...r.getElementsByTagName('w:t')].map((n) => n.textContent).join('');
      if (!t) return '';
      const props = r.getElementsByTagName('w:rPr')[0];
      const b = props?.getElementsByTagName('w:b').length > 0;
      const it = props?.getElementsByTagName('w:i').length > 0;
      let e = escapeXml(t);
      if (b) e = `<strong>${e}</strong>`;
      if (it) e = `<em>${e}</em>`;
      return e;
    }).join('');
    if (!runs.trim()) return;
    if (/^Heading1/i.test(style)) {
      const id = `dx-${i}`;
      htmlParts.push(`<h1 id="${id}">${runs}</h1>`);
      toc.push({ id, title: p.textContent.trim().slice(0, 120), level: 1 });
    } else if (/^Heading2/i.test(style)) {
      const id = `dx-${i}`;
      htmlParts.push(`<h2 id="${id}">${runs}</h2>`);
      toc.push({ id, title: p.textContent.trim().slice(0, 120), level: 2 });
    } else if (/^Heading3/i.test(style)) {
      const id = `dx-${i}`;
      htmlParts.push(`<h3 id="${id}">${runs}</h3>`);
      toc.push({ id, title: p.textContent.trim().slice(0, 120), level: 3 });
    } else {
      htmlParts.push(`<p>${runs}</p>`);
    }
  });
  // core props for author/title
  let author = '';
  try {
    const core = await zip.file('docProps/core.xml')?.async('string');
    if (core) {
      const cd = new DOMParser().parseFromString(core, 'application/xml');
      author = cd.getElementsByTagName('dc:creator')[0]?.textContent || '';
      const t = cd.getElementsByTagName('dc:title')[0]?.textContent;
      if (t) title = t;
    }
  } catch { /* ignore */ }
  return { meta: { title, author }, chapters: [{ id: 'c0', title, html: htmlParts.join('\n') }], toc: toc.slice(0, 200) };
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
