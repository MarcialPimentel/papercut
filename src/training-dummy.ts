// Sumi in Training: a dummy that stands there and never swings. The tuning panel's "Bot actions" pick what it
// does: guard high, guard low or switch (with the old yellow glint as the tell), jump now and then, and walk
// forward, backward or back and forth. It presses the same buttons a player would.
// Kept outside src/sim/ on purpose: it is offline only, and src/sim/ is hashed into the online fight version.
// (Endless and Dojo Defense still use the full bot in src/sim/dummy.ts.)

import { BTN, type State } from './sim/sim';
import { FPS } from './sim/rules';

export type BotGuard = 'high' | 'low' | 'switch';
export type BotJump = 'off' | 'on';
export type BotMove = 'stand' | 'forward' | 'back' | 'both';

/** What the training dummy does. The tuning panel changes these; they last until the page is closed. */
export const BOT: { guard: BotGuard; jump: BotJump; move: BotMove } = { guard: 'high', jump: 'off', move: 'stand' };
export const BOT_DEFAULTS = Object.freeze({ ...BOT });

/** The panel's "Bot actions" rows: each setting and its choices, in order. */
export const BOT_OPTIONS = [
  { key: 'guard', label: 'Guard', choices: [['high', 'High'], ['low', 'Low'], ['switch', 'Switches']] },
  { key: 'jump', label: 'Jumping', choices: [['off', 'Off'], ['on', 'On']] },
  { key: 'move', label: 'Moving', choices: [['stand', 'Stand'], ['forward', 'Forward'], ['back', 'Backward'], ['both', 'Back & forth']] },
] as const;

/** Seconds between guard switches, jumps, and each leg of "back and forth". */
const SWITCH_EVERY = 2.4 * FPS, JUMP_EVERY = 1.5 * FPS, LEG = 1 * FPS;

export class TrainingDummy {
  /** Frames left on the glint before the guard switches (0 = no tell showing). */
  tell = 0;
  readonly tellFrames = 30;
  private low = true;
  private timer = SWITCH_EVERY;
  private jumpTimer = JUMP_EVERY;
  private moveT = 0;

  constructor(readonly seat: 0 | 1 = 1, private opts = BOT) {}

  reset() { this.tell = 0; this.low = true; this.timer = SWITCH_EVERY; this.jumpTimer = JUMP_EVERY; this.moveT = 0; }

  /** Low guard held this frame? */
  private guardLow(): boolean {
    if (this.opts.guard !== 'switch') { this.tell = 0; return this.opts.guard === 'low'; }
    if (--this.timer < this.tellFrames && this.tell === 0) this.tell = this.tellFrames;
    if (this.tell > 0 && --this.tell === 0) { this.low = !this.low; this.timer = SWITCH_EVERY; }
    return this.low;
  }

  /** The dummy's buttons for the next frame of `s`. */
  think(s: State): number {
    const held = (low: boolean) => (low ? BTN.low : 0);
    if (s.phase === 'over') return held(this.opts.guard === 'low') | BTN.rematch;
    if (s.phase !== 'fight') { this.tell = 0; return held(this.opts.guard === 'low' || (this.opts.guard === 'switch' && this.low)); }
    const me = s.f[this.seat], you = s.f[1 - this.seat];
    if (!me.alive || s.hitstop > 0) return held(this.opts.guard === 'low' || (this.opts.guard === 'switch' && this.low));
    let b = held(this.guardLow());

    const toward = you.x > me.x ? BTN.right : BTN.left, away = toward === BTN.right ? BTN.left : BTN.right;
    const m = this.opts.move;
    if (m === 'forward') b |= toward;
    else if (m === 'back') b |= away;
    else if (m === 'both') { b |= this.moveT < LEG ? toward : away; this.moveT = (this.moveT + 1) % (2 * LEG); }

    if (this.opts.jump === 'on' && --this.jumpTimer <= 0 && me.state === 'guard' && me.y <= 0) { b |= BTN.jump; this.jumpTimer = JUMP_EVERY; }
    return b;
  }
}
