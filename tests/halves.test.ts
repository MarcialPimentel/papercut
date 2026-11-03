// K.O. halves land on the paper you see (#36): the physics floor follows the drawn page, halves start above it
// and inside the walls.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PaperPhysics, loadRapier } from '../src/render/physics';
import { FLOOR_LIFT, WALL_X, pageY, spawnNudge } from '../src/render/page';

type XYZ = { x: number; y: number; z: number };
type Posed = { translation(): XYZ; rotation(): XYZ & { w: number } };

/** A flat card like a fallen half: 1.6 x 1.0, 0.04 thick, as hull points. */
function card(w = 1.6, h = 1.0, d = 0.04) {
  const pts: number[] = [];
  for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) for (const z of [-d / 2, d / 2]) pts.push(x, y, z);
  return new Float32Array(pts);
}
/** How far the body's deepest hull point is under the drawn paper (negative: it's above the paper). */
function under(pts: Float32Array, b: Posed) {
  const t = b.translation(), r = b.rotation(), q = new THREE.Quaternion(r.x, r.y, r.z, r.w), v = new THREE.Vector3();
  let most = -Infinity;
  for (let i = 0; i < pts.length; i += 3) { v.set(pts[i], pts[i + 1], pts[i + 2]).applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z)); most = Math.max(most, pageY(v.x) - v.y); }
  return most;
}
async function world() {
  await loadRapier();
  const p = new PaperPhysics();
  await Promise.resolve();
  expect(p.ready).toBe(true);
  return p;
}
const settle = (p: PaperPhysics, s = 4) => { for (let i = 0; i < s * 60; i++) p.step(1 / 60); };

describe('K.O. halves (#36)', () => {
  it('the physics floor is the drawn page, lifted a hair', async () => {
    const p = await world(), pts = new Float32Array([-0.01, 0, -0.01, 0.01, 0, -0.01, -0.01, 0, 0.01, 0.01, 0, 0.01, 0, 0.01, 0]);
    // Drop a tiny probe at many x and z and check where it stops.
    for (let i = 0; i <= 64; i++) {
      const x = -8.2 + (16.4 * i) / 64;
      const b = p.addHalf(pts, new THREE.Vector3(x, 0.3, i % 2 ? -0.5 : 0.5), new THREE.Quaternion(), new THREE.Vector3(0, -1, 0), new THREE.Vector3())!;
      expect(b.lockRotations !== undefined).toBe(true);
      b.lockRotations(true, true); b.setLinearDamping(5);
      settle(p, 2);
      expect(b.translation().y, `floor at x=${x.toFixed(2)}`).toBeCloseTo(pageY(b.translation().x) + FLOOR_LIFT, 2);
      p.remove(b);
    }
  });

  it('a half rests on the paper everywhere: in the spine, mid-page and at the outer edges', async () => {
    const p = await world(), pts = card();
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (const x of [-7.4, -4, -1, 0, 0.6, 3, 7.4]) {
      const b = p.addHalf(pts, new THREE.Vector3(x, 1.2, 0), flat, new THREE.Vector3(0, -2, 0), new THREE.Vector3(0.4, 0, 0.2))!;
      settle(p);
      // No corner under the drawn paper (that's the flicker / stuck-in-floor bug), and resting on it, not floating.
      const d = under(pts, b);
      expect(d, `half at x=${x}`).toBeLessThan(0);
      expect(d, `half at x=${x}`).toBeGreaterThan(-0.02);
      p.remove(b);
    }
  });

  it('a half that would start inside the page or past a wall is moved out first', () => {
    // A leg half whose rim dips below the paper at x = 5.
    const a = spawnNudge(4.5, 5.5, -0.04);
    expect(a.dx).toBe(0);
    expect(-0.04 + a.dy).toBeGreaterThan(pageY(5.5) + FLOOR_LIFT);
    // A top half at the page edge reaching past the side wall.
    const b = spawnNudge(7.2, 8.9, 1);
    expect(8.9 + b.dx).toBeLessThan(WALL_X);
    expect(b.dy).toBe(0);
    expect(spawnNudge(-8.9, -7.2, 1).dx).toBeGreaterThan(0);
    // Already fine: no change.
    expect(spawnNudge(-1, 1, 0.5)).toEqual({ dx: 0, dy: 0 });
  });
});
