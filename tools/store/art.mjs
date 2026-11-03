// Renders Papercut's key art, every Steam capsule and library image, the logos and the menu title,
// from the real game (no HUD), into art/store/ and public/. Run: npm run store:art
// The scene: Kami's light slash counter-cuts Sumi mid-heavy on the Legal Pad Grove, 0.9 s after the cut,
// as Sumi comes apart in two halves with the red inside of the paper showing.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, OUT, ROOT, launch, openGame, startServer, state, tick } from './lib.mjs';

const CACHE = join(HERE, 'cache');
const COMPOSE_ONLY = process.argv.includes('--compose-only'); // reuse the last renders, only lay out again
const LEGAL = 2; // the Legal Pad Grove spread (src/sim/rules.ts PAGES)
for (const d of [CACHE, OUT, join(OUT, 'capsules'), join(OUT, 'library'), join(OUT, 'logo')]) mkdirSync(d, { recursive: true });

const { server, url } = await startServer();
const browser = await launch();

/** Stage the counter cut and render it at w x h (x2) with camera `cam` (relative to the fighters' midpoint). */
async function render(name, w, h, cam, { after = 54 } = {}) {
  if (COMPOSE_ONLY) return `/tools/store/cache/${name}.png`;
  const page = await openGame(browser, url, { w, h, scale: 2 });
  await page.evaluate(() => { window.__store.hold(); window.__store.hud('none'); });
  while ((await state(page)).phase !== 'fight') await tick(page, 1 / 30);
  const mid = await page.evaluate((spread) => {
    const pc = window.__pc, s = pc.mode.s;
    s.page = spread; pc.view.setPage(spread);
    s.f[0].x = -1.05; s.f[1].x = 1.15;
    const f = s.f[1]; f.state = 'wind'; f.atk = 'heavy'; f.t = 0; // Sumi starts a heavy...
    window.__store.press(window.__store.B.light); // ...and Kami's light slash catches it: a counter cut
    return (s.f[0].x + s.f[1].x) / 2;
  }, LEGAL);
  const c = { fov: cam.fov, pos: [mid + cam.pos[0], cam.pos[1], cam.pos[2]], at: [mid + cam.at[0], cam.at[1], cam.at[2]] };
  await page.evaluate((c) => window.__store.camera(c), c);
  while ((await state(page)).f[1].alive) await tick(page, 1 / 60);
  await tick(page, 1 / 60, after);
  const file = join(CACHE, `${name}.png`);
  await page.screenshot({ path: file });
  await page.close();
  console.log('rendered', name);
  return `/tools/store/cache/${name}.png`;
}

/** Lay out one image with compose.html. */
async function compose(out, w, h, q, { transparent = false, type = 'png' } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const qs = new URLSearchParams({ w, h, ...q }).toString();
  await page.goto(`${url}tools/store/compose.html?${qs}`);
  await page.waitForFunction(() => document.title === 'ok', null, { timeout: 30000 });
  await page.screenshot({ path: join(OUT, out), omitBackground: transparent, type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
  await page.close();
  console.log('wrote', out);
}

// ---------- renders (cached in tools/store/cache, not committed) ----------
const wideCam = { fov: 30, pos: [-0.5, 0.7, 7.8], at: [0.25, 1.75, 0] };
const wide = await render('wide', 1920, 1080, wideCam);
const tall = await render('tall', 748, 896, { fov: 34, pos: [0.1, 0.8, 8.2], at: [0.2, 2.05, 0] });
const lib = await render('library', 600, 900, { fov: 34, pos: [0.1, 0.8, 9.4], at: [0.2, 2.15, 0] });
const hero = await render('hero', 1920, 620, { fov: 22, pos: [-0.4, 0.7, 8.8], at: [0.3, 1.6, 0] });

// ---------- store capsules: key art + logo, no other text (Steam's rules) ----------
await compose('capsules/header_capsule_920x430.png', 920, 430, { bg: wide, op: '50% 62%', lw: 0.56, at: '0.3,0.19' });
await compose('capsules/small_capsule_462x174.png', 462, 174, { bg: wide, op: '50% 42%', lw: 0.94, at: '0.5,0.5', veil: 'rgba(246,226,127,.30)' });
await compose('capsules/main_capsule_1232x706.png', 1232, 706, { bg: wide, op: '50% 55%', lw: 0.46, at: '0.27,0.16' });
await compose('capsules/vertical_capsule_748x896.png', 748, 896, { bg: tall, lw: 0.88, at: '0.5,0.11' });
// Ambient, so it doesn't compete with the page: the key art, soft and quiet.
await compose('page_background_1438x810.png', 1438, 810, { bg: wide, op: '50% 40%', filter: 'blur(10px) saturate(.75) brightness(.9)' });

// ---------- library ----------
await compose('library/library_capsule_600x900.png', 600, 900, { bg: lib, lw: 0.9, at: '0.5,0.1' });
await compose('library/library_header_920x430.png', 920, 430, { bg: wide, op: '50% 62%', lw: 0.56, at: '0.3,0.19' });
await compose('library/library_hero_3840x1240.jpg', 3840, 1240, { bg: hero }, { type: 'jpeg' });
await compose('library/library_logo_1280x387.png', 1280, 387, { lw: 0.96, at: '0.5,0.5', shadow: '0' }, { transparent: true });

// ---------- key art and logos ----------
await compose('keyart_1920x1080.png', 1920, 1080, { bg: wide, lw: 0.46, at: '0.27,0.16' });
await compose('keyart_clean_3840x2160.jpg', 3840, 2160, { bg: wide }, { type: 'jpeg' });
await compose('logo/logo_2400.png', 2400, 726, { lw: 0.96, at: '0.5,0.5' }, { transparent: true });
await compose('logo/community_icon_184x184.png', 184, 184, { lw: 0.9, at: '0.5,0.5', text: 'P', veil: '#F6E27F' });
await compose('logo/community_icon_512x512.png', 512, 512, { lw: 0.9, at: '0.5,0.5', text: 'P', veil: '#F6E27F' });

// The menu title in the game uses the same logo.
const page = await browser.newPage({ viewport: { width: 900, height: 272 } });
await page.goto(`${url}tools/store/compose.html?${new URLSearchParams({ w: 900, h: 272, lw: 0.98, at: '0.5,0.5' })}`);
await page.waitForFunction(() => document.title === 'ok');
await page.screenshot({ path: join(ROOT, 'public/logo.png'), omitBackground: true });
console.log('wrote public/logo.png');

await browser.close();
await server.close();
