// Pairs players into rooms (1v1 or tournament) and relays their inputs. The server's referee steps
// the same fight alongside the players to read the result and count what happened (see referee.ts).

import { leadOf } from './lead';
import { CODE_LENGTH, CODE_LETTERS, cleanLook, cleanName, delayFor, normalizeCode, type RankInfo, type ToClient, type ToServer } from '../src/net/protocol';
import { DEFAULT_CFG, cleanCfg, type MatchCfg } from '../src/sim/config';
import { Referee, cleanGuard, type GuardStyle, type MatchRecord } from './referee';
import type { Ranked } from './ranked';
import { TOURNEY_MAX, Tourney } from './tourney';

export interface Peer {
  send(msg: ToClient): void;
  /** Latest measured round trip to this player, in ms (undefined until measured). */
  rtt?: number;
  /** The guard style this player's browser uses (it says so in a 'hello'). */
  guard?: GuardStyle;
  /** The player's look code (drawn only, never part of the fight). */
  look?: string;
  /** The name the player picked ('' if none), shown to their rival. */
  name?: string;
  /** The fight version this player's game runs (server/fightVersion.ts). */
  v?: string;
  /** Ranked: this player's id (a hash of their token), once they said hello. */
  pid?: string;
}

/** Told to a player whose game runs different fight rules from the server's. */
export const MISMATCH_MSG = "This copy of Papercut doesn't match the online version. Update it (or reload the page) to fight online. Practice and Endless still work.";
/** Told to a ranked player who stopped sending inputs (tab hidden, game frozen) while their rival kept playing. */
export const STALL_MSG = 'You were away from the ranked fight for too long, so it counts as a loss.';
/** How long a ranked fight may wait on one player while the other keeps playing before it's their loss. */
export const STALL_MS = 10_000;
const PAIRING = new Set(['host', 'join', 'quick', 'tourney', 'ranked']);

interface Room {
  code: string; host: Peer; guest?: Peer; quick: boolean; cfg: MatchCfg; ref?: Referee;
  /** A ranked match: both players' ids, and whether its result has been counted. */
  ranked?: { ids: [string, string]; settled: boolean };
  /** Ranked: the frame the fight was last seen waiting on one seat, and since when (ms). */
  stall?: { seat: 0 | 1 | null; frame: number; since: number };
}

export class Lobby {
  private rooms = new Map<string, Room>();
  private roomOf = new Map<Peer, Room>();
  private waiting: Room | null = null;
  private tourneys = new Map<string, Tourney>();
  private tourneyOf = new Map<Peer, Tourney>();
  private gone = new WeakSet<Peer>();
  /** The server is stopping (a deploy): players dropping out of ranked matches don't lose. */
  private stopping = false;

  /**
   * @param fight the server's fight version. When set, only players on that version can make or join rooms,
   *   so two different rule sets never meet in one fight (they would fall out of sync).
   * @param record called with every finished match, for the stats.
   */
  constructor(
    private rand: () => number = Math.random,
    private later: (fn: () => void, ms: number) => unknown = setTimeout,
    private fight: string | null = null,
    private record: (r: MatchRecord) => void = () => {},
    /** Ranked play (needs the stats database for ratings). */
    private ranked: Ranked | null = null,
    private now: () => number = Date.now,
  ) {}

  /** Pair whoever is waiting for a ranked match, and end stalled ones (the server calls this every second). */
  tick() {
    if (!this.ranked || this.stopping) return;
    this.stalls();
    for (const [a, b] of this.ranked.match()) {
      if (this.gone.has(a as Peer) || this.gone.has(b as Peer)) continue;
      const r = this.open(a as Peer, true, DEFAULT_CFG);
      r.ranked = { ids: [a.pid!, b.pid!], settled: false };
      this.begin(r, b as Peer);
    }
  }

  /**
   * A ranked fight stuck waiting on one player for STALL_MS while the other has kept playing: the
   * silent one loses as if they had left. (Otherwise a losing player could hide the tab and freeze the
   * fight until their rival gave up and took the loss.) A fight waiting on both players isn't judged.
   */
  private stalls() {
    const t = this.now();
    for (const r of [...this.rooms.values()]) {
      if (!r.ranked || r.ranked.settled || !r.guest || !r.ref) continue;
      const seat = r.ref.waitingOn, frame = r.ref.state.frame;
      if (!r.stall || r.stall.seat !== seat || r.stall.frame !== frame) { r.stall = { seat, frame, since: t }; continue; }
      if (seat === null || t - r.stall.since < STALL_MS) continue;
      const silent = seat === 0 ? r.host : r.guest;
      this.settle(r, seat === 0 ? 1 : 0, 'left');
      silent.send({ t: 'err', msg: STALL_MSG });
      this.leave(silent, true);
    }
  }

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
    if (PAIRING.has(m.t) && 'look' in m && m.look !== undefined) p.look = cleanLook(m.look);
    if (PAIRING.has(m.t) && 'name' in m && m.name !== undefined) p.name = cleanName(m.name, '');
    switch (m.t) {
      case 'tourney': {
        this.leave(p, false);
        // Every bracket match must end, so endless rounds aren't allowed in a tournament.
        const cfg = cleanCfg(m.cfg);
        if (cfg.wins === 0) cfg.wins = DEFAULT_CFG.wins;
        const tn = new Tourney(this.newCode(), cfg, this.rand, this.later, this.record);
        this.tourneys.set(tn.code, tn);
        this.tourneyOf.set(p, tn);
        tn.add(p, m.name);
        return;
      }
      case 'hello':
        p.guard = cleanGuard(m.guard);
        this.ranked?.hello(p, m.id).catch(() => {});
        return;
      case 'ranked': {
        this.leave(p, false);
        if (!this.ranked) return p.send({ t: 'err', msg: 'Ranked play is not available on this server.' });
        const ranked = this.ranked;
        ranked.join(p, m.name).then((ok) => {
          if (this.gone.has(p)) { ranked.leave(p); return; }
          if (!ok) { p.send({ t: 'err', msg: 'Ranked needs this browser to remember you. Reload the page and try again.' }); return; }
          p.send({ t: 'waiting', ranked: true });
          this.tick();
        }, () => p.send({ t: 'err', msg: 'Ranked is not available right now. Try again in a moment.' }));
        return;
      }
      case 'name': t?.rename(p, m.name); return;
      case 'begin': t?.begin(p); return;
      case 'restart': t?.restart(p); return;
      case 'result': return; // older games still say who won; the server's own re-play decides
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
        if (!o || !r.ref) return;
        const seat = r.host === p ? 0 : 1;
        // Only what the server's referee accepted reaches the rival, so both always step the same inputs.
        // The input goes out before the referee steps it, so a result it decides never arrives ahead of it.
        if (m.t === 'in') { const b = m.b | 0; if (r.ref.accepts(seat, m.f)) { o.send({ t: 'in', f: m.f, b, a: leadOf(m.a) }); r.ref.input(seat, m.f, b); } }
        else { const h = m.h >>> 0; if (r.ref.hash(seat, m.f, h)) o.send({ t: 'hash', f: m.f, h }); }
        return;
      }
    }
  }

  /** A player disconnected. */
  close(p: Peer) { this.gone.add(p); this.leave(p, true); }

  /** The server is about to stop: unfinished ranked matches end without a result, and no new ones start. */
  shutdown() { this.stopping = true; }

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
    const mode = r.ranked ? 'ranked' : r.quick ? 'quick' : 'room';
    const a = r.ranked && this.ranked?.info(r.host), b = r.ranked && this.ranked?.info(guest);
    const extra = a && b ? { ranks: [a, b] as [RankInfo, RankInfo] } : {};
    const looks: [string, string] = [r.host.look ?? '', guest.look ?? ''];
    // Ranked names come from the ranked record (it fills in a Ronin name); otherwise the names the players sent.
    const names: [string, string] = a && b ? [a.name, b.name] : [r.host.name || 'Kami', guest.name || 'Sumi'];
    const ref = new Referee(mode, r.cfg, delay, [r.host.guard ?? '', guest.guard ?? ''], (rec) => {
      rec.players = r.ranked ? r.ranked.ids : [r.host.pid ?? '', guest.pid ?? ''];
      rec.names = names; rec.looks = looks;
      this.record(rec);
      if (rec.winner === 0 || rec.winner === 1) this.settle(r, rec.winner, 'match');
    });
    r.ref = ref;
    r.host.send({ t: 'start', seat: 0, delay, code: r.code, cfg: r.cfg, looks, names, ...extra });
    guest.send({ t: 'start', seat: 1, delay, code: r.code, cfg: r.cfg, looks, names, ...extra });
  }

  /**
   * Count a ranked result once. The winner is the server's own re-play of the fight; a browser whose
   * fingerprints disagreed with it (a modified game) loses, and if both disagreed nothing is counted.
   */
  private settle(r: Room, winner: 0 | 1, why: 'match' | 'left') {
    if (!r.ranked || r.ranked.settled || !r.guest || !this.ranked) return;
    r.ranked.settled = true;
    const bad = r.ref?.bad ?? [false, false];
    if (bad[0] && bad[1]) return;
    const w: 0 | 1 = bad[winner] ? (winner === 0 ? 1 : 0) : winner;
    this.ranked.settle([r.host, r.guest], r.ranked.ids, w, why);
  }

  private leave(p: Peer, tell: boolean) {
    this.ranked?.leave(p);
    const t = this.tourneyOf.get(p);
    if (t) {
      this.tourneyOf.delete(p);
      if (t.leave(p)) { t.close(); this.tourneys.delete(t.code); }
    }
    const r = this.roomOf.get(p);
    if (!r) return;
    const o = r.host === p ? r.guest : r.host;
    // Leaving a ranked match before it's decided is a loss, unless the server itself is stopping.
    if (r.ranked && r.guest && !r.ranked.settled && !this.stopping) this.settle(r, r.host === p ? 1 : 0, 'left');
    r.ref?.close();
    this.roomOf.delete(p);
    if (o) this.roomOf.delete(o);
    this.rooms.delete(r.code);
    if (this.waiting === r) this.waiting = null;
    if (o && tell) o.send({ t: 'gone' });
  }
}
