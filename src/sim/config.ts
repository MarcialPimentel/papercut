// The rules a match is played with: the defaults, what a custom room may change, and Endless mode.
// No imports, so the rooms server can check a room's settings with this same file.

export interface MatchCfg {
  /** Round wins that take the match (best of 2n-1). 0 = endless: the match never ends. */
  wins: number;
  /** A full health strip. */
  maxHp: number;
  /** Seconds per round. 0 = no timer. */
  roundSecs: number;
  /** Endless mode (offline): seat 0 keeps their strip between bots, heals every few bots, and one lost round ends the run. */
  gauntlet: boolean;
  /** Dojo Defence: one heavy's worth of health; cut your rival down, then run across the notebook to their cover. */
  defence?: boolean;
}

export const DEFAULT_CFG: MatchCfg = { wins: 3, maxHp: 80, roundSecs: 60, gauntlet: false };

/** What a custom room's creator can pick from. */
export const ROOM_OPTIONS = {
  wins: [1, 2, 3, 4, 0], // best of 1, 3, 5, 7, endless
  maxHp: [50, 80, 100, 150],
  roundSecs: [30, 60, 90, 0],
} as const;

/** Endless mode: the strip refills by this share every `healEvery` bots, and the bots level up just as often. */
export const ENDLESS = { healEvery: 5, healShare: 0.5 };
export const ENDLESS_CFG: MatchCfg = { wins: 0, maxHp: 80, roundSecs: 60, gauntlet: true };

/** Dojo Defence: no rounds or timer, and a strip that one heavy (35) empties. */
export const DEFENCE_CFG: MatchCfg = { wins: 0, maxHp: 35, roundSecs: 0, gauntlet: false, defence: true };

/** A room's settings from an untrusted message: anything not on the menu falls back to the default. */
export function cleanCfg(x: unknown): MatchCfg {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  if (o.defence === true) return { ...DEFENCE_CFG }; // Dojo Defence has fixed rules
  const pick = <K extends keyof typeof ROOM_OPTIONS>(k: K): number =>
    (ROOM_OPTIONS[k] as readonly number[]).includes(o[k] as number) ? (o[k] as number) : DEFAULT_CFG[k];
  return { wins: pick('wins'), maxHp: pick('maxHp'), roundSecs: pick('roundSecs'), gauntlet: false };
}

/** "Best of 5", "Endless rounds". */
export const roundsLabel = (wins: number) => (wins === 0 ? 'Endless rounds' : `Best of ${wins * 2 - 1}`);
