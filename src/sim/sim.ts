// The fight, as plain data on a fixed 60-frames-per-second clock.
// step(state, inputs) is the only way the fight moves, and it depends on nothing but the inputs:
// two computers fed the same inputs end on the same state. That is what online play relies on.
// Only + - * / and comparisons here (no Math.random, no trig), so every browser computes the same.

import { DEFAULT_CFG, ENDLESS, type MatchCfg } from './config';
import { AIR_CUT, BODY, DEFENCE, FINAL_PAGE, FPS, MOVES, RULES, defencePage, pageForRound, type Move } from './rules';

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
  emote: 1024, // a press: the "come at me" taunt (locked in, can't guard: any slash lands)
} as const;
const PRESSES = ['light', 'heavy', 'feint', 'jump', 'dashL', 'dashR'] as const;
type Press = (typeof PRESSES)[number];

export type Stance = 'high' | 'low';
/** stagger: the guard knocked aside by a blocked heavy (open to hits, like stun). taunt: "come at me", locked in and
 *  unguarded until it ends. */
export type FState = 'guard' | 'wind' | 'active' | 'recover' | 'feint' | 'stun' | 'dash' | 'land' | 'stagger' | 'taunt';
const FSTATES: FState[] = ['guard', 'wind', 'active', 'recover', 'feint', 'stun', 'dash', 'land', 'stagger', 'taunt'];
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
  unfold: number; // Dojo Defence: frames left unfolding after coming back (can't act, can't be hit)
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
  // Dojo Defence (cfg.defence) only:
  zone: number; // which spread the fight is on, -2 (front cover) to 2 (back cover)
  way: number; // who has the way (made the last kill and may run on): 0, 1, or -1 nobody
  respawnT: number; // frames until the cut fighter unfolds again (0 = not counting)
  respawnWho: number; // who comes back: 0, 1, 2 = both (a double K.O.), -1 = nobody
  turnDir: number; // the way the page is turning: 1 toward the back cover, -1 toward the front
}

/** What happened this frame, for drawing and sound. Never feeds back into the fight. */
export type FightEvent =
  | { k: 'round'; round: number; page: number }
  | { k: 'cut' }
  | { k: 'swing'; p: number; atk: Atk; slash: Stance }
  | { k: 'feint' | 'jump' | 'dash' | 'taunt'; p: number }
  | { k: 'whiff'; p: number; x: number; y: number; ang: number; heavy: boolean; over: boolean }
  | { k: 'clash'; p: number; x: number; y: number; ang: number }
  | { k: 'block'; p: number; x: number; y: number; ang: number; heavy: boolean; chip: number; stagger: boolean }
  | { k: 'parry'; p: number; x: number; y: number; ang: number }
  | { k: 'hit'; p: number; x: number; y: number; ang: number; heavy: boolean; atk: Atk; dmg: number }
  | { k: 'ko'; p: number; x: number; y: number; ang: number; counter: boolean; dmg: number; why?: 'wind' | 'miss' }
  | { k: 'roundEnd'; winner: number; how: string }
  | { k: 'turn'; to: number; final: boolean; back?: boolean } // back: turning toward the front cover
  | { k: 'swap'; page: number }
  | { k: 'over'; winner: number }
  | { k: 'heal'; p: number; amt: number }
  | { k: 'spawn'; p: number } // Endless: a fresh bot appears beside you. Dojo Defence: a cut fighter unfolds again
  | { k: 'restart' };

const DEG = Math.PI / 180;

function newFighter(side: 0 | 1, maxHp: number): Fighter {
  return {
    x: side === 0 ? -RULES.startX : RULES.startX, y: 0, vx: 0, vy: 0,
    facing: side === 0 ? 1 : -1,
    stance: side === 0 ? 'high' : 'low', stanceAt: -999,
    state: 'guard', t: 0, atk: 'light', slash: 'high', whiffed: false, airSlash: false,
    hp: maxHp, wins: 0, alive: true, riposte: 0, buf: '', bufLeft: 0,
    dashDir: 0, dashFrom: 0, dashLen: 0, stunT: 0, walk: 0, unfold: 0,
  };
}

export function newMatch(cfg: MatchCfg = DEFAULT_CFG): State {
  const s: State = {
    cfg: { ...cfg },
    frame: 0, round: 1, page: cfg.defence ? defencePage(0) : 0, phase: 'intro', phaseT: 0, clock: cfg.roundSecs * FPS, hitstop: 0,
    roundWinner: -1, how: '', why: '', final: false, turnTo: 0, rematch: [false, false],
    f: [newFighter(0, cfg.maxHp), newFighter(1, cfg.maxHp)],
    zone: 0, way: -1, respawnT: 0, respawnWho: -1, turnDir: 1,
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

/** Endless (and Training): a fresh bot appears a few steps away, on the left or right; you stay where you are. */
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

/** Is this slash the downward air cut (thrown in the air, and still in the air)? */
export const airCut = (a: Fighter) => a.airSlash && a.y > 0;

/** Where and at what angle a slash cuts, in the fight's side-on plane, `at` metres ahead of the attacker's centre.
 *  A slash on the ground cuts level; the air cut slopes down to its tip (AIR_CUT). */
export function slashLine(a: Fighter, at = MOVES[a.atk].reach - 0.3) {
  if (airCut(a)) {
    const x = Math.max(AIR_CUT.hiltX, Math.min(MOVES[a.atk].reach, at));
    return { ang: a.facing * -AIR_CUT.deg * DEG, y: a.y + AIR_CUT.hiltY - (x - AIR_CUT.hiltX) * AIR_CUT.slope };
  }
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
        // Training: whoever went down, a fresh dummy steps in (Endless's way) and you're back to full.
        if (s.cfg.training) { nextBot(s, ev); break; }
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
      if (s.cfg.defence) { defenceTurn(s, ev); break; }
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
        ev.push({ k: 'restart' }, { k: 'round', round: 1, page: s.page });
      }
      break;
  }
  return ev;
}

/** Who won the match. In Endless the bot always ends the run; in Dojo Defence, whoever crossed the rival's cover. */
export const matchWinner = (s: State) => (s.cfg.gauntlet ? 1 : s.cfg.defence ? Math.max(0, s.way) : s.f[0].wins > s.f[1].wins ? 0 : 1);

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
    if (f.unfold > 0) { f.unfold--; f.walk = 0; continue; } // still unfolding: no buttons, no moving
    for (const p of PRESSES) if (b & BTN[p]) act(s, i, p, b, ev);
    // The taunt: only from a standing guard. Locked in for its whole length, and it can't block (judge only blocks
    // from 'guard'), so any slash that reaches lands as a clean hit. Presses near its end come out after it.
    if (b & BTN.emote && f.alive && f.state === 'guard' && f.y <= 0) { f.state = 'taunt'; f.t = 0; ev.push({ k: 'taunt', p: i }); }
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
      case 'taunt':
        if (f.t >= RULES.emoteFrames) f.state = 'guard';
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
  if (s.phase === 'fight' && s.cfg.defence) defenceStep(s, ev);
  else if (s.phase === 'fight') {
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
  const a = s.f[att], d = s.f[1 - att], M = MOVES[a.atk], dx = Math.abs(d.x - a.x);
  // The blade's tip must pass the front of the body...
  if (!d.alive || d.unfold > 0 || dx - BODY.half > M.reach) return { k: 'whiff', att, over: false };
  // ...and the blade inside the body must cross it between the feet and the head: a low slash passes under a
  // jumper's feet. (A level cut is one height; the air cut is highest at the body's front, lowest at its back.)
  const hi = slashLine(a, dx - BODY.half).y, lo = slashLine(a, dx + BODY.half).y;
  if (hi < d.y + BODY.feet || lo > d.y + BODY.top) return { k: 'whiff', att, over: true };
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
  // Where the cut crosses the rival's middle (kept on the body, for a sloped air cut that clips a head or shin).
  const yd = slashLine(a, Math.abs(d.x - a.x)).y;
  const P = { x: d.x - a.facing * 0.05, y: Math.max(d.y + BODY.feet, Math.min(d.y + BODY.top, yd)) };
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
  if (s.cfg.defence) return defenceKO(s, down, ev);
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

// ---------- Dojo Defence ----------
// A tug-of-war across five spreads. A K.O. doesn't end anything: the killer gets the way and may run on toward the
// rival's cover, while the cut fighter unfolds again a little way ahead of them, in their path. Nobody can pass a
// living rival (not even by jumping), so the only way through is to cut them down. Cross the rival's cover to win.

/** Which way a seat runs: Kami (0) toward the back cover, Sumi (1) toward the front cover. */
export const runDir = (seat: number) => (seat === 0 ? 1 : -1);

function defenceKO(s: State, down: number[], ev: FightEvent[]) {
  s.respawnT = DEFENCE.respawn;
  if (down.length === 2) {
    // Both cut: nobody has the way, and both unfold where the fight began on this spread.
    s.way = -1; s.respawnWho = 2; s.how = 'Double K.O.'; s.roundWinner = -1; s.why = '';
    ev.push({ k: 'roundEnd', winner: -1, how: 'Double K.O.' });
    return;
  }
  const w = 1 - down[0];
  s.f[w].wins++; // cuts landed
  s.way = w; s.respawnWho = down[0];
  const counter = ev.find((e) => e.k === 'ko' && e.p === w && e.counter);
  s.why = counter && counter.k === 'ko' ? counter.why ?? '' : '';
  s.how = counter ? 'Counter cut' : 'K.O.'; s.roundWinner = w;
  ev.push({ k: 'roundEnd', winner: w, how: s.how });
}

/** A fresh fighter for seat i at x, keeping its cut count; it unfolds for a moment first. */
function unfoldAt(s: State, i: 0 | 1, x: number, ev: FightEvent[]) {
  const wins = s.f[i].wins;
  s.f[i] = newFighter(i, s.cfg.maxHp);
  Object.assign(s.f[i], { wins, x, unfold: RULES.unfoldFrames });
  ev.push({ k: 'spawn', p: i });
}

/** Bring the cut fighter back, ahead of the one with the way. False when there's no room before the page's edge
 *  yet: they come back when the page turns. */
function respawn(s: State, ev: FightEvent[]): boolean {
  const who = s.respawnWho;
  if (who === 2) {
    unfoldAt(s, 0, -RULES.startX, ev); unfoldAt(s, 1, RULES.startX, ev);
  } else if (who === 0 || who === 1) {
    const w = 1 - who, x = s.f[w].x + runDir(w) * DEFENCE.gap;
    if (Math.abs(x) > RULES.edge - DEFENCE.entry) return false;
    unfoldAt(s, who, x, ev);
    s.f[w].hp = s.cfg.maxHp; // the winner's strip refills too: every exchange starts fresh
  }
  s.respawnWho = -1; s.respawnT = 0;
  return true;
}

function defenceStep(s: State, ev: FightEvent[]) {
  const [a, b] = s.f, gap = RULES.bodyGap, edge = RULES.edge;
  // Nobody passes a living rival: Kami always stays left of Sumi, in the air too.
  if (a.alive && b.alive && b.x - a.x < gap) { const push = (gap - (b.x - a.x)) / 2; a.x -= push; b.x += push; }
  for (const f of s.f) f.x = Math.max(-edge, Math.min(edge, f.x));
  if (a.alive && b.alive && b.x - a.x < gap) { if (b.x >= edge) a.x = b.x - gap; else b.x = a.x + gap; }
  if (s.respawnT > 0 && --s.respawnT === 0) respawn(s, ev);
  if (s.way < 0) return;
  const r = s.f[s.way], dir = runDir(s.way);
  if (!r.alive || r.x * dir < edge) return;
  if (s.zone === DEFENCE.goal * dir) {
    // Across the rival's cover: the match is won.
    s.final = true; s.phase = 'over'; s.phaseT = 0; s.rematch = [false, false];
    ev.push({ k: 'over', winner: s.way });
    return;
  }
  s.turnDir = dir; s.turnTo = defencePage(s.zone + dir);
  s.phase = 'turn'; s.phaseT = 0;
  ev.push({ k: 'turn', to: s.turnTo, final: false, back: dir < 0 });
}

/** The page turns under the runner: they come in at the near edge of the next spread, and their rival unfolds ahead. */
function defenceTurn(s: State, ev: FightEvent[]) {
  if (s.phaseT === RULES.turnSwap) {
    s.zone += s.turnDir; s.page = s.turnTo;
    const w = s.way as 0 | 1, r = s.f[w];
    const keep = { wins: r.wins, hp: r.hp, stance: r.stance };
    s.f[w] = newFighter(w, s.cfg.maxHp);
    Object.assign(s.f[w], keep, { x: -s.turnDir * (RULES.edge - DEFENCE.entry) });
    if (!s.f[1 - w].alive) { s.respawnWho = 1 - w; respawn(s, ev); }
    ev.push({ k: 'swap', page: s.page });
  }
  if (s.phaseT >= RULES.turnFrames) { s.phase = 'fight'; s.phaseT = 0; }
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
  mix(s.zone); mix(s.way); mix(s.respawnT); mix(s.respawnWho);
  for (const f of s.f) {
    mix(f.x); mix(f.y); mix(f.vy); mix(f.hp); mix(f.wins); mix(f.t); mix(f.riposte); mix(f.stanceAt);
    mix(FSTATES.indexOf(f.state)); mix(f.airSlash ? 1 : 0);
    mix(f.stance === 'high' ? 1 : 2); mix(f.alive ? 1 : 0); mix(f.unfold);
  }
  return h;
}
