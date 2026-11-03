// What the desktop app gives the game page (window.papercutDesktop). The page has no other access to the PC.
// The shape matches DesktopBridge in src/store.ts.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('papercutDesktop', {
  platform: process.platform,
  server: ipcRenderer.sendSync('server'),
  load: () => ipcRenderer.sendSync('load'),
  save: (data) => ipcRenderer.send('save', data),
  setFullscreen: (on) => ipcRenderer.send('fullscreen:set', !!on),
  isFullscreen: () => ipcRenderer.sendSync('fullscreen:get'),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (_e, on) => cb(!!on)),
  quit: () => ipcRenderer.send('quit'),
  // Steam: null when Steam isn't running.
  steam: ipcRenderer.sendSync('steam') ? {
    name: ipcRenderer.sendSync('steam:name'),
    unlock: (id) => ipcRenderer.send('steam:unlock', String(id)),
    presence: (token, vars) => ipcRenderer.send('steam:presence', String(token), vars || {}),
  } : null,
});
