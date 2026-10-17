// E2: reconeixement d'entitats (persones, organitzacions, llocs) amb un model de Transformers.js.
import { resolveOverlaps, RULE_TYPES } from './pii-rules.js';

const KEEP = new Set(['PER', 'ORG', 'LOC']);
const MAX_CHUNK = 900; // caràcters per tros (el model talla a 512 tokens)

// Talla el text en trossos per línies, sense passar de MAX_CHUNK caràcters.
export function chunkText(text, max = MAX_CHUNK) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + max);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      const sp = text.lastIndexOf(' ', end);
      const cut = nl > start + max / 3 ? nl : sp > start + max / 3 ? sp : end;
      end = cut;
    }
    chunks.push({ start, text: text.slice(start, end) });
    start = end;
    while (start < text.length && /\s/.test(text[start])) start++;
  }
  return chunks;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// El pipeline no dona posicions: busquem la paraula descodificada dins del tros.
function locate(chunk, word, from) {
  const parts = word
    .trim()
    .split(/\s+/)
    .map((p) => p.split(/(?=[^\p{L}\p{N}])|(?<=[^\p{L}\p{N}])/u).map(escapeRe).join('\\s*'));
  if (!parts.length || !parts[0]) return null;
  const re = new RegExp(parts.join('\\s+'), 'gu');
  re.lastIndex = from;
  const m = re.exec(chunk);
  if (!m) {
    re.lastIndex = 0;
    const m2 = re.exec(chunk);
    return m2 ? { start: m2.index, end: m2.index + m2[0].length } : null;
  }
  return { start: m.index, end: m.index + m[0].length };
}

// Amplia una entitat fins als límits de paraula (el model a vegades marca només un tros).
function snapToWord(text, s, e) {
  while (s > 0 && /[\p{L}\p{N}·'’-]/u.test(text[s - 1])) s--;
  while (e < text.length && /[\p{L}\p{N}·-]/u.test(text[e])) e++;
  return [s, e];
}

export async function runNer(pipe, text, { minScore = 0.5 } = {}) {
  const out = [];
  for (const ch of chunkText(text)) {
    const groups = await pipe(ch.text, { aggregation_strategy: 'simple' });
    let cursor = 0;
    for (const g of groups) {
      const type = g.entity_group;
      if (!KEEP.has(type) || g.score < minScore) continue;
      const pos = locate(ch.text, g.word, cursor);
      if (!pos) continue;
      cursor = pos.end;
      const [s, e] = snapToWord(text, ch.start + pos.start, ch.start + pos.end);
      out.push({ type, text: text.slice(s, e), start: s, end: e, score: g.score, source: 'model' });
    }
  }
  return mergeAdjacent(text, out);
}

// Uneix entitats del mateix tipus separades només per espais (p. ex. nom i cognoms partits).
function mergeAdjacent(text, ents) {
  ents.sort((a, b) => a.start - b.start);
  const res = [];
  for (const e of ents) {
    const last = res[res.length - 1];
    if (last && last.type === e.type && e.start <= last.end + 2 && /^[ \t]*$/.test(text.slice(last.end, e.start))) {
      last.end = Math.max(last.end, e.end);
      last.text = text.slice(last.start, last.end);
      last.score = Math.min(last.score, e.score);
    } else if (!last || e.start >= last.end) res.push({ ...e });
  }
  return res;
}

const STREET = /^(carrer|c\/|calle|c\.|avinguda|avenida|avda\.?|av\.|pla[çz]a|passeig|paseo|rambla|ronda|camí|camino|travessera|pol[íi]gon|via)\b/i;

// Ajuda opcional: si una entitat LOC comença per un tipus de via, s'amplia amb el número i el pis.
export function extendAddresses(text, ents) {
  return ents.map((e) => {
    if (e.type !== 'LOC' || !STREET.test(e.text)) return e;
    const rest = text.slice(e.end, e.end + 40);
    // Fins a dos grups curts amb xifres després d'una coma (número, pis), sense agafar el codi postal.
    const m = /^(?:,\s*(?=[^,\n]*\d)(?!\d{5})[^,\n]{1,8}(?=,|\n|$)){1,2}/.exec(rest);
    if (!m) return e;
    const end = e.end + m[0].length;
    return { ...e, end, text: text.slice(e.start, end), extended: true };
  });
}

// Combina E1 (regles) i E2 (model). Si se solapen, guanyen les regles.
export function combine(rules, model) {
  return resolveOverlaps([...rules, ...model], [...RULE_TYPES, 'PER', 'ORG', 'LOC']);
}
