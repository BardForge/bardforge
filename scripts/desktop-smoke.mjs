import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';

await mkdir('tmp', { recursive: true });
const profile = await mkdtemp(path.resolve('tmp', 'desktop-profile-'));
const executablePath =
  process.env.BARDFORGE_TEST_EXE || path.resolve('build', 'win-unpacked', 'BardForge Studio.exe');
const env = { ...process.env, BARDFORGE_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({ executablePath, env });
  let page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Попробовать демосцену' }).click();
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-level]')?.getAttribute('data-level')) > 0.001,
  );
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const settings = await desktop.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(settings, { sandbox: true, contextIsolation: true, nodeIntegration: false });
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await page.getByRole('button', { name: 'Приложение и компоненты', exact: true }).click();
  await page.getByText('Тестовая сборка. Обновления включатся в стабильном выпуске.').waitFor();
  if (process.env.BARDFORGE_TEST_DOWNLOADS === '1') {
    await page.getByRole('button', { name: 'Подготовить компонент' }).click();
    await page.getByText('Установлен и проверен', { exact: true }).waitFor({ timeout: 120_000 });
    console.log(
      'PASS: UI downloaded Python from official source, verified SHA-256 and successfully executed isolated runtime.',
    );
  }
  await page.getByRole('button', { name: 'Закрыть настройки' }).click();
  await page.getByLabel('Название сцены').fill('Desktop persistence check');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('status', { name: 'Сохранение сцены' }).filter({ hasText: 'Сохранено' }).waitFor();
  await desktop.close();
  desktop = undefined;
  desktop = await electron.launch({ executablePath, env });
  page = await desktop.firstWindow();
  await page.getByLabel('Название сцены').waitFor();
  assert.equal(await page.getByLabel('Название сцены').inputValue(), 'Desktop persistence check');
  assert.equal(await page.getByTestId('track-row').count(), 3);
  if (process.env.BARDFORGE_TEST_DOWNLOADS === '1') {
    await page.getByRole('button', { name: 'Приложение и компоненты', exact: true }).click();
    await page.getByText('Установлен и проверен', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Закрыть настройки' }).click();
  }
  await page.getByRole('button', { name: 'Играть сцену', exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector('[data-level]')?.getAttribute('data-level')) > 0.001,
  );
  await page.getByRole('button', { name: 'Стоп', exact: true }).click();
  await page.screenshot({ path: 'tmp/desktop-packaged.png' });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: packaged Windows app, real audio output signal, isolated renderer, saved audio and scene restored after process restart.',
  );
} finally {
  await desktop?.close();
}
