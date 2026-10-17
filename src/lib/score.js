// Puntuació automàtica contra la "resposta correcta" de cada mostra.
import { normalizeId } from './ids.js';

const ID_TYPES = new Set(['DNI', 'NIE', 'NIF', 'IBAN', 'TEL', 'EMAIL', 'CP']);
export const MODEL_TYPES = new Set(['PER', 'ORG', 'LOC']);

export function normText(s) {
  return String(s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

function normValue(type, v) {
  if (type === 'TEL') return normalizeId(v).replace(/^(\+34|0034)/, '');
  if (type === 'EMAIL') return String(v).toLowerCase();
  if (ID_TYPES.has(type)) return normalizeId(v);
  return normText(v);
}

// Coincidència d'entitats de model: una conté l'altra (mínim 3 lletres).
function fuzzyMatch(det, truth) {
  const a = normText(det);
  const b = normText(truth);
  if (a.length < 3) return false;
  return a === b || b.includes(a) || a.includes(b);
}

// Puntua una llista de deteccions contra la resposta correcta.
// types: tipus que es tenen en compte (p. ex. només els de regles per a E1).
export function scoreEntities(detections, truthPii, types) {
  const truth = truthPii.filter((t) => types.has(t.type));
  const dets = dedupe(detections.filter((d) => types.has(d.type)));
  const hits = [];
  const misses = [];
  const usedDet = new Set();
  for (const t of truth) {
    const idx = dets.findIndex((d, i) => {
      if (d.type !== t.type) return false;
      if (MODEL_TYPES.has(t.type)) return fuzzyMatch(d.text, t.value);
      return normValue(t.type, d.text) === normValue(t.type, t.value);
    });
    if (idx >= 0) {
      // Totes les deteccions que encaixen amb aquesta entitat compten com a encert, no com a fals positiu.
      dets.forEach((d, i) => {
        if (d.type === t.type && (MODEL_TYPES.has(t.type) ? fuzzyMatch(d.text, t.value) : normValue(t.type, d.text) === normValue(t.type, t.value))) usedDet.add(i);
      });
      const exact = normValue(t.type, dets[idx].text) === normValue(t.type, t.value);
      hits.push({ ...t, found: dets[idx].text, partial: !exact });
    } else misses.push(t);
  }
  // Una detecció de model que encaixa amb una entitat d'un altre tipus no es compta com a fals positiu greu,
  // però sí com a error de tipus.
  const falsePositives = [];
  const wrongType = [];
  dets.forEach((d, i) => {
    if (usedDet.has(i)) return;
    const other = truthPii.find((t) => t.type !== d.type && (MODEL_TYPES.has(t.type) || MODEL_TYPES.has(d.type) ? fuzzyMatch(d.text, t.value) : normValue(t.type, d.text) === normValue(t.type, t.value)));
    if (other) wrongType.push({ ...d, expected: other.type });
    else falsePositives.push(d);
  });
  const tp = hits.length;
  const fp = falsePositives.length + wrongType.length;
  const fn = misses.length;
  return {
    truthCount: truth.length,
    hits,
    misses,
    falsePositives,
    wrongType,
    tp,
    fp,
    fn,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: truth.length ? tp / truth.length : 1,
    byType: byType(truth, hits, falsePositives.concat(wrongType)),
  };
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const d of list) {
    const k = d.type + '|' + normValue(d.type, d.text);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

function byType(truth, hits, fps) {
  const out = {};
  for (const t of truth) (out[t.type] ??= { truth: 0, tp: 0, fp: 0 }).truth++;
  for (const h of hits) out[h.type].tp++;
  for (const f of fps) (out[f.type] ??= { truth: 0, tp: 0, fp: 0 }).fp++;
  return out;
}

export const RULE_TYPE_SET = ID_TYPES;

// ---------- Factures (E4) ----------

export function parseAmount(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  let s = String(v).replace(/[^\d.,-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return Number(s);
}

export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export const INVOICE_FIELDS = ['emissor', 'nif', 'data', 'base', 'iva', 'total'];

export function scoreInvoice(pred, truth) {
  const fields = {};
  for (const f of INVOICE_FIELDS) {
    const p = pred?.[f];
    const t = truth[f];
    let ok = false;
    if (f === 'emissor') ok = !!p && (normText(p).includes(normText(t)) || (normText(p).length > 5 && normText(t).includes(normText(p))));
    else if (f === 'nif') ok = !!p && normalizeId(p) === normalizeId(t);
    else if (f === 'data') ok = parseDate(p) === t;
    else ok = Math.abs(parseAmount(p) - t) < 0.011;
    fields[f] = { expected: t, got: p ?? null, ok };
  }
  const correct = Object.values(fields).filter((x) => x.ok).length;
  return { fields, correct, total: INVOICE_FIELDS.length };
}

// ---------- Preguntes (E5) ----------
// Només indica si la resposta conté la dada clau. No és una nota de qualitat.
export function containsKey(answer, keys) {
  const a = normText(answer);
  return keys.some((k) => a.includes(normText(k)));
}
