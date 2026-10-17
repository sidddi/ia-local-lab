import { test, expect } from '@playwright/test';
import { index, truthOf } from './helpers.js';

test('E1 troba totes les dades personals de les mostres, sense falsos positius', async ({ page }) => {
  const expected = index.reduce((n, s) => n + truthOf(s.id).pii.filter((p) => !['PER', 'ORG', 'LOC'].includes(p.type)).length, 0);
  await page.goto('/#/e1');
  await expect(page.getByTestId('doc-info')).toContainText('pàgines');
  await page.getByTestId('run-all').click();
  const table = page.getByTestId('summary-table');
  await expect(table.locator('tbody tr')).toHaveCount(index.length + 1, { timeout: 60_000 });
  await expect(page.getByTestId('total-tp')).toHaveText(`${expected}/${expected}`);
  await expect(page.getByTestId('total-fp')).toHaveText('0');
  await expect(page.getByTestId('total-fn')).toHaveText('0');
});

test('E1 marca les dades a la vista prèvia del PDF', async ({ page }) => {
  await page.goto('/#/e1');
  await page.getByTestId('sample-select').selectOption('ca-carta');
  await expect(page.locator('.pdf-mark')).toHaveCount(8, { timeout: 30_000 });
  await expect(page.locator('.pdf-page canvas')).toHaveCount(1);
});

test("L'exportació JSON inclou les execucions i el dispositiu", async ({ page }) => {
  await page.goto('/#/e1');
  await expect(page.getByTestId('doc-info')).toContainText('pàgines');
  await page.getByTestId('run').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  const data = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(data.device.userAgent).toBeTruthy();
  expect(data.runs.length).toBeGreaterThan(0);
  expect(data.runs.at(-1).experiment).toBe('E1');
});
