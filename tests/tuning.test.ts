import { afterEach, describe, expect, it } from 'vitest';
import { Lockstep } from '../src/net/lockstep';
import { Spectator } from '../src/net/spectator';
import { MOVES, RULES } from '../src/sim/rules';
import { FEEL, GUARD } from '../src/feel';
import { DEFAULTS, KNOBS, applyTuning, changes, clean, copyText, getValue, isTuned, resetTuning, setValue } from '../src/tuning';

afterEach(() => resetTuning());

describe('tuning panel numbers', () => {
  it('every slider points at a real number that starts inside its limits', () => {
    for (const k of KNOBS) {
      const v = getValue(k.key);
      expect(typeof v, k.key).toBe('number');
      expect(v, k.key).toBeGreaterThanOrEqual(k.min);
      expect(v, k.key).toBeLessThanOrEqual(k.max);
    }
  });

  it('changes go straight into the fight and feel tables, and reset puts them back', () => {
    setValue('moves.heavy.wind', 12);
    setValue('rules.missOpen', 10);
    setValue('rules.hitstop.parry', 9);
    setValue('guard.deadZone', 10);
    setValue('feel.shake', 2);
    expect([MOVES.heavy.wind, RULES.missOpen, RULES.hitstop.parry, GUARD.deadZone, FEEL.shake]).toEqual([12, 10, 9, 10, 2]);
    expect(isTuned()).toBe(true);
    resetTuning();
    expect(MOVES.heavy.wind).toBe(DEFAULTS['moves.heavy.wind']);
    expect(changes()).toEqual({});
  });

  it('frames stay whole and values stay inside the slider', () => {
    expect(setValue('moves.light.wind', 6.4)).toBe(6);
    expect(setValue('moves.light.wind', 999)).toBe(40);
    expect(setValue('moves.heavy.lunge', 0.43)).toBe(0.45);
    expect(clean('moves.light.reach', 3)).toBeNull(); // reach has no slider
    expect(clean('moves.light.wind', 'fast')).toBeNull();
  });

  it('a saved set ignores unknown keys and junk', () => {
    applyTuning({ 'moves.light.dmg': 12, 'moves.light.reach': 9, 'rules.parryWindow': 'wide', '__proto__.x': 1 });
    expect(changes()).toEqual({ 'moves.light.dmg': 12 });
    expect(MOVES.light.reach).toBe(1.8);
  });

  it('copies only the changed numbers, game value first', () => {
    expect(copyText()).toMatch(/no changes/);
    setValue('rules.blockStagger', 30);
    expect(copyText('abc123')).toBe("Papercut tuning (build abc123), please make these the game's numbers:\nrules.blockStagger: 34 -> 30");
  });

  it('online fights and watching always run the game numbers, whatever Practice was tuned to', () => {
    setValue('moves.light.dmg', 40);
    setValue('rules.parryWindow', 15);
    new Lockstep(0, 2, () => {});
    expect(MOVES.light.dmg).toBe(DEFAULTS['moves.light.dmg']);
    expect(RULES.parryWindow).toBe(DEFAULTS['rules.parryWindow']);
    setValue('moves.heavy.dmg', 70);
    new Spectator();
    expect(changes()).toEqual({});
  });
});
