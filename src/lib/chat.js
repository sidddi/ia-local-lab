// Motors de xat per a E3, E4 i E5. Tots tenen la mateixa interfície:
//   const eng = await loadChat(cfg, onProgress)
//   const { text, ms, tokens } = await eng.generate(messages, { maxTokens, schema })
import { netMark, netSince } from './net.js';
import { getGpuInfo } from './env-info.js';
import { loadModel, localManifest } from './tf.js';
import { WEBLLM_MODELS, TJS_CHAT_MODELS } from '../models.js';

let current = null;

export function currentChat() {
  return current;
}

export async function loadChat(cfg, onProgress = () => {}) {
  const key = JSON.stringify(cfg);
  if (current?.key === key) return { ...current, metrics: { ...current.metrics, reused: true } };
  await unloadChat();
  let eng;
  if (cfg.engine === 'webllm') eng = await loadWebLLM(cfg, onProgress);
  else if (cfg.engine === 'transformers') eng = await loadTjsChat(cfg, onProgress);
  else if (cfg.engine === 'chrome') eng = await loadChromePrompt(onProgress);
  else throw new Error(`Motor desconegut: ${cfg.engine}`);
  current = { key, ...eng };
  return current;
}

export async function unloadChat() {
  if (!current) return;
  try {
    await current.unload?.();
  } catch {
    /* res */
  }
  current = null;
}

// Treu el bloc de raonament dels models Qwen3, si n'hi ha.
export function stripThinking(s) {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim();
}

// ---------- WebLLM (WebGPU) ----------

async function loadWebLLM(cfg, onProgress) {
  const gpu = await getGpuInfo();
  if (!gpu.available) throw new Error(`WebLLM necessita WebGPU i aquest navegador no en té (${gpu.reason}).`);
  const webllm = await import('@mlc-ai/web-llm');
  const meta = WEBLLM_MODELS.find((m) => m.id === cfg.model) ?? { id: cfg.model };
  // Sense shader-f16 cal la variant q4f32.
  const modelId = gpu.shaderF16 || !meta.f32 ? meta.id : meta.f32;
  // Si el model és a /models (npm run fetch-models -- --webllm ...), es carrega des del mateix origen.
  const local = (await localManifest()).find((m) => m.kind === 'webllm' && m.id === modelId);
  let appConfig;
  if (local) {
    const base = new URL(`${import.meta.env.BASE_URL}models/`, location.href).href;
    const rec = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === modelId);
    appConfig = {
      ...webllm.prebuiltAppConfig,
      model_list: [{ ...rec, model: `${base}mlc/${modelId}/resolve/main/`, model_lib: `${base}${local.local_lib}` }],
    };
  }
  const mark = netMark();
  const t0 = performance.now();
  const engine = await webllm.CreateMLCEngine(modelId, {
    appConfig,
    initProgressCallback: (r) => onProgress({ progress: r.progress, text: r.text }),
  });
  const net = netSince(mark);
  return {
    engine: 'webllm',
    model: modelId,
    backend: 'webgpu',
    metrics: { loadMs: performance.now() - t0, downloadBytes: net.bytes, runtimeBytes: net.runtimeBytes, origins: net.origins, device: 'webgpu', source: local ? 'mateix origen (/models)' : 'Hugging Face', reused: false },
    contextChars: 9000,
    async generate(messages, { maxTokens = 512, schema } = {}) {
      const t = performance.now();
      const req = {
        messages,
        temperature: 0,
        max_tokens: maxTokens,
        extra_body: { enable_thinking: false },
      };
      if (schema) req.response_format = { type: 'json_object', schema: JSON.stringify(schema) };
      const r = await engine.chat.completions.create(req);
      return {
        text: stripThinking(r.choices[0].message.content ?? ''),
        ms: performance.now() - t,
        tokens: r.usage?.completion_tokens ?? null,
        promptTokens: r.usage?.prompt_tokens ?? null,
        tokPerSec: r.usage?.extra?.decode_tokens_per_s ?? null,
      };
    },
    async unload() {
      await engine.unload();
    },
  };
}

// ---------- Transformers.js (WASM o WebGPU) ----------

async function loadTjsChat(cfg, onProgress) {
  const meta = TJS_CHAT_MODELS.find((m) => m.id === cfg.model) ?? { id: cfg.model, dtype: { wasm: 'q4', webgpu: 'q4f16' } };
  const device = cfg.device ?? 'auto';
  const { getTransformers, resolveDevice } = await import('./tf.js');
  const resolved = await resolveDevice(device);
  const dtype = cfg.dtype || meta.dtype[resolved];
  const { obj, metrics } = await loadModel({ kind: 'causal-lm', id: meta.id, device: resolved, dtype, onProgress });
  const { tokenizer, model } = obj;
  const tf = await getTransformers();
  return {
    engine: 'transformers',
    model: meta.id,
    backend: resolved,
    metrics,
    contextChars: 6000,
    async generate(messages, { maxTokens = 512, schema } = {}) {
      const t = performance.now();
      const msgs = schema
        ? messages.map((m, i) => (i === messages.length - 1 ? { ...m, content: `${m.content}\n\nRespon només amb un objecte JSON vàlid.` } : m))
        : messages;
      const inputs = tokenizer.apply_chat_template(msgs, {
        add_generation_prompt: true,
        return_dict: true,
        enable_thinking: false,
      });
      let first = null;
      const streamer = new tf.TextStreamer(tokenizer, {
        skip_prompt: true,
        callback_function: () => {
          first ??= performance.now();
        },
      });
      const out = await model.generate({ ...inputs, max_new_tokens: maxTokens, do_sample: false, streamer });
      const promptLen = inputs.input_ids.dims.at(-1);
      const newTokens = out.slice(null, [promptLen, null]);
      const text = tokenizer.batch_decode(newTokens, { skip_special_tokens: true })[0];
      const n = newTokens.dims.at(-1);
      const end = performance.now();
      return {
        text: stripThinking(text),
        ms: end - t,
        tokens: n,
        promptTokens: promptLen,
        tokPerSec: first && n > 1 ? (n - 1) / ((end - first) / 1000) : null,
      };
    },
    async unload() {
      await model.dispose?.();
    },
  };
}

// ---------- IA integrada de Chrome ----------

export async function chromeAiStatus(lang = 'en') {
  const status = { summarizer: 'no existeix', prompt: 'no existeix' };
  try {
    if ('Summarizer' in self) {
      status.summarizer = await self.Summarizer.availability({
        type: 'key-points',
        format: 'plain-text',
        length: 'medium',
        expectedInputLanguages: [lang],
        outputLanguage: lang,
      });
    }
  } catch (e) {
    status.summarizer = `error: ${e.message}`;
  }
  try {
    if ('LanguageModel' in self) {
      status.prompt = await self.LanguageModel.availability({
        expectedInputs: [{ type: 'text', languages: [lang] }],
        expectedOutputs: [{ type: 'text', languages: [lang] }],
      });
    }
  } catch (e) {
    status.prompt = `error: ${e.message}`;
  }
  return status;
}

async function loadChromePrompt(onProgress) {
  if (!('LanguageModel' in self)) throw new Error("Aquest navegador no té l'API Prompt de Chrome (LanguageModel).");
  const t0 = performance.now();
  const base = await self.LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress({ progress: e.loaded, text: 'Chrome baixa Gemini Nano' }));
    },
  });
  return {
    engine: 'chrome',
    model: 'Gemini Nano (Chrome)',
    backend: 'chrome',
    metrics: { loadMs: performance.now() - t0, downloadBytes: 0, origins: [], device: 'chrome', reused: false, note: 'El pes el baixa Chrome fora de la pàgina.' },
    contextChars: 6000,
    async generate(messages, { schema } = {}) {
      const t = performance.now();
      const system = messages.find((m) => m.role === 'system');
      const session = await base.clone?.() ?? base;
      const rest = messages.filter((m) => m.role !== 'system');
      const prompt = (system ? `${system.content}\n\n` : '') + rest.map((m) => m.content).join('\n\n');
      const text = await session.prompt(prompt, schema ? { responseConstraint: schema } : undefined);
      if (session !== base) session.destroy?.();
      return { text, ms: performance.now() - t, tokens: null, promptTokens: null, tokPerSec: null };
    },
    async unload() {
      base.destroy?.();
    },
  };
}

export async function chromeSummarize(text, lang, onProgress = () => {}) {
  const opts = { type: 'key-points', format: 'plain-text', length: 'medium', expectedInputLanguages: [lang], outputLanguage: lang };
  const t0 = performance.now();
  const s = await self.Summarizer.create({
    ...opts,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress({ progress: e.loaded, text: 'Chrome baixa el model de resum' }));
    },
  });
  const loadMs = performance.now() - t0;
  const t1 = performance.now();
  // Si el text no hi cap, es resumeix per trossos i després es resumeixen els resums.
  const quota = s.inputQuota ?? Infinity;
  let summary;
  const usage = (await s.measureInputUsage?.(text)) ?? 0;
  if (usage <= quota) summary = await s.summarize(text);
  else {
    const parts = splitBySize(text, 6000);
    const partial = [];
    for (const p of parts) partial.push(await s.summarize(p));
    summary = await s.summarize(partial.join('\n'));
  }
  s.destroy?.();
  return { text: summary, loadMs, runMs: performance.now() - t1 };
}

export function splitBySize(text, max) {
  const paras = text.split(/\n{2,}/);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > max) {
      out.push(cur);
      cur = '';
    }
    if (p.length > max) {
      for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max));
      continue;
    }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) out.push(cur);
  return out;
}
