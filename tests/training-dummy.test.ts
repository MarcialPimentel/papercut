import { describe, expect, it } from 'vitest';
import { newMatch, step, type State } from '../src/sim/sim';
import { TrainingDummy, type BotGuard, type BotJump, type BotMove } from '../src/training-dummy';

/** A fight past the intro, the fighters 3 m apart, and a dummy with these bot actions. */
function setup(guard: BotGuard = 'high', jump: BotJump = 'off', move: BotMove = 'stand') {
  const s: State = newMatch();
  while (s.phase !== 'fight') step(s, [0, 0]);
  s.f[0].x = -1.5; s.f[1].x = 1.5;
  return { s, d: new TrainingDummy(1, { guard, jump, move }) };
}
/** Run frames with the player standing still; note what the dummy did. */
function run(s: State, d: TrainingDummy, frames: number) {
  const seen = { states: new Set<string>(), stances: new Set<string>(), maxY: 0, xs: [] as number[] };
  for (let n = 0; n < frames; n++) {
    step(s, [0, d.think(s)]);
    const me = s.f[1];
    seen.states.add(me.state); seen.stances.add(me.stance); seen.maxY = Math.max(seen.maxY, me.y); seen.xs.push(me.x);
  }
  return seen;
}

describe('training dummy', () => {
  it('by default stands still, guards high and never swings', () => {
    const { s, d } = setup();
    const seen = run(s, d, 600);
    expect(s.f[1].x).toBe(1.5);
    expect([...seen.states]).toEqual(['guard']);
    expect([...seen.stances]).toEqual(['high']);
    expect(s.f[0].hp).toBe(s.cfg.maxHp);
  });

  it('holds a low guard', () => {
    const { s, d } = setup('low');
    expect([...run(s, d, 300).stances]).toEqual(['low']);
  });

  it('switches guard with a glint first', () => {
    const { s, d } = setup('switch');
    let glinted = false;
    const stances = new Set<string>();
    for (let n = 0; n < 400; n++) { step(s, [0, d.think(s)]); if (d.tell > 0) glinted = true; stances.add(s.f[1].stance); }
    expect(glinted).toBe(true);
    expect(stances).toEqual(new Set(['high', 'low']));
  });

  it('jumps now and then', () => {
    const { s, d } = setup('high', 'on');
    const seen = run(s, d, 200);
    expect(seen.maxY).toBeGreaterThan(0.3);
    expect(seen.states.has('light') || seen.states.has('heavy')).toBe(false);
  });

  it('walks forward, backward, and back and forth', () => {
    let t = setup('high', 'off', 'forward'); run(t.s, t.d, 30);
    expect(t.s.f[1].x).toBeLessThan(1.5);
    t = setup('high', 'off', 'back'); run(t.s, t.d, 30);
    expect(t.s.f[1].x).toBeGreaterThan(1.5);
    t = setup('high', 'off', 'both');
    const xs = run(t.s, t.d, 120).xs;
    expect(Math.min(...xs)).toBeLessThan(1.5);
    expect(xs[xs.length - 1]).toBeGreaterThan(Math.min(...xs) + 0.5);
  });
});
