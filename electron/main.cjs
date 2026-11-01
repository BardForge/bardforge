const { app, BrowserWindow, Menu, protocol, session, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { ComponentManager } = require('./components.cjs');
const { createUpdates } = require('./updates.cjs');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const devURL =
  !app.isPackaged && process.env.BARDFORGE_DEV_URL === 'http://127.0.0.1:5173'
    ? process.env.BARDFORGE_DEV_URL
    : undefined;
const development = !app.isPackaged || app.getVersion().includes('-');
const dataDir =
  process.env.BARDFORGE_DATA_DIR ||
  path.join(app.getPath('appData'), development ? 'BardForge Studio Dev' : 'BardForge Studio');
app.setPath('userData', path.resolve(dataDir));
app.setName('BardForge Studio');
protocol.registerSchemesAsPrivileged([
  { scheme: 'bardforge', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let window;
const components = new ComponentManager(dataDir);
const updates = createUpdates(autoUpdater, !development);
function handle(channel, action) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
      throw new Error('Unauthorized sender');
    return action(...args);
  });
}
handle('desktop:status', async () => ({
  version: app.getVersion(),
  update: updates.state(),
  components: await components.list(),
}));
handle('desktop:check-updates', () => {
  void updates.check();
});
handle('desktop:install-update', () => updates.install());
handle('desktop:install-component', (id) => {
  if (typeof id !== 'string' || id.length > 64) throw new Error('Invalid component');
  void components.ensureInstalled(id).catch(() => {});
});
handle('desktop:cancel-component', (id) => {
  if (typeof id === 'string') components.cancel(id);
});
const createWindow = () => {
  window = new BrowserWindow({
    width: 1536,
    height: 1000,
    minWidth: 940,
    minHeight: 640,
    title: 'BardForge Studio — development',
    backgroundColor: '#0a0e15',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = devURL ? url.startsWith(`${devURL}/`) : url === 'bardforge://app/index.html';
    if (!allowed) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.on('closed', () => {
    window = undefined;
  });
  void window.loadURL(devURL ?? 'bardforge://app/index.html');
};

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    protocol.handle('bardforge', async (request) => {
      const url = new URL(request.url);
      const route = decodeURIComponent(url.pathname);
      if (
        url.hostname !== 'app' ||
        !(/^\/index\.html$/.test(route) || /^\/(assets|art)\/[a-zA-Z0-9_.-]+$/.test(route))
      )
        return new Response('Not found', { status: 404 });
      const file = path.join(__dirname, '..', 'dist', route);
      const mime =
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }[path.extname(file)] ?? 'application/octet-stream';
      try {
        return new Response(await readFile(file), {
          headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    createWindow();
    if (!development) {
      setTimeout(() => void updates.check(), 15_000).unref();
      setInterval(() => void updates.check(), 6 * 60 * 60 * 1000).unref();
    }
  });
  app.on('window-all-closed', () => app.quit());
}
