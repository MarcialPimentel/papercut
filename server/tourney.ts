// A tournament room: 3 to 8 players, a single-elimination bracket, one fight at a time.
// The two fighters play an ordinary online match; everyone else in the room gets both players'
// inputs and watches it live. The fighters report the winner; when they agree, the bracket moves on.

import { BYE_SLOT, delayFor, type BracketMatch, type ToClient } from '../src/net/protocol';
import type { MatchCfg } from '../src/sim/config';

export interface TPeer {
  send(msg: ToClient): void;
  rtt?: number;
}

interface Player { peer: TPeer; name: string; gone: boolean }
interface Match extends BracketMatch { reports: [number | null, number | null] }

export const TOURNEY_MIN = 3;
export const TOURNEY_MAX = 8;
/** A free pass to the next round. */
export const BYE = BYE_SLOT;
/** Seconds between a fight's end and the next fight (time to look at the bracket). */
export const BREAK_MS = 6000;

/** A player's name: printable, short, never empty. */
export function cleanName(x: unknown, fallback: string) {
  const s = typeof x === 'string' ? x.replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 14) : '';
  return s || fallback;
}

export class Tourney {
  players: Player[] = [];
  rounds: Match[][] = [];
  started = false;
  /** The fight on stage: [round, match]. */
  current: [number, number] | null = null;
  champion: number | null = null;
  private timer: unknown = null;

  constructor(
    readonly code: string,
    readonly cfg: MatchCfg,
    private rand: () => number,
    private later: (fn: () => void, ms: number) => unknown = setTimeout,
  ) {}

  get host() { return this.players.find((p) => !p.gone); }
  get live() { return this.players.filter((p) => !p.gone); }
  indexOf(peer: TPeer) { return this.players.findIndex((p) => p.peer === peer && !p.gone); }

  add(peer: TPeer, name: unknown) {
    this.players.push({ peer, name: cleanName(name, `Player ${this.players.length + 1}`), gone: false });
    this.sendLobby();
  }

  rename(peer: TPeer, name: unknown) {
    const i = this.indexOf(peer);
    if (i < 0 || this.started) return;
    this.players[i].name = cleanName(name, this.players[i].name);
    this.sendLobby();
  }

  /** The host starts the bracket. */
  begin(peer: TPeer) {
    if (this.started || this.host?.peer !== peer || this.live.length < TOURNEY_MIN) return;
    this.started = true;
    // Shuffle the seats, then pair them up; empty spots in a 4 or 8 bracket are byes.
    const order = this.players.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const size = order.length <= 4 ? 4 : 8;
    let byes = size - order.length, k = 0;
    const first: Match[] = [];
    for (let m = 0; m < size / 2; m++) {
      const a = order[k++];
      const b = byes > 0 ? (byes--, BYE) : order[k++];
      first.push(newMatch(a, b));
    }
    this.rounds = [first];
    for (let n = size / 4; n >= 1; n /= 2) this.rounds.push(Array.from({ length: n }, () => newMatch(null, null)));
    this.next();
  }

  /** The host can deal a new bracket: once started, between fights, with enough players still here. */
  canRestart(peer: TPeer) {
    return this.started && !this.current && this.host?.peer === peer && this.live.length >= TOURNEY_MIN;
  }

  /** A new bracket with the same players (anyone who left is dropped), seats shuffled again. */
  restart(peer: TPeer) {
    if (!this.canRestart(peer)) return;
    this.stop(); // the break timer would start a fight from the old bracket
    this.players = this.live;
    this.rounds = []; this.champion = null; this.started = false;
    this.begin(peer);
  }

  /** A fighter in the current fight says who won. */
  report(peer: TPeer, winner: unknown) {
    if (!this.current || (winner !== 0 && winner !== 1)) return;
    const m = this.match(this.current);
    const seat: number = m.a !== null && this.players[m.a].peer === peer ? 0 : m.b !== null && m.b >= 0 && this.players[m.b].peer === peer ? 1 : -1;
    if (seat !== 0 && seat !== 1) return;
    m.reports[seat] = winner;
    const [x, y] = m.reports;
    if (x === null || y === null) return;
    if (x === y) this.finish(x === 0 ? m.a! : m.b!, false);
    else { m.reports = [null, null]; this.startMatch(); } // the two games disagree: fight it again
  }

  /** The two fighters of the current fight, as [seat 0 player, seat 1 player]. */
  fighters(): [Player, Player] | null {
    if (!this.current) return null;
    const m = this.match(this.current);
    return [this.players[m.a!], this.players[m.b!]];
  }

  /** Pass a fighter's message along: inputs go to the rival and to everyone watching, hashes only to the rival. */
  relay(peer: TPeer, msg: { t: 'in' | 'hash'; f: number; b?: number; h?: number }) {
    const fs = this.fighters();
    if (!fs) return;
    const seat = fs[0].peer === peer ? 0 : fs[1].peer === peer ? 1 : -1;
    if (seat === -1) return;
    const rival = fs[1 - seat];
    if (msg.t === 'hash') { if (!rival.gone) rival.peer.send({ t: 'hash', f: msg.f, h: (msg.h ?? 0) >>> 0 }); return; }
    const b = (msg.b ?? 0) | 0;
    if (!rival.gone) rival.peer.send({ t: 'in', f: msg.f, b });
    for (const p of this.live) if (p !== fs[0] && p !== fs[1]) p.peer.send({ t: 'in', f: msg.f, b, s: seat });
  }

  /** A player left (or lost their connection). Returns true when the room is empty and can be deleted. */
  leave(peer: TPeer): boolean {
    const i = this.indexOf(peer);
    if (i < 0) return this.live.length === 0;
    if (!this.started) {
      this.players.splice(i, 1);
      this.sendLobby();
      return this.players.length === 0;
    }
    this.players[i].gone = true;
    if (this.current) {
      const m = this.match(this.current);
      if (m.a === i || m.b === i) this.finish(m.a === i ? m.b! : m.a!, true);
    }
    if (!this.live.length) { this.stop(); return true; }
    this.sendBracket();
    return false;
  }

  stop() { if (this.timer !== null) clearTimeout(this.timer as ReturnType<typeof setTimeout>); this.timer = null; }

  private match([r, i]: [number, number]) { return this.rounds[r][i]; }

  private finish(winner: number, forfeit: boolean) {
    const [r, i] = this.current!;
    const m = this.rounds[r][i];
    m.winner = winner; m.forfeit = forfeit;
    this.current = null;
    this.advance(r, i);
    this.sendBracket();
    this.stop();
    this.timer = this.later(() => { this.timer = null; this.next(); }, BREAK_MS);
  }

  /** Put a match's winner into the next round. */
  private advance(r: number, i: number) {
    const w = this.rounds[r][i].winner;
    if (r + 1 >= this.rounds.length) { this.champion = w; return; }
    const nm = this.rounds[r + 1][i >> 1];
    if (i % 2 === 0) nm.a = w; else nm.b = w;
  }

  /** Settle byes and walkovers, then start the next real fight (or crown the champion). */
  next(): void {
    if (this.current || this.champion !== null) return;
    for (let r = 0; r < this.rounds.length; r++) {
      for (let i = 0; i < this.rounds[r].length; i++) {
        const m = this.rounds[r][i];
        if (m.winner !== null || m.a === null || m.b === null) continue;
        const gone = (p: number) => p === BYE || this.players[p].gone;
        if (gone(m.a) || gone(m.b)) {
          // A bye or a player who left: the other one goes through without a fight.
          m.winner = gone(m.a) && !gone(m.b) ? m.b : m.a;
          m.forfeit = m.b !== BYE && m.a !== BYE;
          this.advance(r, i);
          return this.next();
        }
        this.current = [r, i];
        this.startMatch();
        return;
      }
    }
    this.sendBracket();
  }

  private startMatch() {
    const fs = this.fighters()!;
    const delay = delayFor(fs[0].peer.rtt ?? 80, fs[1].peer.rtt ?? 80);
    const names: [string, string] = [fs[0].name, fs[1].name];
    this.sendBracket();
    for (const p of this.live) {
      const seat = p === fs[0] ? 0 : p === fs[1] ? 1 : -1;
      p.peer.send({ t: 'match', seat, delay, cfg: this.cfg, names, code: this.code });
    }
  }

  private sendLobby() {
    const names = this.live.map((p) => p.name);
    this.live.forEach((p, you) => p.peer.send({ t: 'lobby', code: this.code, names, you, host: you === 0, cfg: this.cfg }));
  }

  sendBracket() {
    const names = this.players.map((p) => p.name + (p.gone ? ' (left)' : ''));
    const rounds = this.rounds.map((r) => r.map(({ a, b, winner, forfeit }) => ({ a, b, winner, forfeit })));
    for (const p of this.live) {
      p.peer.send({ t: 'bracket', names, rounds, current: this.current, champion: this.champion, you: this.players.indexOf(p), restart: this.canRestart(p.peer) });
    }
  }
}

function newMatch(a: number | null, b: number | null): Match {
  return { a, b, winner: null, forfeit: false, reports: [null, null] };
}
