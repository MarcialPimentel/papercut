// The fight, as plain data on a fixed 60-frames-per-second clock.
// step(state, inputs) is the only way the fight moves, and it depends on nothing but the inputs:
// two computers fed the same inputs end on the same state. That is what online play relies on.
// Only + - * / and comparisons here (no Math.random, no trig), so every browser computes the same.

import { DEFAULT_CFG, ENDLESS, type MatchCfg } from './config';
import { BODY, FINAL_PAGE, FPS, MOVES, RULES, pageForRound, type Move } from './rules';

/** One player's controls for one frame, packed into a number. */
export const BTN = {
  left: 1,
  right: 2,
  low: 4, // held: guard low (otherwise high)
  light: 8, // presses (true for one frame)
  heavy: 16,
  feint: 32,
  jump: 64,
  dashL: 128,
  dashR: 256,
  rematch: 512,
} as const;
const PRESSES = ['light', 'heavy', 'feint', 'jump', 'dashL', 'dashR'] as const;
type Press = (typeof PRESSES)[number];

export type Stance = 'high' | 'low';
/** stagger: the guard knocked aside by a blocked heavy (open to hits, like stun). */
export type FState = 'guard' | 'wind' | 'active' | 'recover' | 'feint' | 'stun' | 'dash' | 'land' | 'stagger';
const FSTATES: FState[] = ['guard', 'wind', 'active', 'recover', 'feint', 'stun', 'dash', 'land', 'stagger'];
export type Atk = keyof typeof MOVES;
export type Phase = 'intro' | 'fight' | 'ko' | 'turn' | 'over';

export interface Fighter {
  x: number; y: number; vx: number; vy: number;
  facing: 1 | -1;
  stance: Stance;
  stanceAt: number; // frame the guard last changed (-999 = never)
  state: FState;
  t: number; // frames in the current state
  atk: Atk;
  slash: Stance;
  whiffed: boolean;
  airSlash: boolean; // slashed in the air: stuck for a moment on landing
  hp: number;
  wins: number;
  alive: boolean;
  riposte: number; // frames left to start a riposte
  buf: Press | ''; // a press waiting for the fighter to be free
  bufLeft: number;
  dashDir: number; dashFrom: number; dashLen: number;
  stunT: number;
  walk: number; // -1, 0, 1: walking direction this frame
}

export interface State {
  cfg: MatchCfg; // the rules this match is played with (same for both players)
  frame: number;
  round: number;
  page: number;
  phase: Phase;
  phaseT: number;
  clock: number; // frames left in the round
  hitstop: number;
  roundWinner: number; // -1 = nobody (draw)
  how: string;
  /** Why the last counter cut landed: caught winding up a heavy, or after a missed slash. */
  why: '' | 'wind' | 'miss';
  final: boolean; // the match is decided; the page turns to the back cover
  turnTo: number;
  rematch: [boolean, boolean];
  f: [Fighter, Fighter];
}

/** What happened this frame, for drawing and sound. Never feeds back into the fight. */
export type FightEvent =
  | { k: 'round'; round: number; page: number }
  | { k: 'cut' }
  | { k: 'swing'; p: number; atk: Atk; slash: Stance }
  | { k: 'feint' | 'jump' | 'dash'; p: number }
  | { k: 'whiff'; p: number; x: number; y: number; ang: number; heavy: boolean; over: boolean }
  | { k: 'clash'; p: number; x: number; y: number; ang: number }
  | { k: 'block'; p: number; x: number; y: number; ang: number; heavy: boolean; chip: number; stagger: boolean }
  | { k: 'parry'; p: number; x: number; y: number; ang: number }
  | { k: 'hit'; p: number; x: number; y: number; ang: number; heavy: boolean; atk: Atk; dmg: number }
  | { k: 'ko'; p: number; x: number; y: number; ang: number; counter: boolean; dmg: number; why?: 'wind' | 'miss' }
  | { k: 'roundEnd'; winner: number; how: string }
  | { k: 'turn'; to: number; final: boolean }
  | { k: 'swap'; page: number }
  | { k: 'over'; winner: number }
  | { k: 'heal'; p: number; amt: number }
  | { k: 'spawn'; p: number } // Endless: a fresh bot appears beside you
  | { k: 'restart' };

const DEG = Math.PI / 180;

function newFighter(side: 0 | 1, maxHp: number): Fighter {
  return {
    x: side === 0 ? -RULES.startX : RULES.startX, y: 0, vx: 0, vy: 0,
    facing: side === 0 ? 1 : -1,
    stance: side === 0 ? 'high' : 'low', stanceAt: -999,
    state: 'guard', t: 0, atk: 'light', slash: 'high', whiffed: false, airSlash: false,
    hp: maxHp, wins: 0, alive: true, riposte: 0, buf: '', bufLeft: 0,
    dashDir: 0, dashFrom: 0, dashLen: 0, stunT: 0, walk: 0,
  };
}

export function newMatch(cfg: MatchCfg = DEFAULT_CFG): State {
  const s: State = {
    cfg: { ...cfg },
    frame: 0, round: 1, page: 0, phase: 'intro', phaseT: 0, clock: cfg.roundSecs * FPS, hitstop: 0,
    roundWinner: -1, how: '', why: '', final: false, turnTo: 0, rematch: [false, false],
    f: [newFighter(0, cfg.maxHp), newFighter(1, cfg.maxHp)],
  };
  return s;
}

function resetForRound(s: State, ev: FightEvent[]) {
  const wonLast = s.roundWinner === 0, hp0 = s.f[0].hp;
  for (const i of [0, 1] as const) {
    const wins = s.f[i].wins;
    s.f[i] = newFighter(i, s.cfg.maxHp);
    s.f[i].wins = wins;
  }
  if (s.cfg.gauntlet) {
    // Endless: you keep your strip from bot to bot, and every few bots you get some of it back.
    s.f[0].hp = hp0;
    if (wonLast && s.f[0].wins % ENDLESS.healEvery === 0) {
      const amt = Math.min(s.cfg.maxHp - hp0, Math.round(s.cfg.maxHp * ENDLESS.healShare));
      if (amt > 0) { s.f[0].hp += amt; ev.push({ k: 'heal', p: 0, amt }); }
    }
  }
  s.phase = 'intro'; s.phaseT = 0; s.clock = s.cfg.roundSecs * FPS; s.hitstop = 0;
  s.roundWinner = -1; s.how = ''; s.why = '';
}

/** Endless: a fresh bot appears a few steps away, on the left or right; you stay where you are. */
function nextBot(s: State, ev: FightEvent[]) {
  const x = s.f[0].x;
  resetForRound(s, ev); // fresh fighters (you keep your strip), heal every few bots, back to the intro
  s.round++;
  const me = s.f[0], bot = s.f[1], gap = RULES.startX * 2;
  me.x = x;
  // Left or right from a shuffle of the frame count: unpredictable for the player, but still plain
  // integer maths, so the fight stays repeatable from its inputs.
  let dir = (Math.imul(s.frame ^ (s.round * 7919), 2654435761) >>> 16) & 1 ? 1 : -1;
  if (Math.abs(x + dir * gap) > RULES.edge - 0.3) dir = -dir;
  bot.x = Math.max(-RULES.edge, Math.min(RULES.edge, x + dir * gap));
  me.facing = dir > 0 ? 1 : -1; bot.facing = me.facing === 1 ? -1 : 1;
  ev.push({ k: 'spawn', p: 1 }, { k: 'round', round: s.round, page: s.page });
}

export const cloneState = (s: State): State => structuredClone(s);

/** Where and at what angle a slash cuts, in the fight's side-on plane. */
export function slashLine(a: Fighter) {
  const base = a.slash === 'high' ? -22 * DEG : 14 * DEG;
  // Chest and knee height, where the drawn strike poses hold the blade.
  return { ang: a.facing * base, y: (a.slash === 'high' ? 1.45 : 0.62) + a.y };
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

/** Advance the fight by one frame. Mutates and returns events. */
export function step(s: State, inputs: readonly [number, number]): FightEvent[] {
  const ev: FightEvent[] = [];
  s.frame++;
  s.phaseT++;
  switch (s.phase) {
    case 'intro':
      if (s.phaseT === 1 && s.frame === 1) ev.push({ k: 'round', round: s.round, page: s.page });
      trackStances(s, inputs);
      if (s.phaseT === RULES.introCut) ev.push({ k: 'cut' });
      if (s.phaseT >= RULES.introFrames) { s.phase = 'fight'; s.phaseT = 0; }
      break;
    case 'fight':
      fight(s, inputs, ev);
      break;
    case 'ko':
      if (s.phaseT >= RULES.koFrames) {
        s.final = s.cfg.gauntlet
          ? s.roundWinner === 1 || !s.f[0].alive // Endless: one lost round ends the run
          : s.cfg.wins > 0 && s.f.some((f) => f.wins >= s.cfg.wins);
        if (s.cfg.gauntlet) {
          // Endless never turns the page: the next bot steps in, or the run ends where it stands.
          if (!s.final) { nextBot(s, ev); break; }
          s.phase = 'over'; s.phaseT = 0; s.rematch = [false, false];
          ev.push({ k: 'over', winner: 1 });
          break;
        }
        s.turnTo = s.final ? FINAL_PAGE : pageForRound(s.round + 1);
        s.phase = 'turn'; s.phaseT = 0;
        ev.push({ k: 'turn', to: s.turnTo, final: s.final });
      }
      break;
    case 'turn':
      if (s.phaseT === RULES.turnSwap) {
        s.page = s.turnTo;
        if (!s.final) { s.round++; const p = s.page; resetForRound(s, ev); s.phase = 'turn'; s.phaseT = RULES.turnSwap; s.page = p; }
        else {
          // The match winner stands alone on the back cover.
          const w = matchWinner(s);
          Object.assign(s.f[w], { x: 0, y: 0, vx: 0, vy: 0, state: 'guard', t: 0, alive: true, facing: 1 });
          s.f[1 - w].alive = false;
        }
        ev.push({ k: 'swap', page: s.page });
      }
      if (s.phaseT >= RULES.turnFrames) {
        if (s.final) {
          s.phase = 'over'; s.phaseT = 0; s.rematch = [false, false];
          ev.push({ k: 'over', winner: matchWinner(s) });
        } else {
          s.phase = 'intro'; s.phaseT = 0;
          ev.push({ k: 'round', round: s.round, page: s.page });
        }
      }
      break;
    case 'over':
      for (const i of [0, 1]) if (inputs[i] & BTN.rematch) s.rematch[i] = true;
      if (s.rematch[0] && s.rematch[1]) {
        const frame = s.frame;
        Object.assign(s, newMatch(s.cfg));
        s.frame = frame;
        ev.push({ k: 'restart' }, { k: 'round', round: 1, page: 0 });
      }
      break;
  }
  return ev;
}

/** Who won the match. In Endless the bot always ends the run. */
export const matchWinner = (s: State) => (s.cfg.gauntlet ? 1 : s.f[0].wins > s.f[1].wins ? 0 : 1);

function trackStances(s: State, inputs: readonly [number, number]) {
  for (const i of [0, 1]) {
    const f = s.f[i];
    const want: Stance = inputs[i] & BTN.low ? 'low' : 'high';
    if (f.alive && want !== f.stance) { f.stance = want; f.stanceAt = s.frame; }
  }
}

function fight(s: State, inputs: readonly [number, number], ev: FightEvent[]) {
  trackStances(s, inputs);
  if (s.hitstop > 0) {
    // The fight is frozen for impact; presses wait in the buffer.
    s.hitstop--;
    for (const i of [0, 1]) for (const p of PRESSES) if (inputs[i] & BTN[p]) {
      const f = s.f[i];
      if (p === 'feint' || (p === 'light' && f.state === 'wind' && f.atk === 'heavy')) continue;
      f.buf = p; f.bufLeft = RULES.buffer;
    }
    return;
  }
  const timed = s.cfg.roundSecs > 0;
  if (timed) s.clock--;
  const freshlyActive: number[] = [];
  for (const i of [0, 1]) {
    const f = s.f[i], o = s.f[1 - i], b = inputs[i];
    if (f.riposte > 0) f.riposte--;
    for (const p of PRESSES) if (b & BTN[p]) act(s, i, p, b, ev);
    if (f.buf) {
      if (f.state === 'guard') { const p = f.buf; f.buf = ''; act(s, i, p, b, ev); }
      else if (--f.bufLeft <= 0) f.buf = '';
    }
    if (!f.alive) continue;
    if (o.alive && Math.abs(o.x - f.x) > 0.05 && f.state !== 'dash') f.facing = o.x > f.x ? 1 : -1;
    const dir = ((b & BTN.right) ? 1 : 0) - ((b & BTN.left) ? 1 : 0);
    f.walk = 0;
    f.t++;
    switch (f.state) {
      case 'guard':
        if (f.y <= 0) { f.x += dir * RULES.walk; f.walk = dir; } else f.x += f.vx;
        break;
      case 'wind': {
        const M = MOVES[f.atk], n = Math.min(4, M.wind);
        if (f.y > 0) f.x += f.vx;
        else if (M.lunge > 0 && f.t > M.wind - n) f.x += (f.facing * M.lunge) / n; // the step-in, after the feint point
        if (f.t >= M.wind) { f.state = 'active'; f.t = 0; freshlyActive.push(i); }
        break;
      }
      case 'active':
        if (f.t >= MOVES[f.atk].act) { f.state = 'recover'; f.t = 0; }
        break;
      case 'recover':
        if (f.t >= MOVES[f.atk].rec) {
          f.whiffed = false;
          if (f.airSlash && f.y <= 0) { f.state = 'land'; f.t = 0; f.airSlash = false; } else f.state = 'guard';
        }
        break;
      case 'feint':
        if (f.t >= RULES.feintFrames) f.state = 'guard';
        break;
      case 'stun': case 'stagger':
        if (f.t >= f.stunT) f.state = 'guard';
        break;
      case 'land':
        if (f.t >= RULES.landLag) f.state = 'guard';
        break;
      case 'dash': {
        const k = Math.min(1, f.t / RULES.dashFrames);
        f.x = f.dashFrom + f.dashDir * f.dashLen * easeOut(k);
        if (k >= 1) f.state = 'guard';
        break;
      }
    }
    if (f.state !== 'dash' && (f.y > 0 || f.vy > 0)) {
      f.vy -= RULES.gravity; f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0; f.vy = 0; f.vx = 0;
        // Landing after an air slash: a short stuck moment, so a blocked jump-in can be punished.
        if (f.airSlash && (f.state === 'guard' || f.state === 'recover')) { f.state = 'land'; f.t = 0; f.airSlash = false; }
      }
    }
  }
  // Slashes land after both fighters have moved, judged against where both stood at that moment,
  // so neither player is favoured when both swing on the same frame.
  if (freshlyActive.length) {
    const snap = s.f.map((f) => ({ state: f.state, t: f.t, atk: f.atk, slash: f.slash, whiffed: f.whiffed })) as [Snap, Snap];
    if (freshlyActive.length === 2 && snap[0].slash === snap[1].slash && snap[0].atk === snap[1].atk) clash(s, ev);
    else {
      const outcomes = freshlyActive.map((i) => judge(s, i, snap[1 - i]));
      for (const o of outcomes) apply(s, o, ev);
      finishKOs(s, ev);
    }
  }
  if (s.phase === 'fight') {
    const [a, b] = s.f;
    if (a.alive && b.alive && a.y < 0.35 && b.y < 0.35) {
      const dx = b.x - a.x;
      if (Math.abs(dx) < RULES.bodyGap) {
        const push = ((RULES.bodyGap - Math.abs(dx)) / 2) * (dx >= 0 ? 1 : -1);
        a.x -= push; b.x += push;
      }
    }
    for (const f of s.f) f.x = Math.max(-RULES.edge, Math.min(RULES.edge, f.x));
    if (timed && s.clock <= 0) timeUp(s, ev);
  }
}

function act(s: State, i: number, p: Press, b: number, ev: FightEvent[]) {
  const f = s.f[i];
  if (!f.alive) return;
  // Feint: cancel a heavy during most of its wind-up.
  if ((p === 'feint' || p === 'light') && f.state === 'wind' && f.atk === 'heavy' && f.t < RULES.feintBefore) {
    f.state = 'feint'; f.t = 0; ev.push({ k: 'feint', p: i }); return;
  }
  if (p === 'feint') return;
  if (f.state !== 'guard') { f.buf = p; f.bufLeft = RULES.buffer; return; }
  if (p === 'light' || p === 'heavy') {
    f.state = 'wind'; f.t = 0;
    f.atk = f.riposte > 0 ? 'riposte' : p; f.riposte = 0;
    f.slash = f.y > 0.2 ? 'high' : f.stance; f.whiffed = false; f.airSlash = f.y > 0;
    ev.push({ k: 'swing', p: i, atk: f.atk, slash: f.slash });
  } else if (p === 'jump') {
    if (f.y > 0) return;
    const dir = ((b & BTN.right) ? 1 : 0) - ((b & BTN.left) ? 1 : 0);
    f.vy = RULES.jumpV; f.vx = dir * RULES.walk; f.y = 0.0001;
    ev.push({ k: 'jump', p: i });
  } else {
    if (f.y > 0) return;
    const d = p === 'dashL' ? -1 : 1;
    f.state = 'dash'; f.t = 0; f.dashDir = d; f.dashFrom = f.x;
    f.dashLen = d === f.facing ? RULES.dashForward : RULES.dashBack;
    ev.push({ k: 'dash', p: i });
  }
}

interface Snap { state: FState; t: number; atk: Atk; slash: Stance; whiffed: boolean }
type Outcome =
  | { k: 'whiff'; att: number; over: boolean }
  | { k: 'counter' | 'hit' | 'parry' | 'block'; att: number };

/** Decide what a slash that just came out does, against the defender as they stood this frame. */
export function judge(s: State, att: number, def: Snap): Outcome {
  const a = s.f[att], d = s.f[1 - att], M = MOVES[a.atk], y = slashLine(a).y;
  // The blade's tip must pass the front of the body...
  if (!d.alive || Math.abs(d.x - a.x) - BODY.half > M.reach) return { k: 'whiff', att, over: false };
  // ...and its cut line must cross the body: a low slash passes under a jumper's feet, an air slash can sail overhead.
  if (y < d.y + BODY.feet || y > d.y + BODY.top) return { k: 'whiff', att, over: true };
  // The counter cut: caught winding up a heavy, or just after a miss.
  if ((def.state === 'wind' && def.atk === 'heavy') || (def.state === 'recover' && def.whiffed && def.t < RULES.missOpen)) return { k: 'counter', att };
  if (def.state === 'guard' && d.y <= 0.3 && d.stance === a.slash) {
    const parried = s.frame - d.stanceAt < RULES.parryWindow && a.atk !== 'riposte';
    return { k: parried ? 'parry' : 'block', att };
  }
  return { k: 'hit', att };
}

function apply(s: State, o: Outcome, ev: FightEvent[]) {
  const a = s.f[o.att], d = s.f[1 - o.att], M: Move = MOVES[a.atk], L = slashLine(a), heavy = a.atk !== 'light';
  const P = { x: d.x - a.facing * 0.05, y: L.y };
  switch (o.k) {
    case 'whiff':
      a.whiffed = true;
      ev.push({ k: 'whiff', p: o.att, x: a.x + a.facing * (M.reach - 0.3), y: L.y, ang: L.ang, heavy, over: o.over });
      return;
    case 'counter':
      ev.push({ k: 'ko', p: o.att, ...P, ang: L.ang, counter: true, dmg: d.hp, why: d.state === 'wind' ? 'wind' : 'miss' });
      d.hp = 0;
      return;
    case 'parry':
      d.riposte = RULES.riposteWindow;
      a.state = 'stun'; a.t = 0; a.stunT = RULES.parryStun; a.airSlash = false; a.x -= a.facing * RULES.slide.parry;
      s.hitstop = Math.max(s.hitstop, RULES.hitstop.parry);
      ev.push({ k: 'parry', p: o.att, ...P, ang: L.ang });
      return;
    case 'block': {
      // A blocked heavy staggers the guard: nobody slides, and the attacker recovers first and keeps the turn.
      const stagger = a.atk === 'heavy';
      if (stagger) { d.state = 'stagger'; d.t = 0; d.stunT = RULES.blockStagger; }
      else { a.x -= a.facing * RULES.slide.blockAtt; d.x += a.facing * RULES.slide.blockDef; }
      const before = d.hp;
      if (M.chip) d.hp = Math.max(1, d.hp - M.chip);
      s.hitstop = Math.max(s.hitstop, heavy ? RULES.hitstop.blockHeavy : RULES.hitstop.block);
      ev.push({ k: 'block', p: o.att, ...P, ang: L.ang, heavy, chip: before - d.hp, stagger });
      return;
    }
    case 'hit': {
      const before = d.hp;
      d.hp = Math.max(0, d.hp - M.dmg);
      if (d.hp <= 0) { ev.push({ k: 'ko', p: o.att, ...P, ang: L.ang, counter: false, dmg: before }); return; }
      d.state = 'stun'; d.t = 0; d.stunT = M.stun; d.airSlash = false; d.x += a.facing * M.push;
      s.hitstop = Math.max(s.hitstop, M.hitstop);
      ev.push({ k: 'hit', p: o.att, ...P, ang: L.ang, heavy, atk: a.atk, dmg: before - d.hp });
      return;
    }
  }
}

function clash(s: State, ev: FightEvent[]) {
  const [a, b] = s.f, L = slashLine(a);
  a.x -= a.facing * RULES.slide.clash; b.x -= b.facing * RULES.slide.clash;
  s.hitstop = Math.max(s.hitstop, RULES.hitstop.clash);
  ev.push({ k: 'clash', p: 0, x: (a.x + b.x) / 2, y: L.y, ang: L.ang });
}

function finishKOs(s: State, ev: FightEvent[]) {
  const down = [0, 1].filter((i) => s.f[i].alive && s.f[i].hp <= 0);
  if (!down.length) return;
  for (const i of down) s.f[i].alive = false;
  s.hitstop = 0;
  if (down.length === 2) return endRound(s, -1, 'Double K.O.', ev);
  const w = 1 - down[0];
  s.f[w].wins++;
  const counter = ev.find((e) => e.k === 'ko' && e.p === w && e.counter);
  s.why = counter && counter.k === 'ko' ? counter.why ?? '' : '';
  endRound(s, w, counter ? 'Counter cut' : 'K.O.', ev);
}

function timeUp(s: State, ev: FightEvent[]) {
  const [a, b] = s.f;
  const w: number = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1;
  if (w >= 0) s.f[w].wins++;
  s.clock = 0;
  endRound(s, w, 'Time', ev);
}

function endRound(s: State, winner: number, how: string, ev: FightEvent[]) {
  s.phase = 'ko'; s.phaseT = 0; s.roundWinner = winner; s.how = how;
  ev.push({ k: 'roundEnd', winner, how });
}

/** A short fingerprint of the fight, so two online players can check they're seeing the same thing. */
export function hashState(s: State): number {
  let h = 2166136261 >>> 0;
  const mix = (n: number) => {
    const v = Math.round(n * 10000) | 0;
    h = Math.imul(h ^ (v & 0xffff), 16777619) >>> 0;
    h = Math.imul(h ^ (v >>> 16), 16777619) >>> 0;
  };
  mix(s.frame); mix(s.round); mix(s.page); mix(s.phaseT); mix(s.clock); mix(s.hitstop);
  for (const f of s.f) {
    mix(f.x); mix(f.y); mix(f.vy); mix(f.hp); mix(f.wins); mix(f.t); mix(f.riposte); mix(f.stanceAt);
    mix(FSTATES.indexOf(f.state)); mix(f.airSlash ? 1 : 0);
    mix(f.stance === 'high' ? 1 : 2); mix(f.alive ? 1 : 0);
  }
  return h;
}
