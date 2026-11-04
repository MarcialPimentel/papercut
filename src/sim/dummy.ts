// Sumi as a practice dummy: presses the same buttons a player would.
// Switches guard on a timer (with a yellow glint as the tell), walks in when you back off,
// swings back now and then, and sometimes feints a heavy. Only used offline. Its dice come only from `rand`
// (never Math.random directly): Endless passes a seeded one so the server can re-play a run (src/sim/endless.ts).
// Endless mode raises its `level`: from level 1 it also reads your wind-ups and switches guard to block
// (late switches at high levels become parries), punishes your misses with a counter cut, knocks
// jumpers out of the air and cuts you while you're stuck landing. Each level does all of it more often.

import { BTN, type State } from './sim';
import { FPS, MOVES, rangeOf } from './rules';

// Distances (centre to centre) the dummy works with: where each slash lands, and where it stops walking in.
// Read fresh each time, so the tuning panel's step-in changes them too.
const light = () => rangeOf(MOVES.light), heavy = () => rangeOf(MOVES.heavy);

export class Dummy {
  /** Frames left on the glint before the guard switches (0 = no tell showing). */
  tell = 0;
  readonly tellFrames = 30;
  private low = true;
  private timer = 2.4 * FPS;
  private atkTimer = 2.6 * FPS;
  private planFeint = false;
  private queued = 0;
  private readTried = false;
  private punishTried = false;
  private airTried = false;
  /** 0 = the practice dummy. Endless sets 1, 2, 3… */
  level = 0;

  constructor(private rand: () => number = Math.random, readonly seat: 0 | 1 = 1) {}

  reset() {
    this.tell = 0; this.low = true; this.timer = 2.4 * FPS; this.atkTimer = 2.6 * FPS; this.planFeint = false; this.queued = 0;
    this.readTried = this.punishTried = this.airTried = false;
  }

  /** The dummy's buttons for the next frame of `s`. */
  think(s: State): number {
    let b = this.low ? BTN.low : 0;
    if (s.phase === 'over') return b | BTN.rematch;
    if (s.phase !== 'fight') { this.tell = 0; return b; }
    const me = s.f[this.seat], you = s.f[1 - this.seat];
    if (!me.alive) return b;
    // Dojo Defense: with you cut down and the way ours, run for your cover.
    if (s.cfg.defence && !you.alive) return s.way === this.seat ? b | (this.seat === 1 ? BTN.left : BTN.right) : b;
    if (s.hitstop > 0) return b;
    this.timer--;
    if (this.timer < this.tellFrames && this.tell === 0) this.tell = this.tellFrames;
    if (this.tell > 0 && --this.tell === 0) {
      this.low = !this.low;
      this.timer = (1.6 + this.rand() * 2) * FPS;
      b = this.low ? BTN.low : 0;
    }
    const dx = Math.abs(you.x - me.x);
    if (me.state === 'guard' && dx > light() + 1.15) b |= you.x > me.x ? BTN.right : BTN.left;
    this.atkTimer--;
    const react = this.level > 0 ? this.reactions(s, dx) : 0;
    b = (b & ~BTN.low) | (this.low ? BTN.low : 0); // a reaction may have switched the guard
    if (react) b |= react;
    else if (this.queued) { b |= this.queued; this.queued = 0; }
    else if (this.atkTimer <= 0 && me.state === 'guard' && dx < heavy() - 0.1 && this.tell === 0) {
      const heavy = this.rand() < 0.55;
      b |= heavy ? BTN.heavy : BTN.light;
      this.planFeint = heavy && this.rand() < 0.3 + 0.05 * this.level;
      this.atkTimer = (1.8 + this.rand() * 2.4) * FPS * Math.max(0.4, 1 - 0.12 * Math.max(0, this.level - 1));
    }
    if (this.planFeint && me.state === 'wind' && me.atk === 'heavy' && me.t > 8) { this.planFeint = false; b |= BTN.feint; }
    return b;
  }

  /** Endless levels: answers to what you're doing. Returns presses to make (0 = nothing), and may switch the guard. */
  private reactions(s: State, dx: number): number {
    const me = s.f[this.seat], you = s.f[1 - this.seat], L = this.level, chance = (p: number) => this.rand() < p;
    if (me.state !== 'guard') return 0;
    // Read your wind-up and guard where it's coming. Heavies from level 1, lights from level 3.
    if (you.state !== 'wind') this.readTried = false;
    else if (!this.readTried) {
      const heavy = you.atk !== 'light';
      // Heavies: guard 7 + 2*level frames before the cut (a plain block); from level 4, sometimes 5 frames before (a parry).
      const w = MOVES.heavy.wind, at = heavy ? (L >= 4 && chance(0.4) ? w - 5 : Math.max(4, w - 7 - 2 * L)) : 1;
      if (you.t >= at && (heavy || L >= 3)) {
        this.readTried = true;
        if (chance(Math.min(0.75, (heavy ? 0.2 : 0.05) + 0.1 * L))) { this.low = you.slash === 'low'; this.tell = 0; }
      }
    }
    // Punish a missed slash with a counter cut.
    if (!(you.state === 'recover' && you.whiffed)) this.punishTried = false;
    else if (!this.punishTried && dx < light() - 0.05) {
      this.punishTried = true;
      if (chance(Math.min(0.85, 0.25 * L))) return BTN.light;
    }
    // Knock a falling jumper out of the air (a high slash; nobody can block mid-air).
    if (you.y <= 0) this.airTried = false;
    else if (!this.airTried && you.vy < 0 && dx < light() + 0.05) {
      this.airTried = true;
      if (chance(Math.min(0.8, 0.2 * L))) { this.low = false; this.tell = 0; return BTN.light; }
    }
    // Punish a taunt with a heavy: it can't be blocked and lands well before the taunt ends.
    if (you.state === 'taunt' && you.t === 1 && dx < heavy() - 0.1 && chance(Math.min(0.9, 0.3 * L))) return BTN.heavy;
    // Cut you while you're stuck landing.
    if (you.state === 'land' && you.t === 1 && dx < light() - 0.05 && L >= 2 && chance(0.6)) return BTN.light;
    return 0;
  }
}
