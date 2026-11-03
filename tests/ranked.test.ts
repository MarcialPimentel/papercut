import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { Ranked, playerId } from '../server/ranked';
import { START, badge, divisionOf, rate } from '../server/rating';
import { MemoryStore } from '../server/store';
import type { ToClient } from '../src/net/protocol';
import { DEFAULT_CFG } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { BTN, hashState, newMatch, step, type State } from '../src/sim/sim';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
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
  last() { return this.inbox[this.inbox.length - 1]; }
  get<T extends ToClient['t']>(t: T) { return this.inbox.filter((m) => m.t === t) as Extract<ToClient, { t: T }>[]; }
}

const TOKEN_A = 'a'.repeat(32), TOKEN_B = 'b'.repeat(32);
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Two players queue for ranked and get paired. */
async function pairUp(store = new MemoryStore()) {
  const ranked = new Ranked(store);
  const lobby = new Lobby(Math.random, setTimeout, null, () => {}, ranked);
  const a = new FakePeer(), b = new FakePeer();
  lobby.message(a, { t: 'hello', guard: 'flick', id: TOKEN_A });
  lobby.message(b, { t: 'hello', guard: 'flick', id: TOKEN_B });
  await flush();
  lobby.message(a, { t: 'ranked', name: 'Ann' });
  lobby.message(b, { t: 'ranked', name: 'Bo' });
  await flush(); await flush();
  return { lobby, ranked, a, b, store };
}

/**
 * Play the match out through the lobby. `hashFor` lets a test send fake fingerprints for a seat.
 * Returns who the real fight's winner was.
 */
function playOut(lobby: Lobby, a: FakePeer, b: FakePeer, hashFor?: (seat: number, real: number) => number) {
  const start = a.get('start')[0];
  const s = newMatch(DEFAULT_CFG), pa = brawler(11, 0), pb = brawler(12, 1);
  for (let f = 0; f < start.delay; f++) step(s, [0, 0]);
  for (let f = start.delay; f < 100000 && s.phase !== 'over'; f++) {
    const ia = pa(s), ib = pb(s);
    lobby.message(a, { t: 'in', f, b: ia });
    lobby.message(b, { t: 'in', f, b: ib });
    step(s, [ia, ib]);
    if (s.frame % 60 === 0) {
      const h = hashState(s);
      lobby.message(a, { t: 'hash', f: s.frame, h: hashFor ? hashFor(0, h) : h });
      lobby.message(b, { t: 'hash', f: s.frame, h: hashFor ? hashFor(1, h) : h });
    }
  }
  return s.f[0].wins > s.f[1].wins ? 0 : 1;
}

describe('ratings', () => {
  it('moves a new player a lot and a settled one a little', () => {
    const fresh = rate(START, START, 1);
    expect(fresh.rating).toBeGreaterThan(1600);
    expect(fresh.rd).toBeLessThan(START.rd);
    const settled = { rating: 1500, rd: 60, vol: 0.06 };
    const step1 = rate(settled, settled, 1).rating - 1500;
    expect(step1).toBeGreaterThan(0);
    expect(step1).toBeLessThan(15);
    // Beating someone much stronger is worth more than beating someone weaker.
    expect(rate(settled, { ...settled, rating: 1800 }, 1).rating).toBeGreaterThan(rate(settled, { ...settled, rating: 1200 }, 1).rating);
  });

  it('names the paper-grade divisions and holds them back during placement', () => {
    expect(['Tissue', 'Newsprint', 'Cardstock', 'Washi', 'Gold Leaf'].map((_, i) => divisionOf([1200, 1400, 1500, 1650, 1800][i])))
      .toEqual(['Tissue', 'Newsprint', 'Cardstock', 'Washi', 'Gold Leaf']);
    expect(badge({ ...START, games: 2 })).toMatchObject({ division: 'Placement 2/5', placed: false });
    expect(badge({ ...START, games: 5 })).toMatchObject({ division: 'Cardstock', points: 1500, placed: true });
  });
});

describe('the ranked queue', () => {
  it('pairs close ratings at once and far ones only after waiting', async () => {
    let now = 0;
    const store = new MemoryStore();
    await store.savePlayer({ id: playerId(TOKEN_A), name: 'A', rating: 1500, rd: 50, vol: 0.06, games: 30, wins: 15 });
    await store.savePlayer({ id: playerId(TOKEN_B), name: 'B', rating: 1900, rd: 50, vol: 0.06, games: 30, wins: 15 });
    const ranked = new Ranked(store, () => now);
    const a = new FakePeer(), b = new FakePeer();
    await ranked.hello(a, TOKEN_A); await ranked.hello(b, TOKEN_B);
    await ranked.join(a, 'A'); await ranked.join(b, 'B');
    expect(ranked.match()).toHaveLength(0); // 400 apart
    now = 10000;
    expect(ranked.match()).toHaveLength(0); // the gap has widened to 350
    now = 12100;
    expect(ranked.match()).toHaveLength(1); // 100 + 25 per second reaches 400
  });

  it('never pairs a player with themselves (two windows, one browser)', async () => {
    const ranked = new Ranked(new MemoryStore());
    const a = new FakePeer(), a2 = new FakePeer();
    await ranked.hello(a, TOKEN_A); await ranked.hello(a2, TOKEN_A);
    await ranked.join(a, 'A'); await ranked.join(a2, 'A');
    expect(ranked.match()).toHaveLength(0);
  });

  it('refuses a player with no token', async () => {
    const lobby = new Lobby(Math.random, setTimeout, null, () => {}, new Ranked(new MemoryStore()));
    const p = new FakePeer();
    lobby.message(p, { t: 'ranked' });
    await flush();
    expect(p.get('err')).toHaveLength(1);
  });
});

describe('ranked matches', () => {
  it('rates both players from the server\'s own re-play, and the ratings last across a restart', async () => {
    const { lobby, a, b, store } = await pairUp();
    const start = a.get('start')[0];
    expect(start.ranks).toEqual([
      { name: 'Ann', division: 'Placement 0/5', points: 1500, placed: false },
      { name: 'Bo', division: 'Placement 0/5', points: 1500, placed: false },
    ]);
    const winner = playOut(lobby, a, b);
    const [ra] = a.get('ranked'), [rb] = b.get('ranked');
    expect(ra.won).toBe(winner === 0);
    expect(rb.won).toBe(winner === 1);
    expect(Math.sign(ra.delta)).toBe(winner === 0 ? 1 : -1);
    expect(ra.you.division).toBe('Placement 1/5');
    // Leaving afterwards changes nothing.
    lobby.close(a);
    expect(b.get('ranked')).toHaveLength(1);
    // A fresh server (a deploy) loads the same ratings from the database.
    const again = new Ranked(store);
    const a2 = new FakePeer();
    await again.hello(a2, TOKEN_A);
    expect(a2.get('rank')[0].you.points).toBe(ra.you.points);
  });

  it('ignores a browser that claims a result, and a modified game loses even when its fight was winning', async () => {
    // The same scripted fight, played honestly, to learn who really wins it.
    const dry = await pairUp();
    const realWinner = playOut(dry.lobby, dry.a, dry.b);
    const { lobby, a, b } = await pairUp();
    const peers = [a, b], cheat = peers[realWinner], honest = peers[1 - realWinner];
    // The other side's browser claims the win: ignored, there is no such thing as a reported result in ranked.
    lobby.message(honest, { t: 'result', winner: 1 - realWinner });
    // The real winner's game is "modified": its fingerprints don't match the server's re-play.
    playOut(lobby, a, b, (seat, h) => (seat === realWinner ? h ^ 1 : h));
    expect(cheat.get('ranked')[0].won).toBe(false);
    expect(honest.get('ranked')[0].won).toBe(true);
  });

  it('counts leaving a ranked match early as a loss', async () => {
    const { lobby, a, b } = await pairUp();
    lobby.message(a, { t: 'in', f: 10, b: 0 });
    lobby.close(a);
    expect(b.get('ranked')[0]).toMatchObject({ won: true, why: 'left' });
    expect(b.last().t).toBe('gone');
  });
});

describe('the ranked list', () => {
  it('shows only placed players, highest rating first, with your place', async () => {
    const st = new MemoryStore();
    const p = (id: string, rating: number, games: number) => st.savePlayer({ id, name: id.toUpperCase(), rating, rd: 80, vol: 0.06, games, wins: 0 });
    await p('a', 1500, 12); await p('b', 1720, 9); await p('c', 1900, 3); await p('d', 1610, 5);
    expect((await st.rankedTop(100)).map((x) => x.id)).toEqual(['b', 'd', 'a']); // c is still in placement
    expect(await st.rankedPlace('a')).toBe(3);
    expect(await st.rankedPlace('c')).toBeNull();
    expect(await st.rankedPlace('nobody')).toBeNull();
    expect((await st.rankedTop(2)).length).toBe(2);
  });
});
