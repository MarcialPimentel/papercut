// The database side of /api/health, and getting the database ready before the server opens.

import type { Store } from './store';

/** 'ok': the database answered. 'down': it didn't (in time). 'memory': no database (your own PC). */
export type DbStatus = 'ok' | 'down' | 'memory';

/** Ask the database a trivial question, giving up after `ms`. */
export async function dbStatus(store: Store, ms = 1500): Promise<DbStatus> {
  if (store.kind === 'memory') return 'memory';
  return (await store.ping(ms)) ? 'ok' : 'down';
}

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * Make the database's tables before the server takes players, trying `tries` times. Returns whether it
 * worked. If it never does, the server starts anyway (Practice and the game page still work) and
 * /api/health says `"db":"down"`, which fails the deploy's last check so it shows up red.
 */
export async function prepare(store: Store, tries = 5, waitMs = 2000, wait = sleep): Promise<boolean> {
  for (let i = 1; i <= tries; i++) {
    try { await store.setup(); return true; } catch (e) {
      console.error(`Database not ready (try ${i} of ${tries}):`, (e as Error).message);
      if (i < tries) await wait(waitMs);
    }
  }
  return false;
}
