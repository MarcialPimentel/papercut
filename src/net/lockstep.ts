// Online play with input delay: each player's buttons are scheduled `delay` frames ahead and sent
// to the other player. A frame runs only when both players' buttons for it have arrived, so both
// games step through exactly the same inputs. If the rival's inputs are late, the game waits.
// (Rollback, which hides lag instead of waiting, can be built on the same pieces later.)

import { hashState, newMatch, step, type FightEvent, type State } from '../sim/sim';
import type { ToClient, ToServer } from './protocol';

const HASH_EVERY = 60;

export class Lockstep {
  readonly state: State = newMatch();
  private mine = new Map<number, number>();
  private theirs = new Map<number, number>();
  private nextMine: number;
  private myHashes = new Map<number, number>();
  private theirHashes = new Map<number, number>();
  /** Frames the game has spent waiting for the rival's inputs, in a row. */
  waiting = 0;
  desynced = false;

  constructor(readonly seat: 0 | 1, readonly delay: number, private send: (m: ToServer) => void) {
    for (let f = 0; f < delay; f++) { this.mine.set(f, 0); this.theirs.set(f, 0); }
    this.nextMine = delay;
  }

  /** The frame the fight will run next. */
  get frame() { return this.state.frame; }

  receive(m: ToClient) {
    if (m.t === 'in') this.theirs.set(m.f, m.b);
    else if (m.t === 'hash') { this.theirHashes.set(m.f, m.h); this.checkHash(m.f); }
  }

  /** How many frames of the rival's inputs are waiting to be used (more than the delay means we're behind). */
  get backlog() {
    let n = 0;
    while (this.theirs.has(this.state.frame + n)) n++;
    return n;
  }

  /**
   * Try to run one frame. `sample` reads this player's buttons; it's only called when a new frame of
   * input is needed, so presses made while waiting are kept for the next one.
   * Returns the frame's events, or null if the rival's inputs haven't arrived yet.
   */
  tick(sample: () => number): FightEvent[] | null {
    const f = this.state.frame;
    if (this.nextMine <= f + this.delay) {
      const b = sample();
      this.mine.set(this.nextMine, b);
      this.send({ t: 'in', f: this.nextMine, b });
      this.nextMine++;
    }
    const theirs = this.theirs.get(f);
    if (theirs === undefined) { this.waiting++; return null; }
    const mine = this.mine.get(f) ?? 0;
    this.waiting = 0;
    this.mine.delete(f); this.theirs.delete(f);
    const ev = step(this.state, this.seat === 0 ? [mine, theirs] : [theirs, mine]);
    if (this.state.frame % HASH_EVERY === 0) {
      const h = hashState(this.state);
      this.myHashes.set(this.state.frame, h);
      this.send({ t: 'hash', f: this.state.frame, h });
      this.checkHash(this.state.frame);
    }
    return ev;
  }

  private checkHash(f: number) {
    const a = this.myHashes.get(f), b = this.theirHashes.get(f);
    if (a === undefined || b === undefined) return;
    if (a !== b) this.desynced = true;
    this.myHashes.delete(f); this.theirHashes.delete(f);
  }
}
