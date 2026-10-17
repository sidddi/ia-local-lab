// Registre de models del laboratori. Pes aproximat del fitxer que es baixa amb la configuració per defecte.
// La mida real la mesura la web (mètrica "Pes baixat").
// license_flag: 'ok' (permet ús comercial sense condicions especials) | 'cond' (amb condicions) | 'nc' (no comercial)

export const NER_MODELS = [
  {
    id: 'Xenova/bert-base-multilingual-cased-ner-hrl',
    label: 'mBERT NER HRL (base)',
    source: 'https://huggingface.co/Xenova/bert-base-multilingual-cased-ner-hrl',
    upstream: 'https://huggingface.co/Davlan/bert-base-multilingual-cased-ner-hrl',
    params: '177M',
    approxMB: { q8: 178, fp32: 709 },
    license: 'AFL-3.0',
    license_flag: 'ok',
    notes: "Entrenat en 10 llengües (inclou es i en, no ca). El preentrenament de mBERT sí que inclou el català.",
  },
  {
    id: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    label: 'DistilmBERT NER HRL',
    source: 'https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl',
    upstream: 'https://huggingface.co/Davlan/distilbert-base-multilingual-cased-ner-hrl',
    params: '135M',
    approxMB: { q8: 135, fp32: 540 },
    license: 'AFL-3.0',
    license_flag: 'ok',
    notes: 'Versió destil·lada: més petita i més ràpida, una mica menys precisa.',
  },
];

export const EMBEDDING_MODELS = [
  {
    id: 'Xenova/multilingual-e5-small',
    label: 'multilingual-e5-small',
    source: 'https://huggingface.co/Xenova/multilingual-e5-small',
    upstream: 'https://huggingface.co/intfloat/multilingual-e5-small',
    params: '118M',
    approxMB: { q8: 118, fp32: 470 },
    license: 'MIT',
    license_flag: 'ok',
    prefixes: { query: 'query: ', passage: 'passage: ' },
    notes: 'Basat en XLM-R: el català és al preentrenament.',
  },
  {
    id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    label: 'paraphrase-multilingual-MiniLM-L12-v2',
    source: 'https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    upstream: 'https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    params: '118M',
    approxMB: { q8: 118, fp32: 470 },
    license: 'Apache-2.0',
    license_flag: 'ok',
    prefixes: { query: '', passage: '' },
    notes: '50+ llengües, el català inclòs a les dades de paràfrasi.',
  },
];

// Models de xat per a WebLLM (només WebGPU). Pes aproximat dels pesos q4f16.
export const WEBLLM_MODELS = [
  {
    id: 'Qwen3.5-2B-q4f16_1-MLC',
    f32: 'Qwen3.5-2B-q4f32_1-MLC',
    label: 'Qwen3.5 2B (recomanat)',
    source: 'https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC',
    params: '2B',
    approxMB: 1300,
    vramMB: 2245,
    license: 'Apache-2.0',
    license_flag: 'ok',
    notes: 'Multilingüe (201 llengües segons Qwen), inclou català.',
  },
  {
    id: 'Qwen3-1.7B-q4f16_1-MLC',
    f32: 'Qwen3-1.7B-q4f32_1-MLC',
    label: 'Qwen3 1.7B',
    source: 'https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC',
    params: '1.7B',
    approxMB: 1000,
    vramMB: 2037,
    license: 'Apache-2.0',
    license_flag: 'ok',
    notes: '119 llengües segons Qwen, inclou català.',
  },
  {
    id: 'Qwen3.5-4B-q4f16_1-MLC',
    f32: 'Qwen3.5-4B-q4f32_1-MLC',
    label: 'Qwen3.5 4B (portàtils bons)',
    source: 'https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC',
    params: '4B',
    approxMB: 2500,
    vramMB: 3868,
    license: 'Apache-2.0',
    license_flag: 'ok',
    notes: 'Més qualitat, el doble de pes.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    f32: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    label: 'Llama 3.2 3B ⚠ llicència',
    source: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC',
    params: '3B',
    approxMB: 1800,
    vramMB: 2264,
    license: 'Llama 3.2 Community License',
    license_flag: 'cond',
    notes: 'Llicència amb condicions (política d\'ús, atribució, límit de 700M usuaris). Català no és llengua oficialment suportada.',
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    f32: 'gemma-2-2b-it-q4f32_1-MLC',
    label: 'Gemma 2 2B ⚠ llicència',
    source: 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC',
    params: '2.6B',
    approxMB: 1400,
    vramMB: 1895,
    license: 'Gemma Terms of Use',
    license_flag: 'cond',
    notes: "Termes d'ús de Gemma amb restriccions d'ús.",
  },
];

// Models de xat per a Transformers.js (WASM o WebGPU). Serveixen per provar-ho tot sense WebGPU.
export const TJS_CHAT_MODELS = [
  {
    id: 'onnx-community/Qwen3-1.7B-ONNX',
    label: 'Qwen3 1.7B (ONNX)',
    source: 'https://huggingface.co/onnx-community/Qwen3-1.7B-ONNX',
    params: '1.7B',
    dtype: { wasm: 'q4', webgpu: 'q4f16' },
    approxMB: 1400,
    license: 'Apache-2.0',
    license_flag: 'ok',
    notes: 'Mateix model que a WebLLM, en format ONNX.',
  },
  {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    label: 'Qwen3 0.6B (ONNX, per proves)',
    source: 'https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX',
    params: '0.6B',
    dtype: { wasm: 'q4', webgpu: 'q4f16' },
    approxMB: 550,
    license: 'Apache-2.0',
    license_flag: 'ok',
    notes: 'Per sota de 1B: només per comprovar que el flux funciona amb CPU.',
  },
];

export const SUMMARY_MODELS = [
  {
    id: 'Xenova/distilbart-cnn-6-6',
    label: 'DistilBART CNN 6-6',
    source: 'https://huggingface.co/Xenova/distilbart-cnn-6-6',
    upstream: 'https://huggingface.co/sshleifer/distilbart-cnn-6-6',
    params: '230M',
    approxMB: { q8: 290 },
    license: 'Apache-2.0',
    license_flag: 'ok',
    langs: ['en'],
    notes: 'Només anglès. No hi ha cap model de resum específic petit i multilingüe en ONNX que funcioni bé en català.',
  },
];

export const CHROME_AI = {
  label: 'IA integrada de Chrome (Gemini Nano)',
  source: 'Chrome la baixa i la gestiona (no passa per aquesta web)',
  license: 'Google Generative AI Prohibited Uses Policy + termes de Chrome',
  license_flag: 'cond',
};

export const LICENSE_TEXT = {
  ok: 'Permet ús comercial',
  cond: '⚠ Ús comercial amb condicions',
  nc: '⛔ No comercial',
};

export function findModel(id) {
  return [...NER_MODELS, ...EMBEDDING_MODELS, ...WEBLLM_MODELS, ...TJS_CHAT_MODELS, ...SUMMARY_MODELS].find(
    (m) => m.id === id || m.f32 === id,
  );
}
