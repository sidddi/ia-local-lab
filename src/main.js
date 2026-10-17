// Primer de tot: registrar totes les peticions de xarxa.
import { installFetchMonitor } from './lib/net.js';
installFetchMonitor();

import './style.css';
import { exportRuns } from './lib/runs.js';

const routes = {
  '': () => import('./pages/home.js'),
  e1: () => import('./pages/e1.js'),
  e2: () => import('./pages/e2.js'),
  e3: () => import('./pages/e3.js'),
  e4: () => import('./pages/e4.js'),
  e5: () => import('./pages/e5.js'),
  resultats: () => import('./pages/results.js'),
};

const app = document.getElementById('app');
const pages = new Map();

async function route() {
  const name = location.hash.replace(/^#\/?/, '').split('?')[0];
  const loader = routes[name] ?? routes[''];
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('active', a.getAttribute('href') === `#/${name}`);
  // Cada pàgina es crea una sola vegada i es manté en memòria (amb el model carregat).
  if (!pages.has(name)) {
    const mod = await loader();
    pages.set(name, await mod.default());
  }
  app.replaceChildren(pages.get(name));
  pages.get(name).dispatchEvent(new Event('page-show'));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
document.getElementById('export').addEventListener('click', () => exportRuns());
route();
