import { h, section, fmtBytes, fmtMs, pct } from '../ui.js';
import { loadRuns, clearRuns, exportRuns } from '../lib/runs.js';
import { getDeviceInfo } from '../lib/env-info.js';
import { originsContacted } from '../lib/net.js';

export default async function results() {
  const body = h('div');
  const page = h(
    'div',
    {},
    h('h1', {}, 'Resultats'),
    h('p', { class: 'lead' }, "Totes les execucions d'aquest navegador. L'exportació inclou el navegador i el dispositiu."),
    h(
      'div',
      { class: 'row' },
      h('button', { onclick: () => exportRuns(), 'data-testid': 'export-results' }, 'Exporta els resultats (JSON)'),
      h(
        'button',
        {
          class: 'secondary',
          onclick: () => {
            if (confirm('Vols esborrar totes les execucions guardades en aquest navegador?')) clearRuns();
          },
        },
        'Esborra-ho tot',
      ),
    ),
    body,
  );

  async function render() {
    const runs = loadRuns();
    const d = await getDeviceInfo();
    const by = (e) => runs.filter((r) => r.experiment === e);
    body.replaceChildren(
      section(
        'Dispositiu',
        h('p', {}, `${d.browser ?? d.userAgent} · ${d.platform} · ${d.cpuThreads ?? '?'} fils · WebGPU: ${d.webgpu.available ? 'sí' : 'no'}`),
        h('p', { class: 'muted' }, `Orígens contactats en aquesta sessió: ${originsContacted().map((o) => o.origin).join(', ') || 'cap'}`),
      ),
      section('E1. Regles', table(by('E1'), [['Mostra', (r) => r.sample], ['Encerts', (r) => (r.score ? `${r.score.tp}/${r.score.truth}` : 'n/d')], ['FP', (r) => r.score?.fp ?? 'n/d'], ['Oblits', (r) => r.score?.fn ?? 'n/d'], ['Temps', (r) => fmtMs(r.metrics.runMs)]])),
      section(
        'E2. Entitats',
        table(by('E2'), [
          ['Mostra', (r) => r.sample],
          ['Model', (r) => r.model.split('/').pop()],
          ['Backend', (r) => r.metrics.backend],
          ['Model: encerts / FP', (r) => (r.score ? `${r.score.model.tp}/${r.score.model.truth} · ${r.score.model.fp}` : 'n/d')],
          ['E1+E2: encerts / FP', (r) => (r.score ? `${r.score.combined.tp}/${r.score.combined.truth} · ${r.score.combined.fp}` : 'n/d')],
          ['Càrrega', (r) => fmtMs(r.metrics.loadMs)],
          ['Baixat', (r) => fmtBytes(r.metrics.downloadBytes)],
          ['Temps', (r) => fmtMs(r.metrics.runMs)],
        ]),
      ),
      section(
        'E3. Resums',
        table(by('E3'), [
          ['Mostra', (r) => r.sample],
          ['Motor', (r) => r.engine],
          ['Model', (r) => r.model],
          ['Càrrega', (r) => fmtMs(r.metrics.loadMs)],
          ['Temps', (r) => fmtMs(r.metrics.runMs)],
        ]),
        by('E3').map((r) => h('details', {}, h('summary', {}, `${r.sample} · ${r.model} · ${new Date(r.ts).toLocaleString()}`), h('pre', { class: 'summary' }, r.output.summary))),
      ),
      section(
        'E4. Factures',
        table(by('E4'), [
          ['Mostra', (r) => r.sample],
          ['Model', (r) => r.model],
          ['JSON vàlid', (r) => (r.score?.jsonValid ? 'sí' : 'no')],
          ['Camps', (r) => `${r.score?.correct ?? 0}/${r.score?.total ?? 6}`],
          ['Temps', (r) => fmtMs(r.metrics.runMs)],
        ]),
      ),
      section(
        'E5. Preguntes',
        table(by('E5'), [
          ['Mostra', (r) => r.sample],
          ['Model', (r) => r.model],
          ['Recuperació amb dada clau', (r) => `${r.score.retrievalHits}/${r.score.questions}`],
          ['Respostes amb dada clau', (r) => (r.score.answerKeyHits == null ? 'n/d' : `${r.score.answerKeyHits}/${r.score.questions}`)],
          ['Temps total', (r) => fmtMs(r.metrics.runMs)],
        ]),
      ),
    );
  }
  page.addEventListener('page-show', render);
  window.addEventListener('runs-changed', render);
  await render();
  return page;
}

function table(runs, cols) {
  if (!runs.length) return h('p', { class: 'muted' }, 'Encara no hi ha execucions.');
  return h(
    'table',
    { class: 'metrics' },
    h('thead', {}, h('tr', {}, cols.map(([k]) => h('th', {}, k)))),
    h('tbody', {}, runs.map((r) => h('tr', {}, cols.map(([, f]) => h('td', {}, String(f(r))))))),
  );
}

export { pct };
