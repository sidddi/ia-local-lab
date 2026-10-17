// Converteix els elements de text de PDF.js en text pla, i guarda on és cada tros
// per poder marcar les deteccions a la vista prèvia. Funció pura (navegador i Node).

export function itemsToText(items) {
  let text = '';
  const spans = [];
  let prev = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    if (prev && !prev.hasEOL && it.str && text && !/\s$/.test(text)) {
      // Mateixa línia: afegim un espai si hi ha un buit visible entre els dos trossos.
      const prevEnd = prev.transform[4] + prev.width;
      const gap = it.transform[4] - prevEnd;
      const fontSize = Math.abs(it.transform[3]) || 10;
      const sameLine = Math.abs(it.transform[5] - prev.transform[5]) < fontSize * 0.5;
      if (!sameLine) text += '\n';
      else if (gap > fontSize * 0.15) text += ' ';
    }
    const start = text.length;
    text += it.str;
    if (it.str) spans.push({ start, end: text.length, transform: it.transform, width: it.width, height: it.height });
    if (it.hasEOL) text += '\n';
    prev = it;
  }
  return { text, spans };
}

// Uneix pàgines en un sol text i retorna els desplaçaments de cada pàgina.
export function joinPages(pages) {
  let text = '';
  const offsets = [];
  pages.forEach((p, i) => {
    if (i > 0) text += '\n\n';
    offsets.push(text.length);
    text += p.text;
  });
  return { text, offsets };
}

export function pageOf(offsets, index) {
  let p = 0;
  for (let i = 0; i < offsets.length; i++) if (index >= offsets[i]) p = i;
  return p;
}
