// Every number the fight runs on, in frames (60 per second) and metres.
// Timings come from the mock-up (seconds x 60, rounded). Milestone 1's tuning panel will expose these.

export const FPS = 60;

export interface Move {
  wind: number; // wind-up frames
  act: number; // active frames
  rec: number; // recovery frames
  reach: number; // metres from the attacker's centre
  dmg: number; // % of the health strip on a clean hit
  chip: number; // % taken through a block
  stun: number; // hit-stun frames
  push: number; // metres the defender slides on a hit
  hitstop: number; // frames the fight freezes on a clean hit
}

export const MOVES = {
  light: { wind: 5, act: 3, rec: 12, reach: 1.55, dmg: 10, chip: 0, stun: 13, push: 0.22, hitstop: 4 },
  heavy: { wind: 19, act: 5, rec: 25, reach: 1.85, dmg: 35, chip: 3, stun: 27, push: 0.55, hitstop: 7 },
  // After a parry: light speed, heavy damage, a lunge, can't be parried.
  riposte: { wind: 5, act: 4, rec: 15, reach: 2.15, dmg: 35, chip: 3, stun: 27, push: 0.5, hitstop: 7 },
} satisfies Record<string, Move>;

export const RULES = {
  feintFrames: 8, // a feint returns to guard in this long
  feintBefore: 16, // a heavy can be feinted until this frame of its wind-up
  parryWindow: 7, // switch guard to the right height this close to the hit to parry
  parryStun: 30, // the parried attacker is stuck this long
  riposteWindow: 36, // after a parry, your next slash within this long is a riposte
  buffer: 6, // a press this early still comes out when you're free
  walk: 2.6 / FPS, // metres per frame
  jumpV: 5.6 / FPS,
  gravity: 15 / (FPS * FPS),
  dashFrames: 12,
  dashForward: 1.4,
  dashBack: 1.15,
  bodyGap: 0.85, // fighters can't stand closer than this (jumping over is fine)
  edge: 7.7, // the page's edge
  startX: 1.8,
  roundFrames: 60 * FPS,
  winsNeeded: 2,
  // phase lengths
  introCut: 60, // "Round N" banner, then "Cut!"
  introFrames: 87,
  koFrames: 180,
  turnSwap: 69, // the page has flipped: the next spread is built
  turnFrames: 96,
  hitstop: { block: 3, blockHeavy: 5, parry: 6, clash: 5, ko: 8 },
};

export const PAGES = [
  { key: 'graph', name: 'Graph Paper Dojo' },
  { key: 'lined', name: 'Ruled Courtyard' },
  { key: 'legal', name: 'Legal Pad Grove' },
  { key: 'cover', name: 'The back cover', night: true },
] as const;
export const FINAL_PAGE = 3;
export const pageForRound = (round: number) => (round - 1) % 3;
