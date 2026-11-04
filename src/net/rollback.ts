// Online play with rollback. Each player's buttons are scheduled `delay` frames ahead and sent to the
// other player, as before, but the game no longer waits for the rival's buttons: it guesses them (the
// same direction and guard as their last frame, no new presses) and keeps going. When their real
// buttons arrive and differ from the guess, it rewinds to that frame and re-runs the frames since,
// all within one screen frame. Only when the guesses run more than MAX_GUESS frames ahead does it wait.
//
// Both games still end up stepping exactly the same inputs: a frame is "confirmed" once both players'
// buttons for it are known, and the hash check and achievements only ever look at confirmed frames.
// The server's referee and people watching only see the real inputs, so nothing changes for them.

import { DEFAULT_CFG, type MatchCfg } from '../sim/config';
import { BTN, cloneState, hashState, newMatch, step, type FightEvent, type State } from '../sim/sim';
import { resetTuning } from '../tuning';
import type { ToClient, ToServer } from './protocol';

const HASH_EVERY = 60;
/** How many frames the game may run on guesses before it waits for the rival. */
export const MAX_GUESS = 8;
/** The buttons that carry over into a guess: held ones. Presses (slash, jump, dash...) are never guessed. */
const HELD = BTN.left | BTN.right | BTN.low;

/** Where the frames go: the view shows them, achievements read the confirmed ones. */
export interface RollbackSink {
  /**
   * A frame was run. `replay` is true when it's being re-run after a wrong guess, so sounds driven by
   * state changes stay quiet. `ev` holds only the events not shown before, and never a K.O.: those wait
   * for `confirm`, so a guessed kill never splits a fighter who wasn't really cut.
   */
  show(s: State, ev: FightEvent[], replay: boolean): void;
  /** A frame is final (both players' buttons are known). `s` is the state just after it. */
  confirm(s: State, ev: FightEvent[]): void;
}
const NO_SINK: RollbackSink = { show() {}, confirm() {} };

const key = (e: FightEvent) => `${e.k}|${'p' in e ? e.p : ''}`;

export class Rollback {
  /** The fight as shown: confirmed frames plus the guessed ones on top. */
  state: State;
  private mine = new Map<number, number>();
  private theirs = new Map<number, number>();
  private nextMine: number;
  /** Every frame before this one is confirmed. */
  private done = 0;
  /** For each unconfirmed frame: the state before it, the rival buttons used, its events, the events shown. */
  private before = new Map<number, State>();
  private used = new Map<number, number>();
  private events = new Map<number, FightEvent[]>();
  private shown = new Map<number, Set<string>>();
  private lastTheirs = 0;
  private lastTheirsFrame: number;
  private myHashes = new Map<number, number>();
  private theirHashes = new Map<number, number>();
  /** How far ahead of us the rival says they are running (their "lead"), if their game reports it. */
  private theirLead: number | undefined;
  private sinceHold = 0;
  /** Frames the game has spent waiting for the rival's inputs, in a row. */
  waiting = 0;
  /** Frames re-run after wrong guesses (for the lag readout and tests). */
  rerun = 0;
  desynced = false;

  constructor(readonly seat: 0 | 1, readonly delay: number, private send: (m: ToServer) => void, cfg: MatchCfg = DEFAULT_CFG) {
    resetTuning(); // the tuning panel is Training only: every online fight runs the game's own numbers
    this.state = newMatch(cfg);
    for (let f = 0; f < delay; f++) { this.mine.set(f, 0); this.theirs.set(f, 0); }
    this.nextMine = delay;
    this.lastTheirsFrame = delay - 1;
  }

  /** The frame the fight will run next. */
  get frame() { return this.state.frame; }
  /** Frames being shown on guesses right now. */
  get guessing() { return this.state.frame - this.done; }
  /**
   * How many frames ahead of the rival this game runs, counting the time their inputs take to arrive.
   * With the same lag both ways, both games report about the same lead; the one with the bigger lead is
   * running ahead and holds back a frame now and then.
   */
  get lead() { return this.state.frame - (this.lastTheirsFrame - this.delay); }

  receive(m: ToClient) {
    if (m.t === 'in') {
      if (m.f < this.done || this.theirs.has(m.f)) return;
      this.theirs.set(m.f, m.b);
      if (m.f > this.lastTheirsFrame) { this.lastTheirsFrame = m.f; this.lastTheirs = m.b; }
      if (typeof m.a === 'number') this.theirLead = m.a;
    } else if (m.t === 'hash') { this.theirHashes.set(m.f, m.h); this.checkHash(m.f); }
  }

  /**
   * One screen tick's worth of fight. `sample` reads this player's buttons; it's only called when a new
   * frame of input is needed, so presses made while waiting are kept for the next one.
   * Returns false if no new frame ran (the guesses ran too far ahead, or this game is holding back).
   */
  tick(sample: () => number, out: RollbackSink = NO_SINK): boolean {
    const F = this.state.frame;
    if (this.nextMine <= F + this.delay) {
      const b = sample();
      this.mine.set(this.nextMine, b);
      this.send({ t: 'in', f: this.nextMine, b, a: this.lead });
      this.nextMine++;
    }
    // A wrong guess: rewind to it and run the frames since with what we know now.
    for (let f = this.done; f < F; f++) {
      const t = this.theirs.get(f);
      if (t === undefined) break; // inputs arrive in order, so nothing later is known either
      if (t !== this.used.get(f)) {
        this.state = cloneState(this.before.get(f)!);
        for (let g = f; g < F; g++) this.run(g, out, true);
        this.rerun += F - f;
        break;
      }
    }
    // Frames with both players' buttons are final.
    while (this.done < F && this.theirs.has(this.done)) this.confirm(this.done, out);
    if (F - this.done >= MAX_GUESS) { this.waiting++; return false; }
    this.waiting = 0;
    // Running ahead of the rival: hold back a frame now and then (at most one in 6) so both meet in the middle.
    this.sinceHold++;
    if (this.theirLead !== undefined && this.lead - this.theirLead >= 3 && this.sinceHold >= 6) { this.sinceHold = 0; return false; }
    this.run(F, out, false);
    return true;
  }

  private run(f: number, out: RollbackSink, replay: boolean) {
    this.before.set(f, cloneState(this.state));
    const theirs = this.theirs.get(f) ?? (this.lastTheirs & HELD);
    this.used.set(f, theirs);
    const mine = this.mine.get(f) ?? 0;
    const ev = step(this.state, this.seat === 0 ? [mine, theirs] : [theirs, mine]);
    this.events.set(f, ev);
    let seen = this.shown.get(f);
    if (!seen) this.shown.set(f, (seen = new Set()));
    const fresh: FightEvent[] = [];
    for (const e of ev) {
      if (e.k === 'ko') continue;
      const k = key(e);
      if (!seen.has(k)) { seen.add(k); fresh.push(e); }
    }
    out.show(this.state, fresh, replay);
  }

  private confirm(f: number, out: RollbackSink) {
    const after = f + 1 === this.state.frame ? this.state : this.before.get(f + 1)!;
    out.confirm(after, this.events.get(f) ?? []);
    if (after.frame % HASH_EVERY === 0) {
      const h = hashState(after);
      this.myHashes.set(after.frame, h);
      this.send({ t: 'hash', f: after.frame, h });
      this.checkHash(after.frame);
    }
    this.before.delete(f); this.used.delete(f); this.events.delete(f); this.shown.delete(f);
    this.mine.delete(f); this.theirs.delete(f);
    this.done = f + 1;
  }

  private checkHash(f: number) {
    const a = this.myHashes.get(f), b = this.theirHashes.get(f);
    if (a === undefined || b === undefined) return;
    if (a !== b) this.desynced = true;
    this.myHashes.delete(f); this.theirHashes.delete(f);
  }
}
