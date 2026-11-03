import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { Referee, replay, type MatchRecord } from '../server/referee';
import { summarize, readFilter, page } from '../server/stats';
import { MemoryStore, PgStore, KEEP_INPUTS_DAYS, type PgLike } from '../server/store';
import type { ToClient } from '../src/net/protocol';
import { DEFAULT_CFG, type MatchCfg } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { BTN, hashState, newMatch, step, type State } from '../src/sim/sim';
import { RULES } from '../src/sim/rules';
import { Tally, emptyTally } from '../src/sim/tally';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A practice dummy that also keeps walking in, so two of them actually fight. */
function brawler(seed: number, seat: 0 | 1) {
  const d = new Dummy(seeded(seed), seat);
  return (s: State) => {
    const b = d.think(s), me = s.f[seat], you = s.f[1 - seat];
    if (s.phase === 'fight' && me.state === 'guard' && Math.abs(you.x - me.x) > 1.6) return b | (you.x > me.x ? BTN.right : BTN.left);
    return b;
  };
}

/** Two practice dummies fight a whole match through a referee; returns what it recorded and the frame it ended on. */
function dummyMatch(cfg: MatchCfg = DEFAULT_CFG, seed = 1) {
  const recs: { r: MatchRecord; frame: number; hash: number }[] = [];
  const ref = new Referee('quick', cfg, 3, ['line', 'cursor'], (r) => recs.push({ r, frame: ref.state.frame, hash: hashState(ref.state) }));
  const shadow = newMatch(cfg); // the dummies' own view of the fight, to decide their buttons
  const a = brawler(seed, 0), b = brawler(seed + 1, 1);
  for (let f = 0; f < 3; f++) step(shadow, [0, 0]);
  for (let f = 3; f < 100000 && !recs.length; f++) {
    const ia = a(shadow), ib = b(shadow);
    ref.input(0, f, ia); ref.input(1, f, ib);
    step(shadow, [ia, ib]);
  }
  return recs;
}

describe('the referee', () => {
  it('steps the fight alongside the players and records the finished match', () => {
    const [{ r, frame, hash }] = dummyMatch();
    expect(r.mode).toBe('quick');
    expect(r.standard).toBe(true);
    expect(r.guard).toEqual(['line', 'cursor']);
    expect(r.winner === 0 || r.winner === 1).toBe(true);
    const wins = r.tally.rounds.filter((x) => x.winner === r.winner).length;
    expect(wins).toBe(DEFAULT_CFG.wins);
    expect(r.tally.sides[0].light.n + r.tally.sides[0].heavy.n).toBeGreaterThan(0);
    // The saved inputs re-play to exactly the same fight.
    const again = replay(DEFAULT_CFG, r.start, r.inputs, frame - r.start);
    expect(hashState(again)).toBe(hash);
  });

  it('only runs frames both players have sent, in order', () => {
    const ref = new Referee('room', DEFAULT_CFG, 2, ['', ''], () => {});
    ref.input(0, 2, BTN.right);
    expect(ref.state.frame).toBe(2); // frames 0 and 1 are the empty delay frames
    ref.input(1, 3, 0);
    expect(ref.state.frame).toBe(2); // still missing seat 1's frame 2
    ref.input(1, 2, 0);
    expect(ref.state.frame).toBe(3);
    ref.input(0, 99999, 0); // far ahead: ignored
    ref.input(0, 1, 0); // in the past: ignored
    expect(ref.state.frame).toBe(3);
  });

  it('keeps an endless-rounds room when it closes, and nothing from a room that never fought', () => {
    const cfg = { ...DEFAULT_CFG, wins: 0, roundSecs: 30 };
    const got: MatchRecord[] = [];
    const ref = new Referee('room', cfg, 2, ['', ''], (r) => got.push(r));
    for (let f = 2; f < 2 + 60 * 40; f++) { ref.input(0, f, 0); ref.input(1, f, 0); }
    ref.close();
    expect(got).toHaveLength(1);
    expect(got[0].winner).toBeNull();
    expect(got[0].standard).toBe(false);
    expect(got[0].tally.rounds[0].how).toBe('Time');
    const quiet: MatchRecord[] = [];
    new Referee('room', cfg, 2, ['', ''], (r) => quiet.push(r)).close();
    expect(quiet).toHaveLength(0);
  });
});

describe('the lobby records matches', () => {
  class FakePeer implements Peer {
    inbox: ToClient[] = [];
    send(m: ToClient) { this.inbox.push(m); }
  }
  it('feeds a quick match to its referee with each player\'s guard style', () => {
    const recs: MatchRecord[] = [];
    const lobby = new Lobby(Math.random, setTimeout, (r) => recs.push(r));
    const a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'hello', guard: 'cursor' });
    lobby.message(b, { t: 'hello', guard: 'line' });
    lobby.message(a, { t: 'quick' });
    lobby.message(b, { t: 'quick' });
    const start = a.inbox.find((m) => m.t === 'start');
    expect(start).toBeTruthy();
    const delay = start && start.t === 'start' ? start.delay : 0;
    const shadow = newMatch(DEFAULT_CFG), da = brawler(3, 0), db = brawler(4, 1);
    for (let f = 0; f < delay; f++) step(shadow, [0, 0]);
    for (let f = delay; f < 100000 && !recs.length; f++) {
      const ia = da(shadow), ib = db(shadow);
      lobby.message(a, { t: 'in', f, b: ia });
      lobby.message(b, { t: 'in', f, b: ib });
      step(shadow, [ia, ib]);
    }
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ mode: 'quick', guard: ['cursor', 'line'], winner: shadow.f[0].wins > shadow.f[1].wins ? 0 : 1 });
  });
});

describe('the tally', () => {
  it('counts a blocked heavy and the cut that follows the stagger', () => {
    const s = newMatch(DEFAULT_CFG), t = new Tally();
    const run = (n: number, a = 0, b = 0) => { for (let i = 0; i < n; i++) t.feed(s, step(s, [a, b])); };
    run(RULES.introFrames + 2);
    s.f[0].x = -1; s.f[1].x = 1; // close enough to reach
    s.f[0].stance = 'high'; s.f[1].stance = 'high'; s.f[1].stanceAt = -999;
    run(1, BTN.heavy, 0); // seat 0 heavies high into seat 1's high guard
    while (s.f[1].state !== 'stagger') run(1);
    while (s.f[0].state !== 'guard') run(1); // the attacker recovers first and keeps the turn
    expect(t.t.sides[0].heavy.n).toBe(1);
    expect(t.t.sides[0].heavy.block).toBe(1);
    expect(t.t.sides[1].blocks).toBe(1);
    expect(t.t.sides[0].staggers).toBe(1);
    expect(s.f[1].state).toBe('stagger');
    run(1, BTN.light | BTN.low, 0);
    run(30, 0, 0);
    expect(t.t.sides[0].light.land).toBe(1);
    expect(t.t.sides[0].staggerFollow).toBe(1);
  });
});

describe('the stats', () => {
  const rec = (winner: 0 | 1, how: string, why: '' | 'wind' | 'miss' = '', guard: ['line' | 'cursor', 'line' | 'cursor'] = ['line', 'cursor']) => {
    const tally = emptyTally();
    tally.rounds.push({ winner, how, why, frames: 600, hp: [10, 0] });
    tally.sides[0].heavy = { n: 4, land: 1, block: 2, parried: 0, whiff: 1, clash: 0, feint: 1 };
    tally.sides[0].staggers = 2; tally.sides[0].staggerFollow = 1;
    tally.winner = winner;
    return { build: 'abc1234', mode: 'quick' as const, standard: true, guard, winner, tally };
  };

  it('works out how rounds end and win rates', () => {
    const st = summarize([rec(0, 'K.O.'), rec(1, 'Counter cut', 'wind'), rec(0, 'Counter cut', 'miss'), rec(0, 'Time')], []);
    expect(st.matches).toBe(4);
    expect(st.rounds).toBe(4);
    expect(st.ends).toEqual({ ko: 1, counterWind: 1, counterMiss: 1, time: 1, double: 0 });
    expect(st.kamiWins).toBe(3);
    expect(st.guardMixed).toBe(4);
    expect(st.lineWins).toBe(3); // Kami was on Line in all four
    expect(st.slashes.heavy.thrown).toBe(16);
    expect(st.staggerFollow / st.staggers).toBe(0.5);
    expect(st.avgRoundSecs).toBe(10);
    const html = page(st, readFilter(new URL('http://x/stats')), ['abc1234'], 'abc1234');
    expect(html).toContain('25%'); // each way of ending a round
    expect(html).toContain('50%'); // blocked heavy, then a cut lands
  });

  it('reads filters safely', () => {
    expect(readFilter(new URL('http://x/stats?build=<x>&rules=all&guard=line'))).toEqual({ build: '', rules: 'all', guard: 'line' });
    expect(readFilter(new URL('http://x/stats'))).toEqual({ build: '', rules: 'standard', guard: 'any' });
  });
});

describe('the store', () => {
  it('filters by build, rules and guard, and drops old inputs', async () => {
    let now = 0;
    const st = new MemoryStore(() => now);
    const base = dummyMatch()[0].r;
    await st.addMatch('aaa', base);
    await st.addMatch('bbb', { ...base, standard: false, guard: ['line', 'line'] });
    expect(await st.matches({ build: '', rules: 'standard', guard: 'any' })).toHaveLength(1);
    expect(await st.matches({ build: '', rules: 'all', guard: 'line' })).toHaveLength(1);
    expect(await st.matches({ build: 'bbb', rules: 'all', guard: 'any' })).toHaveLength(1);
    expect(await st.builds()).toEqual(['bbb', 'aaa']);
    now = (KEEP_INPUTS_DAYS + 1) * 86400e3;
    await st.addMatch('ccc', base);
    await st.prune();
    expect(st.rows.map((r) => r.inputs === null)).toEqual([true, true, false]);
  });

  it('writes to Postgres with placeholders, never by pasting values into the query', async () => {
    const seen: { text: string; values?: unknown[] }[] = [];
    const pool: PgLike = { async query(text, values) { seen.push({ text, values }); return { rows: [] }; } };
    const st = new PgStore(pool);
    await st.matches({ build: "x'; DROP TABLE matches; --", rules: 'custom', guard: 'cursor' });
    const q = seen[seen.length - 1];
    expect(q.text).not.toContain('DROP');
    expect(q.values).toEqual(["x'; DROP TABLE matches; --", false, 'cursor', 20000]);
    expect(seen[0].text).toContain('CREATE TABLE IF NOT EXISTS matches');
  });
});
