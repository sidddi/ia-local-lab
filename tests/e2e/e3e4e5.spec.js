import { test, expect } from '@playwright/test';
import { modelReachable, waitStatus } from './helpers.js';

// Tests mínims: els models de xat pesen més d'1 GB i amb CPU són molt lents.
// Per executar-los: RUN_CHAT=1 npm run test:e2e (cal accés als models).

test('E3 detecta si hi ha IA integrada de Chrome i ho diu a la pàgina', async ({ page }) => {
  await page.goto('/#/e3');
  await expect(page.getByTestId('chrome-status')).toContainText('API Summarizer');
  const unavailable = page.getByTestId('chrome-unavailable');
  const button = page.getByTestId('run-chrome');
  await expect(unavailable.or(button)).toBeVisible();
});

test('E3, E4 i E5 mostren la configuració del model de xat', async ({ page }) => {
  for (const p of ['e3', 'e4', 'e5']) {
    await page.goto(`/#/${p}`);
    await expect(page.locator('main [data-testid=engine-select]')).toBeVisible();
    await expect(page.locator('main [data-testid=doc-info]')).toContainText('pàgines');
  }
});

test('E5 recupera els fragments amb la dada clau (només embeddings)', async ({ page }) => {
  await page.goto('/#/e5');
  const id = 'Xenova/multilingual-e5-small';
  test.skip(!(await modelReachable(page, id)), `No es pot baixar ${id}: Hugging Face no és accessible i el model no és a public/models.`);
  await page.getByTestId('retrieval-only').check();
  await page.getByTestId('run').click();
  expect(await waitStatus(page, /Fet|Error/)).toBe('Fet.');
  await expect(page.getByTestId('qa')).toHaveCount(5);
  console.log('E5 recuperació:', await page.getByTestId('metrics').textContent());
});

test('E4 extreu els camps amb el model de xat (pesat)', async ({ page }) => {
  test.skip(!process.env.RUN_CHAT, 'Test pesat: posa RUN_CHAT=1 per executar-lo.');
  await page.goto('/#/e4');
  const model = process.env.CHAT_MODEL ?? 'onnx-community/Qwen3-0.6B-ONNX';
  test.skip(!(await modelReachable(page, model)), `No es pot baixar ${model}.`);
  await page.getByTestId('engine-select').selectOption('transformers');
  await page.getByTestId('custom-model').fill(model);
  await page.locator('main [data-testid=device-select]').last().selectOption('wasm');
  await page.getByTestId('run').click();
  expect(await waitStatus(page, /correctes|Fet|Error/, 20 * 60 * 1000)).toMatch(/correctes|Fet/);
  console.log('E4:', await page.getByTestId('result').textContent());
});
