// Remappable keys and the controller reader (#32). None of this touches the fight: it only decides which frame buttons are sent.
import { describe, expect, it } from 'vitest';
import { PAD, actionForKey, bindKey, bindPad, defaults, keyName, padName, parse } from '../src/bindings';
import { DOUBLE_TAP_MS, PadReader, type PadSnap } from '../src/pad';

const snap = (opts: { x?: number; y?: number; down?: number[] } = {}): PadSnap => {
  const buttons = Array.from({ length: 17 }, (_, i) => (opts.down ?? []).includes(i));
  return { buttons, axes: [opts.x ?? 0, opts.y ?? 0, 0, 0] };
};

describe('bindings', () => {
  it('defaults match the old controls', () => {
    const b = defaults();
    expect(actionForKey(b, 'Mouse0')).toBe('light');
    expect(actionForKey(b, 'Mouse2')).toBe('heavy');
    expect(actionForKey(b, 'KeyQ')).toBe('feint');
    expect(actionForKey(b, 'KeyA')).toBe('left');
    expect(actionForKey(b, 'ArrowRight')).toBe('right');
    expect(actionForKey(b, 'Space')).toBe('jump');
    expect(actionForKey(b, 'KeyR')).toBe('restart');
    expect(actionForKey(b, 'KeyH')).toBe('hitboxes');
    expect(actionForKey(b, 'KeyT')).toBe('tune');
    expect(b.keys.guardLow).toEqual(['', '']); // unbound by default (Marz's pick)
  });

  it('controller defaults: RB/X light, RT/Y heavy, B feint, A jump, LB dash', () => {
    const b = defaults();
    expect(b.pad.light).toEqual([PAD.RB, PAD.X]);
    expect(b.pad.heavy).toEqual([PAD.RT, PAD.Y]);
    expect(b.pad.feint[0]).toBe(PAD.B);
    expect(b.pad.jump[0]).toBe(PAD.A);
    expect(b.pad.dash[0]).toBe(PAD.LB);
  });

  it('a key moves to its new action and leaves the old one', () => {
    const b = defaults();
    const from = bindKey(b, 'jump', 1, 'KeyQ');
    expect(from).toBe('feint');
    expect(b.keys.jump[1]).toBe('KeyQ');
    expect(b.keys.feint).not.toContain('KeyQ');
    expect(actionForKey(b, 'KeyQ')).toBe('jump');
  });

  it('a controller button moves the same way', () => {
    const b = defaults();
    expect(bindPad(b, 'feint', 1, PAD.LB)).toBe('dash');
    expect(b.pad.dash).not.toContain(PAD.LB);
    expect(b.pad.feint).toEqual([PAD.B, PAD.LB]);
  });

  it('Esc and the d-pad / Menu button cannot be taken', () => {
    const b = defaults();
    expect(bindKey(b, 'light', 0, 'Escape')).toBeNull();
    expect(b.keys.light[0]).toBe('Mouse0');
    bindPad(b, 'light', 0, PAD.Menu);
    expect(b.pad.light[0]).toBe(PAD.RB);
  });

  it('saved bindings survive a reload; broken ones fall back to defaults', () => {
    const b = defaults();
    bindKey(b, 'guardLow', 0, 'ShiftLeft');
    const again = parse(JSON.stringify(b));
    expect(again.keys.guardLow[0]).toBe('ShiftLeft');
    expect(parse('not json')).toEqual(defaults());
    const odd = parse(JSON.stringify({ keys: { light: [42, 'Escape'] }, pad: { jump: [99, 'x'] } }));
    expect(odd.keys.light).toEqual(['', '']);
    expect(odd.pad.jump).toEqual([-1, -1]);
    expect(odd.keys.heavy).toEqual(defaults().keys.heavy);
  });

  it('names read well', () => {
    expect(keyName('KeyQ')).toBe('Q');
    expect(keyName('Mouse2')).toBe('Right click');
    expect(padName(PAD.RT)).toBe('RT');
  });
});

describe('controller reader', () => {
  it('left stick sideways walks, up and down set the guard, and the guard stays after letting go', () => {
    const r = new PadReader(), b = defaults();
    let f = r.update(snap({ x: 0.9 }), 0, b);
    expect(f.right).toBe(true);
    expect(f.low).toBeNull();
    f = r.update(snap({ y: 0.9 }), 16, b);
    expect(f.low).toBe(true);
    expect(f.guardChanged).toBe(true);
    f = r.update(snap(), 32, b); // let go
    expect(f.low).toBe(true);
    expect(f.guardChanged).toBe(false);
    f = r.update(snap({ y: -0.9 }), 48, b);
    expect(f.low).toBe(false);
  });

  it('a fresh push to the same height counts again (so the stick can take the guard back from the mouse)', () => {
    const r = new PadReader(), b = defaults();
    expect(r.update(snap({ y: 0.9 }), 0, b).guardChanged).toBe(true);
    expect(r.update(snap({ y: 0.9 }), 16, b).guardChanged).toBe(false); // still held
    r.update(snap(), 32, b);
    expect(r.update(snap({ y: 0.9 }), 48, b).guardChanged).toBe(true);
  });

  it('walking with the stick a little off level does not flip the guard', () => {
    const r = new PadReader(), b = defaults();
    r.update(snap({ y: -0.9 }), 0, b); // guard high
    const f = r.update(snap({ x: 0.95, y: 0.62 }), 16, b); // forward, slightly down
    expect(f.right).toBe(true);
    expect(f.low).toBe(false);
  });

  it('down-forward walks and guards low', () => {
    const r = new PadReader(), b = defaults();
    const f = r.update(snap({ x: 0.7, y: 0.7 }), 0, b);
    expect(f.right).toBe(true);
    expect(f.low).toBe(true);
  });

  it('the d-pad does the same as the stick', () => {
    const r = new PadReader(), b = defaults();
    let f = r.update(snap({ down: [PAD.Down] }), 0, b);
    expect(f.low).toBe(true);
    f = r.update(snap({ down: [PAD.Left] }), 16, b);
    expect(f.left).toBe(true);
    expect(f.low).toBe(true);
  });

  it('double-tapping a side dashes; a slow second tap does not', () => {
    const r = new PadReader(), b = defaults();
    r.update(snap({ x: -1 }), 0, b);
    r.update(snap(), 60, b);
    expect(r.update(snap({ x: -1 }), 120, b).tapDash).toBe(-1);
    r.update(snap(), 400, b);
    r.update(snap({ x: 1 }), 500, b);
    r.update(snap(), 600, b);
    expect(r.update(snap({ x: 1 }), 500 + DOUBLE_TAP_MS + 10, b).tapDash).toBe(0);
  });

  it('buttons fire once per press, following the bindings', () => {
    const r = new PadReader(), b = defaults();
    expect(r.update(snap({ down: [PAD.RB] }), 0, b).presses).toEqual(['light']);
    expect(r.update(snap({ down: [PAD.RB] }), 16, b).presses).toEqual([]); // still held
    expect(r.update(snap({ down: [PAD.Y, PAD.A] }), 32, b).presses).toEqual(['heavy', 'jump']);
    bindPad(b, 'light', 0, PAD.LT);
    expect(r.update(snap({ down: [PAD.LT] }), 48, b).presses).toEqual(['light']);
  });

  it('menus: the stick steps, A picks, B goes back', () => {
    const r = new PadReader(), b = defaults();
    expect(r.update(snap({ y: 1 }), 0, b).nav).toEqual(['down']);
    expect(r.update(snap({ y: 1 }), 100, b).nav).toEqual([]); // held: waits before repeating
    expect(r.update(snap({ y: 1 }), 500, b).nav).toEqual(['down']);
    r.update(snap(), 520, b);
    expect(r.update(snap({ down: [PAD.A] }), 540, b).nav).toEqual(['ok']);
    expect(r.update(snap({ down: [PAD.B] }), 560, b).nav).toEqual(['back']);
  });
});
