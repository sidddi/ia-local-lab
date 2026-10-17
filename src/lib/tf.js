// Configuració de Transformers.js i càrrega de models amb mètriques.
import { netMark, netSince } from './net.js';
import { getGpuInfo } from './env-info.js';

const BASE = import.meta.env.BASE_URL;
let tfPromise = null;
let manifestPromise = null;

export function getTransformers() {
  tfPromise ??= import('@huggingface/transformers').then((tf) => {
    const { env } = tf;
    // El runtime ONNX (WASM) es serveix des del mateix origen, no des d'un CDN.
    env.backends.onnx.wasm.wasmPaths = new URL(`${BASE}ort/`, location.href).href;
    env.useWasmCache = false;
    env.fetch = (...args) => fetch(...args);
    env.allowLocalModels = false;
    env.localModelPath = `${BASE}models/`;
    return tf;
  });
  return tfPromise;
}

// Models copiats al mateix origen amb `npm run fetch-models` (public/models/manifest.json).
export function localManifest() {
  manifestPromise ??= fetch(`${BASE}models/manifest.json`, { headers: { accept: 'application/json' } })
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : { models: [] }))
    .then((m) => (Array.isArray(m?.models) ? m.models : []))
    .catch(() => []);
  return manifestPromise;
}

export async function localModels() {
  return (await localManifest()).map((m) => m.id);
}

export async function resolveDevice(pref) {
  if (pref === 'wasm') return 'wasm';
  const gpu = await getGpuInfo();
  if (pref === 'webgpu') return gpu.available ? 'webgpu' : 'wasm';
  return gpu.available ? 'webgpu' : 'wasm';
}

const cache = new Map();

// Carrega (o reaprofita) un model. Retorna l'objecte i les mètriques de càrrega.
export async function loadModel({ kind, task, id, device: devicePref = 'auto', dtype = 'q8', onProgress }) {
  const tf = await getTransformers();
  const device = await resolveDevice(devicePref);
  const key = `${kind}|${task}|${id}|${device}|${dtype}`;
  if (cache.has(key)) return { ...cache.get(key), metrics: { ...cache.get(key).metrics, reused: true } };

  const local = (await localModels()).includes(id);
  tf.env.allowLocalModels = local;
  tf.env.allowRemoteModels = !local;

  const files = new Map();
  const progress_callback = (p) => {
    if (p.file && typeof p.total === 'number' && p.total > 0) files.set(p.file, p.total);
    if (p.status === 'progress' && onProgress) {
      const total = [...files.values()].reduce((a, b) => a + b, 0);
      onProgress({ file: p.file, progress: p.progress, totalBytes: total });
    }
  };
  const mark = netMark();
  const t0 = performance.now();
  let obj;
  const opts = { device, dtype, progress_callback };
  if (kind === 'pipeline') {
    obj = await tf.pipeline(task, id, opts);
  } else if (kind === 'causal-lm') {
    const tokenizer = await tf.AutoTokenizer.from_pretrained(id, { progress_callback });
    const model = await tf.AutoModelForCausalLM.from_pretrained(id, opts);
    obj = { tokenizer, model };
  } else throw new Error(`Tipus desconegut: ${kind}`);
  const loadMs = performance.now() - t0;
  const net = netSince(mark);
  const metrics = {
    loadMs,
    downloadBytes: net.bytes,
    runtimeBytes: net.runtimeBytes,
    modelFilesBytes: [...files.values()].reduce((a, b) => a + b, 0),
    origins: net.origins,
    source: local ? 'mateix origen (/models)' : 'Hugging Face',
    device,
    dtype,
    reused: false,
  };
  const entry = { obj, metrics };
  cache.set(key, entry);
  return entry;
}

export async function disposeAll() {
  for (const { obj } of cache.values()) {
    try {
      await (obj.dispose?.() ?? obj.model?.dispose?.());
    } catch {
      /* res */
    }
  }
  cache.clear();
}
