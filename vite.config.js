import { defineConfig } from 'vite';

// COOP + COEP activen l'aïllament entre orígens: permet WASM multifil (SharedArrayBuffer).
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Als tests es desactiva el HMR perquè la prova sense connexió no recarregui la pàgina.
  server: { headers: isolation, port: 5173, hmr: process.env.NO_HMR ? false : undefined },
  preview: { headers: isolation, port: 4173 },
  optimizeDeps: {
    // Aquestes biblioteques porten WASM i workers: millor no pre-empaquetar-les.
    exclude: ['@huggingface/transformers', '@mlc-ai/web-llm', 'onnxruntime-web'],
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 8000 },
  worker: { format: 'es' },
});
