// Copia el model de prova (tests/fixtures/models) a public/models i l'afegeix al manifest.
// Només el fan servir els tests de fontaneria. No té cap qualitat.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'models');
const FIXTURE = 'lab-fixtures/tiny-ner-test';

await mkdir(OUT, { recursive: true });
await cp(join(root, 'tests', 'fixtures', 'models', FIXTURE), join(OUT, FIXTURE), { recursive: true });
const manifestPath = join(OUT, 'manifest.json');
let manifest = { models: [] };
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
  /* nou */
}
if (!manifest.models.some((m) => m.id === FIXTURE)) {
  manifest.models.push({ id: FIXTURE, kind: 'transformers', dtype: 'q8', fixture: true, source: 'scripts/make-tiny-ner.py' });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
console.log(`Model de prova a public/models/${FIXTURE}`);
