import { h, section, samplePicker, status, metricsTable, withMemory, chatConfig, progressLine } from '../ui.js';
import { loadChat } from '../lib/chat.js';
import { extractInvoice } from '../lib/tasks.js';
import { scoreInvoice, INVOICE_FIELDS } from '../lib/score.js';
import { addRun } from '../lib/runs.js';

export default async function e4() {
  const out = h('div', { 'data-testid': 'result' });
  const metrics = h('div');
  const all = h('div', { 'data-testid': 'all-results' });
  const st = status();
  const prog = progressLine();
  const chat = chatConfig();
  const picker = samplePicker({ kinds: ['invoice'] });

  async function run() {
    const { pdf, truth, sample } = picker;
    if (!pdf) return null;
    try {
      st.set('Carregant el model de xat...');
      const eng = await loadChat(chat.get(), prog.update);
      prog.textContent = '';
      st.set('Extraient els camps...');
      const res = await extractInvoice(eng, pdf.text, picker.lang);
      const score = truth?.invoice && res.parsed.ok ? scoreInvoice(res.parsed.value, truth.invoice) : null;
      out.replaceChildren(
        h('h3', {}, 'Resposta del model'),
        h('pre', { class: 'summary', 'data-testid': 'raw' }, res.raw),
        h('p', { 'data-testid': 'json-valid' }, res.parsed.ok && !res.schemaErrors.length ? 'JSON vàlid i amb tots els camps.' : `JSON amb problemes: ${res.schemaErrors.join('; ')}`),
        score ? fieldTable(score) : null,
      );
      const m = withMemory({ ...eng.metrics, backend: eng.backend, model: eng.model, runMs: res.ms, pages: pdf.numPages, extraRows: [['Tokens generats', String(res.tokens ?? 'n/d')]] });
      metrics.replaceChildren(metricsTable(m));
      st.set(score ? `${score.correct} de ${score.total} camps correctes.` : 'Fet.', 'ok');
      addRun({
        experiment: 'E4',
        engine: eng.engine,
        sample: sample?.id ?? pdf.name,
        lang: picker.lang,
        model: eng.model,
        metrics: m,
        score: score ? { correct: score.correct, total: score.total, fields: score.fields, jsonValid: res.parsed.ok, schemaErrors: res.schemaErrors } : { correct: 0, total: INVOICE_FIELDS.length, jsonValid: res.parsed.ok, schemaErrors: res.schemaErrors },
        output: { raw: res.raw },
      });
      return { id: sample?.id, score, valid: res.parsed.ok && !res.schemaErrors.length, ms: res.ms };
    } catch (e) {
      console.error(e);
      st.set(`Error: ${e.message}`, 'error');
      return null;
    }
  }

  async function runAll() {
    const rows = [];
    for (const s of await picker.samples()) {
      await picker.loadSample(s);
      const r = await run();
      if (r) rows.push(r);
    }
    all.replaceChildren(
      h(
        'table',
        { class: 'metrics', 'data-testid': 'summary-table' },
        h('thead', {}, h('tr', {}, ['Factura', 'JSON vàlid', 'Camps correctes', 'Temps'].map((x) => h('th', {}, x)))),
        h('tbody', {}, rows.map((r) => h('tr', {}, h('td', {}, r.id), h('td', {}, r.valid ? 'sí' : 'no'), h('td', {}, r.score ? `${r.score.correct}/${r.score.total}` : '0/6'), h('td', {}, `${(r.ms / 1000).toFixed(1)} s`)))),
      ),
    );
  }

  return h(
    'div',
    {},
    h('h1', {}, "E4. Extreure camps d'una factura"),
    h('p', { class: 'lead' }, "El model de xat de E3 extreu emissor, NIF, data, base, IVA i total en JSON. Es valida el JSON i es puntua cada camp."),
    section('1. Factura', picker.el),
    section('2. Model i execució', chat.el, h('div', { class: 'row' }, h('button', { onclick: run, 'data-testid': 'run' }, 'Executa'), h('button', { onclick: runAll, class: 'secondary', 'data-testid': 'run-all' }, 'Executa totes les factures')), prog, st),
    section('3. Resultat', out),
    section('4. Mètriques', metrics),
    section('Totes les factures', all),
  );
}

function fieldTable(score) {
  return h(
    'table',
    { class: 'metrics', 'data-testid': 'fields' },
    h('thead', {}, h('tr', {}, ['Camp', 'Esperat', 'Obtingut', ''].map((x) => h('th', {}, x)))),
    h(
      'tbody',
      {},
      Object.entries(score.fields).map(([k, v]) => h('tr', { class: v.ok ? 'ok' : 'ko' }, h('td', {}, k), h('td', {}, String(v.expected)), h('td', {}, v.got == null ? '(buit)' : String(v.got)), h('td', {}, v.ok ? '✓' : '✗'))),
    ),
  );
}
