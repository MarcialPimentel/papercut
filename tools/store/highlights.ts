// The highlights trailer: tool-assisted fights (art/store/trailer/highlights.json) replayed in the real game,
// captured at 1920x1080 and 60 fps, cut to the title-screen music with paper title cards.
//   npm run store:highlights   -> art/store/trailer/papercut_highlights_1080p60.mp4
// Each clip is checked in Node first (tools/store/tas.ts); a clip that no longer does what it expects
// (after tuning changes) stops the render, and its script needs new timings.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { HERE, OUT, caption, launch, openGame, prepare, startServer, state, tick } from './lib.mjs';
import { SCRIPT, check, loadClips, run, type Clip } from './tas';

const W = 1920, H = 1080, FPS = 60;
const STEP = 1 / 60 + 1e-7; // one fight frame per drawn frame (a hair over, so rounding never skips a step)
const BEAT = 75; // frames: two beats of the title music (96 a minute). Every cut after the title lands on this grid.
const SFX = { 'papercut.volume': JSON.stringify({ music: 0, sfx: 0.8 }) };
const MUSIC = { 'papercut.volume': JSON.stringify({ music: 0.8, sfx: 0 }) };
const MATH_SEED = 11;
const TMP = join(HERE, 'cache', 'highlights');
const only = process.argv[2]; // re-capture one clip (the others are reused from the cache)

const edit: string[] = JSON.parse(readFileSync(SCRIPT, 'utf8')).edit;
const clips = Object.fromEntries(loadClips().map((c) => [c.name, c])) as Record<string, Clip>;

// ---------- 1. check every clip, and fit the cuts to the beat ----------
let afterTitle = false;
for (const item of edit) {
  if (item.startsWith('card:')) { afterTitle ||= item.startsWith('card:title'); continue; }
  const c = clips[item], err = check(c, run(c));
  if (err) throw new Error(`clip ${c.name}: ${err} (fix its script in highlights.json; npx tsx tools/store/tas.ts ${c.name} -v)`);
  if (afterTitle) {
    const shown = c.show.reduce((n, [a, b]) => n + b - a, 0), want = Math.max(BEAT, Math.round(shown / BEAT) * BEAT);
    const last = c.show[c.show.length - 1];
    last[1] = Math.min(c.frames, last[1] + want - shown);
  }
}

// ---------- 2. capture ----------
const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const frameOf = async (page: Page) => (await state(page)).frame as number;
const clockOf = (page: Page) => page.evaluate(() => (window as any).__store.clock.t - (window as any).__store.clock.audio0) as Promise<number>;

interface Part { dir: string; frames: number; t0: number; wav: string }

async function captureClip(browser: any, url: string, c: Clip): Promise<Part[]> {
  const r = run(c), start = JSON.stringify(r.start);
  const span = (c.show[c.show.length - 1][1] - c.show[0][0]) / FPS + 3;
  const page: Page = await openGame(browser, url, { w: W, h: H, start: c.endless ? 'endless' : 'practice', audioSecs: span, storage: SFX, mathSeed: MATH_SEED });
  await prepare(page);
  await page.evaluate((codes) => (window as any).__store.dress(codes), c.looks);
  // Warm the camera up on the opening positions (both fighters idle), then start the scripted run from frame 0.
  await page.evaluate(([s, a, b]) => (window as any).__store.script(s, a, b, true), [start, r.inputs[0], r.inputs[1]] as const);
  await tick(page, STEP, 45);
  await page.evaluate(([s, a, b]) => (window as any).__store.script(s, a, b), [start, r.inputs[0], r.inputs[1]] as const);
  const parts: Part[] = [];
  const wav = join(TMP, `${c.name}.wav`);
  for (const [i, [a, b]] of c.show.entries()) {
    // Drawn but not captured up to the stretch, so the camera, the halves and the effects carry on as in play.
    while ((await frameOf(page)) < a) await tick(page, STEP);
    if (i === 0) await page.evaluate(() => (window as any).__store.audioStart());
    const dir = join(TMP, `${c.name}_${i}`);
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const t0 = await clockOf(page);
    let n = 0;
    for (let f = await frameOf(page); f < b; f = await frameOf(page)) {
      const cap = c.caps?.find(([x, y]) => f >= x && f < y);
      await caption(page, cap ? cap[2] : '');
      await page.screenshot({ path: join(dir, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      await tick(page, STEP);
    }
    parts.push({ dir, frames: n, t0, wav });
    console.log(`clip ${c.name} [${a}, ${b}): ${n} frames`);
  }
  const b64 = await page.evaluate((s) => (window as any).__store.audioWav(s), span);
  writeFileSync(wav, Buffer.from(b64, 'base64'));
  await page.close();
  return parts;
}

/** The title-screen music, recorded on its own (effects muted), long enough for the whole cut. */
async function recordMusic(browser: any, url: string, secs: number, file: string) {
  const page: Page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const director = readFileSync(join(HERE, 'director.js'), 'utf8');
  await page.addInitScript({ content: `window.__STORE_CFG = ${JSON.stringify({ audioSecs: secs + 2, storage: MUSIC, mathSeed: MATH_SEED })};\n${director}` });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__pc && (window as any).__store, null, { timeout: 60000 });
  await page.keyboard.press('Shift'); // a key press turns the sound on
  await page.evaluate(() => (window as any).__store.audioStart());
  for (let t = 0; t < secs + 1; t += 1 / 30) await tick(page, 1 / 30);
  const b64 = await page.evaluate((s) => (window as any).__store.audioWav(s), secs + 1);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  await page.close();
}

const cards: Record<string, Record<string, string | number>> = {
  title: { bg: '/tools/store/cache/wide.png', lw: 0.46, at: '0.27,0.16' },
  match: { bg: '/tools/store/cache/wide.png', filter: 'blur(14px) saturate(.7) brightness(.8)', lw: 0.6, at: '0.5,0.47', text: 'MATCH POINT', shadow: 1 },
  end: { bg: '/tools/store/cache/wide.png', filter: 'blur(14px) saturate(.7) brightness(.85)', lw: 0.62, at: '0.5,0.3', lines: 'Ranked and friendly duels online|Tournaments for up to 8|Endless, with leaderboards|Wishlist on Steam*', ls: 0.05, lt: 0.52 },
};

const { server, url } = await startServer();
const browser = await launch();
if (!only) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const partsFile = join(TMP, 'parts.json');
const parts: Record<string, Part[]> = only && existsSync(partsFile) ? JSON.parse(readFileSync(partsFile, 'utf8')) : {};
for (const item of edit) {
  if (item.startsWith('card:') || (only && item !== only)) continue;
  parts[item] = await captureClip(browser, url, clips[item]);
  writeFileSync(partsFile, JSON.stringify(parts));
}
const missing = edit.filter((x) => !x.startsWith('card:') && !parts[x]);
if (missing.length) { console.log('not captured yet:', missing.join(', ')); await browser.close(); await server.close(); process.exit(0); }
for (const [name, q] of Object.entries(cards)) {
  const p: Page = await browser.newPage({ viewport: { width: W, height: H } });
  await p.goto(`${url}tools/store/compose.html?${new URLSearchParams(Object.entries({ w: W, h: H, ...q }).map(([k, v]) => [k, String(v)]))}`);
  await p.waitForFunction(() => document.title === 'ok');
  await p.screenshot({ path: join(TMP, `card_${name}.png`), type: 'png' });
  await p.close();
}

// ---------- 3. edit ----------
const segs: string[] = [];
let t = 0, musicAt = 0;
for (const item of edit) {
  if (item.startsWith('card:')) {
    const [, name, s] = item.split(':'), secs = Number(s);
    if (name === 'title') musicAt = t;
    const out = join(TMP, `seg${segs.length}.mp4`);
    ffmpeg('-loop', '1', '-framerate', String(FPS), '-t', String(secs), '-i', join(TMP, `card_${name}.png`),
      '-f', 'lavfi', '-t', String(secs), '-i', 'anullsrc=r=48000:cl=stereo',
      '-vf', `fade=t=in:d=0.2,fade=t=out:st=${secs - 0.2}:d=0.2,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS),
      '-c:a', 'pcm_s16le', '-shortest', out.replace('.mp4', '.mkv'));
    segs.push(out.replace('.mp4', '.mkv'));
    t += secs;
    continue;
  }
  for (const p of parts[item]) {
    const secs = p.frames / FPS, out = join(TMP, `seg${segs.length}.mkv`);
    ffmpeg('-framerate', String(FPS), '-i', join(p.dir, '%05d.jpg'), '-ss', String(p.t0), '-t', String(secs), '-i', p.wav,
      '-vf', 'format=yuv420p', '-af', `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, secs - 0.04)}:d=0.04`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS), '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-shortest', out);
    segs.push(out);
    t += secs;
  }
}
writeFileSync(join(TMP, 'list.txt'), segs.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
ffmpeg('-f', 'concat', '-safe', '0', '-i', join(TMP, 'list.txt'), '-c', 'copy', join(TMP, 'cut.mkv'));

// The music starts on the title card (the cold open plays with the fight's own sound only) and fades out on the end card.
const bedSecs = t - musicAt;
await recordMusic(browser, url, bedSecs + 1, join(TMP, 'music_raw.wav'));
ffmpeg('-i', join(TMP, 'music_raw.wav'), '-af', `silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:${bedSecs},afade=t=out:st=${bedSecs - 2}:d=2`, join(TMP, 'music.wav'));
mkdirSync(join(OUT, 'trailer'), { recursive: true });
const ms = Math.round(musicAt * 1000);
ffmpeg('-i', join(TMP, 'cut.mkv'), '-i', join(TMP, 'music.wav'),
  '-filter_complex', `[1:a]adelay=${ms}|${ms},volume=0.7[m];[0:a][m]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '8M', '-bufsize', '16M', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', join(OUT, 'trailer', 'papercut_highlights_1080p60.mp4'));
console.log(`wrote highlights trailer: ${t.toFixed(1)} s`);

await browser.close();
await server.close();
