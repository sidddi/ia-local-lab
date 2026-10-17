// Validació i càlcul d'identificadors espanyols i IBAN.
// Mòdul pur: es fa servir al navegador (E1) i a Node (generador de mostres i tests).

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_LETTERS = 'JABCDEFGHI';

export function dniLetter(num) {
  return DNI_LETTERS[Number(num) % 23];
}

export function normalizeId(s) {
  return String(s).toUpperCase().replace(/[\s.\-]/g, '');
}

export function isValidDni(s) {
  const v = normalizeId(s);
  const m = /^(\d{8})([A-Z])$/.exec(v);
  return !!m && dniLetter(m[1]) === m[2];
}

export function isValidNie(s) {
  const v = normalizeId(s);
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(v);
  if (!m) return false;
  const num = 'XYZ'.indexOf(m[1]) + m[2];
  return dniLetter(num) === m[3];
}

// Dígit de control d'un CIF / NIF de persona jurídica (7 dígits centrals).
export function cifControl(digits7) {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    let d = Number(digits7[i]);
    if (i % 2 === 0) {
      d *= 2;
      d = Math.floor(d / 10) + (d % 10);
    }
    sum += d;
  }
  const c = (10 - (sum % 10)) % 10;
  return { digit: String(c), letter: CIF_LETTERS[c] };
}

export function isValidCif(s) {
  const v = normalizeId(s);
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  const { digit, letter } = cifControl(m[2]);
  const first = m[1];
  if ('PQRSNW'.includes(first)) return m[3] === letter;
  if ('ABEH'.includes(first)) return m[3] === digit;
  return m[3] === digit || m[3] === letter;
}

function mod97(numeric) {
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem;
}

function ibanNumeric(rearranged) {
  return rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
}

export function isValidIban(s) {
  const v = normalizeId(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  if (v.startsWith('ES') && v.length !== 24) return false;
  return mod97(ibanNumeric(v.slice(4) + v.slice(0, 4))) === 1;
}

// Dígits de control del compte bancari espanyol (CCC).
function cccDigit(ten) {
  const w = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(ten[i]) * w[i];
  const r = 11 - (sum % 11);
  return r === 11 ? 0 : r === 10 ? 1 : r;
}

export function makeSpanishIban(entity, office, account) {
  const dc = `${cccDigit('00' + entity + office)}${cccDigit(account)}`;
  const bban = entity + office + dc + account;
  const check = 98 - mod97(ibanNumeric(bban + 'ES00'));
  return 'ES' + String(check).padStart(2, '0') + bban;
}

export function formatIban(v) {
  return normalizeId(v).replace(/(.{4})/g, '$1 ').trim();
}
