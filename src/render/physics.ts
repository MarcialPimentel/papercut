// Paper physics for the K.O. halves (Rapier). Cosmetic only: the halves tumble, bounce off the
// pop-ups and pile up, but nothing here feeds back into the fight, so online play stays inputs-only.
// Rapier (about 1.5 MB) loads in the background; until it is ready, halves use a scripted fall.

import type * as THREE from 'three';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import { FLOOR_LIFT, PAGE_SEGS, PD, PW, PZ, WALL_X, pageY } from './page';

type Rapier = typeof import('@dimforge/rapier3d-compat').default;
/** Collision groups (membership << 16 | filter): halves are group 2 and only collide with group 1 (scenery). Halves
 *  never collide with each other: two halves of one cut would jam together, and a pile of halves never settles
 *  (it jitters). Halves that overlap are drawn in a fixed order instead (see FighterView.split). */
const HALVES = (0x0002 << 16) | 0x0001;

/** The page surface as solid strips, one per drawn strip, from one outer edge to the other and following the curve
 *  into the spine: each is a block whose top is the paper (lifted a hair) and whose bottom is well under it. Solid
 *  blocks always push a half back up; a thin surface (a triangle mesh or heightfield) lets a thin half pressed down
 *  by the pile slip through and stay under the page. */
export function floorStrips(steps = 2 * PAGE_SEGS, bottom = -0.3) {
  const out: Float32Array[] = [];
  for (let i = 0; i < steps; i++) {
    const x0 = -PW + (2 * PW * i) / steps, x1 = -PW + (2 * PW * (i + 1)) / steps, pts: number[] = [];
    for (const x of [x0, x1]) for (const y of [pageY(x) + FLOOR_LIFT, bottom]) for (const z of [PZ - PD / 2, PZ + PD / 2]) pts.push(x, y, z);
    out.push(new Float32Array(pts));
  }
  return out;
}

let R: Rapier | null = null;
let loading: Promise<Rapier | null> | null = null;

export function loadRapier() {
  loading ??= import('@dimforge/rapier3d-compat')
    .then(async (m) => { const r = (m.default ?? m) as Rapier; await r.init(); R = r; return r; })
    .catch((e) => { console.warn('Paper physics unavailable; halves use the scripted fall.', e); return null; });
  return loading;
}

export class PaperPhysics {
  private world: World | null = null;
  private fixed: RigidBody | null = null;
  private statics: Collider[] = [];
  private scenery: Float32Array[] = [];

  constructor() {
    void loadRapier().then((r) => {
      if (!r) return;
      this.world = new r.World({ x: 0, y: -14, z: 0 });
      this.fixed = this.world.createRigidBody(r.RigidBodyDesc.fixed());
      this.applyScenery();
    });
  }

  get ready() { return !!this.world; }

  /** The page's pop-ups, as convex hulls of world-space points (x, y, z, x, y, z...). */
  setScenery(hulls: Float32Array[]) { this.scenery = hulls; this.applyScenery(); }

  private applyScenery() {
    const w = this.world, f = this.fixed;
    if (!w || !f || !R) return;
    for (const c of this.statics) w.removeCollider(c, true);
    this.statics = [];
    const add = (d: ReturnType<Rapier['ColliderDesc']['cuboid']> | null) => { if (d) this.statics.push(w.createCollider(d.setFriction(0.9), f)); };
    // The page exactly as drawn (curved into the spine), a thick slab under it in case anything still slips through,
    // a glass wall in front of the lane (halves never fly into the camera), and the page's other edges.
    for (const pts of floorStrips()) add(R.ColliderDesc.convexHull(pts));
    add(R.ColliderDesc.cuboid(PW + 1, 0.2, PD).setTranslation(0, -0.32, PZ));
    add(R.ColliderDesc.cuboid(PW + 1, 4, 0.1).setTranslation(0, 4, 1.35));
    add(R.ColliderDesc.cuboid(PW + 1, 4, 0.1).setTranslation(0, 4, PZ - PD / 2));
    for (const s of [-1, 1]) add(R.ColliderDesc.cuboid(0.1, 4, PD).setTranslation(s * (WALL_X + 0.1), 4, PZ));
    for (const pts of this.scenery) add(R.ColliderDesc.convexHull(pts));
  }

  /** A falling half: its shape as points in its own space, where it is, and how it is thrown. */
  addHalf(points: Float32Array, pos: THREE.Vector3, rot: THREE.Quaternion, vel: THREE.Vector3, spin: THREE.Vector3): RigidBody | null {
    const w = this.world;
    if (!w || !R) return null;
    const shape = R.ColliderDesc.convexHull(points);
    if (!shape) return null;
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z).setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
      .setLinvel(vel.x, vel.y, vel.z).setAngvel({ x: spin.x, y: spin.y, z: spin.z })
      .setLinearDamping(0.35).setAngularDamping(0.6).setCcdEnabled(true));
    w.createCollider(shape.setDensity(0.5).setFriction(0.85).setRestitution(0.25).setCollisionGroups(HALVES), body);
    return body;
  }

  remove(body: RigidBody) { this.world?.removeRigidBody(body); }

  step(dt: number) {
    const w = this.world;
    if (!w || dt <= 0) return;
    // Small steps (at most 1/120 s) so thin, fast halves don't sink into the page when they land.
    const t = Math.min(dt, 1 / 30), n = Math.ceil(t / (1 / 120) - 1e-6);
    w.timestep = t / n;
    for (let i = 0; i < n; i++) w.step();
  }
}
