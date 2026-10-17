// E1: detecció de dades personals amb regles (sense model).
// Retorna entitats { type, text, start, end, source: 'rules' } sobre el text del document.
import { isValidDni, isValidNie, isValidCif, isValidIban } from './ids.js';

// Ordre = prioritat quan dues deteccions se solapen.
const RULES = [
  {
    type: 'IBAN',
    re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
    valid: isValidIban,
  },
  {
    type: 'EMAIL',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: 'NIE',
    re: /\b[XYZ][ -]?\d{7}[ -]?[A-Z]\b/g,
    valid: isValidNie,
  },
  {
    type: 'DNI',
    re: /\b\d{8}[ -]?[A-Z]\b/g,
    valid: isValidDni,
  },
  {
    type: 'NIF',
    re: /\b[ABCDEFGHJNPQRSUVW][ -]?\d{7}[ -]?[0-9A-J]\b/g,
    valid: isValidCif,
  },
  {
    type: 'TEL',
    // Fixos i mòbils espanyols: 9 xifres que comencen per 6, 7, 8 o 9, amb prefix opcional.
    re: /(?<![\w+])(?:(?:\+|00)34[\s.-]?)?[6789](?:[\s.-]?\d){8}(?![\w])/g,
  },
  {
    type: 'CP',
    re: /(?<![\w.,])(?:0[1-9]|[1-4]\d|5[0-2])\d{3}(?![\w.,]|,\d)/g,
    valid: (m, text, index) => postalContext(text, index, m.length),
  },
];

const CP_KEYWORDS = /(c\.?\s?p\.?|codi postal|código postal|cod\. postal|postal code|postcode|zip)\s*[:.]?\s*$/i;
const STREET_WORDS = /\b(carrer|c\/|calle|avinguda|avenida|avda\.?|av\.|pla[çz]a|passeig|paseo|rambla|ronda|camí|camino|travessera|via|pol[íi]gon|street|road|avenue)\b/i;

// Un codi postal de 5 xifres només compta si el context ho indica:
// una paraula clau just abans, o el patró "adreça, 08001 Ciutat" / "08001 Ciutat" a l'inici de línia.
function postalContext(text, index, len) {
  const before = text.slice(Math.max(0, index - 30), index);
  if (CP_KEYWORDS.test(before)) return true;
  const after = text.slice(index + len, index + len + 40);
  const followedByTown = /^\s+\p{Lu}[\p{L}'·-]+/u.test(after);
  if (!followedByTown) return false;
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const linePrefix = text.slice(lineStart, index);
  if (linePrefix.trim() === '') return true;
  return /,\s*$/.test(linePrefix) && STREET_WORDS.test(linePrefix);
}

export function detectRules(text) {
  const found = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      const value = m[0];
      if (rule.valid && !rule.valid(value, text, m.index)) continue;
      found.push({ type: rule.type, text: value, start: m.index, end: m.index + value.length, source: 'rules' });
    }
  }
  return resolveOverlaps(found);
}

// Si dues deteccions se solapen, es queda la de més prioritat (ordre a RULES).
export function resolveOverlaps(list, priority = RULES.map((r) => r.type)) {
  const rank = (e) => {
    const i = priority.indexOf(e.type);
    return i === -1 ? priority.length : i;
  };
  const sorted = [...list].sort((a, b) => rank(a) - rank(b) || b.end - b.start - (a.end - a.start));
  const kept = [];
  for (const e of sorted) {
    if (kept.some((k) => e.start < k.end && k.start < e.end)) continue;
    kept.push(e);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export const RULE_TYPES = RULES.map((r) => r.type);
