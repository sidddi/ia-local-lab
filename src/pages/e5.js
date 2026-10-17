import { h, section, samplePicker, status, metricsTable, withMemory, chatConfig, progressLine, modelSelect, modelInfo, deviceSelect, fmtMs } from '../ui.js';
import { loadChat } from '../lib/chat.js';
import { answerWithContext } from '../lib/tasks.js';
import { loadModel } from '../lib/tf.js';
import { makePassages, embed, topK } from '../lib/rag.js';
import { containsKey } from '../lib/score.js';
import { addRun } from '../lib/runs.js';
import { EMBEDDING_MODELS } from '../models.js';

export default async function e5() {
  const out = h('div', { 'data-testid': 'result' });
  const metrics = h('div');
  const st = status();
  const prog = progressLine();
  const chat = chatConfig();
  const embSel = modelSelect(EMBEDDING_MODELS, 'emb-select');
  const embInfo = h('div', {}, modelInfo(EMBEDDING_MODELS[0]));
  embSel.addEventListener('change', () => embInfo.replaceChildren(modelInfo(EMBEDDING_MODELS.find((m) => m.id === embSel.value))));
  const embDevice = deviceSelect('auto');
  const k = h('input', { type: 'number', min: '1', max: '8', value: '3', 'aria-label': 'Fragments' });
  const retrievalOnly = h('input', { type: 'checkbox', 'data-testid': 'retrieval-only' });
  const custom = h('textarea', { rows: '2', placeholder: 'Pregunta pròpia (opcional, una per línia)', 'aria-label': 'Preguntes pròpies' });
  const picker = samplePicker({ kinds: ['long'], defaultId: 'ca-llarg' });

  async function run() {
    const { pdf, truth, sample } = picker;
    if (!pdf) return;
    const meta = EMBEDDING_MODELS.find((m) => m.id === embSel.value);
    try {
      st.set("Carregant el model d'embeddings...");
      const { obj: extractor, metrics: em } = await loadModel({ kind: 'pipeline', task: 'feature-extraction', id: meta.id, device: embDevice.value, dtype: 'q8', onProgress: prog.update });
      prog.textContent = '';
      st.set('Indexant el document...');
      const t0 = performance.now();
      const passages = makePassages(pdf);
      const vecs = await embed(extractor, passages.map((p) => p.text), meta.prefixes.passage);
      const index = passages.map((p, i) => ({ ...p, vec: vecs[i] }));
      const indexMs = performance.now() - t0;

      let eng = null;
      if (!retrievalOnly.checked) {
        st.set('Carregant el model de xat...');
        eng = await loadChat(chat.get(), prog.update);
        prog.textContent = '';
      }

      const qs = [
        ...(truth?.qa ?? []),
        ...custom.value
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean)
          .map((q) => ({ q, a: null, keys: [] })),
      ];
      const results = [];
      out.replaceChildren();
      for (const [i, item] of qs.entries()) {
        st.set(`Pregunta ${i + 1} de ${qs.length}...`);
        const tq = performance.now();
        const [qv] = await embed(extractor, [item.q], meta.prefixes.query);
        const top = topK(index, qv, Number(k.value));
        const retrieveMs = performance.now() - tq;
        const retrievedKey = item.keys.length ? top.some((p) => containsKey(p.text, item.keys)) : null;
        let answer = null;
        let genMs = null;
        if (eng) {
          const r = await answerWithContext(eng, top, item.q, picker.lang);
          answer = r.text;
          genMs = r.ms;
        }
        const res = {
          q: item.q,
          expected: item.a,
          answer,
          answerHasKey: answer != null && item.keys.length ? containsKey(answer, item.keys) : null,
          retrievedKey,
          retrieveMs,
          genMs,
          totalMs: performance.now() - tq,
          passages: top.map((p) => ({ page: p.page, score: Number(p.score.toFixed(3)), text: p.text })),
        };
        results.push(res);
        out.append(qaCard(res, i + 1));
      }
      const avg = (f) => (results.length ? results.reduce((a, r) => a + (f(r) ?? 0), 0) / results.length : null);
      const m = withMemory({
        ...(eng?.metrics ?? {}),
        backend: `${em.device} (embeddings)${eng ? `, ${eng.backend} (xat)` : ''}`,
        model: `${meta.id}${eng ? ` + ${eng.model}` : ''}`,
        downloadBytes: em.downloadBytes + (eng?.metrics.reused ? 0 : eng?.metrics.downloadBytes ?? 0),
        loadMs: em.loadMs + (eng && !eng.metrics.reused ? eng.metrics.loadMs : 0),
        runMs: indexMs + results.reduce((a, r) => a + r.totalMs, 0),
        pages: pdf.numPages,
        extraRows: [
          ["Temps d'indexació", `${fmtMs(indexMs)} (${passages.length} fragments)`],
          ['Temps mitjà per pregunta', fmtMs(avg((r) => r.totalMs))],
          ['Recuperació amb la dada clau', `${results.filter((r) => r.retrievedKey).length}/${results.filter((r) => r.retrievedKey != null).length}`],
          eng ? ['Respostes amb la dada clau', `${results.filter((r) => r.answerHasKey).length}/${results.filter((r) => r.answerHasKey != null).length}`] : ['Respostes', 'no generades (només recuperació)'],
        ],
      });
      metrics.replaceChildren(metricsTable(m));
      st.set('Fet.', 'ok');
      addRun({
        experiment: 'E5',
        engine: eng?.engine ?? 'retrieval-only',
        sample: sample?.id ?? pdf.name,
        lang: picker.lang,
        model: m.model,
        metrics: m,
        score: {
          retrievalHits: results.filter((r) => r.retrievedKey).length,
          answerKeyHits: eng ? results.filter((r) => r.answerHasKey).length : null,
          questions: results.length,
        },
        output: results,
      });
    } catch (e) {
      console.error(e);
      st.set(`Error: ${e.message}`, 'error');
    }
  }

  return h(
    'div',
    {},
    h('h1', {}, 'E5. Preguntes sobre un document llarg'),
    h(
      'p',
      { class: 'lead' },
      "RAG local: el document es talla en fragments, es calculen embeddings al navegador i es guarden en un índex en memòria. Per a cada pregunta es busquen els fragments més semblants i el model de xat respon amb aquests fragments.",
    ),
    section('1. Document', picker.el),
    section(
      '2. Models i execució',
      h('div', { class: 'row' }, h('label', {}, 'Embeddings ', embSel), h('label', {}, 'Backend ', embDevice), h('label', {}, 'Fragments per pregunta ', k)),
      embInfo,
      chat.el,
      h('label', {}, retrievalOnly, ' Només recuperació (sense model de xat)'),
      custom,
      h('div', { class: 'row' }, h('button', { onclick: run, 'data-testid': 'run' }, 'Indexa i respon')),
      prog,
      st,
      h('p', { class: 'muted' }, '"Dada clau" només indica si la resposta conté la xifra o el fet esperat. No és una nota de qualitat.'),
    ),
    section('3. Respostes', out),
    section('4. Mètriques', metrics),
  );
}

function qaCard(r, n) {
  return h(
    'div',
    { class: 'qa', 'data-testid': 'qa' },
    h('p', {}, h('strong', {}, `${n}. ${r.q}`)),
    r.expected ? h('p', { class: 'muted' }, `Resposta correcta: ${r.expected}`) : null,
    h('p', { 'data-testid': 'answer' }, r.answer ?? '(sense resposta: només recuperació)'),
    h(
      'p',
      { class: 'muted' },
      `Recuperació: ${fmtMs(r.retrieveMs)}${r.genMs != null ? ` · Generació: ${fmtMs(r.genMs)}` : ''}`,
      r.retrievedKey != null ? ` · Dada clau als fragments: ${r.retrievedKey ? 'sí' : 'no'}` : '',
      r.answerHasKey != null ? ` · Dada clau a la resposta: ${r.answerHasKey ? 'sí' : 'no'}` : '',
    ),
    h('details', {}, h('summary', {}, 'Fragments recuperats'), r.passages.map((p) => h('p', { class: 'passage' }, `[pàg. ${p.page}, ${p.score}] ${p.text}`))),
  );
}
