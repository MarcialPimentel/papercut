// An Endless run sent by the browser (POST /api/endless): its seed and the player's inputs.
// The server re-plays the run itself and only keeps the score the re-play reaches, so an edited
// score is rejected. The re-play runs in slices so online fights on this server never wait for it.

import { MAX_RUN_FRAMES, RunReplay, type RunResult } from '../src/sim/endless';
import type { EndlessRecord } from './store';

/** Frames re-played before letting the server do other work (about 10 ms). */
const SLICE = 5000;
/** Most numbers an input list may have: two per change. */
const MAX_INPUTS = 400000;

export interface RunClaim { seed: number; inputs: number[]; bots: number; guard: 'line' | 'cursor' | ''; token: unknown; name: unknown }

/** The run's shape from an untrusted body, or a reason it's refused. */
export function readClaim(x: unknown): RunClaim | string {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const seed = o.seed, bots = o.bots, inputs = o.inputs;
  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff) return 'bad seed';
  if (!Number.isInteger(bots) || (bots as number) < 0) return 'bad score';
  if (!Array.isArray(inputs) || inputs.length % 2 || inputs.length > MAX_INPUTS) return 'bad inputs';
  let last = -1;
  for (let i = 0; i < inputs.length; i += 2) {
    const f = inputs[i], b = inputs[i + 1];
    if (!Number.isInteger(f) || f <= last || f >= MAX_RUN_FRAMES || !Number.isInteger(b) || b < 0 || b > 1023) return 'bad inputs';
    last = f;
  }
  const guard = o.guard === 'line' || o.guard === 'cursor' ? o.guard : '';
  return { seed: seed as number, inputs: inputs as number[], bots: bots as number, guard, token: o.id, name: o.name };
}

/** Re-play a run without holding up the server for more than a slice at a time. */
export async function replayAsync(seed: number, inputs: readonly number[], yieldNow: () => Promise<void> = () => new Promise((r) => setImmediate(r))): Promise<RunResult | null> {
  const r = new RunReplay(seed, inputs);
  for (;;) {
    const out = r.advance(SLICE);
    if (out !== undefined) return out;
    await yieldNow();
  }
}

/** Check a claimed run. The verified record, or why it was refused. */
export async function verifyRun(c: RunClaim): Promise<{ run: EndlessRecord; frames: number } | string> {
  const res = await replayAsync(c.seed, c.inputs);
  if (!res) return 'the run never ended';
  if (res.bots !== c.bots) return 'the score does not match the re-play';
  const last = res.tally.rounds[res.tally.rounds.length - 1];
  return { run: { guard: c.guard, bots: res.bots, how: last?.how ?? 'K.O.', why: last?.why ?? '', tally: res.tally, frames: res.frames }, frames: res.frames };
}
