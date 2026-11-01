function createUpdates(updater, enabled) {
  let status = {
    status: enabled ? 'idle' : 'development',
    message: enabled
      ? 'Проверка обновлений ещё не выполнялась.'
      : 'Тестовая сборка. Обновления включатся в стабильном выпуске.',
  };
  let busy = false;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.disableWebInstaller = true;
  updater.disableDifferentialDownload = true;
  updater.logger = null;
  updater.on('checking-for-update', () => {
    status = { status: 'checking', message: 'Проверяем обновления…' };
  });
  updater.on('update-not-available', () => {
    status = { status: 'current', message: 'Установлена последняя версия.' };
  });
  updater.on('update-available', () => {
    status = { status: 'downloading', message: 'Обновление загружается в фоне…', percent: 0 };
  });
  updater.on('download-progress', (progress) => {
    status = { status: 'downloading', message: 'Обновление загружается в фоне…', percent: progress.percent };
  });
  updater.on('update-downloaded', () => {
    status = { status: 'ready', message: 'Обновление готово. Установите его после завершения сессии.' };
  });
  const failed = () => {
    status = {
      status: 'error',
      message: 'Не удалось получить обновление. Проверьте подключение и повторите позже.',
    };
  };
  updater.on('error', failed);
  return {
    state: () => status,
    async check() {
      if (!enabled || busy || status.status === 'ready' || status.status === 'downloading') return status;
      busy = true;
      try {
        const result = await updater.checkForUpdates();
        await result?.downloadPromise;
      } catch {
        failed();
      } finally {
        busy = false;
      }
      return status;
    },
    install() {
      if (enabled && status.status === 'ready') updater.quitAndInstall(false, true);
    },
  };
}
module.exports = { createUpdates };
