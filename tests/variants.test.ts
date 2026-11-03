// Kami and Sumi share one rig and piece list; paper objects named "kami_..." / "sumi_..." are worn by one only (#37).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PIECE_NAMES, variantOfName, wornBy, type Puppet, type Shape } from '../src/render/puppet';

const shape = (role: string, only?: Shape['only']): Shape => ({ pts: [[0, 0], [1, 0], [0, 1]], role, color: '#fff', z: 0, paper: true, obj: role, only });
function puppet(): Puppet {
  const p = {} as Puppet;
  for (const name of PIECE_NAMES) p[name] = { name, rest: new THREE.Vector2(), shapes: [shape('robe')] };
  p.head.shapes = [shape('skin'), shape('hair', 'kami'), shape('straw', 'sumi')];
  return p;
}

describe('fighter variants (#37)', () => {
  it('reads the tag from the paper object name', () => {
    expect(variantOfName('sumi_hat')).toBe('sumi');
    expect(variantOfName('Kami_sleeve_L')).toBe('kami');
    expect(variantOfName('sleeve_L')).toBeUndefined();
    expect(variantOfName('kamisama')).toBeUndefined();
  });

  it('each fighter wears the shared pieces plus only their own', () => {
    const p = puppet();
    expect(wornBy(p, 'kami').head.shapes.map((s) => s.role)).toEqual(['skin', 'hair']);
    expect(wornBy(p, 'sumi').head.shapes.map((s) => s.role)).toEqual(['skin', 'straw']);
    // Same rig and piece list for both.
    expect(Object.keys(wornBy(p, 'sumi'))).toEqual([...PIECE_NAMES]);
    expect(wornBy(p, 'sumi').torso.shapes).toHaveLength(1);
    // The loaded puppet is shared, so it must not be changed.
    expect(p.head.shapes).toHaveLength(3);
  });

  it('Kami and Sumi each name their variant', async () => {
    (globalThis as { matchMedia?: unknown }).matchMedia ??= () => ({ matches: false });
    const { KAMI, LOOKS, SUMI } = await import('../src/render/common');
    expect(KAMI.variant).toBe('kami');
    expect(SUMI.variant).toBe('sumi');
    expect(LOOKS.map((l) => l.variant)).toEqual(['kami', 'sumi']);
  });
});
