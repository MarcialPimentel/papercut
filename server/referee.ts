// The server's own copy of an online fight. Both players' inputs already pass through the server,
// so it steps the same deterministic fight alongside them and reads the result itself: no browser
// can claim a result the inputs don't produce. It also keeps the inputs (changes only) and counts
// what happened, for the balance stats.

import { DEFAULT_CFG, type MatchCfg } from '../src/sim/config';
import { hashState, newMatch, step, type State } from '../src/sim/sim';
import { Tally, type MatchTally } from '../src/sim/tally';

export type MatchMode = 'quick' | 'room' | 'tourney' | 'ranked';
export type GuardStyle = 'line' | 'cursor' | '';

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
  /** Ranked: the two players' ids (hashes, not their tokens). */
  players?: [string, string];
}

/** How far ahead of the fight a player's inputs may run before the server ignores them. */
const AHEAD = 600;
/** Browsers send their fight's fingerprint every this many frames (src/net/lockstep.ts). */
const HASH_EVERY = 60;

export const isStandard = (c: MatchCfg) =>
  c.wins === DEFAULT_CFG.wins && c.maxHp === DEFAULT_CFG.maxHp && c.roundSecs === DEFAULT_CFG.roundSecs && !c.gauntlet;

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
    // The first `delay` frames have no buttons on either side (see Lockstep).
    for (let f = 0; f < delay; f++) { this.queued[0].set(f, 0); this.queued[1].set(f, 0); }
  }

  /** A player's buttons for frame f. Runs every frame both players have now sent. */
  input(seat: 0 | 1, f: number, b: number) {
    if (this.closed || !Number.isInteger(f) || f < this.state.frame || f > this.state.frame + AHEAD) return;
    this.queued[seat].set(f, b | 0);
    for (;;) {
      const f0 = this.state.frame, a = this.queued[0].get(f0), c = this.queued[1].get(f0);
      if (a === undefined || c === undefined) return;
      this.queued[0].delete(f0); this.queued[1].delete(f0);
      if (a !== this.last[0] || c !== this.last[1]) { this.log.push([f0 - this.start, a, c]); this.last = [a, c]; }
      const ev = step(this.state, [a, c]);
      if (this.state.frame % HASH_EVERY === 0) this.fingerprint();
      if (ev.some((e) => e.k === 'restart')) this.begin(); // a rematch: a fresh record from here
      const done = this.tally.feed(this.state, ev);
      if (done) this.record(done);
    }
  }

  /** A browser's fingerprint of its fight at frame f. */
  hash(seat: 0 | 1, f: number, h: number) {
    if (this.closed || !Number.isInteger(f) || f % HASH_EVERY !== 0 || f > this.state.frame + AHEAD) return;
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

  /** Who the server's own fight says won (null until the match is over). */
  get winner(): number | null { return this.state.phase === 'over' ? (this.state.f[0].wins > this.state.f[1].wins ? 0 : 1) : null; }

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
        winner: t.winner, tally: structuredClone(t), start: this.start, inputs: this.log.slice(),
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
