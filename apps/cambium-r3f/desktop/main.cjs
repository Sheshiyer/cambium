const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  net,
  protocol,
  session,
} = require('electron');

const DEV_SERVER_URL = process.env.CAMBIUM_DESKTOP_DEV_SERVER || '';
const APP_SCHEME = 'cambium';
const APP_HOST = 'app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.enableSandbox();

let mainWindow;

function rendererRoot() {
  return path.resolve(app.getAppPath(), 'dist');
}

function localAppUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === `${APP_SCHEME}:`) return parsed.host === APP_HOST;
    if (DEV_SERVER_URL) return parsed.origin === new URL(DEV_SERVER_URL).origin;
  } catch {
    return false;
  }
  return false;
}

function protectWebContents(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!localAppUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

function registerLocalProtocol() {
  const root = rendererRoot();
  protocol.handle(APP_SCHEME, async (request) => {
    const parsed = new URL(request.url);
    const requested = decodeURIComponent(parsed.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(root, requested);
    const withinRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);
    if (parsed.host !== APP_HOST || !withinRoot) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    backgroundColor: '#07191b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged && process.env.CAMBIUM_ALLOW_DEVTOOLS === '1',
    },
  });

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show();
    process.stdout.write(`CAMBIUM_DESKTOP_READY ${mainWindow.webContents.getURL()}\n`);
    if (process.env.CAMBIUM_DESKTOP_SMOKE === '1') {
      setTimeout(() => app.quit(), 250);
    }
  });

  if (DEV_SERVER_URL) mainWindow.loadURL(DEV_SERVER_URL);
  else mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
}

app.whenReady().then(() => {
  registerLocalProtocol();
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => protectWebContents(contents));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
