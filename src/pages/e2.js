import { h, section, samplePicker, status, metricsTable, withMemory, entityTable, scoreBlock, deviceSelect, modelSelect, modelInfo, progressLine } from '../ui.js';
import { detectRules } from '../lib/pii-rules.js';
import { scoreEntities, RULE_TYPE_SET, MODEL_TYPES } from '../lib/score.js';
import { renderPreview } from '../lib/pdf.js';
import { loadModel, localManifest } from '../lib/tf.js';
import { runNer, combine, extendAddresses } from '../lib/ner.js';
import { addRun } from '../lib/runs.js';
import { NER_MODELS } from '../models.js';
import { slim, summaryTable } from './e1.js';

const ALL_TYPES = new Set([...RULE_TYPE_SET, ...MODEL_TYPES]);

export default async function e2() {
  const out = h('div', { 'data-testid': 'result' });
  const preview = h('div', { class: 'preview', 'data-testid': 'preview' });
  const metrics = h('div');
  const all = h('div', { 'data-testid': 'all-results' });
  const st = status();
  const prog = progressLine();
  const modelSel = modelSelect(NER_MODELS);
  const info = h('div', {}, modelInfo(NER_MODELS[0]));
  modelSel.addEventListener('change', () => info.replaceChildren(modelInfo(NER_MODELS.find((m) => m.id === modelSel.value))));
  // Model de prova dels tests (només si s'ha instal·lat a /models). No té cap qualitat.
  localManifest().then((list) => {
    for (const m of list.filter((x) => x.fixture)) modelSel.append(h('option', { value: m.id }, `${m.id} (model de prova sense qualitat)`));
  });
  const device = deviceSelect('auto');
  const dtype = h('select', { 'aria-label': 'Quantització', 'data-testid': 'dtype-select' }, ['q8', 'fp16', 'fp32', 'q4'].map((d) => h('option', { value: d }, d)));
  const addr = h('input', { type: 'checkbox', checked: true, 'data-testid': 'extend-addr' });
  const minScore = h('input', { type: 'number', min: '0', max: '1', step: '0.05', value: '0.5', 'aria-label': 'Puntuació mínima' });

  const picker = samplePicker({ kinds: ['personal', 'invoice'] });

  async function load() {
    st.set('Carregant el model...');
    const r = await loadModel({ kind: 'pipeline', task: 'token-classification', id: modelSel.value, device: device.value, dtype: dtype.value, onProgress: prog.update });
    prog.textContent = '';
    return r;
  }

  async function run() {
    const { pdf, truth, sample } = picker;
    if (!pdf) return null;
    try {
      const { obj: pipe, metrics: lm } = await load();
      st.set('Executant...');
      const t0 = performance.now();
      let model = await runNer(pipe, pdf.text, { minScore: Number(minScore.value) });
      if (addr.checked) model = extendAddresses(pdf.text, model);
      const runMs = performance.now() - t0;
      const rules = detectRules(pdf.text);
      const combined = combine(rules, model);
      const scoreModel = truth ? scoreEntities(model, truth.pii, MODEL_TYPES) : null;
      const scoreAll = truth ? scoreEntities(combined, truth.pii, ALL_TYPES) : null;
      out.replaceChildren(
        entityTable(combined),
        scoreModel ? scoreBlock(scoreModel, 'Només el model (persones, organitzacions, llocs)') : null,
        scoreAll ? scoreBlock(scoreAll, 'E1 + E2 combinats (totes les dades)') : h('p', { class: 'muted' }, 'Document sense resposta correcta: no es puntua.'),
      );
      const m = withMemory({ ...lm, backend: lm.device, model: modelSel.value, runMs, pages: pdf.numPages });
      metrics.replaceChildren(metricsTable(m));
      await renderPreview(preview, pdf, combined);
      st.set(`${model.length} entitats del model, ${combined.length} en total.`, 'ok');
      addRun({
        experiment: 'E2',
        sample: sample?.id ?? pdf.name,
        lang: picker.lang,
        model: modelSel.value,
        options: { dtype: dtype.value, extendAddresses: addr.checked, minScore: Number(minScore.value) },
        metrics: m,
        score: scoreAll && { model: slim(scoreModel), combined: slim(scoreAll) },
        output: combined.map(({ type, text, source }) => ({ type, text, source })),
      });
      return { scoreModel, scoreAll };
    } catch (e) {
      console.error(e);
      st.set(`Error: ${e.message}`, 'error');
      return null;
    }
  }

  async function runAll() {
    const rowsModel = [];
    const rowsAll = [];
    for (const s of await picker.samples()) {
      await picker.loadSample(s);
      const r = await run();
      if (r?.scoreAll) {
        rowsModel.push({ id: s.id, ...r.scoreModel });
        rowsAll.push({ id: s.id, ...r.scoreAll });
      }
    }
    all.replaceChildren(h('h3', {}, 'Només el model'), summaryTable(rowsModel), h('h3', {}, 'E1 + E2'), summaryTable(rowsAll));
  }

  return h(
    'div',
    {},
    h('h1', {}, 'E2. Dades personals amb model'),
    h('p', { class: 'lead' }, "Un model petit de reconeixement d'entitats (NER) troba noms de persones, organitzacions i llocs. Es combina amb les regles de E1."),
    section('1. Document', picker.el),
    section(
      '2. Model i execució',
      h('div', { class: 'row' }, h('label', {}, 'Model ', modelSel), h('label', {}, 'Backend ', device), h('label', {}, 'Quantització ', dtype)),
      info,
      h('div', { class: 'row' }, h('label', {}, addr, ' Amplia les adreces amb el número i el pis (regla d\'ajuda)'), h('label', {}, 'Puntuació mínima ', minScore)),
      h('div', { class: 'row' }, h('button', { onclick: run, 'data-testid': 'run' }, 'Executa'), h('button', { onclick: runAll, class: 'secondary', 'data-testid': 'run-all' }, 'Executa totes les mostres')),
      prog,
      st,
    ),
    section('3. Resultat', out, preview),
    section('4. Mètriques', metrics),
    section('Totes les mostres', all),
  );
}
