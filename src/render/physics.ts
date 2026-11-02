// Paper physics for the K.O. halves (Rapier). Cosmetic only: the halves tumble, bounce off the
// pop-ups and pile up, but nothing here feeds back into the fight, so online play stays inputs-only.
// Rapier (about 1.5 MB) loads in the background; until it is ready, halves use a scripted fall.

import type * as THREE from 'three';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import { PD, PW, PZ } from './notebook';

type Rapier = typeof import('@dimforge/rapier3d-compat').default;
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
    // The page, a glass wall in front of the lane (halves never fly into the camera), and the page's other edges.
    add(R.ColliderDesc.cuboid(PW + 1, 0.2, PD).setTranslation(0, -0.215, PZ));
    add(R.ColliderDesc.cuboid(PW + 1, 4, 0.1).setTranslation(0, 4, 1.35));
    add(R.ColliderDesc.cuboid(PW + 1, 4, 0.1).setTranslation(0, 4, PZ - PD / 2));
    for (const s of [-1, 1]) add(R.ColliderDesc.cuboid(0.1, 4, PD).setTranslation(s * (PW - 0.2), 4, PZ));
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
      .setLinearDamping(0.35).setAngularDamping(0.9).setCcdEnabled(true));
    w.createCollider(shape.setDensity(0.5).setFriction(0.85).setRestitution(0.25), body);
    return body;
  }

  remove(body: RigidBody) { this.world?.removeRigidBody(body); }

  step(dt: number) {
    const w = this.world;
    if (!w || dt <= 0) return;
    w.timestep = Math.min(dt, 1 / 30);
    w.step();
  }
}
