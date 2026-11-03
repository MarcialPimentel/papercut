// The fight's version: a short fingerprint of the rules' source (src/sim). Two players can only fight online
// when theirs match, because both computers must compute exactly the same fight. Unlike the build number,
// it only changes when the rules change, so a docs or art change doesn't lock out an older desktop app.
// Used by the build (vite.config.ts bakes it into the game) and by the rooms server.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function fightVersion(simDir: string): string {
  const h = createHash('sha256');
  for (const name of readdirSync(simDir).filter((n) => n.endsWith('.ts')).sort()) {
    // Line endings differ between a Windows and a Linux checkout; the rules don't.
    h.update(name).update('\0').update(readFileSync(join(simDir, name), 'utf8').replace(/\r\n/g, '\n')).update('\0');
  }
  return h.digest('hex').slice(0, 8);
}
