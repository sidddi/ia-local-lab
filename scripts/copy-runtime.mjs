// Copia el runtime d'ONNX (WASM) i els recursos de PDF.js a public/, per servir-los des del mateix origen.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// La versió d'onnxruntime-web que fa servir Transformers.js (niada si n'hi ha més d'una).
const nested = join(root, 'node_modules', '@huggingface', 'transformers', 'node_modules', 'onnxruntime-web', 'dist');
const ortDist = existsSync(nested) ? nested : join(root, 'node_modules', 'onnxruntime-web', 'dist');
const pdfjs = join(root, 'node_modules', 'pdfjs-dist');

await mkdir(join(root, 'public', 'ort'), { recursive: true });
for (const f of await readdir(ortDist)) {
  if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f)) await cp(join(ortDist, f), join(root, 'public', 'ort', f));
}
await cp(join(pdfjs, 'standard_fonts'), join(root, 'public', 'pdfjs', 'standard_fonts'), { recursive: true });
await cp(join(pdfjs, 'wasm'), join(root, 'public', 'pdfjs', 'wasm'), { recursive: true });
console.log('Runtime copiat a public/ort i public/pdfjs');
