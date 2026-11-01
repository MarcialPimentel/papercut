// Sumi as a practice dummy: presses the same buttons a player would.
// Switches guard on a timer (with a yellow glint as the tell), walks in when you back off,
// swings back now and then, and sometimes feints a heavy. Only used offline, so it may use randomness.

import { BTN, type State } from './sim';
import { FPS } from './rules';

export class Dummy {
  /** Frames left on the glint before the guard switches (0 = no tell showing). */
  tell = 0;
  readonly tellFrames = 30;
  private low = true;
  private timer = 2.4 * FPS;
  private atkTimer = 2.6 * FPS;
  private planFeint = false;
  private queued = 0;

  constructor(private rand: () => number = Math.random, readonly seat: 0 | 1 = 1) {}

  reset() {
    this.tell = 0; this.low = true; this.timer = 2.4 * FPS; this.atkTimer = 2.6 * FPS; this.planFeint = false; this.queued = 0;
  }

  /** The dummy's buttons for the next frame of `s`. */
  think(s: State): number {
    let b = this.low ? BTN.low : 0;
    if (s.phase === 'over') return b | BTN.rematch;
    if (s.phase !== 'fight') { this.tell = 0; return b; }
    const me = s.f[this.seat], you = s.f[1 - this.seat];
    if (!me.alive) return b;
    if (s.hitstop > 0) return b;
    this.timer--;
    if (this.timer < this.tellFrames && this.tell === 0) this.tell = this.tellFrames;
    if (this.tell > 0 && --this.tell === 0) {
      this.low = !this.low;
      this.timer = (1.6 + this.rand() * 2) * FPS;
      b = this.low ? BTN.low : 0;
    }
    const dx = Math.abs(you.x - me.x);
    if (me.state === 'guard' && dx > 2.4) b |= you.x > me.x ? BTN.right : BTN.left;
    this.atkTimer--;
    if (this.queued) { b |= this.queued; this.queued = 0; }
    else if (this.atkTimer <= 0 && me.state === 'guard' && dx < 1.9 && this.tell === 0) {
      const heavy = this.rand() < 0.55;
      b |= heavy ? BTN.heavy : BTN.light;
      this.planFeint = heavy && this.rand() < 0.3;
      this.atkTimer = (1.8 + this.rand() * 2.4) * FPS;
    }
    if (this.planFeint && me.state === 'wind' && me.atk === 'heavy' && me.t > 8) { this.planFeint = false; b |= BTN.feint; }
    return b;
  }
}
