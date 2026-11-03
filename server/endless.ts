// An Endless run as the browser reports it (POST /api/endless), checked for shape and sane numbers.
// Only used for the balance stats; the leaderboard build has the server re-play runs instead.

import { emptyTally, type AtkTally, type MatchTally, type RoundTally, type SideTally } from '../src/sim/tally';
import { cleanGuard } from './referee';
import type { EndlessRecord } from './store';

const MAX_BOTS = 10000;
const MAX_COUNT = 1e6;
const HOWS = ['K.O.', 'Counter cut', 'Time', 'Double K.O.'];

const count = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= MAX_COUNT ? x : null);

function cleanAtk(x: unknown): AtkTally | null {
  const o = (x ?? {}) as Record<string, unknown>, out = {} as AtkTally;
  for (const k of ['n', 'land', 'block', 'parried', 'whiff', 'clash', 'feint'] as const) { const v = count(o[k]); if (v === null) return null; out[k] = v; }
  return out;
}

function cleanSide(x: unknown): SideTally | null {
  const o = (x ?? {}) as Record<string, unknown>, out = emptyTally().sides[0];
  for (const k of ['light', 'heavy', 'riposte'] as const) { const a = cleanAtk(o[k]); if (!a) return null; out[k] = a; }
  for (const k of ['counterWind', 'counterMiss', 'blocks', 'parries', 'jumps', 'dashes', 'staggers', 'staggerFollow'] as const) {
    const v = count(o[k]); if (v === null) return null; out[k] = v;
  }
  return out;
}

function cleanRound(x: unknown): RoundTally | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const hp = Array.isArray(o.hp) ? o.hp.map(count) : [];
  const frames = count(o.frames);
  if (![-1, 0, 1].includes(o.winner as number) || !HOWS.includes(o.how as string) || !['', 'wind', 'miss'].includes(o.why as string)
    || frames === null || hp.length !== 2 || hp.some((v) => v === null)) return null;
  return { winner: o.winner as number, how: o.how as string, why: o.why as RoundTally['why'], frames, hp: hp as [number, number] };
}

/** The run from an untrusted request body, or null if it doesn't add up. */
export function cleanEndless(x: unknown): EndlessRecord | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = (o.tally ?? {}) as Record<string, unknown>;
  const bots = count(o.bots);
  if (bots === null || bots > MAX_BOTS || !Array.isArray(t.rounds) || !Array.isArray(t.sides) || t.sides.length !== 2) return null;
  const rounds = t.rounds.slice(0, MAX_BOTS + 1).map(cleanRound);
  const sides = t.sides.map(cleanSide);
  const clashes = count(t.clashes);
  if (rounds.some((r) => !r) || sides.some((s) => !s) || clashes === null || !rounds.length) return null;
  const last = rounds[rounds.length - 1]!;
  // Each bot cut is one round won; the run ends on the one round lost.
  if (rounds.filter((r) => r!.winner === 0).length !== bots) return null;
  const tally: MatchTally = { rounds: rounds as RoundTally[], sides: sides as [SideTally, SideTally], winner: 1, clashes };
  const guard = cleanGuard(o.guard);
  return { guard, bots, how: last.how, why: last.why, tally };
}
