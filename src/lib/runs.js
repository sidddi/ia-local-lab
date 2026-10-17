// Registre d'execucions. Es guarda al localStorage del navegador i s'exporta en JSON.
import { getDeviceInfo } from './env-info.js';

const KEY = 'ia-local-lab-runs-v1';

export function loadRuns() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRun(run) {
  const runs = loadRuns();
  const full = { id: crypto.randomUUID(), ts: new Date().toISOString(), ...run };
  runs.push(full);
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
  } catch (e) {
    console.warn('No he pogut desar la execució', e);
  }
  window.dispatchEvent(new CustomEvent('runs-changed'));
  return full;
}

export function clearRuns() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* res */
  }
  window.dispatchEvent(new CustomEvent('runs-changed'));
}

export async function exportRuns() {
  const data = {
    app: 'ia-local-lab',
    exportedAt: new Date().toISOString(),
    device: await getDeviceInfo(),
    runs: loadRuns(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ia-local-lab-resultats-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return data;
}
