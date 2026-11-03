// Shared helpers for the store-art tools: a dev server for the game, a headless browser, and a game page
// that runs on the fake clock in director.js.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, loadConfigFromFile } from 'vite';
import { chromium } from 'playwright-core';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const OUT = join(ROOT, 'art/store');
export const FPS = 30; // trailer and capture frame rate (the fight itself always runs at 60)

/** The game's dev server (Vite), which also serves these tools' own pages. */
export async function startServer() {
  // The game's own config, minus its proxy to the rooms server (not running here; it would only log errors).
  const { config } = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(ROOT, 'vite.config.ts'));
  const server = await createServer({ ...config, configFile: false, root: ROOT, logLevel: 'error', server: { ...config.server, proxy: undefined, port: 5299, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { server, url };
}

/** Headless Chromium. Uses CHROME_PATH, else Playwright's own install (see docs/steam-store.md). */
export async function launch() {
  const guess = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe');
  const executablePath = process.env.CHROME_PATH || (guess && existsSync(guess) ? guess : undefined);
  // Software WebGL, so it runs the same on any PC (slow, but the fake clock makes speed irrelevant).
  return chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}

const director = readFileSync(join(HERE, 'director.js'), 'utf8');

/**
 * Open the game at w x h (CSS pixels; `scale` 2 renders at twice that), on the fake clock.
 * `start`: 'practice' or 'endless'. `audioSecs`: record sound for that long. `storage`: saved settings to start with
 * (e.g. volumes). `mathSeed`: seed Math.random, so drawing details repeat exactly.
 */
export async function openGame(browser, url, { w = 1920, h = 1080, scale = 1, start = 'practice', audioSecs = 0, seed = 7, level = 3, storage = {}, mathSeed = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.addInitScript({ content: `window.__STORE_CFG = ${JSON.stringify({ audioSecs, seed, storage, mathSeed })};\n${director}` });
  await page.goto(url);
  await page.waitForFunction(() => window.__pc && window.__store, null, { timeout: 60000 });
  // Let the models and fonts load (real time), drawing the menu on the fake clock meanwhile.
  for (let i = 0; i < 20; i++) { await tick(page, 1 / FPS); await page.waitForTimeout(100); }
  await page.evaluate(() => document.fonts.ready);
  await page.click(start === 'endless' ? '#bEndless' : '#bPractice');
  await page.evaluate((lv) => window.__store.takeOver(lv), level);
  return page;
}

export const tick = (page, secs = 1 / FPS, n = 1) => page.evaluate(({ secs, n }) => { for (let i = 0; i < n; i++) window.__store.tick(secs); }, { secs, n });
export const state = (page) => page.evaluate(() => window.__store.state());

/** Run the fight without drawing until `until(state)` is true or `maxFrames` fight frames pass. */
export async function fastForward(page, until, maxFrames = 60 * 600) {
  await page.evaluate(() => window.__store.drawing(false));
  const start = (await state(page)).frame;
  for (;;) {
    await tick(page, 0.05, 20);
    const s = await state(page);
    if ((until && until(s)) || s.frame - start > maxFrames) break;
  }
  await page.evaluate(() => window.__store.drawing(true));
}

/** Run to an exact fight frame without drawing (the game steps at most 3 frames per tick). */
export async function runTo(page, frame) {
  await page.evaluate(() => window.__store.drawing(false));
  for (;;) {
    const s = await state(page);
    const left = frame - s.frame;
    if (left <= 0) break;
    await tick(page, Math.min(3, left) / 60);
  }
  await page.evaluate(() => window.__store.drawing(true));
}

// Trailer captions: a paper sticker over the fight, in the logo's stencil type.
const CAPTION_CSS = `#__cap{position:absolute;left:50%;bottom:9%;transform:translateX(-50%) rotate(-2deg);z-index:50;font:800 64px/1 'Big Shoulders Stencil Display',sans-serif;
text-transform:uppercase;letter-spacing:.03em;color:#18171C;background:#FBFAF6;border:4px solid #18171C;box-shadow:7px 7px 0 #18171C;padding:10px 26px 14px;white-space:nowrap}
#__cap:empty{display:none}`;

/** Ready a game page for footage: hide the practice status line, add the caption sticker. */
export async function prepare(page) {
  await page.evaluate((css) => {
    window.__store.hud('shots');
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('div'); d.id = '__cap'; document.getElementById('stage').appendChild(d);
  }, CAPTION_CSS);
}
export const caption = (page, text) => page.evaluate((t) => { document.getElementById('__cap').textContent = t; }, text);
