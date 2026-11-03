// Endless runs that the server can check. The bot's dice come from a numbered sequence (the run's
// seed), so the same seed and the same player inputs always give the same run. The browser keeps
// the inputs; the leaderboard server re-plays them and only posts the score the re-play reaches.

import { ENDLESS, ENDLESS_CFG } from './config';
import { Dummy } from './dummy';
import { newMatch, step, type State } from './sim';
import { Tally, type MatchTally } from './tally';

/** The bot's level for the bot you're facing (1, then +1 every few bots). */
export const botLevel = (cut: number) => Math.floor(cut / ENDLESS.healEvery) + 1;

/** A repeatable stand-in for Math.random (mulberry32): integer maths only, the same in every browser. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The Endless bot for a run with this seed. */
export const endlessBot = (seed: number) => new Dummy(seeded(seed), 1);

/** The bot's buttons for the next frame (its level follows how many bots you've cut). */
export function botInput(bot: Dummy, s: State): number {
  bot.level = botLevel(s.f[0].wins);
  return bot.think(s);
}

/** Records the player's buttons as changes: a flat list [frame, buttons, frame, buttons, …]. */
export class RunInputs {
  readonly list: number[] = [];
  private last = -1;
  add(frame: number, b: number) {
    if (b !== this.last) { this.list.push(frame, b); this.last = b; }
  }
}

/** The longest run the server will re-play (an hour of fighting). */
export const MAX_RUN_FRAMES = 60 * 60 * 60;

export interface RunResult { bots: number; frames: number; tally: MatchTally }

/** Re-plays a run from its seed and the player's inputs, a slice at a time (so a server can keep serving between slices). */
export class RunReplay {
  private s = newMatch(ENDLESS_CFG);
  private bot: Dummy;
  private tally = new Tally();
  private i = 0;
  private b = 0;
  constructor(seed: number, private inputs: readonly number[], private maxFrames = MAX_RUN_FRAMES) { this.bot = endlessBot(seed); }

  /** Run up to n frames. The result when the run ended, null if it never will, undefined to keep going. */
  advance(n: number): RunResult | null | undefined {
    const { s, inputs } = this;
    for (let k = 0; k < n; k++) {
      if (s.frame >= this.maxFrames) return null;
      while (this.i < inputs.length && inputs[this.i] === s.frame) { this.b = inputs[this.i + 1]; this.i += 2; }
      const ev = step(s, [this.b, botInput(this.bot, s)]);
      const done = this.tally.feed(s, ev);
      if (done) return { bots: s.f[0].wins, frames: s.frame, tally: done };
    }
    return undefined;
  }
}

/** Re-play a whole run at once. Null if the inputs never end the run. */
export function replayRun(seed: number, inputs: readonly number[], maxFrames = MAX_RUN_FRAMES): RunResult | null {
  const r = new RunReplay(seed, inputs, maxFrames);
  for (;;) { const out = r.advance(10000); if (out !== undefined) return out; }
}
