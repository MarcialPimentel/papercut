// Ranked play: who each player is, the queue, and rating changes after a match.
// A player is an anonymous token the browser keeps; the server only stores a hash of it.
// One queue for everyone: it pairs close ratings first and accepts wider gaps the longer people wait,
// because with few players a split queue means long waits. Results come from the server's own
// re-play of the fight (referee.ts), never from what a browser says.

import { createHash } from 'node:crypto';
import { cleanName } from './tourney';
import { START, badge, rate } from './rating';
import type { Player, Store } from './store';
import type { RankInfo, ToClient } from '../src/net/protocol';

export interface RankedPeer {
  send(msg: ToClient): void;
  /** This player's id (a hash of their token), once they said hello. */
  pid?: string;
}

/** Rating gap accepted at once, and how much wider it gets per second of waiting. */
export const GAP_START = 100;
export const GAP_PER_SEC = 25;
/** After this long, anyone waiting is paired with anyone. */
export const ANY_AFTER_MS = 30000;

interface Waiting { peer: RankedPeer; since: number }

export const playerId = (token: string) => createHash('sha256').update('papercut:' + token).digest('hex').slice(0, 32);
/** A token from the browser: 32 hex characters (128 random bits). */
export const tokenOk = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-f]{32}$/.test(t);

export function rankInfo(p: Player): RankInfo {
  return { name: p.name, ...badge(p) };
}

export class Ranked {
  private players = new Map<string, Player>();
  private loading = new Map<string, Promise<Player>>();
  queue: Waiting[] = [];

  constructor(private store: Store, private now: () => number = Date.now) {}

  /**
   * Load (or create) a player, kept in memory while the server runs. If the database can't be read,
   * this fails and remembers nothing: a stand-in fresh player would later be saved over the real rating.
   */
  load(id: string): Promise<Player> {
    const known = this.players.get(id);
    if (known) return Promise.resolve(known);
    let p = this.loading.get(id);
    if (!p) {
      p = this.store.player(id).then(
        (found) => {
          const pl = this.players.get(id) ?? found ?? { id, name: `Ronin ${id.slice(0, 4).toUpperCase()}`, ...START, games: 0, wins: 0 };
          this.players.set(id, pl);
          this.loading.delete(id);
          return pl;
        },
        (e) => {
          console.error('Could not load a player:', e.message);
          this.loading.delete(id);
          throw e;
        },
      );
      this.loading.set(id, p);
    }
    return p;
  }

  /** Rating saves still being written. */
  private saving = new Set<Promise<unknown>>();

  /** Wait for rating saves still being written (the server is about to stop). */
  async flush() { await Promise.allSettled([...this.saving]); }

  /** Say hello: remember who this peer is and tell them their rank. */
  async hello(peer: RankedPeer, token: unknown) {
    if (!tokenOk(token)) return;
    peer.pid = playerId(token);
    const p = await this.load(peer.pid);
    peer.send({ t: 'rank', you: rankInfo(p) });
  }

  /** Join the ranked queue. Returns false if the player hasn't said who they are. */
  async join(peer: RankedPeer, name: unknown): Promise<boolean> {
    if (!peer.pid) return false;
    const p = await this.load(peer.pid);
    p.name = cleanName(name, p.name);
    this.leave(peer);
    this.queue.push({ peer, since: this.now() });
    return true;
  }

  leave(peer: RankedPeer) { this.queue = this.queue.filter((w) => w.peer !== peer); }

  rating(peer: RankedPeer) { return peer.pid ? this.players.get(peer.pid)?.rating ?? START.rating : START.rating; }
  info(peer: RankedPeer): RankInfo | null { const p = peer.pid && this.players.get(peer.pid); return p ? rankInfo(p) : null; }

  /** Pairs to start now: closest ratings first, within what each player's wait allows. */
  match(): [RankedPeer, RankedPeer][] {
    const t = this.now(), gap = (w: Waiting) => (t - w.since >= ANY_AFTER_MS ? Infinity : GAP_START + (GAP_PER_SEC * (t - w.since)) / 1000);
    const pairs: [Waiting, Waiting, number][] = [];
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const a = this.queue[i], b = this.queue[j];
        if (a.peer.pid === b.peer.pid) continue; // the same player in two windows
        const d = Math.abs(this.rating(a.peer) - this.rating(b.peer));
        if (d <= Math.max(gap(a), gap(b))) pairs.push([a, b, d]);
      }
    }
    pairs.sort((x, y) => x[2] - y[2]);
    const used = new Set<Waiting>(), out: [RankedPeer, RankedPeer][] = [];
    for (const [a, b] of pairs) {
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      out.push([a.peer, b.peer]);
    }
    this.queue = this.queue.filter((w) => !used.has(w));
    return out;
  }

  /** A ranked match is decided: update both ratings, save them and tell both players. */
  settle(seats: [RankedPeer, RankedPeer], ids: [string, string], winner: 0 | 1, why: 'match' | 'left') {
    const [a, b] = ids.map((id) => this.players.get(id)) as [Player | undefined, Player | undefined];
    if (!a || !b) return;
    const before = [Math.round(a.rating), Math.round(b.rating)];
    const na = rate(a, b, winner === 0 ? 1 : 0), nb = rate(b, a, winner === 1 ? 1 : 0);
    Object.assign(a, na); Object.assign(b, nb);
    a.games++; b.games++;
    (winner === 0 ? a : b).wins++;
    for (const p of [a, b]) {
      const save = this.store.savePlayer(p).catch((e) => console.error('Could not save a rating:', e.message));
      this.saving.add(save);
      save.finally(() => this.saving.delete(save));
    }
    [a, b].forEach((p, i) => seats[i].send({
      t: 'ranked', won: winner === i, why, delta: Math.round(p.rating) - before[i], you: rankInfo(p),
    }));
  }
}
