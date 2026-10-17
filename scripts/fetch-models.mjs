// Baixa models de Hugging Face a public/models/ perquè la web els serveixi des del mateix origen.
// És com es faria a producció (CSP connect-src 'self'). La carpeta no es puja al repo.
//
// Ús:
//   npm run fetch-models                      # NER, embeddings, resum i xat petit (Transformers.js)
//   npm run fetch-models -- --chat            # afegeix Qwen3 1.7B ONNX (uns 1,4 GB)
//   npm run fetch-models -- --webllm Qwen3.5-2B-q4f16_1-MLC   # model de WebLLM i la seva biblioteca WASM
//   npm run fetch-models -- --only Xenova/multilingual-e5-small
//
// Si cal un token (models amb accés restringit), posa HF_TOKEN al fitxer .env (vegeu .env.example).
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'models');
const HF = 'https://huggingface.co';

async function loadEnv() {
  try {
    const txt = await readFile(join(root, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sense .env */
  }
}

const DEFAULT = [
  { id: 'Xenova/bert-base-multilingual-cased-ner-hrl', dtype: 'q8' },
  { id: 'Xenova/distilbert-base-multilingual-cased-ner-hrl', dtype: 'q8' },
  { id: 'Xenova/multilingual-e5-small', dtype: 'q8' },
  { id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', dtype: 'q8' },
  { id: 'Xenova/distilbart-cnn-6-6', dtype: 'q8' },
  { id: 'onnx-community/Qwen3-0.6B-ONNX', dtype: 'q4' },
];
const CHAT = [{ id: 'onnx-community/Qwen3-1.7B-ONNX', dtype: 'q4' }];

const SUFFIX = { q8: '_quantized', q4: '_q4', q4f16: '_q4f16', fp16: '_fp16', fp32: '' };

function headers() {
  return process.env.HF_TOKEN ? { authorization: `Bearer ${process.env.HF_TOKEN}` } : {};
}

async function listFiles(id) {
  const r = await fetch(`${HF}/api/models/${id}/tree/main?recursive=true`, { headers: headers() });
  if (!r.ok) throw new Error(`No puc llistar ${id}: HTTP ${r.status}`);
  return (await r.json()).filter((f) => f.type === 'file');
}

function pickTjsFiles(files, dtype) {
  const suffix = SUFFIX[dtype];
  return files.filter((f) => {
    if (!f.path.includes('/') && f.path.endsWith('.json')) return true;
    const m = /^onnx\/(.+?)(\.onnx(?:_data(?:_\d+)?)?)$/.exec(f.path);
    if (!m) return false;
    const base = m[1];
    if (suffix === '') return !/_(quantized|q4|q4f16|fp16|int8|uint8|bnb4)$/.test(base);
    return base.endsWith(suffix);
  });
}

async function download(url, dest, size) {
  if (existsSync(dest) && size && (await stat(dest)).size === size) return 'ja hi era';
  await mkdir(dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status} a ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
  return 'baixat';
}

async function fetchTjs({ id, dtype }) {
  const files = pickTjsFiles(await listFiles(id), dtype);
  if (!files.some((f) => f.path.startsWith('onnx/'))) throw new Error(`${id} no té fitxers ONNX per a ${dtype}`);
  let bytes = 0;
  for (const f of files) {
    const st = await download(`${HF}/${id}/resolve/main/${f.path}`, join(OUT, id, f.path), f.size);
    bytes += f.size ?? 0;
    console.log(`  ${st.padEnd(9)} ${id}/${f.path} (${((f.size ?? 0) / 2 ** 20).toFixed(1)} MB)`);
  }
  return { id, kind: 'transformers', dtype, bytes, source: `${HF}/${id}`, files: files.map((f) => f.path) };
}

async function fetchWebLLM(modelId) {
  const webllm = await import('@mlc-ai/web-llm');
  const rec = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === modelId);
  if (!rec) throw new Error(`WebLLM no coneix ${modelId}`);
  const repo = rec.model.replace(`${HF}/`, '').replace(/\/$/, '');
  const files = await listFiles(repo);
  let bytes = 0;
  for (const f of files) {
    const st = await download(`${HF}/${repo}/resolve/main/${f.path}`, join(OUT, 'mlc', modelId, 'resolve', 'main', f.path), f.size);
    bytes += f.size ?? 0;
    console.log(`  ${st.padEnd(9)} ${modelId}/${f.path}`);
  }
  const libName = rec.model_lib.split('/').pop();
  await download(rec.model_lib, join(OUT, 'mlc-libs', libName));
  console.log(`  baixat    ${libName}`);
  return { id: modelId, kind: 'webllm', bytes, source: rec.model, model_lib: rec.model_lib, local_lib: `mlc-libs/${libName}`, overrides: rec.overrides ?? null, vram_required_MB: rec.vram_required_MB };
}

await loadEnv();
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const webllmIds = args.flatMap((a, i) => (a === '--webllm' ? [args[i + 1]] : []));
let list = only ? [{ id: only, dtype: args.includes('--dtype') ? args[args.indexOf('--dtype') + 1] : 'q8' }] : [...DEFAULT, ...(args.includes('--chat') ? CHAT : [])];
// Amb --webllm només es baixa aquest model, tret que s'afegeixi --with-defaults.
if (webllmIds.length && !only && !args.includes('--with-defaults')) list = [];

const manifestPath = join(OUT, 'manifest.json');
let manifest = { models: [] };
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
  /* nou */
}
const save = async () => {
  await mkdir(OUT, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
};
const upsert = (entry) => {
  manifest.models = manifest.models.filter((m) => m.id !== entry.id);
  manifest.models.push({ ...entry, fetchedAt: new Date().toISOString() });
};

let failed = 0;
for (const item of list) {
  console.log(`→ ${item.id} (${item.dtype})`);
  try {
    upsert(await fetchTjs(item));
    await save();
  } catch (e) {
    failed++;
    console.error(`  ✗ ${e.message}`);
  }
}
for (const id of webllmIds) {
  console.log(`→ WebLLM ${id}`);
  try {
    upsert(await fetchWebLLM(id));
    await save();
  } catch (e) {
    failed++;
    console.error(`  ✗ ${e.message}`);
  }
}
console.log(failed ? `Acabat amb ${failed} errors.` : 'Fet. Els models són a public/models/.');
process.exitCode = failed ? 1 : 0;
