// The server's own copy of an online fight. Both players' inputs already pass through the server,
// so it steps the same deterministic fight alongside them and reads the result itself: no browser
// can claim a result the inputs don't produce. It also keeps the inputs (changes only) and counts
// what happened, for the balance stats.

import { DEFAULT_CFG, type MatchCfg } from '../src/sim/config';
import { hashState, matchWinner, newMatch, step, type State } from '../src/sim/sim';
import { Tally, type MatchTally } from '../src/sim/tally';

export type MatchMode = 'quick' | 'room' | 'tourney' | 'ranked';
/** How a player sets their guard: the mouse (Flick or Cursor) or a controller. */
export const GUARDS = ['flick', 'cursor', 'pad'] as const;
export type GuardStyle = (typeof GUARDS)[number] | '';
/** A guard style from an untrusted message ('' if unknown). */
export const cleanGuard = (x: unknown): GuardStyle => ((GUARDS as readonly unknown[]).includes(x) ? (x as GuardStyle) : '');

/** Inputs as changes: [frame, seat 0 buttons, seat 1 buttons] whenever either changes. */
export type InputLog = [number, number, number][];

export interface MatchRecord {
  mode: MatchMode;
  cfg: MatchCfg;
  /** Played with the standard rules (not a custom room's). */
  standard: boolean;
  guard: [GuardStyle, GuardStyle];
  /** Who won (null: an endless-rounds room closed with the match still going). */
  winner: number | null;
  tally: MatchTally;
  /** The frame the match started on (a rematch carries on the frame count), then its inputs. */
  start: number;
  inputs: InputLog;
  /** How many frames the match ran from `start` (what a replay plays). */
  frames: number;
  /** Both players' ids (hashes of their tokens, '' for a game that didn't say), so each can find their replays. */
  players?: [string, string];
  /** The names and looks shown in the fight (drawn only, for replays). */
  names?: [string, string];
  looks?: [string, string];
  /** The fight version it was played on (server/fightVersion.ts): a replay only plays back on the same rules. */
  fight?: string;
}

/** How far ahead of the fight a player's inputs may run before the server ignores them. */
const AHEAD = 600;
/** Browsers send their fight's fingerprint every this many frames (src/net/rollback.ts). */
const HASH_EVERY = 60;

export const isStandard = (c: MatchCfg) =>
  c.wins === DEFAULT_CFG.wins && c.maxHp === DEFAULT_CFG.maxHp && c.roundSecs === DEFAULT_CFG.roundSecs && !c.gauntlet && !c.defence;

export class Referee {
  readonly state: State;
  private tally = new Tally();
  private queued: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  private log: InputLog = [];
  private last: [number, number] = [-1, -1];
  private start = 0;
  private closed = false;
  /** The server's own fingerprints, and the ones each browser sent that it hasn't reached yet. */
  private own = new Map<number, number>();
  private claims: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  /** The last frame each browser sent a fingerprint for (they come in order). */
  private lastHash: [number, number] = [-1, -1];
  /** A browser whose fight disagreed with the server's: a modified game (or a bug). */
  readonly bad: [boolean, boolean] = [false, false];

  constructor(
    readonly mode: MatchMode,
    readonly cfg: MatchCfg,
    delay: number,
    readonly guard: [GuardStyle, GuardStyle],
    private onRecord: (r: MatchRecord) => void,
  ) {
    this.state = newMatch(cfg);
    // The first `delay` frames have no buttons on either side (see Rollback).
    for (let f = 0; f < delay; f++) { this.queued[0].set(f, 0); this.queued[1].set(f, 0); }
  }

  /** Would `input` take this player's buttons for frame f? (The first for a frame the fight hasn't reached.) */
  accepts(seat: 0 | 1, f: number): boolean {
    return !this.closed && Number.isInteger(f) && f >= this.state.frame && f <= this.state.frame + AHEAD && !this.queued[seat].has(f);
  }

  /**
   * A player's buttons for frame f. Runs every frame both players have now sent.
   * Only the first buttons a player sends for a frame count. Returns false for anything ignored, which
   * must not be passed on to the rival: a game sending two different inputs for one frame could
   * otherwise show its rival a different fight from the server's and get the rival judged a cheat.
   */
  input(seat: 0 | 1, f: number, b: number): boolean {
    if (!this.accepts(seat, f)) return false;
    this.queued[seat].set(f, b | 0);
    for (;;) {
      if (this.closed) return true; // the result just ended the room (a tournament fight)
      const f0 = this.state.frame, a = this.queued[0].get(f0), c = this.queued[1].get(f0);
      if (a === undefined || c === undefined) return true;
      this.queued[0].delete(f0); this.queued[1].delete(f0);
      if (a !== this.last[0] || c !== this.last[1]) { this.log.push([f0 - this.start, a, c]); this.last = [a, c]; }
      const ev = step(this.state, [a, c]);
      if (this.state.frame % HASH_EVERY === 0) this.fingerprint();
      if (ev.some((e) => e.k === 'restart')) this.begin(); // a rematch: a fresh record from here
      const done = this.tally.feed(this.state, ev);
      if (done) this.record(done);
    }
  }

  /** A browser's fingerprint of its fight at frame f. Like inputs, only the first per frame counts (returns false otherwise). */
  hash(seat: 0 | 1, f: number, h: number): boolean {
    if (this.closed || !Number.isInteger(f) || f % HASH_EVERY !== 0 || f > this.state.frame + AHEAD) return false;
    if (f <= this.lastHash[seat]) return false;
    this.lastHash[seat] = f;
    this.check(seat, f, h);
    return true;
  }

  private check(seat: 0 | 1, f: number, h: number) {
    const mine = this.own.get(f);
    if (mine !== undefined) { if (mine !== h >>> 0) this.bad[seat] = true; }
    else if (f > this.state.frame) this.claims[seat].set(f, h >>> 0);
  }

  private fingerprint() {
    const f = this.state.frame, h = hashState(this.state);
    this.own.set(f, h);
    this.own.delete(f - AHEAD); // browsers are never this far behind
    for (const seat of [0, 1] as const) {
      const c = this.claims[seat].get(f);
      if (c !== undefined) { if (c !== h) this.bad[seat] = true; this.claims[seat].delete(f); }
    }
  }

  /**
   * The seat the fight is stuck waiting on: its rival has sent buttons for the frame the fight is on,
   * it hasn't (null: the fight isn't waiting on just one player).
   */
  get waitingOn(): 0 | 1 | null {
    if (this.closed || this.state.phase === 'over') return null;
    const f = this.state.frame, a = this.queued[0].has(f), c = this.queued[1].has(f);
    return a === c ? null : a ? 1 : 0;
  }

  /** Who the server's own fight says won (null until the match is over). */
  get winner(): number | null { return this.state.phase === 'over' ? matchWinner(this.state) : null; }

  /** The room closed. An endless-rounds room never reaches 'over', so its rounds so far are kept. */
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.cfg.wins === 0 && this.tally.t.rounds.length) this.record({ ...this.tally.t, winner: null });
  }

  private begin() {
    this.start = this.state.frame;
    this.log = [[0, this.last[0], this.last[1]]];
  }

  private record(t: MatchTally) {
    try {
      this.onRecord({
        mode: this.mode, cfg: this.cfg, standard: isStandard(this.cfg), guard: this.guard,
        winner: t.winner, tally: structuredClone(t), start: this.start, inputs: this.log.slice(), frames: this.state.frame - this.start,
      });
    } catch (e) { console.error('Could not record a match:', e); }
  }
}

/** Re-play a recorded match from its inputs: the same fight, frame for frame. */
export function replay(cfg: MatchCfg, start: number, inputs: InputLog, frames: number): State {
  const s = newMatch(cfg);
  s.frame = start;
  let i = 0, cur: [number, number] = [0, 0];
  for (let f = 0; f < frames; f++) {
    while (i < inputs.length && inputs[i][0] === f) { cur = [inputs[i][1], inputs[i][2]]; i++; }
    step(s, cur);
  }
  return s;
}
