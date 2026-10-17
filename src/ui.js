// Petites utilitats d'interfície sense framework.
import { getSamples, fetchSample, loadPdf } from './lib/pdf.js';
import { memorySnapshot } from './lib/env-info.js';
import { getGpuInfo } from './lib/env-info.js';
import { WEBLLM_MODELS, TJS_CHAT_MODELS, LICENSE_TEXT } from './models.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtBytes(n) {
  if (n == null || Number.isNaN(n)) return 'n/d';
  if (n === 0) return '0 B';
  const u = ['B', 'kB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 2 ? 1 : 0)} ${u[i]}`;
}

export function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return 'n/d';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 120000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

export function pct(x) {
  return `${Math.round(x * 100)} %`;
}

export function section(title, ...children) {
  return h('section', { class: 'card' }, h('h2', {}, title), ...children);
}

export function status(text = '', kind = '') {
  const el = h('p', { class: `status ${kind}`, 'data-testid': 'status', role: 'status' }, text);
  el.set = (t, k = '') => {
    el.textContent = t;
    el.className = `status ${k}`;
  };
  return el;
}

// Mètriques comunes a tots els experiments.
export function metricsTable(m) {
  const rows = [
    ['Backend', m.backend ?? m.device ?? 'n/d'],
    ['Model', m.model ?? 'cap'],
    m.dtype ? ['Quantització', m.dtype] : null,
    ['Pes baixat ara (xarxa)', m.downloadBytes != null ? `${fmtBytes(m.downloadBytes)}${m.runtimeBytes ? ` (${fmtBytes(m.runtimeBytes)} de runtime WASM)` : ''}${m.downloadBytes === 0 && m.loadMs ? ' · des de la memòria cau' : ''}` : 'n/d'],
    m.modelFilesBytes ? ['Mida dels fitxers del model', fmtBytes(m.modelFilesBytes)] : null,
    m.source ? ["Origen del model", m.source] : null,
    ['Temps de càrrega del model', m.loadMs != null ? `${fmtMs(m.loadMs)}${m.reused ? ' (ja era a memòria)' : ''}` : 'n/d'],
    ['Temps per document', fmtMs(m.runMs)],
    m.pages ? ['Temps per pàgina', `${fmtMs(m.runMs / m.pages)} (${m.pages} pàg.)`] : null,
    ['Memòria (heap JS)', m.memory?.usedJSHeapMB != null ? `${m.memory.usedJSHeapMB} MB` : 'El navegador no la dona'],
  ].filter(Boolean);
  if (m.extraRows) rows.push(...m.extraRows);
  return h(
    'table',
    { class: 'metrics', 'data-testid': 'metrics' },
    h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))),
  );
}

export function withMemory(m) {
  return { ...m, memory: memorySnapshot() };
}

// Selector de document: mostra inclosa o PDF propi.
export function samplePicker({ kinds = null, defaultId = null, onLoad }) {
  const select = h('select', { 'data-testid': 'sample-select', 'aria-label': 'Mostra' });
  const file = h('input', { type: 'file', accept: 'application/pdf', 'data-testid': 'file-input', 'aria-label': 'PDF propi' });
  const info = h('p', { class: 'muted', 'data-testid': 'doc-info' }, 'Cap document carregat.');
  const state = { pdf: null, truth: null, sample: null, lang: 'ca' };
  const langSel = h(
    'select',
    { 'aria-label': 'Llengua del document', 'data-testid': 'lang-select' },
    ['ca', 'es', 'en'].map((l) => h('option', { value: l }, l)),
  );

  async function load(data, name, truth, sample) {
    info.textContent = 'Llegint el PDF...';
    try {
      state.pdf = await loadPdf(data, name);
      state.truth = truth;
      state.sample = sample;
      state.lang = sample?.lang ?? guessLang(state.pdf.text);
      langSel.value = state.lang;
      info.textContent = `${name}: ${state.pdf.numPages} pàgines, ${state.pdf.text.length} caràcters. Text extret en ${fmtMs(state.pdf.extractMs)}.${truth ? ' Té resposta correcta.' : ''}`;
      await onLoad?.(state);
    } catch (e) {
      info.textContent = `No s'ha pogut llegir: ${e.message}`;
    }
  }

  select.addEventListener('change', async () => {
    const s = (await getSamples()).find((x) => x.id === select.value);
    if (!s) return;
    const { data, truth } = await fetchSample(s);
    await load(data, s.pdf, truth, s);
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    select.value = '';
    // El fitxer es llegeix al navegador. No s'envia enlloc.
    await load(new Uint8Array(await f.arrayBuffer()), f.name, null, null);
  });
  langSel.addEventListener('change', () => (state.lang = langSel.value));

  getSamples().then(async (all) => {
    const list = kinds ? all.filter((s) => kinds.includes(s.kind)) : all;
    select.append(h('option', { value: '' }, 'Tria una mostra...'), ...list.map((s) => h('option', { value: s.id }, `${s.id} (${s.title})`)));
    const def = list.find((s) => s.id === defaultId) ?? list[0];
    if (def) {
      select.value = def.id;
      select.dispatchEvent(new Event('change'));
    }
  });

  state.el = h(
    'div',
    { class: 'picker' },
    h('label', {}, 'Mostra inclosa ', select),
    h('label', {}, 'o el teu PDF ', file),
    h('label', {}, 'Llengua ', langSel),
    info,
    h('p', { class: 'hint' }, 'El PDF es llegeix dins del navegador. No es puja enlloc.'),
  );
  state.samples = async () => {
    const all = await getSamples();
    return kinds ? all.filter((s) => kinds.includes(s.kind)) : all;
  };
  state.loadSample = async (s) => {
    const { data, truth } = await fetchSample(s);
    select.value = s.id;
    await load(data, s.pdf, truth, s);
  };
  return state;
}

function guessLang(text) {
  const t = text.toLowerCase();
  const score = (words) => words.reduce((n, w) => n + (t.match(new RegExp(`\\b${w}\\b`, 'g'))?.length ?? 0), 0);
  const ca = score(['els', 'amb', 'per', 'què', 'és', 'una', 'aquest', 'dels']);
  const es = score(['los', 'con', 'por', 'qué', 'es', 'una', 'este', 'del']);
  const en = score(['the', 'and', 'with', 'for', 'is', 'this', 'of']);
  return ca >= es && ca >= en ? 'ca' : es >= en ? 'es' : 'en';
}

export function deviceSelect(def = 'auto') {
  const sel = h(
    'select',
    { 'data-testid': 'device-select', 'aria-label': 'Backend' },
    h('option', { value: 'auto' }, 'Automàtic (WebGPU si n\'hi ha)'),
    h('option', { value: 'webgpu' }, 'WebGPU'),
    h('option', { value: 'wasm' }, 'WASM (CPU)'),
  );
  sel.value = def;
  return sel;
}

export function modelSelect(models, testid = 'model-select') {
  return h(
    'select',
    { 'data-testid': testid, 'aria-label': 'Model' },
    models.map((m) => h('option', { value: m.id }, `${m.label} · ${m.params} · ${m.license}${m.license_flag !== 'ok' ? ' ⚠' : ''}`)),
  );
}

export function modelInfo(m) {
  if (!m) return h('span');
  const size = typeof m.approxMB === 'number' ? m.approxMB : m.approxMB?.q8 ?? Object.values(m.approxMB ?? {})[0];
  return h(
    'p',
    { class: 'model-info' },
    h('a', { href: m.source, target: '_blank', rel: 'noopener noreferrer' }, m.id),
    ` · ${m.params} paràmetres · uns ${size} MB · ${m.license} (${LICENSE_TEXT[m.license_flag]}). ${m.notes ?? ''}`,
  );
}

// Configuració del model de xat compartida per E3, E4 i E5.
export function chatConfig() {
  const engine = h(
    'select',
    { 'data-testid': 'engine-select', 'aria-label': 'Motor' },
    h('option', { value: 'webllm' }, 'WebLLM (WebGPU)'),
    h('option', { value: 'transformers' }, 'Transformers.js (WASM o WebGPU)'),
    h('option', { value: 'chrome' }, 'IA de Chrome (API Prompt)'),
  );
  const model = h('select', { 'data-testid': 'chat-model-select', 'aria-label': 'Model de xat' });
  const device = deviceSelect('auto');
  const custom = h('input', { type: 'text', placeholder: 'Id de model propi (opcional)', 'aria-label': 'Model propi', 'data-testid': 'custom-model' });
  const info = h('div');
  const warn = h('p', { class: 'warn' });

  function refresh() {
    const list = engine.value === 'webllm' ? WEBLLM_MODELS : engine.value === 'transformers' ? TJS_CHAT_MODELS : [];
    model.replaceChildren(...list.map((m) => h('option', { value: m.id }, `${m.label} · ${m.params} · ${m.license}`)));
    model.disabled = !list.length;
    device.disabled = engine.value !== 'transformers';
    custom.disabled = engine.value === 'chrome';
    info.replaceChildren(modelInfo(list.find((m) => m.id === model.value)));
  }
  engine.addEventListener('change', refresh);
  model.addEventListener('change', refresh);

  getGpuInfo().then((g) => {
    if (!g.available) {
      engine.value = 'transformers';
      engine.querySelector('option[value=webllm]').textContent += ' · no disponible aquí';
      warn.textContent = `Aquest navegador no té WebGPU (${g.reason}). WebLLM no funcionarà; fes servir Transformers.js amb WASM.`;
    }
    refresh();
  });
  refresh();

  return {
    el: h(
      'div',
      { class: 'chat-config' },
      h('label', {}, 'Motor ', engine),
      h('label', {}, 'Model ', model),
      h('label', {}, 'Backend (Transformers.js) ', device),
      h('label', {}, custom),
      info,
      warn,
    ),
    get() {
      return { engine: engine.value, model: custom.value.trim() || model.value, device: device.value };
    },
  };
}

export function progressLine() {
  const el = h('p', { class: 'progress muted', 'data-testid': 'progress' });
  el.update = (p) => {
    if (p.text) el.textContent = p.text;
    else if (p.file) el.textContent = `Baixant ${p.file}: ${Math.round(p.progress ?? 0)} %${p.totalBytes ? ` (total ${fmtBytes(p.totalBytes)})` : ''}`;
  };
  return el;
}

export function entityTable(entities) {
  if (!entities.length) return h('p', { class: 'muted' }, 'Cap detecció.');
  return h(
    'table',
    { class: 'entities', 'data-testid': 'entities' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Tipus'), h('th', {}, 'Text'), h('th', {}, 'Origen'))),
    h(
      'tbody',
      {},
      entities.map((e) => h('tr', {}, h('td', {}, h('span', { class: `tag t-${e.type}` }, e.type)), h('td', {}, e.text), h('td', {}, e.source === 'model' ? `model (${(e.score ?? 0).toFixed(2)})` : 'regles'))),
    ),
  );
}

export function scoreBlock(score, title = 'Puntuació') {
  return h(
    'div',
    { class: 'score', 'data-testid': 'score' },
    h('h3', {}, title),
    h(
      'p',
      { class: 'score-line' },
      h('strong', { 'data-testid': 'score-tp' }, `Encerts: ${score.tp}/${score.truthCount}`),
      ` · Falsos positius: `,
      h('strong', { 'data-testid': 'score-fp' }, String(score.fp)),
      ` · Oblits: `,
      h('strong', { 'data-testid': 'score-fn' }, String(score.fn)),
      ` · Precisió ${pct(score.precision)} · Cobertura ${pct(score.recall)}`,
    ),
    score.misses.length ? h('p', {}, 'Oblits: ', score.misses.map((m) => `${m.type} "${m.value}"`).join(', ')) : null,
    score.falsePositives.length ? h('p', {}, 'Falsos positius: ', score.falsePositives.map((m) => `${m.type} "${m.text}"`).join(', ')) : null,
    score.wrongType?.length ? h('p', {}, 'Tipus equivocat: ', score.wrongType.map((m) => `"${m.text}" com a ${m.type} (era ${m.expected})`).join(', ')) : null,
    score.hits.some((x) => x.partial) ? h('p', { class: 'muted' }, 'Parcials: ', score.hits.filter((x) => x.partial).map((x) => `"${x.found}" per "${x.value}"`).join(', ')) : null,
  );
}
