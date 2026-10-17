// Registre de totes les peticions fetch de la pàgina.
// Serveix per mesurar el pes baixat i per veure a quins dominis es connecta la web.
const log = [];
const listeners = new Set();
let installed = false;

export function installFetchMonitor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const entry = { url: new URL(url, location.href).href, t: performance.now(), status: 0, bytes: 0 };
    log.push(entry);
    try {
      const res = await orig(input, init);
      entry.status = res.status;
      entry.bytes = Number(res.headers.get('content-length') || 0);
      entry.finalUrl = res.url || entry.url;
      return res;
    } catch (e) {
      entry.status = -1;
      entry.error = String(e?.message || e);
      throw e;
    } finally {
      listeners.forEach((fn) => fn(entry));
    }
  };
}

export function netMark() {
  return log.length;
}

// Bytes baixats per xarxa des d'una marca. Les respostes de la memòria cau del navegador
// (Cache API) no passen per fetch i no compten.
export function netSince(mark) {
  const entries = log.slice(mark);
  const ok = (e) => (e.status >= 200 && e.status < 400 ? e.bytes : 0);
  const isRuntime = (e) => /\/ort\/|binary-mlc-llm-libs|\/mlc-libs\//.test(e.finalUrl || e.url);
  return {
    requests: entries.length,
    bytes: entries.reduce((s, e) => s + ok(e), 0),
    runtimeBytes: entries.filter(isRuntime).reduce((s, e) => s + ok(e), 0),
    origins: [...new Set(entries.map((e) => new URL(e.finalUrl || e.url).origin))],
  };
}

export function netLog() {
  return log;
}

export function onNet(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function originsContacted() {
  const m = new Map();
  for (const e of log) {
    const o = new URL(e.finalUrl || e.url).origin;
    const v = m.get(o) ?? { origin: o, requests: 0, bytes: 0 };
    v.requests++;
    v.bytes += e.bytes;
    m.set(o, v);
  }
  return [...m.values()];
}
