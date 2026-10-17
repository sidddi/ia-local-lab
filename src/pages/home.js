import { h, section, fmtBytes } from '../ui.js';
import { getDeviceInfo } from '../lib/env-info.js';
import { originsContacted, onNet } from '../lib/net.js';
import { chromeAiStatus } from '../lib/chat.js';

export default async function home() {
  const caps = h('div', { 'data-testid': 'caps' }, h('p', { class: 'muted' }, 'Comprovant el navegador...'));
  const net = h('div');

  const page = h(
    'div',
    {},
    h('h1', {}, "Laboratori: IA local sobre documents"),
    h(
      'p',
      { class: 'lead' },
      "Proves per saber quines tasques d'IA sobre documents es poden fer dins del navegador, sense enviar el document enlloc. Cada experiment mesura el pes, el temps i la qualitat amb mostres inventades.",
    ),
    section(
      'Experiments',
      h(
        'ul',
        { class: 'exp-list' },
        h('li', {}, h('a', { href: '#/e1' }, 'E1. Dades personals amb regles'), ': DNI, NIE, NIF, IBAN, telèfons, correus i codis postals. Sense model.'),
        h('li', {}, h('a', { href: '#/e2' }, 'E2. Dades personals amb model'), ': noms, adreces i organitzacions amb un model petit.'),
        h('li', {}, h('a', { href: '#/e3' }, 'E3. Resumir'), ': IA de Chrome, model de xat local i model de resum.'),
        h('li', {}, h('a', { href: '#/e4' }, 'E4. Camps de factura'), ': emissor, NIF, data, base, IVA i total en JSON.'),
        h('li', {}, h('a', { href: '#/e5' }, 'E5. Preguntes sobre un document llarg'), ': cerca local amb embeddings i model de xat.'),
        h('li', {}, h('a', { href: '#/resultats' }, 'Resultats'), ': totes les execucions i exportació en JSON.'),
      ),
    ),
    section('Aquest navegador', caps),
    section(
      'Privadesa comprovable',
      h(
        'p',
        {},
        "La pàgina té una política de seguretat (CSP) que només deixa connectar amb aquest mateix origen i amb els dominis dels models. Aquí sota hi ha totes les connexions que ha fet la pàgina en aquesta sessió.",
      ),
      net,
    ),
  );

  function renderNet() {
    const list = originsContacted();
    net.replaceChildren(
      list.length
        ? h(
            'table',
            { class: 'metrics', 'data-testid': 'origins' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Origen'), h('th', {}, 'Peticions'), h('th', {}, 'Bytes'))),
            h('tbody', {}, list.map((o) => h('tr', {}, h('td', {}, o.origin), h('td', {}, String(o.requests)), h('td', {}, fmtBytes(o.bytes))))),
          )
        : h('p', { class: 'muted' }, 'Cap connexió encara.'),
    );
  }
  onNet(renderNet);
  page.addEventListener('page-show', renderNet);
  renderNet();

  getDeviceInfo().then(async (d) => {
    const ai = await chromeAiStatus('ca');
    const aiEs = await chromeAiStatus('es');
    const yes = (b) => (b ? 'sí' : 'no');
    caps.replaceChildren(
      h(
        'table',
        { class: 'metrics' },
        h(
          'tbody',
          {},
          [
            ['Navegador', d.browser ?? d.userAgent],
            ['Plataforma', `${d.platform}${d.model ? ` (${d.model})` : ''}${d.mobile ? ', mòbil' : ''}`],
            ['Fils de CPU', d.cpuThreads ?? 'n/d'],
            ['Memòria del dispositiu', d.deviceMemoryGB ? `${d.deviceMemoryGB} GB o més` : 'n/d'],
            ['WebGPU', d.webgpu.available ? `sí (${[d.webgpu.vendor, d.webgpu.architecture].filter(Boolean).join(' ') || 'adaptador'}; shader-f16: ${yes(d.webgpu.shaderF16)})` : `no (${d.webgpu.reason})`],
            ['Aïllament entre orígens (WASM multifil)', yes(d.crossOriginIsolated)],
            ['Chrome IA: Summarizer (ca / es)', `${ai.summarizer} / ${aiEs.summarizer}`],
            ['Chrome IA: Prompt API (ca / es)', `${ai.prompt} / ${aiEs.prompt}`],
          ].map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, String(v)))),
        ),
      ),
    );
  });

  return page;
}
