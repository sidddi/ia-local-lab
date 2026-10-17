import { test, expect } from '@playwright/test';
import { REAL_NER, FIXTURE_NER, modelReachable, waitStatus, entityRows } from './helpers.js';

test('E2 es carrega i dona algun resultat (model real)', async ({ page }) => {
  await page.goto('/#/e2');
  const where = await modelReachable(page, REAL_NER);
  test.skip(!where, `No es pot baixar ${REAL_NER}: Hugging Face no és accessible des d'aquí i el model no és a public/models.`);
  await page.getByTestId('model-select').selectOption(REAL_NER);
  await page.getByTestId('device-select').selectOption('wasm');
  await page.getByTestId('sample-select').selectOption('ca-carta');
  await expect(page.getByTestId('doc-info')).toContainText('ca-carta');
  await page.getByTestId('run').click();
  const status = await waitStatus(page);
  expect(status).toMatch(/entitats/);
  const rows = await entityRows(page);
  expect(rows.some((r) => r.includes('model'))).toBeTruthy();
  console.log(`E2 (${where}):`, (await page.getByTestId('score').allTextContents()).join('\n'));
});

test('E2 fontaneria: càrrega local amb WASM i combinació amb E1 (model de prova)', async ({ page }) => {
  await page.goto('/#/e2');
  await page.locator(`option[value="${FIXTURE_NER}"]`).waitFor({ state: 'attached' });
  await page.getByTestId('model-select').selectOption(FIXTURE_NER);
  await page.getByTestId('device-select').selectOption('wasm');
  await expect(page.getByTestId('doc-info')).toContainText('pàgines');
  await page.getByTestId('run').click();
  expect(await waitStatus(page)).toMatch(/entitats/);
  const rows = await entityRows(page);
  expect(rows.some((r) => r.includes('model'))).toBeTruthy();
  expect(rows.some((r) => r.includes('regles'))).toBeTruthy();
  await expect(page.getByTestId('metrics')).toContainText('wasm');
});
