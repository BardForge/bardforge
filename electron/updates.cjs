function createUpdates(updater, enabled) {
  let status = {
    status: enabled ? 'idle' : 'development',
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
    status = { status: 'checking' };
  });
  updater.on('update-not-available', () => {
    status = { status: 'current' };
  });
  updater.on('update-available', () => {
    status = { status: 'downloading', percent: 0 };
  });
  updater.on('download-progress', (progress) => {
    status = { status: 'downloading', percent: progress.percent };
  });
  updater.on('update-downloaded', () => {
    status = { status: 'ready' };
  });
  const failed = () => {
    status = {
      status: 'error',
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
