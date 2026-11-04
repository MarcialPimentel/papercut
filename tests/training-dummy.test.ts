import { describe, expect, it } from 'vitest';
import { BTN, newMatch, step, type FightEvent, type State } from '../src/sim/sim';
import { MOVES } from '../src/sim/rules';
import { TRAINING_CFG } from '../src/sim/config';
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

describe('training: no rounds', () => {
  /** Training rules past the intro, the fighters close; seat 0 can be cut by setting its strip low. */
  function training() {
    const s = newMatch(TRAINING_CFG);
    while (s.phase !== 'fight') step(s, [0, 0]);
    s.f[0].x = -0.6; s.f[1].x = 0.6;
    return s;
  }
  /** Step until the fight is on again after a K.O.; returns every event on the way. */
  function untilNextFight(s: State) {
    const ev: FightEvent[] = [];
    for (let n = 0; n < 2000 && !(s.phase === 'fight' && ev.some((e) => e.k === 'spawn')); n++) ev.push(...step(s, [0, 0]));
    return ev;
  }

  it('a fresh dummy steps in after you cut it, with no page turn or match end', () => {
    const s = training();
    s.f[1].hp = 1;
    for (let n = 0; n < MOVES.light.wind + 2; n++) step(s, [BTN.low | (n === 0 ? BTN.light : 0), 0]);
    expect(s.phase).toBe('ko');
    const ev = untilNextFight(s);
    expect(ev.map((e) => e.k)).toContain('spawn');
    expect(ev.map((e) => e.k)).not.toContain('turn');
    expect(ev.map((e) => e.k)).not.toContain('over');
    expect(s.phase).toBe('fight');
    expect(s.f[0].wins).toBe(1);
    expect(s.f[1].alive).toBe(true);
    expect(s.f[1].hp).toBe(TRAINING_CFG.maxHp);
  });

  it('if you go down, the dummy comes back too and you are back to full', () => {
    const s = training();
    s.f[0].hp = 1;
    for (let n = 0; n < MOVES.light.wind + 2; n++) step(s, [0, BTN.low | (n === 0 ? BTN.light : 0)]);
    expect(s.phase).toBe('ko');
    untilNextFight(s);
    expect(s.phase).toBe('fight');
    expect(s.f[0].alive && s.f[1].alive).toBe(true);
    expect(s.f[0].hp).toBe(TRAINING_CFG.maxHp);
  });

  it('has no timer', () => {
    const s = training();
    for (let n = 0; n < 90 * 60; n++) step(s, [0, 0]);
    expect(s.phase).toBe('fight');
  });
});
