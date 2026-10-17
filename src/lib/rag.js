// E5: índex vectorial en memòria amb embeddings de Transformers.js.

// Talla el document en fragments d'unes quantes frases, amb una mica de solapament.
export function makePassages(pdf, { maxChars = 600, overlap = 1 } = {}) {
  const out = [];
  pdf.pages.forEach((page, pi) => {
    const sentences = page.text
      .replace(/\n(?!\n)/g, ' ')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=\p{Lu}|\d)/u)
      .filter((s) => s.trim().length > 0);
    let cur = [];
    let len = 0;
    for (const s of sentences) {
      if (len + s.length > maxChars && cur.length) {
        out.push({ page: pi + 1, text: cur.join(' ') });
        cur = cur.slice(-overlap);
        len = cur.reduce((a, b) => a + b.length, 0);
      }
      cur.push(s);
      len += s.length;
    }
    if (cur.length) out.push({ page: pi + 1, text: cur.join(' ') });
  });
  return out;
}

export async function embed(extractor, texts, prefix = '', batch = 8) {
  const vecs = [];
  for (let i = 0; i < texts.length; i += batch) {
    const t = await extractor(
      texts.slice(i, i + batch).map((x) => prefix + x),
      { pooling: 'mean', normalize: true },
    );
    const dim = t.dims.at(-1);
    for (let j = 0; j < t.dims[0]; j++) vecs.push(t.data.slice(j * dim, (j + 1) * dim));
  }
  return vecs;
}

export function topK(index, qv, k = 3) {
  return index
    .map((p, i) => {
      let s = 0;
      for (let d = 0; d < qv.length; d++) s += qv[d] * p.vec[d];
      return { i, score: s, ...p };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
