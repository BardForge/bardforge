import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('exports original audio and imports as a separate playable scene after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.getByLabel('Название сцены').fill('My portable forest');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт сцены', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('My portable forest.bardforge');
  const buffer = await readFile((await download.path())!);
  await page
    .locator('input[accept=".bardforge"]')
    .setInputFiles({ name: 'forest.bardforge', mimeType: 'application/octet-stream', buffer });
  await expect(page.getByText('Сцена импортирована как новая.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Сцены' }).getByRole('button', { name: /My portable forest/ }),
  ).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel('Название сцены')).toHaveValue('My portable forest');
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel('Уровень сигнала').getAttribute('data-level')))
    .toBeGreaterThan(0.005);
});

test('bad archive leaves current scene and library unchanged and reports in both languages', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Название сцены')).toHaveValue('Новая сцена');
  await page.locator('input[accept=".bardforge"]').setInputFiles({
    name: 'broken.bardforge',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('broken'),
  });
  await expect(page.getByRole('alert')).toContainText('Архив сцены повреждён');
  await expect(page.getByRole('navigation', { name: 'Сцены' }).getByRole('button')).toHaveCount(1);
  await expect(page.getByLabel('Название сцены')).toHaveValue('Новая сцена');
  await page.getByLabel('Язык / Language').selectOption('en');
  await expect(page.getByRole('alert')).toContainText('The scene archive is damaged');
  await expect(page.getByRole('button', { name: 'Export scene', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import scene', exact: true })).toBeVisible();
});
