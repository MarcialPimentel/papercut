import { describe, expect, it } from 'vitest';
import { dbStatus, prepare } from '../server/health';
import { MemoryStore, PgStore, type PgLike, type Store } from '../server/store';

/** A stand-in database: `answer` decides what each query does. */
const pool = (answer: (sql: string) => Promise<unknown>): PgLike => ({
  query: (sql: string) => answer(sql).then(() => ({ rows: [] })),
});

describe('/api/health: the database', () => {
  it('reports ok when the database answers', async () => {
    expect(await dbStatus(new PgStore(pool(async () => {})))).toBe('ok');
  });

  it('reports down when the database errors', async () => {
    expect(await dbStatus(new PgStore(pool(() => Promise.reject(new Error('connection refused')))))).toBe('down');
  });

  it("reports down quickly when the database hangs, instead of hanging the health check", async () => {
    const t = Date.now();
    expect(await dbStatus(new PgStore(pool(() => new Promise(() => {}))), 50)).toBe('down');
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it('reports memory with no database (your own PC)', async () => {
    expect(await dbStatus(new MemoryStore())).toBe('memory');
  });
});

describe('getting the database ready before opening', () => {
  it('keeps trying while the database starts up', async () => {
    let calls = 0;
    const waits: number[] = [];
    const store = { kind: 'postgres', setup: async () => { if (++calls < 3) throw new Error('starting up'); } } as unknown as Store;
    expect(await prepare(store, 5, 100, async (ms) => { waits.push(ms); })).toBe(true);
    expect(calls).toBe(3);
    expect(waits).toEqual([100, 100]);
  });

  it('gives up after a few tries (the server still opens, and health says down)', async () => {
    let calls = 0;
    const store = { kind: 'postgres', setup: async () => { calls++; throw new Error('down'); } } as unknown as Store;
    expect(await prepare(store, 4, 0, async () => {})).toBe(false);
    expect(calls).toBe(4);
  });

  it('makes the tables once, then health checks only ask a trivial question', async () => {
    const asked: string[] = [];
    const st = new PgStore(pool(async (sql) => { asked.push(sql.trim().slice(0, 20)); }));
    expect(await prepare(st)).toBe(true);
    await st.ping(100);
    await st.ping(100);
    expect(asked.filter((q) => q.startsWith('CREATE'))).toHaveLength(1);
    expect(asked.filter((q) => q === 'SELECT 1')).toHaveLength(2);
  });
});
