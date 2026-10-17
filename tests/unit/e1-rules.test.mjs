// Test unitari de E1 a Node: extreu el text de les mostres amb PDF.js i puntua les regles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { itemsToText, joinPages } from '../../src/lib/pdf-text.js';
import { detectRules } from '../../src/lib/pii-rules.js';
import { scoreEntities, RULE_TYPE_SET, parseAmount, parseDate } from '../../src/lib/score.js';
import { isValidDni, isValidNie, isValidCif, isValidIban } from '../../src/lib/ids.js';

const dir = new URL('../../public/samples/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', dir), 'utf8'));

async function extract(file) {
  const data = new Uint8Array(await readFile(new URL(file, dir)));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(itemsToText((await page.getTextContent()).items));
  }
  return joinPages(pages).text;
}

for (const s of index) {
  test(`E1 troba totes les dades de ${s.id} sense falsos positius`, async () => {
    const truth = JSON.parse(await readFile(new URL(s.truth, dir), 'utf8'));
    const text = await extract(s.pdf);
    const score = scoreEntities(detectRules(text), truth.pii, RULE_TYPE_SET);
    assert.deepEqual(score.misses, [], 'oblits');
    assert.deepEqual(score.falsePositives.concat(score.wrongType), [], 'falsos positius');
  });
}

test('validadors', () => {
  assert.ok(isValidDni('12345678Z'));
  assert.ok(!isValidDni('12345678A'));
  assert.ok(isValidNie('X1234567L'));
  assert.ok(!isValidNie('X1234567A'));
  assert.ok(isValidCif('B17583923'));
  assert.ok(isValidIban('ES91 2100 0418 4502 0005 1332'));
  assert.ok(!isValidIban('ES91 2100 0418 4502 0005 1333'));
  assert.ok(isValidIban('GB82 WEST 1234 5698 7654 32'));
});

test('parseAmount i parseDate', () => {
  assert.equal(parseAmount('1.337,05 €'), 1337.05);
  assert.equal(parseAmount('1,996.50'), 1996.5);
  assert.equal(parseAmount(232.05), 232.05);
  assert.equal(parseDate('15/01/2026'), '2026-01-15');
  assert.equal(parseDate('2026-3-10'), '2026-03-10');
});
