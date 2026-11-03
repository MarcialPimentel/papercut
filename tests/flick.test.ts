import { describe, expect, it } from 'vitest';
import { GUARD } from '../src/feel';
import { Flick } from '../src/input';

describe('flick guard', () => {
  it('a short quick move up or down switches the guard', () => {
    const f = new Flick();
    expect(f.move(GUARD.flick, 0)).toBe(true); // down: low
    expect(f.move(-GUARD.flick, 0.01)).toBe(false); // up: high
  });

  it('small moves add up while they keep going the same way', () => {
    const f = new Flick();
    expect(f.move(5, 0)).toBe(null);
    expect(f.move(5, 0.01)).toBe(null);
    expect(f.move(5, 0.02)).toBe(true);
  });

  it('a wobble that changes direction never switches', () => {
    const f = new Flick();
    for (let i = 0; i < 50; i++) expect(f.move(i % 2 ? 6 : -6, i * 0.01)).toBe(null);
  });

  it('slow drift with pauses never switches', () => {
    const f = new Flick();
    for (let i = 0; i < 20; i++) expect(f.move(GUARD.flick - 1, i * (GUARD.flickReset + 0.05))).toBe(null);
  });

  it('sideways movement does nothing', () => {
    expect(new Flick().move(0, 0)).toBe(null);
  });
});
