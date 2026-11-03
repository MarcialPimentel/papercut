// Where finished matches and Endless runs are kept. On the hub: Papercut's database on the shared
// Postgres (DATABASE_URL). Without one (your own PC, tests): in memory, gone on restart.
// No personal data: rules, results, counts, guard styles, and each match's inputs (deleted after 90 days).

import type { MatchTally } from '../src/sim/tally';
import type { GuardStyle, MatchMode, MatchRecord } from './referee';
import type { Rating } from './rating';

export interface EndlessRecord {
  guard: GuardStyle;
  /** Bots cut before the run ended. */
  bots: number;
  /** How the last round ended ('K.O.', 'Counter cut', 'Time') and, for a counter cut, why. */
  how: string;
  why: '' | 'wind' | 'miss';
  tally: MatchTally;
}

/** A ranked player. `id` is a hash of the secret token the browser keeps (the token itself is never stored). */
export interface Player extends Rating { id: string; name: string; games: number; wins: number }

export type RulesFilter = 'standard' | 'custom' | 'all';
export type GuardFilter = 'any' | 'flick' | 'cursor';
export interface Filter { build: string; rules: RulesFilter; guard: GuardFilter }

/** A match as the stats page reads it (no inputs). */
export interface MatchRow { build: string; mode: MatchMode; standard: boolean; guard: [GuardStyle, GuardStyle]; winner: number | null; tally: MatchTally }
export interface EndlessRow { build: string; guard: GuardStyle; bots: number; how: string; why: string; tally: MatchTally }

/** Inputs are kept this long, then dropped (the match summary stays). */
export const KEEP_INPUTS_DAYS = 90;
/** The stats page reads at most this many of the latest matches (and runs). */
export const READ_LIMIT = 20000;

export interface Store {
  readonly kind: 'postgres' | 'memory';
  addMatch(build: string, r: MatchRecord): Promise<void>;
  addEndless(build: string, r: EndlessRecord): Promise<void>;
  matches(f: Filter): Promise<MatchRow[]>;
  endless(f: Filter): Promise<EndlessRow[]>;
  builds(): Promise<string[]>;
  /** Drop inputs older than KEEP_INPUTS_DAYS. */
  prune(): Promise<void>;
  player(id: string): Promise<Player | null>;
  savePlayer(p: Player): Promise<void>;
}

const guardOk = (f: GuardFilter, g: GuardStyle[]) => f === 'any' || g.every((x) => x === f);

export class MemoryStore implements Store {
  readonly kind = 'memory';
  readonly rows: (MatchRow & { at: number; inputs: MatchRecord['inputs'] | null; players?: [string, string] })[] = [];
  readonly runs: (EndlessRow & { at: number })[] = [];
  readonly players = new Map<string, Player>();
  constructor(private now: () => number = Date.now) {}

  async addMatch(build: string, r: MatchRecord) {
    this.rows.push({ build, mode: r.mode, standard: r.standard, guard: r.guard, winner: r.winner, tally: r.tally, at: this.now(), inputs: r.inputs, players: r.players });
  }
  async addEndless(build: string, r: EndlessRecord) { this.runs.push({ build, ...r, at: this.now() }); }
  async matches(f: Filter) {
    return this.rows
      .filter((m) => (!f.build || m.build === f.build) && (f.rules === 'all' || m.standard === (f.rules === 'standard')) && guardOk(f.guard, m.guard))
      .slice(-READ_LIMIT);
  }
  async endless(f: Filter) {
    return this.runs.filter((r) => (!f.build || r.build === f.build) && guardOk(f.guard, [r.guard])).slice(-READ_LIMIT);
  }
  async builds() { return [...new Set([...this.rows, ...this.runs].map((r) => r.build))].reverse(); }
  async player(id: string) { const p = this.players.get(id); return p ? { ...p } : null; }
  async savePlayer(p: Player) { this.players.set(p.id, { ...p }); }
  async prune() {
    const cut = this.now() - KEEP_INPUTS_DAYS * 86400e3;
    for (const r of this.rows) if (r.at < cut) r.inputs = null;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS matches (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  build text NOT NULL,
  mode text NOT NULL,
  standard boolean NOT NULL,
  cfg jsonb NOT NULL,
  guard0 text NOT NULL,
  guard1 text NOT NULL,
  winner smallint,
  tally jsonb NOT NULL,
  start integer NOT NULL,
  inputs jsonb
);
CREATE INDEX IF NOT EXISTS matches_build ON matches (build);
CREATE TABLE IF NOT EXISTS endless_runs (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  build text NOT NULL,
  guard text NOT NULL,
  bots integer NOT NULL,
  how text NOT NULL,
  why text NOT NULL,
  tally jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS endless_build ON endless_runs (build);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player0 text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player1 text;
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  name text NOT NULL,
  rating double precision NOT NULL,
  rd double precision NOT NULL,
  vol double precision NOT NULL,
  games integer NOT NULL,
  wins integer NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
`;

/** Minimal slice of pg's Pool that the store uses (so tests can stand in for it). */
export interface PgLike { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }

export class PgStore implements Store {
  readonly kind = 'postgres';
  private ready: Promise<void> | null = null;
  constructor(private pool: PgLike) {}

  /** Make the tables on first use; if the database is down, try again on the next call. */
  private init() {
    if (!this.ready) this.ready = this.pool.query(SCHEMA).then(() => undefined, (e) => { this.ready = null; throw e; });
    return this.ready;
  }

  async addMatch(build: string, r: MatchRecord) {
    await this.init();
    await this.pool.query(
      'INSERT INTO matches (build, mode, standard, cfg, guard0, guard1, winner, tally, start, inputs, player0, player1) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [build, r.mode, r.standard, JSON.stringify(r.cfg), r.guard[0], r.guard[1], r.winner, JSON.stringify(r.tally), r.start, JSON.stringify(r.inputs),
        r.players?.[0] ?? null, r.players?.[1] ?? null],
    );
  }

  async addEndless(build: string, r: EndlessRecord) {
    await this.init();
    await this.pool.query('INSERT INTO endless_runs (build, guard, bots, how, why, tally) VALUES ($1,$2,$3,$4,$5,$6)',
      [build, r.guard, r.bots, r.how, r.why, JSON.stringify(r.tally)]);
  }

  async matches(f: Filter): Promise<MatchRow[]> {
    await this.init();
    const where: string[] = [], v: unknown[] = [];
    if (f.build) { v.push(f.build); where.push(`build = $${v.length}`); }
    if (f.rules !== 'all') { v.push(f.rules === 'standard'); where.push(`standard = $${v.length}`); }
    if (f.guard !== 'any') { v.push(f.guard); where.push(`guard0 = $${v.length} AND guard1 = $${v.length}`); }
    v.push(READ_LIMIT);
    const { rows } = await this.pool.query(
      `SELECT build, mode, standard, guard0, guard1, winner, tally FROM matches ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $${v.length}`, v);
    return rows.map((r) => ({
      build: r.build as string, mode: r.mode as MatchMode, standard: r.standard as boolean,
      guard: [r.guard0 as GuardStyle, r.guard1 as GuardStyle], winner: r.winner as number | null, tally: r.tally as MatchTally,
    }));
  }

  async endless(f: Filter): Promise<EndlessRow[]> {
    await this.init();
    const where: string[] = [], v: unknown[] = [];
    if (f.build) { v.push(f.build); where.push(`build = $${v.length}`); }
    if (f.guard !== 'any') { v.push(f.guard); where.push(`guard = $${v.length}`); }
    v.push(READ_LIMIT);
    const { rows } = await this.pool.query(
      `SELECT build, guard, bots, how, why, tally FROM endless_runs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $${v.length}`, v);
    return rows as unknown as EndlessRow[];
  }

  async builds() {
    await this.init();
    const { rows } = await this.pool.query(
      `SELECT build, max(at) AS last FROM (SELECT build, at FROM matches UNION ALL SELECT build, at FROM endless_runs) b GROUP BY build ORDER BY last DESC LIMIT 50`);
    return rows.map((r) => r.build as string);
  }

  async player(id: string): Promise<Player | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT id, name, rating, rd, vol, games, wins FROM players WHERE id = $1', [id]);
    return (rows[0] as unknown as Player | undefined) ?? null;
  }

  async savePlayer(p: Player) {
    await this.init();
    await this.pool.query(
      `INSERT INTO players (id, name, rating, rd, vol, games, wins) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET name = $2, rating = $3, rd = $4, vol = $5, games = $6, wins = $7, at = now()`,
      [p.id, p.name, p.rating, p.rd, p.vol, p.games, p.wins]);
  }

  async prune() {
    await this.init();
    await this.pool.query(`UPDATE matches SET inputs = NULL WHERE inputs IS NOT NULL AND at < now() - interval '${KEEP_INPUTS_DAYS} days'`);
  }
}

/** The store for this server: Postgres when DATABASE_URL is set, otherwise memory. */
export async function openStore(url = process.env.DATABASE_URL): Promise<Store> {
  if (!url) return new MemoryStore();
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  pool.on('error', (e) => console.error('Database connection error:', e.message));
  return new PgStore(pool);
}
