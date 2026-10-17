// Informació del navegador i del dispositiu per a les mètriques i l'exportació.

let gpuInfoPromise = null;

export function getGpuInfo() {
  gpuInfoPromise ??= (async () => {
    if (!('gpu' in navigator)) return { available: false, reason: 'navigator.gpu no existeix' };
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return { available: false, reason: "requestAdapter() no ha donat cap adaptador" };
      const info = adapter.info ?? {};
      return {
        available: true,
        vendor: info.vendor || '',
        architecture: info.architecture || '',
        description: info.description || '',
        shaderF16: adapter.features.has('shader-f16'),
        maxBufferSizeMB: Math.round(adapter.limits.maxBufferSize / 2 ** 20),
      };
    } catch (e) {
      return { available: false, reason: String(e?.message || e) };
    }
  })();
  return gpuInfoPromise;
}

export async function getDeviceInfo() {
  const uaData = navigator.userAgentData;
  let hints = null;
  if (uaData?.getHighEntropyValues) {
    try {
      hints = await uaData.getHighEntropyValues(['platform', 'platformVersion', 'model', 'architecture', 'fullVersionList']);
    } catch {
      hints = null;
    }
  }
  return {
    userAgent: navigator.userAgent,
    browser: hints?.fullVersionList?.map((b) => `${b.brand} ${b.version}`).join(', ') ?? null,
    platform: hints ? `${hints.platform} ${hints.platformVersion ?? ''}`.trim() : navigator.platform,
    model: hints?.model || null,
    mobile: uaData?.mobile ?? /Mobi|Android/i.test(navigator.userAgent),
    cpuThreads: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    crossOriginIsolated: self.crossOriginIsolated === true,
    webgpu: await getGpuInfo(),
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    language: navigator.language,
  };
}

// Memòria aproximada. Només Chrome dona performance.memory (heap de JS, no inclou tota la memòria de WASM ni de la GPU).
export function memorySnapshot() {
  const m = performance.memory;
  if (!m) return null;
  return { usedJSHeapMB: Math.round(m.usedJSHeapSize / 2 ** 20), totalJSHeapMB: Math.round(m.totalJSHeapSize / 2 ** 20) };
}

// Mesura més completa (inclou memòria de WASM). Necessita crossOriginIsolated i pot trigar.
export async function memoryDetailed(timeoutMs = 4000) {
  if (!performance.measureUserAgentSpecificMemory || !self.crossOriginIsolated) return null;
  try {
    const r = await Promise.race([
      performance.measureUserAgentSpecificMemory(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return { totalMB: Math.round(r.bytes / 2 ** 20) };
  } catch {
    return null;
  }
}
