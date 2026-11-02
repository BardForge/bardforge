import { expect, test } from '@playwright/test';

test('manual and timed stages play real audio, persist ordering, and restore the original scene stopped', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.locator('.sequence-panel summary').click();
  await page.getByRole('button', { name: 'Добавить текущую сцену' }).click();
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(0);
  await page.getByLabel('Название сцены').fill('Quiet original');
  await page.getByRole('button', { name: 'Добавить текущую сцену' }).click();
  await page.getByLabel('Длительность этапа, секунд 2', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Поднять этап 2', exact: true }).click();
  await expect(page.getByLabel('Длительность этапа, секунд 1', { exact: true })).toHaveValue('1');
  await page.reload();
  await page.locator('.sequence-panel summary').click();
  await expect(page.getByLabel('Длительность этапа, секунд 1', { exact: true })).toHaveValue('1');
  await expect(page.locator('.sequence-stages li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Запустить последовательность' }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText('Этап 2 из 2');
  await expect(page.getByLabel('Название сцены')).toHaveValue('Ночной лес');
  await expect
    .poll(async () => Number(await page.getByLabel('Уровень сигнала').getAttribute('data-level')))
    .toBeGreaterThan(0.005);
  await page.getByRole('button', { name: 'Следующий этап' }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText(
    'Последовательность завершена.',
  );
  await expect(page.getByLabel('Название сцены')).toHaveValue('Quiet original');
  await expect(page.getByTestId('track-row')).toHaveCount(0);
  await expect
    .poll(async () => Number(await page.getByLabel('Уровень сигнала').getAttribute('data-level')))
    .toBeLessThan(0.0001);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('stopping a running sequence cancels the timer and restores original scene', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.locator('.sequence-panel summary').click();
  await page.getByRole('button', { name: 'Добавить текущую сцену' }).click();
  await page.getByLabel('Длительность этапа, секунд 1', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await page.getByLabel('Название сцены').fill('Return here');
  await page.getByRole('button', { name: 'Запустить последовательность' }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText('Этап 1 из 1');
  await page.getByRole('button', { name: 'Остановить последовательность' }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText(
    'Последовательность остановлена.',
  );
  await expect(page.getByLabel('Название сцены')).toHaveValue('Return here');
  await page.waitForTimeout(2200);
  await expect(page.getByLabel('Название сцены')).toHaveValue('Return here');
  await expect(page.getByTestId('track-row')).toHaveCount(0);
});

test('global Stop cancels a silent stage before a later audio stage can start', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Название сцены')).toHaveValue('Новая сцена');
  await page.locator('.sequence-panel summary').click();
  await page.getByRole('button', { name: 'Добавить текущую сцену' }).click();
  await page.getByLabel('Длительность этапа, секунд 1', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Добавить текущую сцену' }).click();
  await page.getByRole('button', { name: 'Запустить последовательность' }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText('Этап 1 из 2');
  await expect(page.getByTestId('track-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText(
    'Последовательность остановлена.',
  );
  await expect(page.getByLabel('Название сцены')).toHaveValue('Ночной лес');
  await page.waitForTimeout(2200);
  await expect(page.getByRole('status', { name: 'Последовательность сцен' })).toHaveText(
    'Последовательность остановлена.',
  );
  await expect(page.getByRole('button', { name: 'Играть сцену', exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByLabel('Уровень сигнала').getAttribute('data-level')))
    .toBeLessThan(0.0001);
});
