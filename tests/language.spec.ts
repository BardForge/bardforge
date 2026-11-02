import { expect, test } from '@playwright/test';

test('switches the full interface and built-in content live, preserving user names and playback', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await page.getByLabel('Язык / Language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel('Scene name')).toHaveValue('Night forest');
  await expect(page.getByRole('button', { name: 'Pause scene', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Group Ambience', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings: Forest rain', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause tile: Forest rain', exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('[data-level]').getAttribute('data-level').then(Number))
    .toBeGreaterThan(0.001);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByLabel('Search scenes', { exact: true }).fill('night');
  await expect(page.getByRole('navigation', { name: 'Scenes' }).getByRole('button')).toHaveCount(1);
  await page.getByLabel('Search scenes', { exact: true }).fill('');
  await page.getByLabel('Search tracks', { exact: true }).fill('forest rain');
  await expect(page.getByTestId('track-row')).toHaveCount(1);
  await page.getByLabel('Search tracks', { exact: true }).fill('');
  // The language picker intentionally shows native language names. All other default UI is English.
  const russianLabels = await page.locator('body').evaluate((body) => {
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.language-picker, script').forEach((element) => element.remove());
    return [
      clone.textContent,
      ...Array.from(clone.querySelectorAll('*')).flatMap((element) =>
        ['aria-label', 'title', 'placeholder', 'value'].map((name) => element.getAttribute(name)),
      ),
    ].filter((text) => /[А-Яа-яЁё]/.test(text || ''));
  });
  expect(russianLabels).toEqual([]);
  await page.screenshot({ path: 'tmp/ui-english.png', fullPage: true });
  await page.getByLabel('Scene name').fill('Моя кампания');
  await page.getByLabel('Scene name').press('Enter');
  await page.getByRole('button', { name: 'Application and components', exact: true }).click();
  await expect(page.getByText('Component management is available in the Windows app.')).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Delete scene “Моя кампания”?');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Scene name')).toHaveValue('Моя кампания');
  await expect(page.getByLabel('Язык / Language')).toHaveValue('en');
  await page.getByLabel('Язык / Language').selectOption('ru');
  await expect(page.getByLabel('Название сцены')).toHaveValue('Моя кампания');
  await expect(page.getByRole('button', { name: 'Параметры: Лесной дождь', exact: true })).toBeVisible();
  await page.getByLabel('Язык / Language').selectOption('en');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'tmp/ui-english-narrow.png', fullPage: true });
});

test('existing errors change language, and custom category names are never translated', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Категория', exact: true }).click();
  await page.getByLabel('Название группы: Новая группа', { exact: true }).fill('Музыка');
  await page.getByLabel('Название группы: Новая группа', { exact: true }).press('Enter');
  await page
    .locator('input[type=file][accept^="audio/"]')
    .setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('Формат не поддерживается');
  await page.getByLabel('Язык / Language').selectOption('en');
  await expect(page.getByRole('alert')).toContainText('Unsupported format or damaged file.');
  await expect(page.getByLabel('Group name: Музыка', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Group name: Music', { exact: true })).toBeVisible();
});

test('translates desktop download and update states live while settings stay open', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bardforge.language', 'en');
    window.bardforge = {
      status: async () => ({
        version: 'test',
        update: { status: 'downloading', percent: 40 },
        components: [
          { id: 'python', version: '3', bytes: 1024 * 1024 * 12.5, received: 1024, status: 'paused' },
        ],
      }),
      checkUpdates: async () => {},
      installUpdate: async () => {},
      installComponent: async () => {},
      cancelComponent: async () => {},
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Application and components', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Downloading the update in the background…');
  await expect(dialog).toContainText('12.5 MB');
  await expect(dialog.getByRole('button', { name: 'Resume download' })).toBeVisible();
  await dialog.getByLabel('Язык / Language').selectOption('ru');
  await expect(dialog).toContainText('Обновление загружается в фоне…');
  await expect(dialog).toContainText('12,5 МБ');
  await expect(dialog.getByRole('button', { name: 'Продолжить загрузку' })).toBeVisible();
  await page.evaluate(() => {
    window.bardforge!.status = async () => ({
      version: 'test',
      update: { status: 'error' },
      components: [
        { id: 'python', version: '3', bytes: 1, received: 0, status: 'error', errorCode: 'disk-space' },
      ],
    });
  });
  await expect(dialog).toContainText('Недостаточно места на диске.');
  await dialog.getByLabel('Язык / Language').selectOption('en');
  await expect(dialog).toContainText('Not enough disk space.');
  await expect(dialog).toContainText('Could not get the update.');
  await expect(dialog.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});
