import { test, expect } from '@playwright/test';
import { REAL_NER, FIXTURE_NER, modelReachable, waitStatus, entityRows, samplePath } from './helpers.js';

// Un cop el model és a memòria, el navegador passa a estar sense connexió i E1 i E2 han de donar el mateix resultat.
test('E1 i E2 funcionen igual sense connexió', async ({ page, context }) => {
  await page.goto('/#/e1');
  await expect(page.getByTestId('doc-info')).toContainText('pàgines');
  await page.goto('/#/e2');
  const real = await modelReachable(page, REAL_NER);
  const model = real ? REAL_NER : FIXTURE_NER;
  test.info().annotations.push({ type: 'model', description: real ? `${REAL_NER} (${real})` : `${FIXTURE_NER}: Hugging Face no accessible, es fa servir el model de prova` });
  await page.locator(`option[value="${model}"]`).waitFor({ state: 'attached' });
  await page.getByTestId('model-select').selectOption(model);
  await page.getByTestId('device-select').selectOption('wasm');

  const file = samplePath('es-formulario.pdf');
  const runE2 = async () => {
    await page.goto('/#/e2');
    await page.getByTestId('file-input').setInputFiles(file);
    await expect(page.getByTestId('doc-info')).toContainText('es-formulario.pdf');
    await page.getByTestId('run').click();
    expect(await waitStatus(page)).toMatch(/entitats/);
    return entityRows(page);
  };
  const runE1 = async () => {
    await page.goto('/#/e1');
    await page.getByTestId('file-input').setInputFiles(file);
    await expect(page.getByTestId('doc-info')).toContainText('es-formulario.pdf');
    await page.getByTestId('run').click();
    expect(await waitStatus(page)).toMatch(/deteccions/);
    return entityRows(page);
  };

  // Amb connexió: carrega el model i guarda els resultats de referència.
  const e2Online = await runE2();
  const e1Online = await runE1();
  expect(e1Online.length).toBeGreaterThanOrEqual(7);

  await context.setOffline(true);
  const blocked = await page.evaluate(() => fetch('https://huggingface.co/', { mode: 'no-cors' }).then(() => 'online', () => 'offline'));
  expect(blocked).toBe('offline');

  expect(await runE1()).toEqual(e1Online);
  expect(await runE2()).toEqual(e2Online);
  await context.setOffline(false);
});
