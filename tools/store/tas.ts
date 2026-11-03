// Tool-assisted fights for the highlights trailer: both fighters play from scripted, frame-exact inputs.
// The fight (src/sim) depends only on its inputs, so a script played here in Node and played in the
// real renderer gives the same fight, frame for frame. The scripts live in art/store/trailer/highlights.json.
//
//   npx tsx tools/store/tas.ts            check every clip: run it and compare with what it expects
//   npx tsx tools/store/tas.ts <clip> -v  print that clip's events frame by frame (add -s for every frame's state)
//   npx tsx tools/store/tas.ts --bake     re-make the Endless clip's inputs (endless.inputs.json)
//
// A clip's inputs are two lists, one per fighter (kami = seat 0, sumi = seat 1), of [frame, "buttons"]:
//   held buttons (left, right, low) stay held until the next entry;
//   presses (light, heavy, feint, jump, dashL, dashR) happen on that frame only.
// "low" held = guard low, otherwise the guard is high. Frames count from the clip's first frame (0).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BTN, newMatch, step, type FightEvent, type State } from '../../src/sim/sim';
import { DEFAULT_CFG, ENDLESS_CFG } from '../../src/sim/config';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SCRIPT = join(ROOT, 'art/store/trailer/highlights.json');
/** The Endless clip's inputs, made by --bake: { clip: [kami's list, sumi's list] }, each list [frame, buttons, ...]. */
export const BAKED = join(ROOT, 'art/store/trailer/endless.inputs.json');

type Track = [number, string][];
export interface Clip {
  name: string;
  /** Notebook page 0-3 (Graph Paper Dojo, Ruled Courtyard, Legal Pad Grove, back cover). */
  page: number;
  endless?: boolean;
  /** Each fighter's look as the game's look code: colour set . d(ark) or l(ight) . outfit . sword. */
  looks: [string, string];
  /** Where the fight stands at frame 0. */
  setup: { x: [number, number]; hp?: [number, number]; wins?: [number, number]; round?: number };
  kami: Track;
  sumi: Track;
  /** Endless only: each fighter's [frame, buttons, ...] list, read from endless.inputs.json (made by --bake). */
  baked?: [number[], number[]];
  /** How many frames to run. */
  frames: number;
  /** What must happen, in order: "kind:seat" (seat of the attacker), e.g. "parry:1", "ko:0". The capture refuses a clip that fails. */
  expect: string[];
  /** The trailer: which stretches of frames it shows [from, to), and captions [from, to, text] (clip frames). */
  show: [number, number][];
  caps?: [number, number, string][];
}

const PRESS = ['light', 'heavy', 'feint', 'jump', 'dashL', 'dashR'];
const HELD = ['left', 'right', 'low'];

export function loadClips(): Clip[] {
  const clips: Clip[] = JSON.parse(readFileSync(SCRIPT, 'utf8')).clips;
  const baked = existsSync(BAKED) ? JSON.parse(readFileSync(BAKED, 'utf8')) : {};
  for (const c of clips) if (c.endless && baked[c.name]) c.baked = baked[c.name];
  return clips;
}

/** One fighter's buttons for every frame of the clip. */
export function inputsOf(track: Track, frames: number, baked?: number[]): number[] {
  const out = new Array(frames + 1).fill(0);
  if (baked) {
    let b = 0, i = 0;
    for (let f = 0; f <= frames; f++) { while (i < baked.length && baked[i] === f) { b = baked[i + 1]; i += 2; } out[f] = b; }
    return out;
  }
  let held = 0, i = 0;
  for (let f = 0; f <= frames; f++) {
    let press = 0;
    while (i < track.length && track[i][0] === f) {
      held = 0;
      for (const w of track[i][1].split(/\s+/).filter(Boolean)) {
        if (!(w in BTN)) throw new Error(`unknown button "${w}" at frame ${f}`);
        if (HELD.includes(w)) held |= BTN[w as keyof typeof BTN];
        else if (PRESS.includes(w)) press |= BTN[w as keyof typeof BTN];
      }
      i++;
    }
    if (i < track.length && track[i][0] < f) throw new Error(`frames out of order near ${track[i][0]}`);
    out[f] = held | press;
  }
  return out;
}

/** The fight as it stands at frame 0 of a clip. */
export function setupState(c: Clip, in0: number, in1: number): State {
  const s = newMatch(c.endless ? ENDLESS_CFG : DEFAULT_CFG);
  s.phase = 'fight'; s.phaseT = 200; s.page = c.page; s.round = c.setup.round ?? 1;
  [0, 1].forEach((i) => {
    const f = s.f[i];
    f.x = c.setup.x[i];
    f.facing = c.setup.x[i] < c.setup.x[1 - i] ? 1 : -1;
    if (c.setup.hp) f.hp = c.setup.hp[i];
    if (c.setup.wins) f.wins = c.setup.wins[i];
    f.stance = ([in0, in1][i] & BTN.low) ? 'low' : 'high';
    f.stanceAt = -999;
  });
  return s;
}

export interface Run { inputs: [number[], number[]]; start: State; events: (FightEvent & { f: number })[]; states: State[] }

export function run(c: Clip): Run {
  const a = inputsOf(c.kami, c.frames, c.baked?.[0]), b = inputsOf(c.sumi, c.frames, c.baked?.[1]);
  const s = setupState(c, a[0], b[0]);
  const start = structuredClone(s);
  const events: Run['events'] = [], states: State[] = [];
  for (let f = 0; f < c.frames; f++) {
    for (const e of step(s, [a[f], b[f]])) events.push({ ...e, f });
    states.push(structuredClone(s));
  }
  return { inputs: [a, b], start, events, states };
}

/** The expected events, in order, among what happened. Returns '' when they all happened, else what's missing. */
export function check(c: Clip, r: Run): string {
  let i = 0;
  for (const want of c.expect) {
    const [k, p] = want.split(':');
    const at = r.events.findIndex((e, j) => j >= i && e.k === k && (p === undefined || ('p' in e && e.p === Number(p))));
    if (at < 0) return `missing ${want}`;
    i = at + 1;
  }
  return '';
}

const short = (e: FightEvent & { f: number }) => {
  const o = e as Record<string, unknown>;
  return [e.f, e.k, ...['p', 'atk', 'slash', 'heavy', 'stagger', 'counter', 'why', 'how', 'over', 'dmg', 'winner'].filter((k) => o[k] !== undefined && o[k] !== false).map((k) => `${k}=${o[k]}`)].join(' ');
};

/**
 * The Endless clip's inputs come from a little scripted policy instead of a hand-written list (it covers several
 * bots): each bot walks in and winds up a heavy, and Kami walks in and counter cuts it, every few bots after a jump.
 * `--bake` runs it once and saves the frame lists to art/store/trailer/endless.inputs.json, so the trailer replays fixed inputs.
 */
export function endlessScript(c: Clip): [number[], number[]] {
  const s = setupState(c, 0, 0);
  const lists: [number[], number[]] = [[], []], last = [-1, -1];
  const rec = (i: number, b: number) => { if (b !== last[i]) { lists[i].push(s.frame, b); last[i] = b; } };
  let waitK = 0;
  for (let f = 0; f < c.frames; f++) {
    const [k, bot] = s.f, dx = Math.abs(bot.x - k.x), toK = k.x > bot.x ? BTN.right : BTN.left, toBot = bot.x > k.x ? BTN.right : BTN.left;
    let a = 0, b = 0;
    if (s.phase === 'fight' && s.hitstop === 0) {
      const n = k.wins; // bots cut so far
      // The bot: walk in, then a heavy (high, or low on odd bots).
      if (bot.state === 'guard' && bot.alive) {
        if (dx > 2.15) b |= toK; else b |= BTN.heavy;
        if (n % 2) b |= BTN.low;
      } else if (n % 2) b |= BTN.low;
      // Kami: walk in, and cut the wind-up as soon as it shows.
      if (k.state === 'guard' && k.alive && waitK <= 0) {
        if (bot.state === 'wind' && bot.atk === 'heavy' && bot.t >= 3) { a |= BTN.light; waitK = 30; }
        else if (dx > 2.2) a |= toBot;
      }
      if (n % 2) a |= BTN.low;
    }
    waitK--;
    rec(0, a); rec(1, b);
    step(s, [a, b]);
  }
  return lists;
}

// ---------- command line ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, flag] = process.argv.slice(2);
  if (name === '--bake') {
    const out: Record<string, [number[], number[]]> = {};
    for (const c of loadClips()) if (c.endless) out[c.name] = endlessScript(c);
    const body = Object.entries(out).map(([k, [a, b]]) => `  "${k}": [
    ${JSON.stringify(a)},
    ${JSON.stringify(b)}
  ]`);
    writeFileSync(BAKED, `{\n${body.join(',\n')}\n}\n`);
    console.log('baked', Object.keys(out).join(', '));
    process.exit(0);
  }
  let bad = 0;
  for (const c of loadClips()) {
    if (name && c.name !== name) continue;
    const r = run(c), err = check(c, r);
    if (err) bad++;
    console.log(`${err ? 'FAIL' : 'ok  '} ${c.name.padEnd(16)} ${err}`);
    if (flag === '-v') {
      for (const e of r.events) console.log('   ', short(e));
      if (process.argv.includes('-s')) r.states.forEach((s, f) => console.log('   s', f, s.f.map((x) => `${x.x.toFixed(2)} ${x.state}${x.t} ${x.stance} hp${x.hp}`).join(' | ')));
    }
  }
  process.exit(bad ? 1 : 0);
}
