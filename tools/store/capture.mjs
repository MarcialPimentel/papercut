// Screenshots and the trailer, captured from real play: Kami is the scripted duelist (director.js),
// Sumi is the practice bot. The fight is deterministic, so a quick run without drawing (the scout)
// finds the moments, then a second run draws and captures only those.
//   npm run store:shots     -> art/store/screenshots/*.png (1920x1080, with the HUD)
//   npm run store:trailer   -> art/store/trailer/papercut_trailer.mp4 (1080p, 30 fps, with the game's sound)
// Moments are found by what happens (Kami's K.O.s on three spreads, the match win, the 6th bot in Endless),
// so they survive small tuning changes; check the results after any change to the fight.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, HERE, OUT, caption, fastForward, launch, openGame, prepare, runTo, startServer, state, tick } from './lib.mjs';

const what = process.argv[2] || 'shots';
const SEED = 7, LEVEL = 3, ENDLESS_SEED = 7;
const INTRO = 87; // RULES.introFrames: a round's fight starts this long after its 'round' event
const W = 1920, H = 1080;
const TMP = join(HERE, 'cache', what);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const { server, url } = await startServer();
const browser = await launch();

// ---------- 1. scout ----------
async function scout(start, seed, until) {
  const page = await openGame(browser, url, { w: 480, h: 270, seed, level: LEVEL, start });
  await fastForward(page, until, 60 * 900);
  const ev = await page.evaluate(() => window.__store.events);
  await page.close();
  return ev;
}

/** The best match: Kami wins, with his K.O.s on as many different spreads as possible, then the most exchanges. */
function pickMatch(ev) {
  const overs = ev.filter((e) => e.k === 'over');
  let best = null, from = 0;
  for (const o of overs) {
    const inMatch = ev.filter((e) => e.f > from && e.f <= o.f);
    const kos = inMatch.filter((e) => e.k === 'ko' && e.p === 0);
    if (o.winner === 0) {
      const pages = new Set(kos.map((k) => k.page)).size;
      const busy = inMatch.filter((e) => ['hit', 'block', 'parry', 'feint'].includes(e.k)).length;
      const score = pages * 1000 + busy;
      if (!best || score > best.score) best = { score, from, over: o.f, ev: inMatch, kos };
    }
    from = o.f;
  }
  if (!best) throw new Error('Kami never won a match: try another SEED');
  // Three K.O.s on different spreads, in order.
  const seen = new Set(), three = [];
  for (const k of best.kos) if (!seen.has(k.page) && three.length < 3) { seen.add(k.page); three.push(k); }
  while (three.length < 3) three.push(best.kos[three.length]);
  best.three = three;
  return best;
}
const fightStart = (ev, f) => Math.max(...ev.filter((e) => e.k === 'round' && e.f <= f).map((e) => e.f)) + INTRO;
/** The busiest stretch of `len` frames of actual fighting (no intros, K.O.s or page turns) that stays clear of `avoid` [a, b] ranges. */
function busiest(ev, len, avoid) {
  let top = { n: -1, f: 0 };
  for (const r of ev.filter((e) => e.k === 'round')) {
    const a = r.f + INTRO, end = ev.find((e) => e.f > a && e.k === 'ko')?.f ?? a;
    for (let f = a; f + len <= end - 10; f += 10) {
      if (avoid.some(([x, y]) => f < y + 40 && f + len > x - 40)) continue;
      const n = ev.filter((e) => e.f >= f && e.f < f + len && ['hit', 'block', 'parry', 'feint'].includes(e.k)).length;
      if (n > top.n) top = { n, f };
    }
  }
  return top.f;
}

const ev = await scout('practice', SEED, (s) => s.frame > 60 * 700);
const m = pickMatch(ev);
const [k1, k2, k3] = m.three;
console.log('match', m.from, '->', m.over, 'Kami K.O.s at', m.three.map((k) => `${k.f} (page ${k.page})`).join(', '));
const eev = await scout('endless', ENDLESS_SEED, (s) => s.frame > 60 * 300);
// The bot cut with the most cut bots already piled up on the page (the halves of the last 5 stay).
const sixth = eev.filter((e) => e.k === 'ko' && e.p === 0).reduce((a, e) => (e.wins > a.wins ? e : a));
console.log('endless: bot', sixth.wins, 'cut at', sixth.f);

// ---------- 2. what to capture ----------
const counterStart = Math.max(fightStart(m.ev, k2.f) - 40, k2.f - 260);
const openStart = Math.max(fightStart(m.ev, k1.f), k1.f - 170), legalStart = Math.max(fightStart(m.ev, k3.f), k3.f - 150);
const bStart = busiest(m.ev, 240, [[openStart, k1.f + 130], [counterStart, k2.f + 276], [legalStart, k3.f + 130]]);
const hit1 = m.ev.find((e) => e.k === 'hit' && e.p === 0 && e.page === k1.page) || m.ev.find((e) => e.k === 'hit' && e.p === 0);
const parry = m.ev.find((e) => e.k === 'parry') || m.ev.find((e) => e.k === 'block');
const feint = m.ev.find((e) => e.k === 'feint' && e.p === 1) || m.ev.find((e) => e.k === 'feint');

// Trailer clips: first and last fight frame, captions [[from, to, text]]. Captured in fight order (sorted below);
// the edit further down puts them in the trailer's order.
const clips = [
  { name: 'open', a: openStart, b: k1.f + 130, caps: [] },
  { name: 'guard', a: bStart, b: bStart + 240, caps: [[bStart, bStart + 240, 'Guard high or low with the mouse']] },
  { name: 'counter', a: counterStart, b: k2.f + 276, caps: [[-1e9, k2.f - 6, 'Feint. Parry. Read them.'], [k2.f - 6, k2.f + 180, 'Catch them mid-swing: counter cut'], [k2.f + 180, 1e9, 'Every round, a new page']] },
  { name: 'legal', a: legalStart, b: k3.f + 130, caps: [[-1e9, 1e9, 'Every hit cuts the paper']] },
  { name: 'win', a: m.over + 8, b: m.over + 160, caps: [] },
];
clips.sort((x, y) => x.a - y.a);
const endlessClip = { name: 'endless', a: sixth.f - 100, b: sixth.f + 60, caps: [[-1e9, 1e9, 'Endless: how many bots can you cut?']] };

// Screenshots: [fight frame, file name].
const shots = [
  [hit1.f + 3, '01_hit'],
  [(parry?.f ?? bStart + 100) + 4, '02_parry'],
  [(feint?.f ?? bStart + 60) + 3, '03_feint'],
  [k2.f + 32, '04_counter_cut'],
  [k2.f + 180 + 44, '05_page_turn'],
  [k3.f + 62, '06_round_won'],
  [m.over + 80, '07_match_won'],
].sort((a, b) => a[0] - b[0]);

// ---------- 3. capture ----------

/** Run to `a`, warm the camera up, then capture frames until `b`. Returns the fake-clock span (for the sound). */
async function clip(page, c, dir) {
  mkdirSync(dir, { recursive: true });
  await runTo(page, c.a - 36);
  await tick(page, 1 / 60, 36); // drawn, so the camera and effects settle
  const t0 = await page.evaluate(() => window.__store.clock.t - window.__store.clock.audio0);
  let n = 0;
  for (;;) {
    const s = await state(page);
    if (s.frame >= c.b) break;
    const cap = c.caps.find(([x, y]) => s.frame >= x && s.frame < y);
    await caption(page, cap ? cap[2] : '');
    await page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    await tick(page, 1 / FPS);
  }
  const t1 = await page.evaluate(() => window.__store.clock.t - window.__store.clock.audio0);
  await caption(page, '');
  console.log('clip', c.name, n, 'frames');
  return { name: c.name, dir, frames: n, t0, t1 };
}

async function still(page, f, name) {
  if ((await state(page)).frame < f - 36) await runTo(page, f - 36);
  while ((await state(page)).frame < f) await tick(page, 1 / 60); // drawn, so the camera and effects settle
  await page.screenshot({ path: join(OUT, 'screenshots', `${name}.png`) });
  console.log('shot', name);
}

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
async function saveAudio(page, secs, file) {
  const b64 = await page.evaluate((s) => window.__store.audioWav(s), secs);
  writeFileSync(file, Buffer.from(b64, 'base64'));
}

if (what === 'shots') {
  mkdirSync(join(OUT, 'screenshots'), { recursive: true });
  const page = await openGame(browser, url, { w: W, h: H, seed: SEED, level: LEVEL });
  await prepare(page);
  await runTo(page, m.from + 1);
  await page.evaluate(() => window.__store.noRematch()); // stay on the back cover after the match
  for (const [f, name] of shots) await still(page, f, name);
  await page.close();
  const ep = await openGame(browser, url, { w: W, h: H, seed: ENDLESS_SEED, level: LEVEL, start: 'endless' });
  await prepare(ep);
  await still(ep, sixth.f + 215, '08_endless'); // the next bot walks in past the cut halves
  await ep.close();
} else {
  // The match, with its sound recorded from the first clip to the last.
  const span = (Math.max(...clips.map((c) => c.b)) - clips[0].a) / 60 + 8;
  const page = await openGame(browser, url, { w: W, h: H, seed: SEED, level: LEVEL, audioSecs: span });
  await prepare(page);
  await runTo(page, clips[0].a - 40);
  await page.evaluate(() => window.__store.audioStart());
  const parts = [];
  await page.evaluate(() => window.__store.noRematch()); // end on the win, not a new match
  for (const c of clips) parts.push(await clip(page, c, join(TMP, c.name)));
  await saveAudio(page, span, join(TMP, 'match.wav'));
  await page.close();
  // Endless, with its own sound.
  const espan = (endlessClip.b - endlessClip.a) / 60 + 4;
  const ep = await openGame(browser, url, { w: W, h: H, seed: ENDLESS_SEED, level: LEVEL, start: 'endless', audioSecs: espan });
  await prepare(ep);
  await runTo(ep, endlessClip.a - 40);
  await ep.evaluate(() => window.__store.audioStart());
  const epart = await clip(ep, endlessClip, join(TMP, 'endless'));
  await saveAudio(ep, espan, join(TMP, 'endless.wav'));
  await ep.close();

  // Title and end cards (laid out by compose.html over the key art).
  const card = async (file, q) => {
    const p = await browser.newPage({ viewport: { width: W, height: H } });
    await p.goto(`${url}tools/store/compose.html?${new URLSearchParams({ w: W, h: H, ...q })}`);
    await p.waitForFunction(() => document.title === 'ok');
    await p.screenshot({ path: file, type: 'png' });
    await p.close();
  };
  await card(join(TMP, 'title.png'), { bg: '/tools/store/cache/wide.png', lw: 0.46, at: '0.27,0.16' });
  await card(join(TMP, 'end.png'), { bg: '/tools/store/cache/wide.png', filter: 'blur(14px) saturate(.7) brightness(.85)', lw: 0.62, at: '0.5,0.3', lines: 'Fight friends online|Tournaments for up to 8|Endless|Wishlist on Steam*', ls: 0.05, lt: 0.52 });

  // ---------- 4. edit: open, title, guard, counter, legal, endless, win, end ----------
  const byName = Object.fromEntries(parts.map((p) => [p.name, p]));
  const seq = [
    { v: byName.open, a: 'match' },
    { still: join(TMP, 'title.png'), secs: 2.2, a: 'match', at: byName.open.t1 }, // the K.O. sound rings on under the title
    { v: byName.guard, a: 'match' },
    { v: byName.counter, a: 'match' },
    { v: byName.legal, a: 'match' },
    { v: epart, a: 'endless' },
    { v: byName.win, a: 'match' },
    { still: join(TMP, 'end.png'), secs: 4.5, a: 'match', at: byName.win.t1 },
  ];
  const segs = [];
  seq.forEach((s, i) => {
    const out = join(TMP, `seg${i}.mp4`);
    const wav = join(TMP, `${s.a}.wav`);
    const secs = s.v ? s.v.frames / FPS : s.secs;
    const at = s.v ? s.v.t0 : s.at;
    const fade = `afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, secs - 0.06)}:d=0.06`;
    const vin = s.v ? ['-framerate', String(FPS), '-i', join(s.v.dir, '%05d.jpg')] : ['-loop', '1', '-framerate', String(FPS), '-t', String(secs), '-i', s.still];
    const vf = s.still ? `fade=t=in:d=0.25,fade=t=out:st=${secs - 0.3}:d=0.3,format=yuv420p` : 'format=yuv420p';
    ffmpeg(...vin, '-ss', String(at), '-t', String(secs), '-i', wav,
      '-vf', vf, '-af', fade, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out);
    segs.push(out);
  });
  writeFileSync(join(TMP, 'list.txt'), segs.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  mkdirSync(join(OUT, 'trailer'), { recursive: true });
  ffmpeg('-f', 'concat', '-safe', '0', '-i', join(TMP, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', join(OUT, 'trailer', 'papercut_trailer_1080p30.mp4'));
  console.log('wrote trailer');
}

await browser.close();
await server.close();
