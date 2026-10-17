import { h, section, samplePicker, status, metricsTable, withMemory, chatConfig, progressLine, deviceSelect, modelInfo, fmtMs } from '../ui.js';
import { chromeAiStatus, chromeSummarize, loadChat } from '../lib/chat.js';
import { summarize } from '../lib/tasks.js';
import { loadModel } from '../lib/tf.js';
import { addRun } from '../lib/runs.js';
import { SUMMARY_MODELS } from '../models.js';
import { splitBySize } from '../lib/chat.js';

export default async function e3() {
  const chromeBox = h('div', { 'data-testid': 'chrome-status' }, h('p', { class: 'muted' }, 'Comprovant la IA de Chrome...'));
  const outs = {
    chrome: h('div', { 'data-testid': 'out-chrome' }),
    chat: h('div', { 'data-testid': 'out-chat' }),
    bart: h('div', { 'data-testid': 'out-bart' }),
  };
  const st = status();
  const prog = progressLine();
  const chat = chatConfig();
  const bartDevice = deviceSelect('auto');
  const picker = samplePicker({ defaultId: 'ca-llarg', onLoad: (s) => checkChrome(s.lang) });

  async function checkChrome(lang) {
    const s = await chromeAiStatus(lang);
    const ok = s.summarizer === 'available' || s.summarizer === 'downloadable' || s.summarizer === 'downloading';
    chromeBox.replaceChildren(
      h('p', {}, `API Summarizer per a "${lang}": `, h('strong', {}, s.summarizer), '. API Prompt: ', h('strong', {}, s.prompt), '.'),
      ok
        ? h('button', { onclick: runChrome, 'data-testid': 'run-chrome' }, 'Resumeix amb Chrome')
        : h('p', { class: 'warn', 'data-testid': 'chrome-unavailable' }, "La IA integrada de Chrome no està disponible en aquest navegador per a aquesta llengua. Cal Chrome d'escriptori recent amb Gemini Nano. El català no és una llengua de sortida suportada ara mateix."),
    );
  }

  function show(box, label, res, m) {
    box.replaceChildren(
      h('h3', {}, label),
      h('pre', { class: 'summary', 'data-testid': 'summary' }, res.text),
      res.partial ? h('details', {}, h('summary', {}, 'Resums parcials'), h('pre', { class: 'summary' }, res.partial.join('\n\n'))) : null,
      metricsTable(m),
    );
  }

  function record(engine, model, res, m) {
    const { pdf, sample } = picker;
    addRun({ experiment: 'E3', engine, sample: sample?.id ?? pdf.name, lang: picker.lang, model, metrics: m, output: { summary: res.text, partial: res.partial ?? null, calls: res.calls ?? null } });
  }

  async function runChrome() {
    const { pdf } = picker;
    try {
      st.set('Resumint amb Chrome...');
      const res = await chromeSummarize(pdf.text, picker.lang, prog.update);
      const m = withMemory({ backend: 'Chrome (Gemini Nano)', model: 'Summarizer API', downloadBytes: 0, loadMs: res.loadMs, runMs: res.runMs, pages: pdf.numPages });
      show(outs.chrome, 'IA de Chrome', res, m);
      record('chrome-summarizer', 'Gemini Nano', res, m);
      st.set('Fet.', 'ok');
    } catch (e) {
      st.set(`Error: ${e.message}`, 'error');
    }
  }

  async function runChat() {
    const { pdf } = picker;
    const cfg = chat.get();
    try {
      st.set('Carregant el model de xat...');
      const eng = await loadChat(cfg, prog.update);
      prog.textContent = '';
      st.set('Resumint...');
      const t0 = performance.now();
      const res = await summarize(eng, pdf.text, picker.lang, (s) => st.set(`Resumint: ${s}`));
      const runMs = performance.now() - t0;
      const toks = res.calls.reduce((a, c) => a + (c.tokens ?? 0), 0);
      const speeds = res.calls.map((c) => c.tokPerSec).filter(Boolean);
      const m = withMemory({
        ...eng.metrics,
        backend: eng.backend,
        model: eng.model,
        runMs,
        pages: pdf.numPages,
        extraRows: [
          ['Crides al model', String(res.calls.length)],
          ['Tokens generats', String(toks)],
          ['Velocitat de generació', speeds.length ? `${(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)} tokens/s` : 'n/d'],
        ],
      });
      show(outs.chat, `Model de xat: ${eng.model}`, res, m);
      record(eng.engine, eng.model, res, m);
      st.set('Fet.', 'ok');
    } catch (e) {
      console.error(e);
      st.set(`Error: ${e.message}`, 'error');
    }
  }

  async function runBart() {
    const { pdf } = picker;
    const meta = SUMMARY_MODELS[0];
    try {
      st.set('Carregant el model de resum...');
      const { obj: pipe, metrics: lm } = await loadModel({ kind: 'pipeline', task: 'summarization', id: meta.id, device: bartDevice.value, dtype: 'q8', onProgress: prog.update });
      prog.textContent = '';
      st.set('Resumint...');
      const t0 = performance.now();
      const parts = splitBySize(pdf.text, 2500);
      const partial = [];
      for (const p of parts) partial.push((await pipe(p, { max_new_tokens: 120 }))[0].summary_text);
      const text = parts.length > 1 ? (await pipe(partial.join(' '), { max_new_tokens: 160 }))[0].summary_text : partial[0];
      const res = { text, partial: parts.length > 1 ? partial : null };
      const m = withMemory({ ...lm, backend: lm.device, model: meta.id, runMs: performance.now() - t0, pages: pdf.numPages });
      show(outs.bart, `Model de resum: ${meta.id}${picker.lang !== 'en' ? ' (només anglès)' : ''}`, res, m);
      record('transformers-summarization', meta.id, res, m);
      st.set('Fet.', 'ok');
    } catch (e) {
      console.error(e);
      st.set(`Error: ${e.message}`, 'error');
    }
  }

  return h(
    'div',
    {},
    h('h1', {}, 'E3. Resumir'),
    h('p', { class: 'lead' }, 'Tres opcions per resumir el document en la seva llengua. Els resums es guarden perquè els puguis llegir. No hi ha cap puntuació automàtica de qualitat.'),
    section('1. Document', picker.el),
    section('Opció 1. IA integrada de Chrome', chromeBox, outs.chrome),
    section('Opció 2. Model de xat petit', chat.el, h('button', { onclick: runChat, 'data-testid': 'run-chat' }, 'Resumeix amb el model de xat'), outs.chat),
    section(
      'Opció 3. Model de resum específic',
      modelInfo(SUMMARY_MODELS[0]),
      h('div', { class: 'row' }, h('label', {}, 'Backend ', bartDevice), h('button', { onclick: runBart, 'data-testid': 'run-bart' }, 'Resumeix amb DistilBART')),
      outs.bart,
    ),
    section('Estat', prog, st, h('p', { class: 'muted' }, `Consell: amb WASM (CPU) un model de xat de 1,7B pot trigar ${fmtMs(5 * 60000)} o més per a un document de 10 pàgines.`)),
  );
}
