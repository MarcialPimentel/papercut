import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { Ranked, playerId } from '../server/ranked';
import type { MatchRecord } from '../server/referee';
import { MemoryStore } from '../server/store';
import { ReplayPlayer } from '../src/net/replay';
import type { ToClient } from '../src/net/protocol';
import { DEFAULT_CFG } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { BTN, hashState, newMatch, step, type State } from '../src/sim/sim';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A practice dummy that also walks in, so two of them actually fight (and never ask for a rematch). */
function brawler(seed: number, seat: 0 | 1) {
  const d = new Dummy(seeded(seed), seat);
  return (s: State) => {
    const b = d.think(s), me = s.f[seat], you = s.f[1 - seat];
    if (s.phase === 'fight' && me.state === 'guard' && Math.abs(you.x - me.x) > 1.6) return b | (you.x > me.x ? BTN.right : BTN.left);
    return b & ~BTN.rematch;
  };
}

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  pid?: string;
  send(m: ToClient) { this.inbox.push(m); }
  get<T extends ToClient['t']>(t: T) { return this.inbox.filter((m) => m.t === t) as Extract<ToClient, { t: T }>[]; }
}

const TOKEN_A = 'a'.repeat(32), TOKEN_B = 'b'.repeat(32);
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Two players fight a quick match through the lobby; the store keeps it like the live server does. */
async function quickMatch() {
  const store = new MemoryStore();
  const lobby = new Lobby(Math.random, setTimeout, null, (r) => { store.addMatch('test', { ...r, fight: 'f1' }); }, new Ranked(store));
  const a = new FakePeer(), b = new FakePeer();
  lobby.message(a, { t: 'hello', guard: 'flick', id: TOKEN_A });
  lobby.message(b, { t: 'hello', guard: 'pad', id: TOKEN_B });
  await flush();
  lobby.message(a, { t: 'quick', name: 'Ann', look: '' });
  lobby.message(b, { t: 'quick', name: 'Bo', look: '' });
  const start = a.get('start')[0];
  const s = newMatch(DEFAULT_CFG), pa = brawler(21, 0), pb = brawler(22, 1);
  for (let f = 0; f < start.delay; f++) step(s, [0, 0]);
  for (let f = start.delay; f < 100000 && s.phase !== 'over'; f++) {
    const ia = pa(s), ib = pb(s);
    lobby.message(a, { t: 'in', f, b: ia });
    lobby.message(b, { t: 'in', f, b: ib });
    step(s, [ia, ib]);
  }
  await flush();
  return { store, final: hashState(s) };
}

describe('replays', () => {
  it('lists a finished online fight for both players, from their own side', async () => {
    const { store } = await quickMatch();
    const ann = await store.replaysOf(playerId(TOKEN_A), 20), bo = await store.replaysOf(playerId(TOKEN_B), 20);
    expect(ann).toHaveLength(1);
    expect(bo).toHaveLength(1);
    expect(ann[0].seat).toBe(0);
    expect(bo[0].seat).toBe(1);
    expect(ann[0].names).toEqual(['Ann', 'Bo']);
    expect(ann[0].mode).toBe('quick');
    expect(ann[0].fight).toBe('f1');
    expect(await store.replaysOf(playerId('c'.repeat(32)), 20)).toEqual([]);
  });

  it('plays the saved fight back to exactly the same end', async () => {
    const { store, final } = await quickMatch();
    const [row] = await store.replaysOf(playerId(TOKEN_A), 20);
    const d = (await store.replay(row.n))!;
    expect(d.frames).toBeGreaterThan(0);
    const rp = new ReplayPlayer(d.cfg, d.start, d.inputs, d.frames);
    while (rp.tick());
    expect(rp.state.phase).toBe('over');
    expect(hashState(rp.state)).toBe(final);
  });

  it('can go back and forward and land on the same frame', async () => {
    const { store } = await quickMatch();
    const [row] = await store.replaysOf(playerId(TOKEN_A), 20);
    const d = (await store.replay(row.n))!;
    const rp = new ReplayPlayer(d.cfg, d.start, d.inputs, d.frames);
    for (let i = 0; i < 900; i++) rp.tick();
    const at900 = hashState(rp.state);
    rp.seek(600);
    expect(rp.at).toBe(600);
    rp.seek(900);
    expect(hashState(rp.state)).toBe(at900);
  });

  it('shows the newest fights first, at most the limit, and skips ones that cannot play back', async () => {
    const store = new MemoryStore();
    const me = playerId(TOKEN_A);
    const rec = (fight: string | undefined, n: number): MatchRecord => ({
      mode: 'room', cfg: DEFAULT_CFG, standard: true, guard: ['', ''], winner: 0, tally: { rounds: [], sides: [] } as never,
      start: 0, inputs: [[0, n, 0]], frames: 10, players: [me, ''], names: ['Me', `Rival ${n}`], looks: ['', ''], fight,
    });
    await store.addMatch('b', rec(undefined, 0)); // from before replays: no fight version
    for (let n = 1; n <= 25; n++) await store.addMatch('b', rec('f1', n));
    const list = await store.replaysOf(me, 20);
    expect(list).toHaveLength(20);
    expect(list[0].names[1]).toBe('Rival 25');
    expect(list.every((r) => r.fight === 'f1')).toBe(true);
    expect(await store.replay(1)).toBeNull();
    expect(await store.replaysOf('', 20)).toEqual([]);
  });
});
