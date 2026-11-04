import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { MAX_GUESS, Rollback, type RollbackSink } from '../src/net/rollback';
import type { FightEvent, State } from '../src/sim/sim';
import { delayFor, type ToClient, type ToServer } from '../src/net/protocol';
import { BTN, hashState } from '../src/sim/sim';
import { DEFAULT_CFG } from '../src/sim/config';

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  rtt?: number;
  constructor(rtt?: number) { this.rtt = rtt; }
  send(m: ToClient) { this.inbox.push(m); }
  last() { return this.inbox[this.inbox.length - 1]; }
}

describe('lobby', () => {
  it('pairs a host and a guest through an invite code', () => {
    const lobby = new Lobby(), a = new FakePeer(40), b = new FakePeer(60);
    lobby.message(a, { t: 'host' });
    const room = a.last();
    expect(room.t).toBe('room');
    if (room.t !== 'room') return;
    lobby.message(b, { t: 'join', code: room.code.toLowerCase() });
    expect(a.last()).toEqual({ t: 'start', seat: 0, delay: delayFor(40, 60), code: room.code, cfg: DEFAULT_CFG, looks: ['', ''], names: ['Kami', 'Sumi'] });
    expect(b.last()).toMatchObject({ t: 'start', seat: 1 });
    expect(lobby.stats).toMatchObject({ rooms: 1, fighting: 1, players: 2 });
  });

  it('refuses unknown codes, your own room and full rooms', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer(), c = new FakePeer();
    lobby.message(a, { t: 'join', code: 'ZZZZ' });
    expect(a.last().t).toBe('err');
    lobby.message(a, { t: 'host' });
    const code = (a.last() as { code: string }).code;
    lobby.message(a, { t: 'join', code });
    expect(a.last().t).toBe('err');
    lobby.message(b, { t: 'join', code });
    lobby.message(c, { t: 'join', code });
    expect(c.last().t).toBe('err');
  });

  it('quick match pairs whoever is waiting', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'quick' });
    expect(a.last()).toEqual({ t: 'waiting' });
    lobby.message(b, { t: 'quick' });
    expect(a.last()).toMatchObject({ t: 'start', seat: 0 });
    expect(b.last()).toMatchObject({ t: 'start', seat: 1 });
  });

  it('relays inputs only to the opponent and tells them when you leave', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer(), c = new FakePeer();
    lobby.message(a, { t: 'quick' });
    lobby.message(b, { t: 'quick' });
    lobby.message(c, { t: 'quick' });
    const f = (b.last() as Extract<ToClient, { t: 'start' }>).delay; // the first frame with real buttons
    lobby.message(a, { t: 'in', f, b: 9 });
    expect(b.last()).toEqual({ t: 'in', f, b: 9 });
    expect(c.inbox).toEqual([{ t: 'waiting' }]);
    lobby.close(a);
    expect(b.last()).toEqual({ t: 'gone' });
    expect(lobby.stats.players).toBe(1);
  });

  it('a cancelled quick match frees the queue', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'quick' });
    lobby.message(a, { t: 'cancel' });
    lobby.message(b, { t: 'quick' });
    expect(b.last()).toEqual({ t: 'waiting' });
  });

  it('input delay covers about half the lag (rollback guesses the rest), between 2 and 6 frames', () => {
    expect(delayFor(10, 10)).toBe(2);
    expect(delayFor(60, 60)).toBe(3);
    expect(delayFor(400, 400)).toBe(6);
  });
});

/**
 * Two rollback games through the real lobby and referee. Each message takes `lag()` ticks to reach the
 * server. Returns what each game confirmed (fingerprints every 60 frames, K.O.s) and how often it waited.
 */
function playLaggy(seed: number, ticks: number, lag: (now: number, from: number) => number) {
  const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
  const lobby = new Lobby(rand);
  const inFlight: { at: number; from: Peer; m: ToServer }[] = [];
  let now = 0;
  const games: Rollback[] = [];
  const prints = [new Map<number, number>(), new Map<number, number>()];
  const kos: number[][] = [[], []];
  const shownKo = [0, 0];
  const sinks: RollbackSink[] = [0, 1].map((i) => ({
    show: (_s: State, ev: FightEvent[]) => { shownKo[i] += ev.filter((e) => e.k === 'ko').length; },
    confirm: (st: State, ev: FightEvent[]) => {
      if (st.frame % 60 === 0) prints[i].set(st.frame, hashState(st));
      for (const e of ev) if (e.k === 'ko') kos[i].push(st.frame);
    },
  }));
  const peers = [0, 1].map((i) => {
    const p: Peer = {
      rtt: 50,
      send: (m) => {
        if (m.t === 'start') games[i] = new Rollback(m.seat, m.delay, (out) => inFlight.push({ at: now + lag(now, i), from: p, m: out }));
        else games[i]?.receive(m);
      },
    };
    return p;
  });
  lobby.message(peers[0], { t: 'quick' });
  lobby.message(peers[1], { t: 'quick' });
  const buttons = () => (rand() < 0.4 ? BTN.right : 0) | (rand() < 0.3 ? BTN.left : 0) | (rand() < 0.5 ? BTN.low : 0) |
    (rand() < 0.05 ? BTN.light : 0) | (rand() < 0.03 ? BTN.heavy : 0) | (rand() < 0.02 ? BTN.feint : 0) | (rand() < 0.01 ? BTN.jump : 0);
  let waits = 0;
  for (now = 0; now < ticks; now++) {
    // Messages from one sender arrive in order, as they do over a websocket.
    inFlight.sort((x, y) => x.at - y.at);
    while (inFlight.length && inFlight[0].at <= now) { const x = inFlight.shift()!; lobby.message(x.from, x.m); }
    games.forEach((g, i) => { g.tick(buttons, sinks[i]); if (g.waiting > 0) waits++; });
  }
  return { games, prints, kos, shownKo, waits };
}

describe('rollback over a laggy connection', () => {
  it('both games confirm exactly the same fight, and guesses really get corrected', () => {
    let jitter = 3;
    const r = playLaggy(5, 8000, () => { jitter = (jitter * 7 + 3) % 11; return 1 + (jitter % 6); });
    const [a, b] = r.games;
    expect(Math.min(a.frame, b.frame)).toBeGreaterThan(7000);
    let compared = 0;
    for (const [f, h] of r.prints[0]) if (r.prints[1].has(f)) { expect(h).toBe(r.prints[1].get(f)); compared++; }
    expect(compared).toBeGreaterThan(100);
    const n = Math.min(r.kos[0].length, r.kos[1].length);
    expect(n).toBeGreaterThan(0);
    expect(r.kos[0].slice(0, n)).toEqual(r.kos[1].slice(0, n));
    expect(r.shownKo).toEqual([0, 0]); // a K.O. is never shown on a guess
    expect(a.desynced || b.desynced).toBe(false);
    expect(a.rerun + b.rerun).toBeGreaterThan(0); // the lag really did make some guesses wrong
    expect(r.waits).toBe(0); // and nobody had to wait: up to 6 ticks of lag fits in the guesses
  });

  it('a long lag spike makes the games wait, then they carry on in step', () => {
    const r = playLaggy(9, 4000, (now) => (now > 1000 && now < 1040 ? 40 : 2));
    const [a, b] = r.games;
    expect(r.waits).toBeGreaterThan(0);
    expect(a.guessing).toBeLessThanOrEqual(MAX_GUESS);
    expect(Math.abs(a.frame - b.frame)).toBeLessThan(MAX_GUESS + 4);
    for (const [f, h] of r.prints[0]) if (r.prints[1].has(f)) expect(h).toBe(r.prints[1].get(f));
    expect(a.desynced || b.desynced).toBe(false);
  });

  it("a game running ahead holds back until both games' leads meet", () => {
    // Player 2's messages take far longer than player 1's, so player 1 sees player 2 behind and runs ahead.
    const r = playLaggy(13, 3000, (_now, from) => (from === 1 ? 7 : 1));
    const [a, b] = r.games;
    expect(Math.abs(a.lead - b.lead)).toBeLessThan(4);
  });
});

describe('custom rooms', () => {
  it("the host's rules reach both players; quick matches use the defaults", () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'host', cfg: { wins: 1, maxHp: 150, roundSecs: 0, gauntlet: true } });
    const code = (a.last() as { code: string }).code;
    lobby.message(b, { t: 'join', code });
    const want = { wins: 1, maxHp: 150, roundSecs: 0, gauntlet: false }; // Endless is offline only
    expect(a.last()).toMatchObject({ t: 'start', cfg: want });
    expect(b.last()).toMatchObject({ t: 'start', cfg: want });
    const c = new FakePeer(), d = new FakePeer();
    lobby.message(c, { t: 'quick' });
    lobby.message(d, { t: 'quick' });
    expect(d.last()).toMatchObject({ t: 'start', cfg: DEFAULT_CFG });
  });
});
