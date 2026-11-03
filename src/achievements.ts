// Steam achievements (#31): the list, and the checks that decide when one is earned.
// Only the desktop app talks to Steam (desktop/steam.cjs); on the website unlock() does nothing.
// The ids here are the "API names" set up on the Steamworks site (docs/steam.md has the click-by-click).
// This file only reads the fight's events and state; it never changes the fight.

import type { FightEvent, State } from './sim/sim';
import { desktop } from './store';

export interface Achievement { id: string; name: string; desc: string }

/** Marz's list (Decision Log, 2026-11-02): a skill learned or a real milestone each, no grinding. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'TUTORIAL_DONE', name: 'First Fold', desc: 'Finish the tutorial.' },
  { id: 'PARRY', name: 'Turned Edge', desc: 'Parry a slash.' },
  { id: 'RIPOSTE', name: 'Answer in Ink', desc: 'Land a riposte after a parry.' },
  { id: 'COUNTER_CUT', name: 'Counter Cut', desc: 'Win a round with a counter cut.' },
  { id: 'ONLINE_WIN', name: 'Signed and Sealed', desc: 'Win an online match.' },
  { id: 'TOURNEY_WIN', name: 'Top of the Stack', desc: 'Win a tournament.' },
  { id: 'DIV_NEWSPRINT', name: 'Newsprint', desc: 'Reach the Newsprint division in Ranked.' },
  { id: 'DIV_CARDSTOCK', name: 'Cardstock', desc: 'Reach the Cardstock division in Ranked.' },
  { id: 'DIV_WASHI', name: 'Washi', desc: 'Reach the Washi division in Ranked.' },
  { id: 'DIV_GOLD_LEAF', name: 'Gold Leaf', desc: 'Reach the Gold Leaf division in Ranked.' },
  { id: 'ENDLESS_10', name: 'Ten Sheets', desc: 'Cut down 10 rivals in one Endless run.' },
  { id: 'ENDLESS_25', name: 'Quarter Ream', desc: 'Cut down 25 rivals in one Endless run.' },
  { id: 'ENDLESS_50', name: 'Half Ream', desc: 'Cut down 50 rivals in one Endless run.' },
];

/** Divisions from lowest to highest (server/rating.ts). Tissue, the first, has no achievement. */
const DIVISIONS = ['Tissue', 'Newsprint', 'Cardstock', 'Washi', 'Gold Leaf'];
const DIV_IDS: Record<string, string> = { Newsprint: 'DIV_NEWSPRINT', Cardstock: 'DIV_CARDSTOCK', Washi: 'DIV_WASHI', 'Gold Leaf': 'DIV_GOLD_LEAF' };
const ENDLESS: [number, string][] = [[10, 'ENDLESS_10'], [25, 'ENDLESS_25'], [50, 'ENDLESS_50']];

/** What one frame's events earn the player in seat `me`. `online`: a real online match (not watching). */
export function fromEvents(s: State, ev: readonly FightEvent[], me: number, online: boolean): string[] {
  const out: string[] = [];
  for (const e of ev) {
    // A parry event names the slash that got parried; the parry belongs to the other fighter.
    if (e.k === 'parry' && e.p !== me) out.push('PARRY');
    else if (e.k === 'hit' && e.p === me && e.atk === 'riposte') out.push('RIPOSTE');
    else if (e.k === 'ko' && e.p === me) {
      if (e.counter) out.push('COUNTER_CUT');
      else if (s.f[me].atk === 'riposte') out.push('RIPOSTE');
    } else if (e.k === 'over' && online && e.winner === me) out.push('ONLINE_WIN');
  }
  return out;
}

/** Reaching a division also counts every one below it (a player can be placed straight into Washi). */
export function forDivision(division: string): string[] {
  const at = DIVISIONS.indexOf(division);
  return DIVISIONS.slice(1, at + 1).map((d) => DIV_IDS[d]);
}

/** Rivals cut down so far in an Endless run. */
export function forEndless(cut: number): string[] {
  return ENDLESS.filter(([n]) => cut >= n).map(([, id]) => id);
}

const sent = new Set<string>();
/** Unlock on Steam (desktop app only). Safe to call every frame: each id is sent once. */
export function unlock(ids: readonly string[]) {
  const steam = desktop?.steam;
  if (!steam) return;
  for (const id of ids) if (!sent.has(id)) { sent.add(id); steam.unlock(id); }
}
