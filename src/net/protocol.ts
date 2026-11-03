// Messages between the game and the rooms server (JSON over one WebSocket).
// The server pairs two players and passes their inputs along; it also steps its own copy of the
// fight from those same inputs to read the result (server/referee.ts).

import type { MatchCfg } from '../sim/config';

// `look`: the player's chosen look as a short code (render/looks.ts). It is only drawn, never part of the fight,
// so it travels once with the request to play and comes back in 'start' / 'match' as `looks` (seat 0, seat 1).
export type ToServer =
  | { t: 'hello'; guard: 'flick' | 'cursor' | 'pad'; id?: string } // how this player guards (for the stats) and this browser's ranked token
  | { t: 'ranked'; name?: string; look?: string } // join the ranked queue
  | { t: 'host'; cfg?: MatchCfg; look?: string } // make a private room for an invite link, with its rules
  | { t: 'join'; code: string; name?: string; look?: string } // a 1v1 room or a tournament
  | { t: 'tourney'; cfg?: MatchCfg; name?: string; look?: string } // make a tournament room (3-8 players)
  | { t: 'name'; name: string } // rename yourself in a tournament lobby
  | { t: 'begin' } // the tournament's host starts the bracket
  | { t: 'restart' } // the host deals a new, reshuffled bracket with the same players (between fights only)
  | { t: 'result'; winner: number } // a tournament fighter: who won the match that just ended
  | { t: 'quick'; look?: string } // pair with whoever is waiting
  | { t: 'cancel' } // leave the room or the queue
  | { t: 'in'; f: number; b: number } // my buttons for frame f
  | { t: 'hash'; f: number; h: number }; // my fight's fingerprint at frame f

export type ToClient =
  | { t: 'room'; code: string } // your invite room is ready
  | { t: 'waiting'; ranked?: boolean } // you're in the quick-match (or ranked) queue
  | { t: 'start'; seat: 0 | 1; delay: number; code: string; cfg: MatchCfg; looks?: [string, string]; ranks?: [RankInfo, RankInfo] } // the fight begins: seat 0 is Kami, 1 is Sumi (ranks: a ranked match)
  | { t: 'rank'; you: RankInfo } // your ranked standing
  | { t: 'ranked'; won: boolean; why: 'match' | 'left'; delta: number; you: RankInfo } // a ranked match was decided
  | { t: 'in'; f: number; b: number; s?: 0 | 1 } // s: whose buttons, for players watching a tournament fight
  | { t: 'hash'; f: number; h: number }
  | { t: 'lobby'; code: string; names: string[]; you: number; host: boolean; cfg: MatchCfg } // a tournament waiting to start
  | { t: 'bracket'; names: string[]; rounds: BracketMatch[][]; current: [number, number] | null; champion: number | null; you: number; restart: boolean } // restart: you're the host and can deal a new bracket now
  | { t: 'match'; seat: 0 | 1 | -1; delay: number; cfg: MatchCfg; names: [string, string]; code: string; looks?: [string, string] } // a tournament fight starts (-1: you watch)
  | { t: 'gone' } // your opponent left
  | { t: 'err'; msg: string };

/** A ranked player as others see them: "Cardstock" (or "Placement 2/5") and rounded points. */
export interface RankInfo { name: string; division: string; points: number; placed: boolean }

/** One match in a tournament bracket. a and b index the players (-1 = a bye, null = not decided yet). */
export interface BracketMatch { a: number | null; b: number | null; winner: number | null; forfeit: boolean }

/** A free pass in a bracket. */
export const BYE_SLOT = -1;

/** A look code as the server keeps it: short lowercase letters, digits and dots, or '' (the default look). */
export const cleanLook = (x: unknown) => (typeof x === 'string' && /^[a-z0-9.]{1,40}$/.test(x) ? x : '');

export const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE_LENGTH = 4;
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);

/** Frames of input delay for a pair of players, from each one's round trip to the server (ms). */
export function delayFor(rttA: number, rttB: number): number {
  const oneWay = (rttA + rttB) / 2; // A -> server -> B
  return Math.max(2, Math.min(8, Math.ceil(oneWay / (1000 / 60)) + 1));
}
