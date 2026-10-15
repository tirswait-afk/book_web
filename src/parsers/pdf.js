// PDF.js wrapper (bundled offline via npm). Lazy-loaded only when opening a PDF.
let libPromise = null;

export async function loadPdfjs() {
  if (!libPromise) {
    libPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return libPromise;
}

export async function openPdf(blob) {
  const pdfjs = await loadPdfjs();
  const buf = await blob.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let meta = { title: '', author: '' };
  try {
    const md = await doc.getMetadata().catch(() => null);
    if (md?.info) {
      meta.title = md.info.Title || '';
      meta.author = md.info.Author || '';
    }
  } catch { /* ignore */ }
  return { doc, numPages: doc.numPages, meta };
}
