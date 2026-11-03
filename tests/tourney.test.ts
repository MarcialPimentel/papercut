import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { BYE } from '../server/tourney';
import type { ToClient } from '../src/net/protocol';
import { cleanCfg } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { BTN, hashState, newMatch, step, type State } from '../src/sim/sim';

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  rtt = 40;
  send(m: ToClient) { this.inbox.push(m); }
  last<K extends ToClient['t']>(t: K) {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Extract<ToClient, { t: K }>;
    return undefined;
  }
}

/** A tournament with `n` players, already started. Breaks between fights run when `flush()` is called. */
function setup(n: number) {
  let seed = 9;
  const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
  const queue: (() => void)[] = [];
  const lobby = new Lobby(rand, (fn) => { queue.push(fn); return 0; });
  const ps = Array.from({ length: n }, () => new FakePeer());
  lobby.message(ps[0], { t: 'tourney', cfg: { wins: 1, maxHp: 50, roundSecs: 30, gauntlet: false }, name: 'Ana' });
  const code = ps[0].last('lobby')!.code;
  ps.slice(1).forEach((p, i) => lobby.message(p, { t: 'join', code, name: `P${i + 2}` }));
  const flush = () => { while (queue.length) queue.shift()!(); };
  return { lobby, ps, code, flush };
}

/** The players fighting right now (by peer), from the last 'match' message each got. */
function fighters(ps: FakePeer[]) {
  const seat0 = ps.find((p) => p.last('match')?.seat === 0 && isLatest(p));
  const seat1 = ps.find((p) => p.last('match')?.seat === 1 && isLatest(p));
  return [seat0!, seat1!] as const;
}
/** A fight is on for this player: their last 'match' came after their last 'bracket' (a fight's start sends both, in that order). */
const isLatest = (p: FakePeer) => { const m = p.last('match'); return !!m && p.inbox.lastIndexOf(m) > p.inbox.lastIndexOf(p.last('bracket')!); };

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A bot that walks in and fights, so a match always ends. */
function brawler(seed: number, seat: 0 | 1) {
  const d = new Dummy(seeded(seed), seat);
  return (s: State) => {
    const b = d.think(s), me = s.f[seat], you = s.f[1 - seat];
    if (s.phase === 'fight' && me.state === 'guard' && Math.abs(you.x - me.x) > 1.6) return b | (you.x > me.x ? BTN.right : BTN.left);
    return b & ~BTN.rematch;
  };
}

/**
 * Play the fight on stage out through the lobby, as two honest games would (plus `extra` before each frame,
 * for a test to slip in its own messages). `hashFor` lets a test send a fake fingerprint for a seat.
 * Returns the seat that really won the fight.
 */
function playFight(lobby: Lobby, a: FakePeer, b: FakePeer, opts: {
  seed?: number; hashFor?: (seat: number, real: number) => number; extra?: (f: number, s: State) => void;
} = {}) {
  const m = a.last('match')!;
  const s = newMatch(cleanCfg(m.cfg)), pa = brawler(opts.seed ?? 11, 0), pb = brawler((opts.seed ?? 11) + 1, 1);
  for (let f = 0; f < m.delay; f++) step(s, [0, 0]);
  for (let f = m.delay; f < 100000 && s.phase !== 'over'; f++) {
    opts.extra?.(f, s);
    const ia = pa(s), ib = pb(s);
    lobby.message(a, { t: 'in', f, b: ia });
    lobby.message(b, { t: 'in', f, b: ib });
    step(s, [ia, ib]);
    if (s.frame % 60 === 0) {
      const h = hashState(s);
      lobby.message(a, { t: 'hash', f: s.frame, h: opts.hashFor ? opts.hashFor(0, h) : h });
      lobby.message(b, { t: 'hash', f: s.frame, h: opts.hashFor ? opts.hashFor(1, h) : h });
    }
  }
  expect(s.phase).toBe('over');
  return s.f[0].wins > s.f[1].wins ? 0 : 1;
}

/** The bracket's winner (a player index) of the fight that just ended between these two. */
const lastWinner = (p: FakePeer) => p.last('bracket')!.rounds.flat().filter((m) => m.winner !== null && m.b !== BYE && !m.forfeit).pop()!;

describe('tournament', () => {
  it('a lobby lists the players; only the host can start, and only with 3 or more', () => {
    const { lobby, ps } = setup(2);
    expect(ps[1].last('lobby')).toMatchObject({ names: ['Ana', 'P2'], you: 1, host: false });
    lobby.message(ps[0], { t: 'begin' });
    expect(ps[0].last('match')).toBeUndefined();
    const c = new FakePeer();
    lobby.message(c, { t: 'join', code: ps[0].last('lobby')!.code });
    lobby.message(ps[1], { t: 'begin' }); // not the host
    expect(ps[0].last('match')).toBeUndefined();
    lobby.message(ps[0], { t: 'begin' });
    expect(ps[0].last('bracket')).toBeDefined();
  });

  it('endless rounds are swapped for the default in a tournament', () => {
    const lobby = new Lobby(), a = new FakePeer();
    lobby.message(a, { t: 'tourney', cfg: { wins: 0, maxHp: 80, roundSecs: 60, gauntlet: false } });
    expect(a.last('lobby')!.cfg.wins).toBe(3);
  });

  it('5 players: a bracket of 8 with 3 byes, one fight at a time, down to one champion', () => {
    const { lobby, ps, flush } = setup(5);
    lobby.message(ps[0], { t: 'begin' });
    const br = ps[0].last('bracket')!;
    expect(br.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(br.rounds[0].filter((m) => m.b === BYE)).toHaveLength(3);

    let fights = 0;
    for (let guard = 0; guard < 10 && ps[0].last('bracket')!.champion === null; guard++) {
      const [a, b] = fighters(ps);
      // Everyone else gets a 'match' to watch.
      expect(ps.filter((p) => p.last('match')?.seat === -1 && isLatest(p))).toHaveLength(3);
      // Inputs go to the rival, and to the watchers tagged with the seat.
      const watcher = ps.find((p) => p !== a && p !== b)!;
      playFight(lobby, a, b, { seed: guard * 7, extra: (f) => {
        if (f !== a.last('match')!.delay + 1) return;
        expect(b.last('in')).toMatchObject({ t: 'in', f: f - 1 });
        expect(watcher.last('in')).toMatchObject({ t: 'in', f: f - 1, s: 1 });
      } });
      fights++;
      flush();
    }
    // 5 players, single elimination: 4 real fights.
    expect(fights).toBe(4);
    const champ = ps[0].last('bracket')!.champion;
    expect(champ).not.toBeNull();
    for (const p of ps) expect(p.last('bracket')!.champion).toBe(champ);
  });

  it("the server's own re-play decides who goes through: a game claiming the win changes nothing", () => {
    const real = (() => {
      const { lobby, ps } = setup(3);
      lobby.message(ps[0], { t: 'begin' });
      const [a, b] = fighters(ps);
      return playFight(lobby, a, b);
    })();
    const { lobby, ps } = setup(3);
    lobby.message(ps[0], { t: 'begin' });
    const [a, b] = fighters(ps);
    const loser = [a, b][1 - real];
    // Every frame, the loser's game claims it won (older games send 'result'): ignored.
    playFight(lobby, a, b, { extra: () => lobby.message(loser, { t: 'result', winner: 1 - real }) });
    const m = lastWinner(ps[0]);
    expect(m.winner).toBe(real === 0 ? m.a : m.b);
    expect(b.inbox.filter((x) => x.t === 'match')).toHaveLength(1); // no replays
  });

  it('a modified game loses its tournament fight even when its fight was winning', () => {
    const real = (() => {
      const { lobby, ps } = setup(3);
      lobby.message(ps[0], { t: 'begin' });
      const [a, b] = fighters(ps);
      return playFight(lobby, a, b);
    })();
    const { lobby, ps } = setup(3);
    lobby.message(ps[0], { t: 'begin' });
    const [a, b] = fighters(ps);
    // The real winner's fingerprints don't match the server's re-play.
    playFight(lobby, a, b, { hashFor: (seat, h) => (seat === real ? h ^ 1 : h) });
    const m = lastWinner(ps[0]);
    expect(m.winner).toBe(real === 0 ? m.b : m.a);
  });

  it('a fighter who leaves loses', () => {
    const { lobby, ps, flush } = setup(3);
    lobby.message(ps[0], { t: 'begin' });
    let [a, b] = fighters(ps);
    lobby.close(a);
    const br = ps.find((p) => p !== a)!.last('bracket')!;
    const done = br.rounds.flat().find((m) => m.forfeit);
    expect(done).toBeDefined();
    flush();
    [a, b] = fighters(ps.filter((p) => p !== a));
    expect(a && b).toBeTruthy();
  });

  it('the host can deal a new, reshuffled bracket between fights, without anyone who left', () => {
    const { lobby, ps, flush } = setup(5);
    lobby.message(ps[0], { t: 'begin' });
    const firstSeeds = ps[0].last('bracket')!.rounds[0].map((m) => `${m.a},${m.b}`).join(' ');
    // Not during a fight, and never by a guest.
    expect(ps[0].last('bracket')!.restart).toBe(false);
    lobby.message(ps[0], { t: 'restart' });
    expect(ps[0].last('bracket')!.rounds[0].map((m) => `${m.a},${m.b}`).join(' ')).toBe(firstSeeds);
    // Play the tournament out; one non-host player leaves along the way.
    for (let guard = 0; guard < 10 && ps[0].last('bracket')!.champion === null; guard++) {
      const [a, b] = fighters(guard === 0 ? ps : ps.slice(0, 4));
      playFight(lobby, a, b, { seed: guard });
      if (guard === 0) lobby.close(ps[4]); // during the first break
      flush();
    }
    expect(ps[0].last('bracket')!.champion).not.toBeNull();
    expect(ps[0].last('bracket')!.restart).toBe(true);
    expect(ps[1].last('bracket')!.restart).toBe(false);
    lobby.message(ps[1], { t: 'restart' }); // a guest can't
    expect(ps[1].last('bracket')!.champion).not.toBeNull();

    // New brackets: 4 players left, no byes, a fight starts at once; across a few deals the seats change.
    const deals = new Set<string>();
    for (let i = 0; i < 6; i++) {
      lobby.message(ps[0], { t: 'restart' });
      const br = ps[0].last('bracket')!;
      expect(br.champion).toBeNull();
      expect(br.names).toHaveLength(4);
      expect(br.rounds.map((r) => r.length)).toEqual([2, 1]);
      expect(br.rounds[0].every((m) => m.b !== BYE && m.winner === null)).toBe(true);
      deals.add(br.rounds[0].map((m) => [m.a, m.b].sort().join(',')).sort().join(' '));
      const [a, b] = fighters(ps.slice(0, 4));
      expect(a && b).toBeTruthy();
      // Finish this fight so the host can deal again during the break.
      playFight(lobby, a, b, { seed: 30 + i });
    }
    expect(deals.size).toBeGreaterThan(1);
  });

  it("can't be joined once it has started", () => {
    const { lobby, ps, code } = setup(3);
    lobby.message(ps[0], { t: 'begin' });
    const late = new FakePeer();
    lobby.message(late, { t: 'join', code });
    expect(late.last('err')).toBeDefined();
  });
});

describe('watching a tournament fight', () => {
  it('a watcher sees exactly the fight the two fighters see', async () => {
    const { Lockstep } = await import('../src/net/lockstep');
    const { Spectator } = await import('../src/net/spectator');
    const { BTN, hashState } = await import('../src/sim/sim');
    let seed = 21;
    const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
    const lobby = new Lobby(rand, () => 0);
    const games: (InstanceType<typeof Lockstep> | InstanceType<typeof Spectator>)[] = [];
    const inFlight: { at: number; from: Peer; m: Parameters<Lobby['message']>[1] }[] = [];
    let now = 0;
    const peers: Peer[] = [0, 1, 2].map((i) => {
      const p: Peer = {
        rtt: 50,
        send: (m) => {
          if (m.t === 'match') {
            games[i] = m.seat === -1 ? new Spectator(m.cfg, m.delay)
              : new Lockstep(m.seat, m.delay, (out) => inFlight.push({ at: now + 1 + Math.floor(rand() * 5), from: p, m: out }), m.cfg);
          } else if (m.t === 'in' || m.t === 'hash') games[i]?.receive(m);
        },
      };
      return p;
    });
    lobby.message(peers[0], { t: 'tourney' });
    const code = [...(lobby as unknown as { tourneys: Map<string, unknown> }).tourneys.keys()][0];
    lobby.message(peers[1], { t: 'join', code });
    lobby.message(peers[2], { t: 'join', code });
    lobby.message(peers[0], { t: 'begin' });
    const buttons = () => (rand() < 0.4 ? BTN.right : 0) | (rand() < 0.5 ? BTN.low : 0) | (rand() < 0.05 ? BTN.light : 0) | (rand() < 0.03 ? BTN.heavy : 0);
    // Fingerprints every 100 frames, for each game.
    const prints = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
    const note = (k: number) => { const st = games[k].state; if (st.frame % 100 === 0) prints[k].set(st.frame, hashState(st)); };
    for (now = 0; now < 3000; now++) {
      for (let k = inFlight.length - 1; k >= 0; k--) if (inFlight[k].at <= now) { const x = inFlight.splice(k, 1)[0]; lobby.message(x.from, x.m); }
      games.forEach((g, k) => { const ev = g instanceof Lockstep ? g.tick(buttons) : g.tick(); if (ev) note(k); });
    }
    const w = games.findIndex((g) => g instanceof Spectator), f = games.findIndex((g) => g instanceof Lockstep);
    expect(games[w].state.frame).toBeGreaterThan(2000);
    let compared = 0;
    for (const [frame, h] of prints[w]) if (prints[f].has(frame)) { expect(h).toBe(prints[f].get(frame)); compared++; }
    expect(compared).toBeGreaterThan(15);
  });
});
