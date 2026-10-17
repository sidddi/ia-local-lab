import { readFileSync } from 'node:fs';

export const SAMPLES = new URL('../../public/samples/', import.meta.url);
export const samplePath = (name) => new URL(name, SAMPLES).pathname;
export const index = JSON.parse(readFileSync(new URL('index.json', SAMPLES), 'utf8'));
export const truthOf = (id) => JSON.parse(readFileSync(new URL(`${id}.truth.json`, SAMPLES), 'utf8'));

export const REAL_NER = 'Xenova/bert-base-multilingual-cased-ner-hrl';
export const FIXTURE_NER = 'lab-fixtures/tiny-ner-test';

// Comprova des del navegador si un model es pot carregar: o és a /models o Hugging Face respon.
export async function modelReachable(page, id) {
  return page.evaluate(async (id) => {
    try {
      const m = await fetch('/models/manifest.json').then((r) => (r.ok ? r.json() : { models: [] }));
      if (m.models?.some((x) => x.id === id)) return 'local';
    } catch {
      /* res */
    }
    try {
      const r = await fetch(`https://huggingface.co/${id}/resolve/main/config.json`);
      return r.ok ? 'hf' : null;
    } catch {
      return null;
    }
  }, id);
}

export async function waitStatus(page, re = /entitats|deteccions|Fet|correctes|Error/, timeout = 8 * 60 * 1000) {
  await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('main [data-testid=status]')?.textContent ?? ''), re.source, { timeout });
  return page.locator('main [data-testid=status]').first().textContent();
}

export async function entityRows(page) {
  return page.locator('main [data-testid=entities] tbody tr').evaluateAll((rows) => rows.map((r) => [...r.cells].map((c) => c.textContent).join(' | ')));
}
