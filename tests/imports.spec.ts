import { expect, test } from '@playwright/test';
import { demoWav } from '../src/audio/demo';

test('mixed import keeps valid audio, applies nested mute and restores after restart', async ({ page }) => {
  await page.goto('/');
  const wav = Buffer.from(await demoWav('drone').arrayBuffer());
  await page.locator('input[type=file][accept^="audio/"]').setInputFiles([
    { name: 'test-tone.wav', mimeType: 'audio/wav', buffer: wav },
    { name: 'bad.wav', mimeType: 'audio/wav', buffer: Buffer.from('broken') },
  ]);
  await expect(page.getByTestId('track-row')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText('bad.wav');
  await page.getByLabel('Настройки группы: Окружение').click();
  await page.getByRole('button', { name: 'Добавить подгруппу', exact: true }).click();
  await page.getByRole('button', { name: 'Параметры: test-tone' }).click();
  await page.getByLabel('Группа выбранной дорожки').selectOption({ label: 'Подгруппа' });
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  const meter = page.getByLabel('Уровень сигнала');
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeGreaterThan(0.005);
  await page.getByRole('button', { name: 'Без звука: Окружение', exact: true }).click();
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeLessThan(0.0001);
  await expect(page.getByRole('status', { name: 'Сохранение сцены' })).toContainText('Сохранено');
  await page.reload();
  await expect(page.getByTestId('track-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Без звука: Окружение', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Без звука: Окружение', exact: true }).click();
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await expect.poll(async () => Number(await meter.getAttribute('data-level'))).toBeGreaterThan(0.005);
});

test('soundboard shortcuts stop after scene change and do not intercept text entry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByRole('button', { name: 'Играть плитку: Далёкий гул' })).toBeEnabled();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('F2');
  await expect(page.getByRole('button', { name: 'Пауза плитку: Далёкий гул' })).toBeVisible();
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await page.getByLabel('Название сцены').focus();
  await page.keyboard.press('F2');
  await expect(page.getByRole('button', { name: 'Играть плитку: Далёкий гул' })).toBeVisible();
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel('Уровень сигнала').getAttribute('data-level')))
    .toBeLessThan(0.0001);
});

test('desktop and mobile reference screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByTestId('track-row')).toHaveCount(3);
  await page.screenshot({ path: 'tmp/ui-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'tmp/ui-mobile.png', fullPage: true });
});
