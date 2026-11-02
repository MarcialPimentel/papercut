// Pairs players into rooms and relays their inputs. No fight logic lives here.

import { CODE_LENGTH, CODE_LETTERS, delayFor, normalizeCode, type ToClient, type ToServer } from '../src/net/protocol';
import { DEFAULT_CFG, cleanCfg, type MatchCfg } from '../src/sim/config';

export interface Peer {
  send(msg: ToClient): void;
  /** Latest measured round trip to this player, in ms (undefined until measured). */
  rtt?: number;
}

interface Room { code: string; host: Peer; guest?: Peer; quick: boolean; cfg: MatchCfg }

export class Lobby {
  private rooms = new Map<string, Room>();
  private roomOf = new Map<Peer, Room>();
  private waiting: Room | null = null;

  constructor(private rand: () => number = Math.random) {}

  get stats() {
    return { rooms: this.rooms.size, fighting: [...this.rooms.values()].filter((r) => r.guest).length, players: this.roomOf.size };
  }

  message(p: Peer, m: ToServer) {
    switch (m.t) {
      case 'host': {
        this.leave(p, false);
        const r = this.open(p, false, cleanCfg(m.cfg));
        p.send({ t: 'room', code: r.code });
        return;
      }
      case 'join': {
        const r = this.rooms.get(normalizeCode(String(m.code)));
        if (!r || r.quick) return p.send({ t: 'err', msg: 'That room does not exist any more. Ask your friend for a new link.' });
        if (r.host === p) return p.send({ t: 'err', msg: 'This is your own room. Send the link to a friend.' });
        if (r.guest) return p.send({ t: 'err', msg: 'That room already has two fighters.' });
        this.leave(p, false);
        this.begin(r, p);
        return;
      }
      case 'quick': {
        if (this.waiting && this.waiting.host !== p) {
          const r = this.waiting;
          this.waiting = null;
          this.leave(p, false);
          this.begin(r, p);
        } else if (!this.waiting) {
          this.leave(p, false);
          this.waiting = this.open(p, true, DEFAULT_CFG);
          p.send({ t: 'waiting' });
        }
        return;
      }
      case 'cancel':
        this.leave(p, true);
        return;
      case 'in':
      case 'hash': {
        const r = this.roomOf.get(p);
        const o = r && (r.host === p ? r.guest : r.host);
        if (!o || typeof m.f !== 'number') return;
        if (m.t === 'in') o.send({ t: 'in', f: m.f, b: m.b | 0 });
        else o.send({ t: 'hash', f: m.f, h: m.h >>> 0 });
        return;
      }
    }
  }

  /** A player disconnected. */
  close(p: Peer) { this.leave(p, true); }

  private open(host: Peer, quick: boolean, cfg: MatchCfg): Room {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(this.rand() * CODE_LETTERS.length)];
    } while (this.rooms.has(code));
    const r: Room = { code, host, quick, cfg };
    this.rooms.set(code, r);
    this.roomOf.set(host, r);
    return r;
  }

  private begin(r: Room, guest: Peer) {
    r.guest = guest;
    this.roomOf.set(guest, r);
    const delay = delayFor(r.host.rtt ?? 80, guest.rtt ?? 80);
    r.host.send({ t: 'start', seat: 0, delay, code: r.code, cfg: r.cfg });
    guest.send({ t: 'start', seat: 1, delay, code: r.code, cfg: r.cfg });
  }

  private leave(p: Peer, tell: boolean) {
    const r = this.roomOf.get(p);
    if (!r) return;
    const o = r.host === p ? r.guest : r.host;
    this.roomOf.delete(p);
    if (o) this.roomOf.delete(o);
    this.rooms.delete(r.code);
    if (this.waiting === r) this.waiting = null;
    if (o && tell) o.send({ t: 'gone' });
  }
}
