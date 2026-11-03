// Counts what happens in a fight, for the balance stats (/stats). It only watches: it reads the
// events step() returns and never changes the fight. The rooms server runs it on every online
// match it re-plays, and the browser runs it on Endless runs.

import { RULES } from './rules';
import type { Atk, FightEvent, State } from './sim';

/** What happened to one kind of slash. A slash that clashes is counted under `clash`. */
export interface AtkTally { n: number; land: number; block: number; parried: number; whiff: number; clash: number; feint: number }

export interface SideTally {
  light: AtkTally; heavy: AtkTally; riposte: AtkTally;
  /** Counter cuts landed: on a heavy's wind-up, or after a miss. */
  counterWind: number; counterMiss: number;
  /** The other player's slashes this player blocked or parried. */
  blocks: number; parries: number;
  jumps: number; dashes: number;
  /** Blocked heavies that staggered the rival, and how many of those this player followed with a cut. */
  staggers: number; staggerFollow: number;
}

export interface RoundTally {
  winner: number; // -1 = nobody
  how: string; // 'K.O.' | 'Counter cut' | 'Time' | 'Double K.O.'
  why: '' | 'wind' | 'miss';
  frames: number; // frames of fighting (intro and page turns not counted)
  hp: [number, number]; // health left at the end
}

export interface MatchTally {
  rounds: RoundTally[];
  sides: [SideTally, SideTally];
  /** Who won the match (null: not finished). Endless: always 1, the run is over. */
  winner: number | null;
  clashes: number;
}

const atk = (): AtkTally => ({ n: 0, land: 0, block: 0, parried: 0, whiff: 0, clash: 0, feint: 0 });
const side = (): SideTally => ({
  light: atk(), heavy: atk(), riposte: atk(), counterWind: 0, counterMiss: 0,
  blocks: 0, parries: 0, jumps: 0, dashes: 0, staggers: 0, staggerFollow: 0,
});
export const emptyTally = (): MatchTally => ({ rounds: [], sides: [side(), side()], winner: null, clashes: 0 });

/** Frames after a stagger starts in which a cut still counts as following it up. */
export const FOLLOW_WINDOW = RULES.blockStagger + 20;

export class Tally {
  t = emptyTally();
  private fightFrames = 0;
  private follow: [number, number] = [-1, -1]; // last frame a stagger follow-up still counts

  /** Call after every step() with the state and that frame's events. Returns the finished match on 'over'. */
  feed(s: State, ev: readonly FightEvent[]): MatchTally | null {
    if (s.phase === 'fight') this.fightFrames++;
    let done: MatchTally | null = null;
    for (const e of ev) {
      switch (e.k) {
        case 'swing': this.t.sides[e.p][e.atk].n++; break;
        case 'feint': this.t.sides[e.p].heavy.feint++; break;
        case 'jump': this.t.sides[e.p].jumps++; break;
        case 'dash': this.t.sides[e.p].dashes++; break;
        case 'whiff': this.out(s, e.p).whiff++; break;
        case 'clash': for (const p of [0, 1]) this.out(s, p).clash++; this.t.clashes++; break;
        case 'parry': this.out(s, e.p).parried++; this.t.sides[1 - e.p].parries++; break;
        case 'block':
          this.out(s, e.p).block++; this.t.sides[1 - e.p].blocks++;
          if (e.stagger) { this.t.sides[e.p].staggers++; this.follow[e.p] = s.frame + FOLLOW_WINDOW; }
          break;
        case 'hit': this.landed(s, e.p); break;
        case 'ko':
          if (e.counter) { if (e.why === 'wind') this.t.sides[e.p].counterWind++; else this.t.sides[e.p].counterMiss++; }
          else this.landed(s, e.p);
          break;
        case 'roundEnd':
          this.t.rounds.push({ winner: e.winner, how: e.how, why: s.why, frames: this.fightFrames, hp: [s.f[0].hp, s.f[1].hp] });
          this.fightFrames = 0; this.follow = [-1, -1];
          break;
        case 'over':
          this.t.winner = e.winner;
          done = this.t;
          break;
        case 'restart':
          this.t = emptyTally(); this.fightFrames = 0; this.follow = [-1, -1];
          break;
      }
    }
    return done;
  }

  private out(s: State, p: number): AtkTally { return this.t.sides[p][s.f[p].atk as Atk]; }

  private landed(s: State, p: number) {
    this.out(s, p).land++;
    if (s.frame <= this.follow[p]) { this.t.sides[p].staggerFollow++; this.follow[p] = -1; }
  }
}
