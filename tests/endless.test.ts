import { describe, expect, it } from 'vitest';
import { readClaim, replayAsync, verifyRun } from '../server/endless';
import { MemoryStore } from '../server/store';
import { ENDLESS_CFG } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { RunInputs, botInput, endlessBot, replayRun, seeded } from '../src/sim/endless';
import { BTN, newMatch, step, type State } from '../src/sim/sim';
import { emptyTally } from '../src/sim/tally';

/** A scripted player: a practice dummy that keeps walking in. */
function player(seed: number) {
  const d = new Dummy(seeded(seed), 0);
  return (s: State) => {
    const b = d.think(s) & ~BTN.rematch, me = s.f[0], you = s.f[1];
    if (s.phase === 'fight' && me.state === 'guard' && Math.abs(you.x - me.x) > 1.6) return b | (you.x > me.x ? BTN.right : BTN.left);
    return b;
  };
}

/** Play an Endless run the way the browser does: record the player's inputs, the bot thinks from the seed. */
function playRun(seed: number, playerSeed = 99) {
  const s = newMatch(ENDLESS_CFG), bot = endlessBot(seed), me = player(playerSeed), inputs = new RunInputs();
  for (let f = 0; f < 400000; f++) {
    const mine = me(s);
    inputs.add(s.frame, mine);
    const ev = step(s, [mine, botInput(bot, s)]);
    if (ev.some((e) => e.k === 'over')) return { seed, inputs: inputs.list, bots: s.f[0].wins, frames: s.frame };
  }
  throw new Error('the run never ended');
}

describe('re-playing Endless runs', () => {
  it('the same seed gives the same dice', () => {
    const a = seeded(42), b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seeded(43)()).not.toBe(seeded(42)());
  });

  it('reaches exactly the run the player had', () => {
    const run = playRun(1234);
    const again = replayRun(run.seed, run.inputs);
    expect(again).not.toBeNull();
    expect(again!.bots).toBe(run.bots);
    expect(again!.frames).toBe(run.frames);
  });

  it('accepts a real run and rejects an edited score', async () => {
    const run = playRun(777);
    const claim = readClaim(JSON.parse(JSON.stringify({ ...run, guard: 'line', id: 'f'.repeat(32), name: 'Ann' })));
    if (typeof claim === 'string') throw new Error(claim);
    const ok = await verifyRun(claim);
    if (typeof ok === 'string') throw new Error(ok);
    expect(ok.run.bots).toBe(run.bots);
    expect(ok.run.guard).toBe('line');
    expect(ok.frames).toBe(run.frames);
    expect(await verifyRun({ ...claim, bots: run.bots + 3 })).toBe('the score does not match the re-play');
    // A different seed is a different bot: the same inputs don't reach the same run.
    const other = await verifyRun({ ...claim, seed: claim.seed + 1 });
    expect(typeof other === 'string' || other.run.frames !== run.frames).toBe(true);
  });

  it('refuses inputs that are not a run', () => {
    expect(readClaim({ seed: 1, bots: 1, inputs: [5, 1, 3, 0] })).toBe('bad inputs'); // frames going backwards
    expect(readClaim({ seed: 1, bots: 1, inputs: [0, 99999] })).toBe('bad inputs');
    expect(readClaim({ seed: -1, bots: 1, inputs: [] })).toBe('bad seed');
    expect(readClaim('nonsense')).toBe('bad seed');
  });

  it('re-plays in slices, letting the server do other work in between', async () => {
    const run = playRun(55);
    let pauses = 0;
    const res = await replayAsync(run.seed, run.inputs, async () => { pauses++; });
    expect(res!.bots).toBe(run.bots);
    expect(pauses).toBe(Math.floor(run.frames / 5000));
  });
});

describe('the leaderboard', () => {
  const run = (player: string, bots: number, frames: number) => ({ guard: 'line' as const, bots, how: 'K.O.', why: '' as const, tally: emptyTally(), frames, player });

  it('ranks each player by their best run: most bots, then fastest', async () => {
    const st = new MemoryStore();
    await st.savePlayer({ id: 'a', name: 'Ann', rating: 1500, rd: 350, vol: 0.06, games: 0, wins: 0 });
    await st.addEndless('b', run('a', 5, 9000));
    await st.addEndless('b', run('a', 12, 30000)); // Ann's best
    await st.addEndless('b', run('b', 12, 25000)); // same bots, faster
    await st.addEndless('b', run('c', 3, 4000));
    await st.addEndless('b', { ...run('x', 50, 1), player: undefined }); // no player: stats only
    const top = await st.board('all', 100);
    expect(top.map((r) => [r.player, r.bots])).toEqual([['b', 12], ['a', 12], ['c', 3]]);
    expect(top[1].name).toBe('Ann');
    expect(await st.place('a', 'all')).toEqual({ place: 2, bots: 12 });
    expect(await st.place('nobody', 'all')).toBeNull();
  });

  it('keeps the 24-hour and 7-day boards to recent runs', async () => {
    let now = 0;
    const st = new MemoryStore(() => now);
    await st.addEndless('b', run('old', 40, 1000));
    now = 3 * 86400e3;
    await st.addEndless('b', run('new', 2, 1000));
    expect((await st.board('day', 100)).map((r) => r.player)).toEqual(['new']);
    expect((await st.board('week', 100)).map((r) => r.player)).toEqual(['old', 'new']);
    now = 11 * 86400e3;
    expect(await st.board('week', 100)).toEqual([]);
    expect((await st.board('all', 100)).map((r) => r.player)).toEqual(['old', 'new']);
  });
});
