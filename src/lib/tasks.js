// Tasques amb model de xat: resum (E3), extracció de factures (E4) i preguntes amb context (E5).
import { splitBySize } from './chat.js';
import { INVOICE_FIELDS } from './score.js';

const P = {
  ca: {
    sys: 'Ets un assistent que treballa amb documents. Respon sempre en català, de manera clara i breu.',
    sumChunk: (t) => `Resumeix aquest fragment d'un document en 2 o 3 punts curts, en català:\n\n${t}`,
    sumFinal: (t) => `Aquests són resums parcials d'un mateix document. Escriu-ne un resum final en català, en 5 punts curts com a màxim:\n\n${t}`,
    sumOne: (t) => `Resumeix aquest document en català, en 5 punts curts com a màxim:\n\n${t}`,
    inv: (t) =>
      `Extreu els camps d'aquesta factura i respon només amb un objecte JSON amb aquestes claus:\n- emissor: nom de l'empresa que emet la factura\n- nif: NIF de l'emissor\n- data: data de la factura en format AAAA-MM-DD\n- base: base imposable (número)\n- iva: import de l'IVA (número)\n- total: total a pagar (número)\n\nFactura:\n${t}`,
    rag: (ctx, q) => `Respon la pregunta fent servir només aquests fragments del document. Si la resposta no hi és, digues que no ho saps. Respon en català amb una sola frase.\n\nFragments:\n${ctx}\n\nPregunta: ${q}`,
  },
  es: {
    sys: 'Eres un asistente que trabaja con documentos. Responde siempre en castellano, de forma clara y breve.',
    sumChunk: (t) => `Resume este fragmento de un documento en 2 o 3 puntos cortos, en castellano:\n\n${t}`,
    sumFinal: (t) => `Estos son resúmenes parciales de un mismo documento. Escribe un resumen final en castellano, en 5 puntos cortos como máximo:\n\n${t}`,
    sumOne: (t) => `Resume este documento en castellano, en 5 puntos cortos como máximo:\n\n${t}`,
    inv: (t) =>
      `Extrae los campos de esta factura y responde solo con un objeto JSON con estas claves:\n- emissor: nombre de la empresa que emite la factura\n- nif: NIF del emisor\n- data: fecha de la factura en formato AAAA-MM-DD\n- base: base imponible (número)\n- iva: importe del IVA (número)\n- total: total a pagar (número)\n\nFactura:\n${t}`,
    rag: (ctx, q) => `Responde la pregunta usando solo estos fragmentos del documento. Si la respuesta no está, di que no lo sabes. Responde en castellano con una sola frase.\n\nFragmentos:\n${ctx}\n\nPregunta: ${q}`,
  },
  en: {
    sys: 'You are an assistant that works with documents. Always answer in English, clearly and briefly.',
    sumChunk: (t) => `Summarise this part of a document in 2 or 3 short bullet points, in English:\n\n${t}`,
    sumFinal: (t) => `These are partial summaries of the same document. Write a final summary in English, in at most 5 short bullet points:\n\n${t}`,
    sumOne: (t) => `Summarise this document in English, in at most 5 short bullet points:\n\n${t}`,
    inv: (t) =>
      `Extract the fields of this invoice and answer only with a JSON object with these keys:\n- emissor: name of the company that issues the invoice\n- nif: tax ID (NIF) of the issuer\n- data: invoice date as YYYY-MM-DD\n- base: tax base (number)\n- iva: VAT amount (number)\n- total: total due (number)\n\nInvoice:\n${t}`,
    rag: (ctx, q) => `Answer the question using only these parts of the document. If the answer is not there, say you do not know. Answer in English in one sentence.\n\nParts:\n${ctx}\n\nQuestion: ${q}`,
  },
};

export function prompts(lang) {
  return P[lang] ?? P.en;
}

// Resum. Si el document no hi cap, map-reduce: resum per trossos i després resum dels resums.
export async function summarize(eng, text, lang, onStep = () => {}) {
  const p = prompts(lang);
  const calls = [];
  const call = async (content, maxTokens) => {
    const r = await eng.generate([{ role: 'system', content: p.sys }, { role: 'user', content }], { maxTokens });
    calls.push({ ms: r.ms, tokens: r.tokens, tokPerSec: r.tokPerSec });
    return r.text;
  };
  const max = eng.contextChars ?? 6000;
  if (text.length <= max) {
    onStep('Resum en una sola passada');
    return { text: await call(p.sumOne(text), 400), calls };
  }
  const parts = splitBySize(text, Math.floor(max / 2));
  const partial = [];
  for (let i = 0; i < parts.length; i++) {
    onStep(`Tros ${i + 1} de ${parts.length}`);
    partial.push(await call(p.sumChunk(parts[i]), 200));
  }
  onStep('Resum final');
  const final = await call(p.sumFinal(partial.join('\n\n')), 400);
  return { text: final, partial, calls };
}

export const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    emissor: { type: 'string' },
    nif: { type: 'string' },
    data: { type: 'string' },
    base: { type: 'number' },
    iva: { type: 'number' },
    total: { type: 'number' },
  },
  required: INVOICE_FIELDS,
};

export function parseJsonLoose(s) {
  const clean = s.replace(/```(?:json)?/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'No hi ha cap objecte JSON a la resposta' };
  try {
    return { ok: true, value: JSON.parse(clean.slice(start, end + 1)) };
  } catch (e) {
    return { ok: false, error: `JSON invàlid: ${e.message}` };
  }
}

// Validació del JSON contra l'esquema: claus presents i tipus correctes.
export function validateInvoice(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['No és un objecte'];
  for (const [k, def] of Object.entries(INVOICE_SCHEMA.properties)) {
    if (!(k in obj)) errors.push(`Falta "${k}"`);
    else if (def.type === 'number' && typeof obj[k] !== 'number') errors.push(`"${k}" no és un número`);
    else if (def.type === 'string' && typeof obj[k] !== 'string') errors.push(`"${k}" no és text`);
  }
  return errors;
}

export async function extractInvoice(eng, text, lang) {
  const p = prompts(lang);
  const r = await eng.generate([{ role: 'system', content: p.sys }, { role: 'user', content: p.inv(text) }], {
    maxTokens: 200,
    schema: INVOICE_SCHEMA,
  });
  const parsed = parseJsonLoose(r.text);
  return { raw: r.text, ms: r.ms, tokens: r.tokens, tokPerSec: r.tokPerSec, parsed, schemaErrors: parsed.ok ? validateInvoice(parsed.value) : [parsed.error] };
}

export async function answerWithContext(eng, passages, question, lang) {
  const p = prompts(lang);
  const ctx = passages.map((x, i) => `[${i + 1}] ${x.text}`).join('\n\n');
  const r = await eng.generate([{ role: 'system', content: p.sys }, { role: 'user', content: p.rag(ctx, question) }], { maxTokens: 120 });
  return r;
}
