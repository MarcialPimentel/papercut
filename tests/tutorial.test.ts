import { describe, expect, it } from 'vitest';
import { BTN, step, type FightEvent, type State } from '../src/sim/sim';
import { HINT_AFTER, STEPS, Tutorial, freshFight } from '../src/tutorial/tutorial';
import { CURSOR_KEYS, MOUSE_KEYS, STEP_TEXT, fill, mouseNames, type InputNames } from '../src/tutorial/text';
import type { StepId } from '../src/tutorial/text';

/** A seeded random, so the tests are the same every run. */
function seeded(seed = 7) {
  let x = seed;
  return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 2 ** 32; };
}

/** What a player does, frame by frame: their buttons, from the fight and the tutorial. */
type Player = (s: State, t: Tutorial, n: number) => number;

/** Play the tutorial from `from` with this player until the step is done (or time runs out). */
function play(from: StepId, player: Player, frames = 1800) {
  const t = new Tutorial(seeded());
  while (t.step !== from) t.skip();
  let s = freshFight();
  const ev: FightEvent[] = [];
  for (let n = 0; n < frames && t.step === from; n++) {
    const e = step(s, [player(s, t, n), t.think(s)]);
    t.after(s, e);
    ev.push(...e);
    if (t.resetDue(s)) s = freshFight();
  }
  return { t, s, ev, done: t.step !== from };
}

const gap = (s: State) => Math.abs(s.f[1].x - s.f[0].x);
const toward = (s: State) => (s.f[1].x > s.f[0].x ? BTN.right : BTN.left);
/** Walk until Sumi is within `d`. */
const close = (s: State, d: number) => (gap(s) > d ? toward(s) : 0);
/** Sumi is guarding low (her blade shows it). */
const herLow = (s: State) => s.f[1].stance === 'low';

describe('tutorial: every step can be done at full speed', () => {
  it('guard: low, then high', () => {
    const r = play('guard', (_s, _t, n) => (n > 20 && n < 40 ? BTN.low : 0));
    expect(r.done).toBe(true);
  });

  it('light: guard low and cut under her high guard', () => {
    let pressed = -99;
    const r = play('light', (s, _t, n) => {
      const g = gap(s) < 2.2;
      if (g && s.f[0].state === 'guard' && n - pressed > 30) { pressed = n; return BTN.low | BTN.light; }
      return BTN.low | close(s, 2.1);
    });
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'hit' && e.p === 0)).toBe(true);
  });

  it('block: match her blade twice', () => {
    const r = play('block', (s) => (herLow(s) ? BTN.low : 0));
    expect(r.done).toBe(true);
    expect(r.ev.filter((e) => e.k === 'block' && e.p === 1).length).toBe(2);
  });

  it('heavy: a blocked heavy staggers her, then a light at the other height lands', () => {
    let pressed = -99;
    const r = play('heavy', (s, t, n) => {
      if (t.part === 1) return (herLow(s) ? 0 : BTN.low) | (s.f[0].state === 'guard' ? BTN.light : 0); // the other height
      if (gap(s) < 2.3 && s.f[0].state === 'guard' && n - pressed > 60) { pressed = n; return BTN.heavy; }
      return close(s, 2.2);
    });
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'block' && e.p === 0 && e.stagger)).toBe(true);
  });

  it('feint: start a heavy and cancel it', () => {
    let pressed = -99;
    const r = play('feint', (s, _t, n) => {
      if (n === pressed + 4) return BTN.feint;
      if (n > 30 && pressed < 0) { pressed = n; return BTN.heavy; }
      return 0;
    });
    expect(r.done).toBe(true);
  });

  it('jump: jump while her low slash glints', () => {
    const r = play('jump', (s, t) => (t.tell === 6 && s.f[0].y === 0 ? BTN.jump : 0));
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'whiff' && e.p === 1 && e.over)).toBe(true);
  });

  it('parry: guard the other height, switch late, then riposte', () => {
    const r = play('parry', (s, t) => {
      const her = s.f[1];
      if (t.part === 1) return (her.stance === 'low' ? BTN.low : 0) | (s.f[0].state === 'guard' ? BTN.light : 0);
      // Wrong height until her step-in, then flick to hers.
      const late = her.state === 'wind' && her.t >= 10;
      const low = late ? her.stance === 'low' : her.stance !== 'low';
      return low ? BTN.low : 0;
    });
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'parry' && e.p === 1)).toBe(true);
    expect(r.ev.some((e) => e.k === 'hit' && e.p === 0 && e.atk === 'riposte')).toBe(true);
  });

  // The window: a light pressed from 4 frames before her wind-up starts to 9 after lands during it.
  for (const at of [3, 1]) {
    it(`counter cut on a wind-up: a light as her glint fades (tell = ${at})`, () => {
      const r = play('wind', (s, t) => (t.tell === at && s.f[0].state === 'guard' ? BTN.light : 0));
      expect(r.done).toBe(true);
      expect(r.ev.some((e) => e.k === 'ko' && e.p === 0 && e.counter && e.why === 'wind')).toBe(true);
    });
  }

  it('counter cut on a miss: a light at the air, and Sumi cuts you for it', () => {
    let pressed = -99;
    const r = play('miss', (s, _t, n) => {
      if (n > 120 && s.f[0].state === 'guard' && n - pressed > 90) { pressed = n; return BTN.light; }
      return 0;
    });
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'ko' && e.p === 1 && e.counter && e.why === 'miss')).toBe(true);
  });

  it('counter cut on a miss: a heavy at the air works too (she steps back from its lunge)', () => {
    let pressed = -99;
    const r = play('miss', (s, _t, n) => {
      if (n > 120 && s.f[0].state === 'guard' && n - pressed > 90) { pressed = n; return BTN.heavy; }
      return 0;
    });
    expect(r.done).toBe(true);
    expect(r.ev.some((e) => e.k === 'ko' && e.p === 1 && e.counter && e.why === 'miss')).toBe(true);
    expect(r.ev.some((e) => e.k === 'hit' && e.p === 0)).toBe(false); // she was never in reach
  });
});

describe('tutorial: flow', () => {
  it('waits: doing nothing never moves a step on, and the hint comes after a few tries', () => {
    for (const id of STEPS) {
      const r = play(id, () => 0, 900);
      expect(r.done, id).toBe(false);
    }
    expect(play('guard', () => 0, 900).t.fails).toBeGreaterThanOrEqual(HINT_AFTER);
  });

  it('failed tries count: heavies that get hit in the parry step', () => {
    const r = play('parry', () => 0, 1200);
    expect(r.t.fails).toBeGreaterThanOrEqual(HINT_AFTER);
  });

  it('nobody runs out of strip outside the counter-cut steps', () => {
    let pressed = -99;
    const r = play('light', (s, _t, n) => {
      if (s.f[0].state === 'guard' && n - pressed > 25) { pressed = n; return BTN.light; } // high: always blocked
      return close(s, 2.1);
    }, 1500);
    expect(r.done).toBe(false);
    expect(r.s.f.every((f) => f.alive)).toBe(true);
  });

  it('skips run through every step to the end', () => {
    const t = new Tutorial(seeded());
    for (const id of STEPS) { expect(t.step).toBe(id); t.skip(); }
    expect(t.finished).toBe(true);
    expect(t.step).toBe(null);
  });

  it('after a K.O. the fight starts fresh', () => {
    const r = play('wind', (s, t) => (t.tell === 2 && s.f[0].state === 'guard' ? BTN.light : 0));
    expect(r.done).toBe(true);
    expect(r.s.f.every((f) => f.alive)).toBe(true);
  });
});

describe('tutorial text', () => {
  it('every step has words, and every {button} has a name', () => {
    for (const id of STEPS) {
      const t = STEP_TEXT[id];
      for (const names of [MOUSE_KEYS, CURSOR_KEYS])
        for (const line of [t.line, t.hint, t.cheer, 'then' in t ? t.then : '']) {
          const out = fill(line ?? '', names);
          expect(out).not.toMatch(/\{\w+\}/);
          expect(out).not.toMatch(/middle|line across/i); // the Line guard trial is gone
        }
    }
  });

  it('guard words follow the guard style: Flick or Cursor', () => {
    expect(mouseNames('flick')).toBe(MOUSE_KEYS);
    expect(mouseNames('cursor')).toBe(CURSOR_KEYS);
    expect(fill(STEP_TEXT.guard.line, MOUSE_KEYS)).toContain('<kbd>flick up</kbd>');
    expect(fill(STEP_TEXT.guard.hint, MOUSE_KEYS)).toMatch(/quick move/);
    expect(fill(STEP_TEXT.guard.line, CURSOR_KEYS)).toContain('crosshair above your waist');
    expect(fill(STEP_TEXT.parry.hint, CURSOR_KEYS)).toMatch(/crosshair to her height/);
    expect(fill(STEP_TEXT.parry.hint, MOUSE_KEYS)).not.toContain('<kbd>'); // tips go in as plain text
  });

  it('another names table (a gamepad) swaps the buttons', () => {
    const pad: InputNames = { ...MOUSE_KEYS, light: 'X', heavy: 'Y' };
    expect(fill(STEP_TEXT.heavy.line, pad)).toContain('<kbd>Y</kbd>');
    expect(fill(STEP_TEXT.light.line, pad)).toContain('<kbd>X</kbd>');
  });
});
