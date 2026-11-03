// Pairs players into rooms (1v1 or tournament) and relays their inputs. No fight logic lives here.

import { CODE_LENGTH, CODE_LETTERS, delayFor, normalizeCode, type ToClient, type ToServer } from '../src/net/protocol';
import { DEFAULT_CFG, cleanCfg, type MatchCfg } from '../src/sim/config';
import { TOURNEY_MAX, Tourney } from './tourney';

export interface Peer {
  send(msg: ToClient): void;
  /** Latest measured round trip to this player, in ms (undefined until measured). */
  rtt?: number;
  /** The fight version this player's game runs (server/fightVersion.ts). */
  v?: string;
}

/** Told to a player whose game runs different fight rules from the server's. */
export const MISMATCH_MSG = "This copy of Papercut doesn't match the online version. Update it (or reload the page) to fight online. Practice and Endless still work.";
const PAIRING = new Set(['host', 'join', 'quick', 'tourney']);

interface Room { code: string; host: Peer; guest?: Peer; quick: boolean; cfg: MatchCfg }

export class Lobby {
  private rooms = new Map<string, Room>();
  private roomOf = new Map<Peer, Room>();
  private waiting: Room | null = null;
  private tourneys = new Map<string, Tourney>();
  private tourneyOf = new Map<Peer, Tourney>();

  /**
   * @param fight the server's fight version. When set, only players on that version can make or join rooms,
   *   so two different rule sets never meet in one fight (they would fall out of sync).
   */
  constructor(private rand: () => number = Math.random, private later: (fn: () => void, ms: number) => unknown = setTimeout, private fight: string | null = null) {}

  get stats() {
    return {
      rooms: this.rooms.size + this.tourneys.size,
      fighting: [...this.rooms.values()].filter((r) => r.guest).length + [...this.tourneys.values()].filter((t) => t.current).length,
      players: this.roomOf.size + this.tourneyOf.size,
    };
  }

  message(p: Peer, m: ToServer) {
    const t = this.tourneyOf.get(p);
    if (this.fight && PAIRING.has(m.t) && p.v !== this.fight) { p.send({ t: 'err', msg: MISMATCH_MSG }); return; }
    switch (m.t) {
      case 'tourney': {
        this.leave(p, false);
        // Every bracket match must end, so endless rounds aren't allowed in a tournament.
        const cfg = cleanCfg(m.cfg);
        if (cfg.wins === 0) cfg.wins = DEFAULT_CFG.wins;
        const tn = new Tourney(this.newCode(), cfg, this.rand, this.later);
        this.tourneys.set(tn.code, tn);
        this.tourneyOf.set(p, tn);
        tn.add(p, m.name);
        return;
      }
      case 'name': t?.rename(p, m.name); return;
      case 'begin': t?.begin(p); return;
      case 'restart': t?.restart(p); return;
      case 'result': t?.report(p, m.winner); return;
      case 'host': {
        this.leave(p, false);
        const r = this.open(p, false, cleanCfg(m.cfg));
        p.send({ t: 'room', code: r.code });
        return;
      }
      case 'join': {
        const code = normalizeCode(String(m.code));
        const tn = this.tourneys.get(code);
        if (tn) {
          if (tn.started) return p.send({ t: 'err', msg: 'That tournament has already started.' });
          if (tn.live.length >= TOURNEY_MAX) return p.send({ t: 'err', msg: `That tournament is full (${TOURNEY_MAX} players).` });
          if (tn.indexOf(p) >= 0) return;
          this.leave(p, false);
          this.tourneyOf.set(p, tn);
          tn.add(p, m.name);
          return;
        }
        const r = this.rooms.get(code);
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
        if (typeof m.f !== 'number') return;
        if (t) { t.relay(p, m); return; }
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

  private newCode() {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(this.rand() * CODE_LETTERS.length)];
    } while (this.rooms.has(code) || this.tourneys.has(code));
    return code;
  }

  private open(host: Peer, quick: boolean, cfg: MatchCfg): Room {
    const code = this.newCode();
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
    const t = this.tourneyOf.get(p);
    if (t) {
      this.tourneyOf.delete(p);
      if (t.leave(p)) { t.stop(); this.tourneys.delete(t.code); }
    }
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
