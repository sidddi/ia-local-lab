import { h, section, samplePicker, status, metricsTable, withMemory, entityTable, scoreBlock, pct } from '../ui.js';
import { detectRules } from '../lib/pii-rules.js';
import { scoreEntities, RULE_TYPE_SET } from '../lib/score.js';
import { renderPreview } from '../lib/pdf.js';
import { addRun } from '../lib/runs.js';

export function runE1(pdf) {
  const t0 = performance.now();
  const entities = detectRules(pdf.text);
  const runMs = performance.now() - t0;
  return { entities, runMs };
}

export default async function e1() {
  const out = h('div', { 'data-testid': 'result' });
  const preview = h('div', { class: 'preview', 'data-testid': 'preview' });
  const metrics = h('div');
  const all = h('div', { 'data-testid': 'all-results' });
  const st = status();

  const picker = samplePicker({ onLoad: () => run(false) });

  async function run(record = true) {
    const { pdf, truth, sample } = picker;
    if (!pdf) return;
    const { entities, runMs } = runE1(pdf);
    const score = truth ? scoreEntities(entities, truth.pii, RULE_TYPE_SET) : null;
    out.replaceChildren(entityTable(entities), score ? scoreBlock(score) : h('p', { class: 'muted' }, 'Document sense resposta correcta: no es puntua.'));
    const m = withMemory({ backend: 'JavaScript (sense model)', model: 'regles', downloadBytes: 0, loadMs: 0, runMs, pages: pdf.numPages });
    metrics.replaceChildren(metricsTable(m));
    await renderPreview(preview, pdf, entities);
    st.set(`${entities.length} deteccions.`, 'ok');
    if (record) addRun({ experiment: 'E1', sample: sample?.id ?? pdf.name, lang: picker.lang, model: 'regles', metrics: m, score: score && slim(score), output: entities.map(({ type, text }) => ({ type, text })) });
    return score;
  }

  async function runAll() {
    const rows = [];
    for (const s of await picker.samples()) {
      await picker.loadSample(s);
      const sc = await run();
      if (sc) rows.push({ id: s.id, ...sc });
    }
    all.replaceChildren(summaryTable(rows));
  }

  return h(
    'div',
    {},
    h('h1', {}, 'E1. Dades personals amb regles'),
    h('p', { class: 'lead' }, "Detecta DNI i NIE (validant la lletra), NIF d'empresa (validant el control), IBAN (validant el codi de control), telèfons espanyols, correus i codis postals quan el context ho indica. No fa servir cap model."),
    section('1. Document', picker.el),
    section('2. Executa', h('div', { class: 'row' }, h('button', { onclick: () => run(), 'data-testid': 'run' }, 'Executa'), h('button', { onclick: runAll, 'data-testid': 'run-all', class: 'secondary' }, 'Executa totes les mostres')), st),
    section('3. Resultat', out, preview),
    section('4. Mètriques', metrics),
    section('Totes les mostres', all),
  );
}

export function slim(score) {
  return {
    truth: score.truthCount,
    tp: score.tp,
    fp: score.fp,
    fn: score.fn,
    precision: score.precision,
    recall: score.recall,
    misses: score.misses.map((m) => `${m.type}:${m.value}`),
    falsePositives: score.falsePositives.map((m) => `${m.type}:${m.text}`),
    wrongType: score.wrongType.map((m) => `${m.type}:${m.text}>${m.expected}`),
    partial: score.hits.filter((x) => x.partial).map((x) => `${x.type}:${x.found}>${x.value}`),
    byType: score.byType,
  };
}

export function summaryTable(rows) {
  const sum = rows.reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn, truth: a.truth + r.truthCount }), { tp: 0, fp: 0, fn: 0, truth: 0 });
  return h(
    'table',
    { class: 'metrics', 'data-testid': 'summary-table' },
    h('thead', {}, h('tr', {}, ['Mostra', 'Encerts', 'Falsos positius', 'Oblits', 'Precisió', 'Cobertura'].map((x) => h('th', {}, x)))),
    h(
      'tbody',
      {},
      rows.map((r) => h('tr', {}, h('td', {}, r.id), h('td', {}, `${r.tp}/${r.truthCount}`), h('td', {}, String(r.fp)), h('td', {}, String(r.fn)), h('td', {}, pct(r.precision)), h('td', {}, pct(r.recall)))),
      h(
        'tr',
        { class: 'total' },
        h('td', {}, 'Total'),
        h('td', { 'data-testid': 'total-tp' }, `${sum.tp}/${sum.truth}`),
        h('td', { 'data-testid': 'total-fp' }, String(sum.fp)),
        h('td', { 'data-testid': 'total-fn' }, String(sum.fn)),
        h('td', {}, pct(sum.tp + sum.fp ? sum.tp / (sum.tp + sum.fp) : 1)),
        h('td', {}, pct(sum.truth ? sum.tp / sum.truth : 1)),
      ),
    ),
  );
}
