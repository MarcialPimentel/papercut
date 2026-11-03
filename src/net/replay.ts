// Playing a saved online fight back. The fight is deterministic, so the saved inputs (changes only,
// see server/referee.ts) run the very same fight again, frame for frame. Going back means running
// it again from the start, which takes a few milliseconds.

import type { MatchCfg } from '../sim/config';
import { newMatch, step, type FightEvent, type State } from '../sim/sim';

/** Inputs as changes: [frame from the start, seat 0 buttons, seat 1 buttons]. */
export type ReplayInputs = [number, number, number][];

export class ReplayPlayer {
  state!: State;
  /** Frames played since the start. */
  at = 0;
  private i = 0;
  private cur: [number, number] = [0, 0];

  /** frames: how long the match ran (null for older records: play until the match is over). */
  constructor(readonly cfg: MatchCfg, readonly start: number, readonly inputs: ReplayInputs, readonly frames: number | null) {
    this.rewind();
  }

  /** The fight is over: nothing left to play. */
  get done() { return this.frames !== null ? this.at >= this.frames : this.state.phase === 'over'; }

  /** Back to the first frame. */
  rewind() {
    this.state = newMatch(this.cfg);
    this.state.frame = this.start;
    this.at = 0; this.i = 0; this.cur = [0, 0];
  }

  /** Play one frame (null once the fight is over). */
  tick(): FightEvent[] | null {
    if (this.done) return null;
    while (this.i < this.inputs.length && this.inputs[this.i][0] <= this.at) {
      const [, a, b] = this.inputs[this.i++];
      this.cur = [a, b];
    }
    const ev = step(this.state, this.cur);
    this.at++;
    return ev;
  }

  /** Jump to a frame (from the start), without drawing the frames in between. */
  seek(frame: number) {
    const to = Math.max(0, Math.floor(frame));
    if (to < this.at) this.rewind();
    while (this.at < to && this.tick());
  }
}
