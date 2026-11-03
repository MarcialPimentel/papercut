// Every number the fight runs on, in frames (60 per second) and metres.
// Timings come from the mock-up (seconds x 60, rounded), distances from the drawn samurai. Milestone 1's tuning
// panel will expose these.

export const FPS = 60;

export interface Move {
  wind: number; // wind-up frames
  act: number; // active frames
  rec: number; // recovery frames
  reach: number; // metres from the attacker's centre to the blade's tip as it cuts (measured from the drawn samurai)
  lunge: number; // metres the attacker steps in over the end of the wind-up
  dmg: number; // health taken on a clean hit (a full strip is MatchCfg.maxHp, 80 by default)
  chip: number; // health taken through a block
  stun: number; // hit-stun frames
  push: number; // metres the defender slides on a hit
  hitstop: number; // frames the fight freezes on a clean hit
}

// Every strike is drawn with the same cut pose, so every slash reaches the same distance from the hands;
// heavies and ripostes step in for their extra reach. A hit leaves the hitter a few frames ahead:
// light +2, heavy +4 (hit stun minus what's left of the attacker's active and recovery frames).
export const MOVES = {
  light: { wind: 5, act: 3, rec: 12, reach: 1.8, lunge: 0, dmg: 10, chip: 0, stun: 17, push: 0.3, hitstop: 4 },
  heavy: { wind: 15, act: 5, rec: 25, reach: 1.8, lunge: 0.4, dmg: 35, chip: 3, stun: 34, push: 0.8, hitstop: 7 },
  // After a parry: light speed, heavy damage, a long lunge, can't be parried.
  riposte: { wind: 5, act: 4, rec: 15, reach: 1.8, lunge: 0.85, dmg: 35, chip: 3, stun: 27, push: 0.7, hitstop: 7 },
} satisfies Record<string, Move>;

export const RULES = {
  feintFrames: 8, // a feint returns to guard in this long
  feintBefore: 12, // a heavy can be feinted until this frame of its wind-up (its step-in comes after)
  missOpen: 6, // after a missed slash you're open to a counter cut for this long; later hits are normal hits
  blockStagger: 34, // a blocked heavy staggers the blocker's guard this long: the attacker recovers 4 frames first
  parryWindow: 7, // switch guard to the right height this close to the hit to parry
  parryStun: 30, // the parried attacker is stuck this long
  riposteWindow: 36, // after a parry, your next slash within this long is a riposte
  buffer: 6, // a press this early still comes out when you're free
  walk: 3.7 / FPS, // metres per frame
  jumpV: 5.6 / FPS,
  gravity: 15 / (FPS * FPS),
  landLag: 10, // stuck this long on landing after a slash in the air
  dashFrames: 12,
  dashForward: 2.0,
  dashBack: 1.65,
  bodyGap: 1.2, // fighters can't stand closer than this (jumping over is fine): the robes just touch
  edge: 7.7, // the page's edge
  startX: 2.55,
  // phase lengths
  introCut: 60, // "Round N" banner, then "Cut!"
  introFrames: 87,
  koFrames: 180,
  turnSwap: 69, // the page has flipped: the next spread is built
  turnFrames: 96,
  hitstop: { block: 3, blockHeavy: 5, parry: 6, clash: 5, ko: 8 },
  // how far fighters slide apart (metres)
  slide: { blockAtt: 0.35, blockDef: 0.28, parry: 0.42, clash: 0.5 },
};

/** Each fighter's body for hits (metres): half its width, and its height above the feet. A slash lands when its
 *  tip passes the front of the body and its cut line is between the feet and the top of the head. Measured from
 *  the drawn samurai (the robe is 0.55 wide in front of the centre; the blade must be a little way into it). */
export const BODY = { half: 0.45, feet: 0.05, top: 2.15 };

/** How far apart (centre to centre) two fighters on the ground can be for this slash to land. */
export const rangeOf = (m: Move) => m.reach + m.lunge + BODY.half;

export const PAGES = [
  { key: 'graph', name: 'Graph Paper Dojo' },
  { key: 'lined', name: 'Ruled Courtyard' },
  { key: 'legal', name: 'Legal Pad Grove' },
  { key: 'cover', name: 'The back cover', night: true },
] as const;
export const FINAL_PAGE = 3;
/** Round pages cycle graph, ruled, legal pad (rounds 4 and 5 reuse the first two). */
export const pageForRound = (round: number) => (round - 1) % 3;
