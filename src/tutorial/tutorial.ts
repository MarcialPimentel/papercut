// The interactive tutorial: a guided fight against a scripted Sumi, one step at a time.
// Each step waits until the player has done the move; the fight's own events (block, parry, counter cut…)
// tell us when. Sumi presses buttons like any player, so the fight rules are the real ones, at full speed.
// Offline only, so it may use randomness. Strips refill so nobody loses; a K.O. (the counter-cut steps)
// plays out, then the fight starts fresh.
// The words live in text.ts.

import { BTN, newMatch, type FightEvent, type State } from '../sim/sim';
import { RULES } from '../sim/rules';
import type { MatchCfg } from '../sim/config';
import type { StepId } from './text';

export const STEPS: StepId[] = ['guard', 'light', 'block', 'heavy', 'feint', 'jump', 'parry', 'wind', 'miss'];

/** No timer, rounds never end the match. */
export const TUTORIAL_CFG: MatchCfg = { wins: 0, maxHp: 80, roundSecs: 0, gauntlet: false };

/** A fresh fight, already past the "Round 1 … Cut!" intro, with the fighters a few steps apart. */
export function freshFight(): State {
  const s = newMatch(TUTORIAL_CFG);
  s.phase = 'fight'; s.phaseT = 0;
  s.f[0].x = -1.5; s.f[1].x = 1.5;
  s.f[0].stance = 'high'; s.f[1].stance = 'high';
  return s;
}

/** How far (centre to centre) Sumi keeps from you in each step. A light reaches 2.25, a heavy 2.65. */
const GAP: Record<StepId, number> = {
  guard: 3.0, light: 2.0, block: 2.0, heavy: 2.0, feint: 2.9, jump: 2.0, parry: 2.2, wind: 2.0, miss: 2.33,
};
/** Steps where Sumi glints, then swings. */
const BEAT: Partial<Record<StepId, 'light' | 'heavy'>> = { block: 'light', jump: 'light', parry: 'heavy', wind: 'heavy' };
/** Frames the "Nice!" line shows before the next step. A K.O. step waits for the K.O. to play out. */
const CHEER = 100, CHEER_KO = 150;
/** A K.O. in the tutorial plays this long, then the fight starts fresh. */
export const KO_RESET = 150;
/** Failed tries before the hint shows. */
export const HINT_AFTER = 3;

export class Tutorial {
  /** Index into STEPS; STEPS.length = finished. */
  i = 0;
  /** Second part of a step (heavy: the follow-up light; parry: the riposte). */
  part = 0;
  /** Frames left to do the second part. */
  private partLeft = 0;
  /** Progress inside a step (blocks made, guard heights tried). */
  got = 0;
  fails = 0;
  /** Frames left on "Nice!"; the next step starts when it runs out. */
  cheer = 0;
  /** Sumi's glint: frames left before she swings (0 = none showing). */
  tell = 0;
  readonly tellFrames = 30;
  private beat = 70;
  private low = false;
  private sawLow = false;
  private punished = false;
  private idle = 0;

  constructor(private rand: () => number = Math.random) {}

  get step(): StepId | null { return STEPS[this.i] ?? null; }
  get finished() { return this.i >= STEPS.length; }
  /** How many of something this step needs (shown as "1 of 2"). */
  get need() { return this.step === 'block' ? 2 : 0; }

  /** Move on without doing the step. */
  skip() { this.next(); }

  /** The fight should start fresh (a K.O. has played out). */
  resetDue(s: State) { return s.phase === 'ko' && s.phaseT >= KO_RESET; }

  private next() {
    this.i++; this.part = 0; this.partLeft = 0; this.got = 0; this.fails = 0; this.cheer = 0;
    this.tell = 0; this.beat = 70; this.sawLow = false; this.punished = false; this.idle = 0;
    this.low = this.step === 'jump'; // jump: she slashes low
  }

  private done(ko = false) { this.cheer = ko ? CHEER_KO : CHEER; this.tell = 0; this.part = 0; }

  /** Sumi's buttons for the next frame. */
  think(s: State): number {
    const id = this.step, me = s.f[1], you = s.f[0];
    if (!id || s.phase !== 'fight' || !me.alive || !you.alive) { this.tell = 0; return this.low ? BTN.low : 0; }
    // Heavy step: she guards wherever you guard, so your heavy is always blocked (and staggers her).
    // Once staggered she stays at that height, so a light at the other height lands.
    if (id === 'heavy' && this.part === 0 && you.state === 'guard') this.low = you.stance === 'low';
    let b = 0;
    const dx = Math.abs(you.x - me.x), toward = you.x > me.x ? BTN.right : BTN.left, away = toward === BTN.right ? BTN.left : BTN.right;
    const free = me.state === 'guard' && me.y <= 0 && s.hitstop === 0;
    if (id === 'miss') b |= this.dodge(s, dx, toward, away);
    else if (free && this.cheer === 0) {
      const want = GAP[id];
      if (dx > want + 0.08) b |= toward;
      else if (dx < want - 0.08 && Math.abs(me.x) < RULES.edge - 0.3) b |= away;
    }
    const swing = BEAT[id];
    if (swing && this.cheer === 0 && this.part === 0) b |= this.onBeat(s, dx, free, swing);
    else this.tell = 0;
    return b | (this.low ? BTN.low : 0);
  }

  /** Glint, then swing. Returns the press when the glint runs out. */
  private onBeat(s: State, dx: number, free: boolean, swing: 'light' | 'heavy'): number {
    const id = this.step!;
    if (!free || Math.abs(dx - GAP[id]) > 0.3) {
      // Knocked out of it (hit, staggered) or out of place: start the count again.
      if (this.beat < this.tellFrames + 20) this.beat = this.tellFrames + 20;
      this.tell = 0;
      return 0;
    }
    this.beat--;
    if (this.beat === this.tellFrames && (id === 'block' || id === 'parry')) this.low = this.rand() < 0.5; // where she'll swing
    this.tell = this.beat <= this.tellFrames ? Math.max(1, this.beat) : 0;
    if (this.beat > 0) return 0;
    this.beat = 80 + Math.floor(this.rand() * 50);
    this.tell = 0;
    return swing === 'light' ? BTN.light : BTN.heavy;
  }

  /** The miss step: stay just out of your reach, and cut you the moment you miss. */
  private dodge(s: State, dx: number, toward: number, away: number): number {
    const me = s.f[1], you = s.f[0];
    if (me.state !== 'guard' || me.y > 0 || s.hitstop > 0 || this.cheer > 0) return 0;
    // You missed, and she can still get there while you're open.
    const missed = you.whiffed && (you.state === 'active' || (you.state === 'recover' && you.t < RULES.missOpen - 1));
    if (missed && !this.punished) {
      // Close in until the light reaches (2.25), then cut.
      if (dx > 2.23) return toward;
      this.punished = true;
      return BTN.light;
    }
    if (!missed) this.punished = false;
    // Your heavy steps in 0.4: back off far enough that it misses.
    const want = you.state === 'wind' && you.atk === 'heavy' ? 2.78 : GAP.miss;
    if (dx < want - 0.06 && Math.abs(me.x) < RULES.edge - 0.3) return away;
    if (dx > want + 0.06 && you.state === 'guard') return toward;
    return 0;
  }

  /** Read what happened this frame. Call after every step of the fight. */
  after(s: State, ev: FightEvent[]) {
    // Nobody runs out of strip in the tutorial.
    if (s.phase === 'fight') for (const f of s.f) if (f.alive && f.hp < s.cfg.maxHp / 2) f.hp = s.cfg.maxHp;
    if (this.finished) return;
    if (this.cheer > 0) { if (--this.cheer === 0) this.next(); return; }
    const you = s.f[0];
    const mine = (k: FightEvent['k']) => ev.find((e) => e.k === k && 'p' in e && e.p === 0);
    const hers = (k: FightEvent['k']) => ev.find((e) => e.k === k && 'p' in e && e.p === 1);
    const fail = () => { this.fails++; };
    // A K.O. outside the counter-cut steps (say, you wound up a heavy into hers): a try that went wrong.
    if (this.step !== 'wind' && this.step !== 'miss' && (mine('ko') || hers('ko'))) { fail(); return; }
    switch (this.step) {
      case 'guard':
        if (you.stance === 'low') this.sawLow = true;
        else if (this.sawLow) { this.got = 2; this.done(); break; }
        this.got = this.sawLow ? 1 : 0;
        if (++this.idle % 200 === 0) fail(); // every 3 seconds without trying both: show the hint
        break;
      case 'light':
        if (mine('hit')) this.done();
        else if (mine('block') || mine('whiff')) fail();
        break;
      case 'block':
        if (hers('block') || hers('parry')) { if (++this.got >= 2) this.done(); }
        else if (hers('hit') || hers('whiff')) fail();
        break;
      case 'heavy':
        if (this.part === 0) {
          const b = mine('block');
          if (b && b.k === 'block' && b.stagger) { this.part = 1; this.partLeft = RULES.blockStagger + 30; }
          else if (mine('whiff') || mine('hit')) fail();
        } else if (mine('hit')) this.done();
        else if (--this.partLeft <= 0 || mine('whiff') || mine('block')) { this.part = 0; fail(); }
        break;
      case 'feint':
        if (mine('feint')) this.done();
        else if (mine('whiff') || mine('block') || mine('hit')) fail(); // the heavy came out
        break;
      case 'jump': {
        const w = hers('whiff');
        if (w && w.k === 'whiff' && w.over) this.done();
        else if (hers('hit') || hers('block') || hers('parry')) fail();
        break;
      }
      case 'parry':
        if (this.part === 0) {
          if (hers('parry')) { this.part = 1; this.partLeft = RULES.riposteWindow + 20; }
          else if (hers('hit') || hers('block')) fail();
        } else {
          const h = mine('hit');
          if (h && h.k === 'hit' && h.atk === 'riposte') this.done();
          else if (--this.partLeft <= 0 || mine('whiff') || mine('block')) { this.part = 0; fail(); }
        }
        break;
      case 'wind': {
        const ko = mine('ko');
        if (ko && ko.k === 'ko' && ko.counter) this.done(true);
        else if (hers('ko') || hers('hit') || hers('block') || hers('parry') || mine('hit') || mine('block')) fail();
        break;
      }
      case 'miss': {
        const ko = hers('ko');
        if (ko && ko.k === 'ko' && ko.counter) this.done(true);
        else if (mine('ko') || mine('hit') || mine('block')) fail();
        break;
      }
    }
  }
}
