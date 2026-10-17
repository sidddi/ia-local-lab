// Lectura de PDF amb PDF.js: text per pàgina i vista prèvia amb marques.
// Build "legacy": funciona també en navegadors i mòbils no tan nous.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { itemsToText, joinPages, pageOf } from './pdf-text.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const BASE = import.meta.env.BASE_URL;
let worker = null;

export async function loadPdf(data, name = 'document.pdf') {
  const t0 = performance.now();
  // Un sol worker per a tota la sessió: així PDF.js continua funcionant sense connexió.
  worker ??= new pdfjs.PDFWorker();
  const doc = await pdfjs.getDocument({
    data,
    worker,
    standardFontDataUrl: `${BASE}pdfjs/standard_fonts/`,
    wasmUrl: `${BASE}pdfjs/wasm/`,
    isEvalSupported: false,
  }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(itemsToText(content.items));
  }
  const { text, offsets } = joinPages(pages);
  return { doc, name, pages, text, offsets, numPages: doc.numPages, extractMs: performance.now() - t0 };
}

export async function fetchSample(sample) {
  const [pdf, truth] = await Promise.all([
    fetch(`${BASE}samples/${sample.pdf}`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}samples/${sample.truth}`).then((r) => r.json()),
  ]);
  return { data: new Uint8Array(pdf), truth };
}

let samplesIndex = null;
export async function getSamples() {
  samplesIndex ??= await fetch(`${BASE}samples/index.json`).then((r) => r.json());
  return samplesIndex;
}

export const TYPE_COLORS = {
  DNI: '#e4572e',
  NIE: '#e4572e',
  NIF: '#f18f01',
  IBAN: '#9c27b0',
  TEL: '#2e86ab',
  EMAIL: '#3a7d44',
  CP: '#8d6e63',
  PER: '#d81b60',
  ORG: '#5e35b1',
  LOC: '#00897b',
};

let measureCtx = null;
function measure(str) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = '20px Helvetica, Arial, sans-serif';
  return measureCtx.measureText(str).width;
}

// Pinta les pàgines amb rectangles sobre les entitats detectades.
export async function renderPreview(container, pdf, entities, { scale = 1.1, maxPages = 3 } = {}) {
  container.replaceChildren();
  const n = Math.min(pdf.numPages, maxPages);
  for (let i = 0; i < n; i++) {
    const page = await pdf.doc.getPage(i + 1);
    const viewport = page.getViewport({ scale });
    const wrap = document.createElement('div');
    wrap.className = 'pdf-page';
    wrap.style.width = `${viewport.width}px`;
    wrap.style.height = `${viewport.height}px`;
    const canvas = document.createElement('canvas');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    wrap.append(canvas);
    container.append(wrap);
    try {
      await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
    } catch (e) {
      console.warn('No he pogut pintar la pàgina', e);
    }

    const pageOffset = pdf.offsets[i];
    const spans = pdf.pages[i].spans;
    for (const e of entities) {
      if (pageOf(pdf.offsets, e.start) !== i) continue;
      const s = e.start - pageOffset;
      const end = e.end - pageOffset;
      for (const sp of spans) {
        const a = Math.max(s, sp.start);
        const b = Math.min(end, sp.end);
        if (a >= b) continue;
        const tx = pdfjs.Util.transform(viewport.transform, sp.transform);
        const fontH = Math.hypot(tx[2], tx[3]);
        const w = sp.width * scale;
        // Posició dins del tros: proporcional a l'amplada real dels caràcters (aproximada amb Arial).
        const str = pdf.text.slice(pageOffset + sp.start, pageOffset + sp.end);
        const full = measure(str) || 1;
        const x0 = tx[4] + (w * measure(str.slice(0, a - sp.start))) / full;
        const x1 = tx[4] + (w * measure(str.slice(0, b - sp.start))) / full;
        const mark = document.createElement('div');
        mark.className = 'pdf-mark';
        mark.title = `${e.type}: ${e.text}${e.source ? ` (${e.source})` : ''}`;
        mark.style.cssText = `left:${x0 - 1}px;top:${tx[5] - fontH * 0.95}px;width:${x1 - x0 + 2}px;height:${fontH * 1.2}px;--c:${TYPE_COLORS[e.type] ?? '#555'}`;
        wrap.append(mark);
      }
    }
  }
  if (pdf.numPages > n) {
    const more = document.createElement('p');
    more.className = 'muted';
    more.textContent = `Es mostren ${n} de ${pdf.numPages} pàgines.`;
    container.append(more);
  }
}
