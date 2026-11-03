import { describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { Lockstep } from '../src/net/lockstep';
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
    expect(a.last()).toEqual({ t: 'start', seat: 0, delay: delayFor(40, 60), code: room.code, cfg: DEFAULT_CFG, looks: ['', ''] });
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
    lobby.message(a, { t: 'in', f: 5, b: 9 });
    expect(b.last()).toEqual({ t: 'in', f: 5, b: 9 });
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

  it('input delay grows with distance, between 2 and 8 frames', () => {
    expect(delayFor(10, 10)).toBe(2);
    expect(delayFor(60, 60)).toBe(5);
    expect(delayFor(400, 400)).toBe(8);
  });
});

describe('lockstep over a laggy connection', () => {
  it('both games see exactly the same fight', () => {
    let seed = 5;
    const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
    const lobby = new Lobby(rand);
    // Each player's messages reach the server after a random 1-6 ticks.
    const inFlight: { at: number; to: 'server'; from: Peer; m: ToServer }[] = [];
    let now = 0;
    const sessions: Lockstep[] = [];
    const peers = [0, 1].map((i) => {
      const p: Peer = {
        rtt: 50,
        send: (m) => {
          if (m.t === 'start') {
            sessions[i] = new Lockstep(m.seat, m.delay, (out) => inFlight.push({ at: now + 1 + Math.floor(rand() * 6), to: 'server', from: p, m: out }));
          } else sessions[i]?.receive(m);
        },
      };
      return p;
    });
    lobby.message(peers[0], { t: 'quick' });
    lobby.message(peers[1], { t: 'quick' });
    expect(sessions).toHaveLength(2);

    const buttons = () => (rand() < 0.4 ? BTN.right : 0) | (rand() < 0.3 ? BTN.left : 0) | (rand() < 0.5 ? BTN.low : 0) |
      (rand() < 0.05 ? BTN.light : 0) | (rand() < 0.03 ? BTN.heavy : 0) | (rand() < 0.02 ? BTN.feint : 0) | (rand() < 0.01 ? BTN.jump : 0);
    let stalls = 0;
    for (now = 0; now < 8000; now++) {
      for (let k = inFlight.length - 1; k >= 0; k--) {
        if (inFlight[k].at <= now) { const x = inFlight.splice(k, 1)[0]; lobby.message(x.from, x.m); }
      }
      for (const s of sessions) if (s.tick(buttons) === null) stalls++;
    }
    const [a, b] = sessions;
    const common = Math.min(a.frame, b.frame);
    expect(common).toBeGreaterThan(5000);
    expect(Math.abs(a.frame - b.frame)).toBeLessThanOrEqual(a.delay + 6);
    // Run the one that's ahead's partner up to the same frame and compare.
    for (let n = 0; n < 200 && a.frame !== b.frame; n++) {
      for (const x of inFlight.splice(0)) lobby.message(x.from, x.m);
      (a.frame < b.frame ? a : b).tick(() => 0);
    }
    expect(a.frame).toBe(b.frame);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.desynced || b.desynced).toBe(false);
    expect(stalls).toBeGreaterThan(0); // the lag really did make them wait sometimes
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
