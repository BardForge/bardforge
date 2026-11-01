import { expect, test } from '@playwright/test';

test('GM creates and renames arbitrary top-level categories and nested subcategories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Категория', exact: true }).click();
  await page.getByLabel('Название группы: Новая группа', { exact: true }).fill('Жители города');
  await page.getByLabel('Название группы: Новая группа', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Добавить подкатегорию: Жители города', exact: true }).click();
  await page.getByLabel('Название группы: Подгруппа', { exact: true }).fill('Торговцы');
  await page.getByLabel('Название группы: Подгруппа', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Добавить подкатегорию: Торговцы', exact: true }).click();
  await page.getByLabel('Название группы: Подгруппа', { exact: true }).fill('Кузнец');
  await page.getByLabel('Название группы: Подгруппа', { exact: true }).press('Enter');
  await expect(page.getByRole('status', { name: 'Сохранение сцены' })).toContainText('Сохранено');
  await page.reload();
  const top = page.getByRole('region', { name: 'Группа Жители города', exact: true });
  await expect(
    top
      .getByRole('region', { name: 'Группа Торговцы', exact: true })
      .getByRole('region', { name: 'Группа Кузнец', exact: true }),
  ).toBeVisible();
});
