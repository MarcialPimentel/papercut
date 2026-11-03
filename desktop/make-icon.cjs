// Draws the app icon (desktop/icon.png, 512x512) from the site's katana favicon (public/favicon.svg).
// Run again after changing the favicon: npx electron desktop/make-icon.cjs

const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const SIZE = 512;
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = readFileSync(join(__dirname, '..', 'public', 'favicon.svg'), 'utf8')
    .replace(/width="64" height="64"/, `width="${SIZE}" height="${SIZE}"`);
  const win = new BrowserWindow({ width: SIZE, height: SIZE, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  win.webContents.setZoomFactor(1);
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  writeFileSync(join(__dirname, 'icon.png'), img.resize({ width: SIZE, height: SIZE }).toPNG());
  app.quit();
});
