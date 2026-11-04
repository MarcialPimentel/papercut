// Watching a tournament fight: the server sends both fighters' buttons, tagged with their seat, and the
// watcher runs the very same fight from them. A frame runs once both players' buttons for it are in.

import { DEFAULT_CFG, type MatchCfg } from '../sim/config';
import { newMatch, step, type FightEvent, type State } from '../sim/sim';
import { resetTuning } from '../tuning';
import type { ToClient } from './protocol';

export class Spectator {
  readonly state: State;
  private inputs: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];

  constructor(cfg: MatchCfg = DEFAULT_CFG, delay = 0) {
    resetTuning(); // the tuning panel is Practice only: every online fight runs the game's own numbers
    this.state = newMatch(cfg);
    // The fighters start with `delay` empty frames of input, like Rollback does.
    for (let f = 0; f < delay; f++) { this.inputs[0].set(f, 0); this.inputs[1].set(f, 0); }
  }

  receive(m: ToClient) {
    if (m.t === 'in' && (m.s === 0 || m.s === 1)) this.inputs[m.s].set(m.f, m.b);
  }

  /** Frames ready to run (both players' buttons are in). */
  get backlog() {
    let n = 0;
    const f = this.state.frame;
    while (this.inputs[0].has(f + n) && this.inputs[1].has(f + n)) n++;
    return n;
  }

  /** Run one frame if its inputs are in; null if still waiting. */
  tick(): FightEvent[] | null {
    const f = this.state.frame, a = this.inputs[0].get(f), b = this.inputs[1].get(f);
    if (a === undefined || b === undefined) return null;
    this.inputs[0].delete(f); this.inputs[1].delete(f);
    return step(this.state, [a, b]);
  }
}
