import { expect, test } from '@playwright/test';

test('Stop cancels Play while the audio device is still resuming', async ({ page }) => {
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = async function () {
      await new Promise<void>((resolve) =>
        window.addEventListener('allow-audio-resume', () => resolve(), { once: true }),
      );
      await resume.call(this);
      document.documentElement.dataset.audioResumed = 'true';
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('allow-audio-resume')));
  await expect(page.locator('html')).toHaveAttribute('data-audio-resumed', 'true');
  await expect(page.getByRole('button', { name: 'Играть сцену', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пауза сцены', exact: true })).toHaveCount(0);
});

test('a transient autosave failure does not poison scene operations after duplicate succeeds', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Новая сцена', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'scenes') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('Temporary storage failure', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByLabel('Название сцены').fill('Recovered scene');
  await page.getByLabel('Название сцены').press('Enter');
  await expect(page.getByRole('alert')).toContainText('Temporary storage failure');
  await page.getByRole('button', { name: 'Копия', exact: true }).click();
  await expect(page.getByLabel('Название сцены')).toHaveValue('Recovered scene — копия');
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await expect(page.getByLabel('Название сцены')).toHaveValue('Новая сцена');
});

test('soundboard category includes descendants and resets a stale filter on scene change', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await page.getByRole('button', { name: 'Добавить подкатегорию: Окружение', exact: true }).click();
  await page.getByLabel('Группа выбранной дорожки').selectOption({ label: 'Подгруппа' });
  await page.locator('#soundboard').getByRole('button', { name: 'Окружение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Играть плитку: Лесной дождь' })).toBeVisible();
  await page.getByRole('button', { name: 'Новая сцена', exact: true }).click();
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await expect(page.getByRole('button', { name: 'Играть плитку: Лесной дождь' })).toBeVisible();
});
