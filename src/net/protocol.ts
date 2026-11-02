// Messages between the game and the rooms server (JSON over one WebSocket).
// The server never runs the fight: it pairs two players and passes their inputs along.

import type { MatchCfg } from '../sim/config';

export type ToServer =
  | { t: 'host'; cfg?: MatchCfg } // make a private room for an invite link, with its rules
  | { t: 'join'; code: string }
  | { t: 'quick' } // pair with whoever is waiting
  | { t: 'cancel' } // leave the room or the queue
  | { t: 'in'; f: number; b: number } // my buttons for frame f
  | { t: 'hash'; f: number; h: number }; // my fight's fingerprint at frame f

export type ToClient =
  | { t: 'room'; code: string } // your invite room is ready
  | { t: 'waiting' } // you're in the quick-match queue
  | { t: 'start'; seat: 0 | 1; delay: number; code: string; cfg: MatchCfg } // the fight begins: seat 0 is Kami, 1 is Sumi
  | { t: 'in'; f: number; b: number }
  | { t: 'hash'; f: number; h: number }
  | { t: 'gone' } // your opponent left
  | { t: 'err'; msg: string };

export const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE_LENGTH = 4;
export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);

/** Frames of input delay for a pair of players, from each one's round trip to the server (ms). */
export function delayFor(rttA: number, rttB: number): number {
  const oneWay = (rttA + rttB) / 2; // A -> server -> B
  return Math.max(2, Math.min(8, Math.ceil(oneWay / (1000 / 60)) + 1));
}
