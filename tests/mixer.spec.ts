import { expect, test } from '@playwright/test';

test('demo plays, pauses, stops and survives reload with its settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByLabel('Название сцены')).toHaveValue('Ночной лес');
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Пауза сцены', exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByTestId('track-row').first().getAttribute('data-position')))
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Пауза сцены', exact: true }).click();
  const position = Number(await page.getByTestId('track-row').first().getAttribute('data-position'));
  await page.waitForTimeout(300);
  expect(Number(await page.getByTestId('track-row').first().getAttribute('data-position'))).toBeCloseTo(
    position,
    1,
  );
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await expect(page.getByTestId('track-row').first()).toHaveAttribute('data-position', '0.00');
  await page.getByLabel('Название сцены').fill('Лес перед грозой');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Сохранение сцены' })).toContainText('Сохранено');
  await page.reload();
  await expect(page.getByLabel('Название сцены')).toHaveValue('Лес перед грозой');
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByTestId('track-row').first().getAttribute('data-position')))
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Играть сцену', exact: true })).toBeDisabled();
});

test('invalid audio is reported and narrow layout stays inside viewport', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('not audio') });
  await expect(page.getByRole('alert')).toContainText('broken.wav');
  await expect(page.getByTestId('track-row')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Импорт аудио', exact: true })).toBeVisible();
});

test('track inspector and soundboard control the real audio signal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await page.getByRole('button', { name: 'Параметры: Далёкий гул' }).click();
  await expect(page.getByRole('complementary', { name: 'Информация о дорожке' })).toContainText(
    'Далёкий гул',
  );
  await page.getByRole('button', { name: 'Играть плитку: Далёкий гул' }).click();
  const meter = page.getByLabel('Уровень сигнала');
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: 'Без звука: Музыка', exact: true }).click();
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeLessThan(0.0001);
  await page.getByRole('button', { name: 'Без звука: Музыка', exact: true }).click();
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
});
