// Papercut's desktop app (Electron): one window showing the built game (dist/), served from inside the app,
// so practice and Endless work offline. Online play goes to the live rooms server.
// Settings are one JSON file in the app's data folder (Windows: %APPDATA%\Papercut\settings.json,
// Linux / Steam Deck: ~/.config/Papercut/settings.json).

const { app, BrowserWindow, Menu, ipcMain, net, protocol, session } = require('electron');
const { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const { extname, join, normalize, sep } = require('node:path');
const { pathToFileURL } = require('node:url');

/** The rooms server. PAPERCUT_SERVER=http://localhost:8790 points a local build at a local server. */
const SERVER = (process.env.PAPERCUT_SERVER || 'https://papercut.marz.gg').replace(/\/+$/, '');
const GAME = join(__dirname, '..', 'dist');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://papercut`;

app.setName('Papercut');
// PAPERCUT_DATA=<folder> keeps a test run's settings apart from the real ones.
if (process.env.PAPERCUT_DATA) app.setPath('userData', process.env.PAPERCUT_DATA);
const FILE = join(app.getPath('userData'), 'settings.json');

function loadSaved() {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    if (data && typeof data === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(data)) if (typeof v === 'string') out[k] = v;
      return out;
    }
  } catch { /* first launch, or a broken file: start fresh */ }
  return {};
}
let saved = loadSaved();
/** The Settings screen's display choices (src/settings.ts writes them under this key). */
function display() {
  try { return JSON.parse(saved['papercut.settings'] || '{}') || {}; } catch { return {}; }
}

// Chromium switches have to be set before the app is ready, so vsync applies from the next launch.
if (display().vsync === false) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
// Linux (Steam Deck): Steam's install can't give Chromium's sandbox helper the rights it needs, which stops
// the app from starting. The window only ever shows the game's own files, so it runs without that sandbox.
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');
// Sound may start without a click first (the browser rule doesn't fit a game).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// One copy at a time: a second launch brings the first window back instead.
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  const d = display();
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    fullscreen: d.fullscreen !== false,
    backgroundColor: '#E9E4DA',
    title: 'Papercut',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // an online fight keeps running if the window loses focus
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  // F11 and Alt+Enter switch fullscreen, like most PC games.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      e.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });
  // Links (none today) open in the real browser; the game window never leaves the game.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });
  win.loadURL(`${ORIGIN}/`);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Serve the built game from inside the app (app://papercut/...), like the website serves it.
  protocol.handle(SCHEME, (req) => {
    const { pathname } = new URL(req.url);
    let file = normalize(join(GAME, decodeURIComponent(pathname)));
    if (!file.startsWith(GAME + sep) || !extname(file) || !existsSync(file)) file = join(GAME, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });

  // The rooms server only accepts connections from its own site. The app is the same game, so it says so.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${SERVER.replace(/^http/, 'ws')}/*`] }, (details, done) => {
    details.requestHeaders.Origin = SERVER;
    done({ requestHeaders: details.requestHeaders });
  });

  ipcMain.on('server', (e) => { e.returnValue = SERVER; });
  ipcMain.on('load', (e) => { e.returnValue = saved; });
  ipcMain.on('save', (_e, data) => {
    if (!data || typeof data !== 'object') return;
    saved = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === 'string') saved[k] = v;
    try {
      mkdirSync(app.getPath('userData'), { recursive: true });
      // Write a copy first, then swap it in, so a crash mid-write never loses the settings.
      writeFileSync(FILE + '.tmp', JSON.stringify(saved, null, 2));
      renameSync(FILE + '.tmp', FILE);
    } catch (err) { console.error('Could not save settings:', err); }
  });
  ipcMain.on('fullscreen:set', (_e, on) => win?.setFullScreen(!!on));
  ipcMain.on('fullscreen:get', (e) => { e.returnValue = !!win?.isFullScreen(); });
  ipcMain.on('quit', () => app.quit());

  createWindow();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
