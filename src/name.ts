// Your player name: typed on the Fighter screen (or in a tournament lobby), shown to rivals online, in Ranked
// and on the leaderboard. Saved like every other setting (store.ts).

import { cleanName } from './net/protocol';
import { desktop, store } from './store';

const NAME_KEY = 'papercut.name';
/** A name for someone who hasn't picked one: their Steam name in the desktop app with Steam open, else like "Ronin 4F2A". */
function roninName() { return cleanName(desktop?.steam?.name, '') || `Ronin ${Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, '0')}`; }
/** Your name: the one you typed (here or in a tournament lobby), or a Ronin name made and saved the first time. */
export function myName(): string {
  const saved = cleanName(store.get(NAME_KEY), '');
  if (saved) return saved;
  const n = roninName();
  store.set(NAME_KEY, n);
  return n;
}
/** Save a typed name (cleaned the way the server cleans it). An empty name becomes a new Ronin name. Returns what was saved. */
export function saveName(typed: string): string {
  const n = cleanName(typed, '') || roninName();
  store.set(NAME_KEY, n);
  return n;
}
