// Folded-paper fighters: faceted shells, a white sticker outline with an ink edge, red cut marks
// that wrap around the folds, and the K.O. split. Ported from the art-direction mock-up.
// Poses are worked out here from the fight's state; nothing here changes the fight.

import * as THREE from 'three';
import { MOVES, RULES } from '../sim/rules';
import type { Fighter } from '../sim/sim';
import { C, D, clamp, easeIO, easeIn, easeOut, lerp, type Look } from './common';

// ---------- shapes ----------
function frustum(rt: number, rb: number, h: number, seg: number, pivot: 'top' | 'bottom', sz = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.translate(0, pivot === 'top' ? -h / 2 : h / 2, 0); g.scale(1, 1, sz); return g;
}
function limb(r0: number, r1: number, len: number) { const g = new THREE.CylinderGeometry(r1, r0, len, 4, 1); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0); return g; }
function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
function merge(...gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
    pos.push(...(g.attributes.position.array as Float32Array)); nor.push(...(g.attributes.normal.array as Float32Array));
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return m;
}
// Inverted hull: push every vertex out along the average normal of all faces that share its position.
const hullCache = new Map<string, THREE.BufferGeometry>();
function hullOf(geo: THREE.BufferGeometry, d: number) {
  const key = geo.uuid + d; if (hullCache.has(key)) return hullCache.get(key)!;
  const g = geo.clone(); g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, acc = new Map<string, number[]>();
  const k = (i: number) => pos.getX(i).toFixed(4) + ',' + pos.getY(i).toFixed(4) + ',' + pos.getZ(i).toFixed(4);
  for (let i = 0; i < pos.count; i++) { const a = acc.get(k(i)) || [0, 0, 0]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k(i), a); }
  const out: number[][] = [];
  for (let i = 0; i < pos.count; i++) { const a = acc.get(k(i))!, l = Math.hypot(a[0], a[1], a[2]) || 1; out.push([pos.getX(i) + (a[0] / l) * d, pos.getY(i) + (a[1] / l) * d, pos.getZ(i) + (a[2] / l) * d]); }
  out.forEach((p, i) => pos.setXYZ(i, p[0], p[1], p[2])); pos.needsUpdate = true; hullCache.set(key, g); return g;
}
const bladeShape = new THREE.Shape([[0.04, -0.026], [1.1, -0.026], [1.22, 0.024], [0.04, 0.026]].map((p) => new THREE.Vector2(p[0], p[1])));
const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.018, bevelEnabled: false }); bladeGeo.translate(0, 0, -0.009);
const LEG = frustum(0.1, 0.23, 0.9, 4, 'top', 0.72);
const UP = limb(0.07, 0.056, 0.32), LOW = merge(limb(0.056, 0.046, 0.3), box(0.085, 0.085, 0.08, 0.32, 0, 0));
const FOOT = box(0.26, 0.075, 0.13, 0.06, 0.0375, 0);
const HEAD = frustum(0.155, 0.13, 0.36, 6, 'bottom', 0.9);
type PartDef = [name: string, z: number, meshes: [THREE.BufferGeometry, string, number?][], details?: [THREE.BufferGeometry, string][]];
const PARTS: PartDef[] = [
  ['legB', -0.11, [[LEG, 'hakamaFold']]],
  ['footB', -0.11, [[FOOT, 'ink']]],
  ['armBU', -0.15, [[UP, 'giFold']]],
  ['armBL', -0.15, [[LOW, 'giFold']]],
  ['legF', 0.11, [[LEG, 'hakama']]],
  ['footF', 0.11, [[FOOT, 'ink']]],
  ['torso', 0, [[frustum(0.28, 0.2, 0.78, 4, 'bottom', 0.66), 'gi']], [[frustum(0.218, 0.207, 0.13, 4, 'bottom', 0.7).translate(0, 0.03, 0), 'sash']]],
  ['head', 0, [[HEAD, 'gi']], [
    [box(0.06, 0.026, 0.012, 0.05, 0.21, 0.122).rotateZ(-0.12), 'ink'], [box(0.06, 0.026, 0.012, 0.05, 0.21, -0.122).rotateZ(-0.12), 'ink'],
    [box(0.085, 0.022, 0.012, 0.045, 0.258, 0.124).rotateZ(-0.2), 'ink'], [box(0.085, 0.022, 0.012, 0.045, 0.258, -0.124).rotateZ(-0.2), 'ink'],
  ]],
  ['hair', 0, [[frustum(0.168, 0.16, 0.15, 6, 'bottom', 0.92).translate(-0.025, 0.285, 0), 'hair']]],
  ['knot', 0, [[new THREE.ConeGeometry(0.045, 0.22, 4).translate(-0.05, 0.53, 0), 'hair']]],
  ['handle', 0.02, [[box(0.3, 0.052, 0.046, -0.15, 0, 0), 'ink', 0.7]], [0, 1, 2, 3].map((k) => [box(0.026, 0.058, 0.052, -0.26 + k * 0.07, 0, 0), 'grip'] as [THREE.BufferGeometry, string])],
  ['tsuba', 0.02, [[box(0.036, 0.14, 0.11, 0.018, 0, 0), 'ink', 0.7]]],
  ['blade', 0.02, [[bladeGeo, 'steel', 0.45]]],
  ['armFU', 0.17, [[UP, 'gi']]],
  ['armFL', 0.17, [[LOW, 'gi']]],
];
const PART_GEO = Object.fromEntries(PARTS.map(([n, , meshes]) => [n, meshes[0][0]]));
const HULL_W = 0.026, HULL_I = 0.04, GAP = 0.02;

type Kind = 'shell' | 'back' | 'core' | 'hullW' | 'hullI';
type MatFn = (color: string, kind: Kind) => THREE.Material;
interface Rig { root: THREE.Group; parts: Record<string, THREE.Group> }

const colorOf = (look: Look, key: string) => (look as unknown as Record<string, string>)[key] ?? (C as Record<string, string>)[key] ?? key;
function buildRig(look: Look, mf: MatFn, cut = false): Rig {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); const parts: Record<string, THREE.Group> = {};
  for (const [n, z, meshes, det = []] of PARTS) {
    const g = new THREE.Group(); g.position.z = z; body.add(g); parts[n] = g;
    for (const [geo, key, os = 1] of meshes) {
      const shell = new THREE.Mesh(geo, mf(colorOf(look, key), 'shell')); shell.castShadow = true; g.add(shell);
      if (cut) { g.add(new THREE.Mesh(geo, mf(C.red, 'back'))); const core = new THREE.Mesh(geo, mf(C.red, 'core')); core.scale.setScalar(0.9); g.add(core); }
      g.add(new THREE.Mesh(hullOf(geo, HULL_W * os), mf(C.white, 'hullW')));
      g.add(new THREE.Mesh(hullOf(geo, HULL_I * os), mf(C.ink, 'hullI')));
    }
    for (const [geo, key] of det) g.add(new THREE.Mesh(geo, mf(colorOf(look, key), 'shell')));
  }
  return { root, parts };
}
function matFor(color: string, kind: Kind, planes?: THREE.Plane[]) {
  const o = planes ? { clippingPlanes: planes, clipShadows: true } : {};
  if (kind === 'shell') return new THREE.MeshLambertMaterial({ color, flatShading: true, ...o });
  if (kind === 'back') return new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, ...o });
  if (kind === 'core') return new THREE.MeshBasicMaterial({ color: C.redDeep, ...o });
  return new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, ...o });
}
const sharedMats = new Map<string, THREE.Material>();
const sharedMF: MatFn = (color, kind) => { const k = color + kind; if (!sharedMats.has(k)) sharedMats.set(k, matFor(color, kind)); return sharedMats.get(k)!; };

// ---------- poses: 2D forward kinematics in the fighter's side plane ----------
export interface Pose { hipY: number; lean: number; legB: number; legF: number; hilt: [number, number]; sword: number; head: number }
const rot = (a: number, v: number[]): [number, number] => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; };
const vadd = (a: number[], b: number[]): [number, number] => [a[0] + b[0], a[1] + b[1]];
function setPart(p: THREE.Object3D, pos: number[], r: number) { p.position.x = pos[0]; p.position.y = pos[1]; p.rotation.z = r; }
function ik(S: number[], G: number[], L1: number, L2: number) {
  const dx = G[0] - S[0], dy = G[1] - S[1], d = clamp(Math.hypot(dx, dy), 0.05, L1 + L2 - 1e-3), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), up = base - A, E = vadd(S, [L1 * Math.cos(up), L1 * Math.sin(up)]);
  return { up, E, lo: Math.atan2(G[1] - E[1], G[0] - E[0]) };
}
function applyPose(rig: Rig, P: Pose) {
  const pr = rig.parts, hip = [0, P.hipY], hb = vadd(hip, [-0.05, 0]), hf = vadd(hip, [0.05, 0]);
  setPart(pr.legB, hb, P.legB); setPart(pr.legF, hf, P.legF);
  const fb = vadd(hb, rot(P.legB, [0, -0.88])), ff = vadd(hf, rot(P.legF, [0, -0.88]));
  setPart(pr.footB, [fb[0] - 0.04, Math.max(0, fb[1] - 0.04)], 0); setPart(pr.footF, [ff[0] - 0.04, Math.max(0, ff[1] - 0.04)], 0);
  setPart(pr.torso, hip, P.lean);
  const neck = vadd(hip, rot(P.lean, [0.02, 0.76])), hr = P.lean * 0.6 + P.head;
  for (const k of ['head', 'hair', 'knot']) setPart(pr[k], neck, hr);
  const H = vadd(hip, rot(P.lean, P.hilt)), a = P.sword + P.lean;
  for (const k of ['handle', 'tsuba', 'blade']) setPart(pr[k], H, a);
  const SF = vadd(hip, rot(P.lean, [0.07, 0.68])), SB = vadd(hip, rot(P.lean, [-0.07, 0.68]));
  let k = ik(SF, vadd(H, rot(a, [-0.07, 0])), 0.32, 0.31); setPart(pr.armFU, SF, k.up); setPart(pr.armFL, k.E, k.lo);
  k = ik(SB, vadd(H, rot(a, [-0.22, 0])), 0.32, 0.31); setPart(pr.armBU, SB, k.up); setPart(pr.armBL, k.E, k.lo);
}
const POSE = {
  guard: {
    high: { hipY: 0.95, lean: -0.05, legB: 0.24, legF: -0.26, hilt: [0.3, 0.62], sword: 68 * D, head: 0.02 },
    low: { hipY: 0.9, lean: -0.13, legB: 0.3, legF: -0.32, hilt: [0.3, 0.3], sword: -12 * D, head: 0.08 },
  },
  wind: {
    high: { hipY: 0.96, lean: 0.08, legB: 0.22, legF: -0.24, hilt: [0.0, 0.98], sword: 140 * D, head: -0.04 },
    low: { hipY: 0.87, lean: 0.02, legB: 0.3, legF: -0.3, hilt: [-0.12, 0.22], sword: -160 * D, head: 0.04 },
  },
  strike: {
    high: { hipY: 0.9, lean: -0.24, legB: 0.38, legF: -0.4, hilt: [0.42, 0.3], sword: -40 * D, head: 0.12 },
    low: { hipY: 0.88, lean: -0.18, legB: 0.36, legF: -0.38, hilt: [0.42, 0.52], sword: 40 * D, head: 0.06 },
  },
} as Record<'guard' | 'wind' | 'strike', Record<'high' | 'low', Pose>>;
// How far toward the full wind-up / strike each move goes (lights are smaller motions).
const MOTION = { light: { windK: 0.45, strikeK: 0.8 }, heavy: { windK: 1, strikeK: 1 }, riposte: { windK: 0.6, strikeK: 1 } };
const POSE_KEYS = ['hipY', 'lean', 'legB', 'legF', 'sword', 'head'] as const;
function lerpPose(a: Pose, b: Pose, k: number, out = {} as Pose): Pose {
  for (const key of POSE_KEYS) out[key] = lerp(a[key], b[key], k);
  out.hilt = [lerp(a.hilt[0], b.hilt[0], k), lerp(a.hilt[1], b.hilt[1], k)]; return out;
}
const copyPose = (p: Pose) => lerpPose(p, p, 0);

// ---------- cut marks ----------
interface Mark { part: string; plane: THREE.Plane; w: number }
interface MarkInst { part: THREE.Group; A: THREE.Plane; B: THREE.Plane; la: THREE.Plane; lb: THREE.Plane; mesh: THREE.Mesh; mat: THREE.Material }
function attachMark(rig: Rig, m: Mark, extra: THREE.Plane[] = []): MarkInst {
  const part = rig.parts[m.part], A = new THREE.Plane(), B = new THREE.Plane();
  const mat = new THREE.MeshBasicMaterial({ color: C.red, clippingPlanes: [A, B, ...extra], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(PART_GEO[m.part], mat); mesh.scale.setScalar(1.012); part.add(mesh);
  const la = m.plane.clone(); la.constant += m.w;
  const lb = m.plane.clone().negate(); lb.constant += m.w;
  return { part, A, B, la, lb, mesh, mat };
}
function updateMark(i: MarkInst) { i.A.copy(i.la).applyMatrix4(i.part.matrixWorld); i.B.copy(i.lb).applyMatrix4(i.part.matrixWorld); }

// ---------- halves after a K.O. ----------
interface Half {
  holder: THREE.Group; rig: Rig; local: THREE.Plane; core: THREE.Plane; skin: THREE.Plane; mats: THREE.Material[]; marks: MarkInst[];
  side: number; t: number; base: THREE.Vector3; dir: number; v: THREE.Vector3; w: THREE.Vector3; landed: boolean;
}

/** One fighter on screen: follows its fighter in the fight and adds the paper effects. */
export class FighterView {
  readonly rig: Rig;
  pose: Pose;
  private yaw: number;
  private prev: { state: string; atk: string } = { state: 'guard', atk: 'light' };
  private from: Pose; private recFrom: Pose; private feintFrom: Pose;
  private walkPhase = 0;
  private marks: Mark[] = [];
  private markInst: MarkInst[] = [];
  halves: Half[] = [];
  /** Called when a half lands: shake the camera, throw paper. */
  onLand: (x: number, dir: number) => void = () => {};

  constructor(private scene: THREE.Scene, readonly look: Look, readonly seat: number) {
    this.rig = buildRig(look, sharedMF);
    scene.add(this.rig.root);
    this.pose = copyPose(POSE.guard[seat === 0 ? 'high' : 'low']);
    this.from = this.recFrom = this.feintFrom = copyPose(this.pose);
    this.yaw = seat === 0 ? 0 : Math.PI;
  }

  /** Back to a fresh round: whole again, no cuts. */
  reset(f: Fighter) {
    this.clearMarks();
    this.dropHalves();
    if (!this.rig.root.parent) this.scene.add(this.rig.root);
    this.pose = copyPose(POSE.guard[f.stance]);
    this.prev = { state: f.state, atk: f.atk };
    this.yaw = f.facing > 0 ? 0 : Math.PI;
  }

  /** Update the pose for one fight frame. */
  stepPose(f: Fighter) {
    const dt = 1 / 60;
    if (f.state !== this.prev.state) {
      if (f.state === 'wind') this.from = copyPose(this.pose);
      if (f.state === 'recover') this.recFrom = copyPose(this.pose);
      if (f.state === 'feint') this.feintFrom = copyPose(this.pose);
      this.prev = { state: f.state, atk: f.atk };
    }
    const P = this.pose, M = MOVES[f.atk], mo = MOTION[f.atk];
    switch (f.state) {
      case 'guard': {
        const tgt = POSE.guard[f.stance];
        lerpPose(P, tgt, 1 - Math.exp(-dt * 22), P);
        if (f.walk && f.y <= 0) this.walkPhase += dt * 10;
        const sw = f.walk && f.y <= 0 ? Math.sin(this.walkPhase) * 0.22 : 0;
        if (f.y > 0) { P.legB = lerp(P.legB, 0.7, 0.3); P.legF = lerp(P.legF, -0.2, 0.3); }
        else { P.legB = lerp(P.legB, tgt.legB + sw, 0.5); P.legF = lerp(P.legF, tgt.legF - sw, 0.5); }
        break;
      }
      case 'wind': {
        const w = lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK);
        lerpPose(this.from, w, easeIO(Math.min(1, f.t / M.wind)), P);
        break;
      }
      case 'active': {
        const w = lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK), s = lerpPose(POSE.guard[f.slash], POSE.strike[f.slash], mo.strikeK);
        lerpPose(w, s, easeOut(Math.min(1, f.t / M.act)), P);
        break;
      }
      case 'recover':
        lerpPose(this.recFrom, POSE.guard[f.stance], easeIO(Math.min(1, f.t / M.rec)), P);
        break;
      case 'feint':
        lerpPose(this.feintFrom, POSE.guard[f.stance], easeOut(Math.min(1, f.t / RULES.feintFrames)), P);
        break;
      case 'stun':
        lerpPose(P, { ...POSE.guard[f.stance], lean: 0.32, head: -0.15 }, 1 - Math.exp(-dt * 18), P);
        break;
      case 'land':
        lerpPose(P, { ...POSE.guard[f.stance], lean: -0.18, legB: 0.55, legF: -0.55 }, 1 - Math.exp(-dt * 30), P);
        break;
      case 'dash': {
        const back = f.dashDir !== f.facing;
        lerpPose(P, { ...POSE.guard[f.stance], lean: back ? 0.2 : -0.2, legB: 0.45, legF: -0.45 }, 1 - Math.exp(-dt * 25), P);
        break;
      }
    }
  }

  /** Place the model for this screen frame. */
  draw(f: Fighter, real: number, fold: number, clock: number) {
    const r = this.rig.root;
    r.visible = f.alive;
    if (!f.alive) return;
    const ty = f.facing > 0 ? 0 : Math.PI;
    this.yaw = lerp(this.yaw, ty, 1 - Math.exp(-real * 14));
    const bob = f.walk && f.y <= 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.03 : Math.sin(clock * 2.2 + this.seat) * 0.006;
    r.position.set(f.x, f.y + bob, 0); r.rotation.y = this.yaw;
    r.scale.set(1, Math.max(0.001, fold), 1);
    applyPose(this.rig, this.pose);
  }

  /** After the scene's matrices are up to date: move cut marks and half clipping planes. */
  afterMatrices() {
    if (this.rig.root.visible) this.markInst.forEach(updateMark);
    for (const h of this.halves) {
      const M = h.rig.root.matrixWorld;
      h.core.copy(h.local).applyMatrix4(M); h.skin.copy(h.local); h.skin.constant -= GAP; h.skin.applyMatrix4(M);
      h.marks.forEach(updateMark);
    }
  }

  /** A clean hit: a red band where the blade crossed (torso for high, legs for low; heavies cut two parts). */
  addCut(f: Fighter, P: [number, number], ang: number, heavy: boolean) {
    const high = P[1] - f.y > 1.1;
    const parts = high ? (heavy ? ['torso', 'armFU'] : ['torso']) : heavy ? ['legF', 'legB'] : ['legF'];
    this.rig.root.updateMatrixWorld(true);
    const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const wp = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(P[0], P[1], 0));
    for (const name of parts) {
      const inv = this.rig.parts[name].matrixWorld.clone().invert();
      const m = { part: name, plane: wp.clone().applyMatrix4(inv), w: heavy ? 0.026 : 0.012 };
      this.marks.push(m); this.markInst.push(attachMark(this.rig, m));
    }
  }

  private clearMarks() { for (const i of this.markInst) { i.part.remove(i.mesh); i.mat.dispose(); } this.markInst = []; this.marks = []; }

  /** The K.O. split: the fighter is redrawn twice, each copy clipped to one side of the blade's path. */
  split(P: [number, number], ang: number, dirAway: number) {
    const f = this.rig.root;
    f.updateMatrixWorld(true);
    const inv = f.matrixWorld.clone().invert();
    const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const wp = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(P[0], P[1], 0));
    const lp = wp.clone().applyMatrix4(inv);
    for (const side of [1, -1]) {
      const core = new THREE.Plane(), skin = new THREE.Plane(), mats: THREE.Material[] = [];
      const mf: MatFn = (color, kind) => { const m = matFor(color, kind, kind === 'back' || kind === 'core' ? [core] : [skin]); mats.push(m); return m; };
      const rig = buildRig(this.look, mf, true);
      const holder = new THREE.Group(); holder.position.set(P[0], P[1], 0); this.scene.add(holder); holder.add(rig.root);
      rig.root.position.copy(f.position).sub(holder.position); rig.root.rotation.copy(f.rotation); rig.root.scale.copy(f.scale);
      applyPose(rig, this.pose); rig.root.updateMatrixWorld(true);
      const h: Half = {
        holder, rig, local: side > 0 ? lp : lp.clone().negate(), core, skin, mats, marks: [], side, t: 0,
        base: holder.position.clone(), dir: dirAway, landed: false,
        v: new THREE.Vector3(dirAway * 1.4, 1.3, (Math.random() - 0.5) * 1.6),
        w: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4, -dirAway * 3.2),
      };
      h.marks = this.marks.map((m) => attachMark(rig, m, [skin]));
      this.halves.push(h);
    }
    this.rig.root.visible = false;
    this.scene.remove(this.rig.root);
  }

  /** Tumble the halves (scripted for now; Rapier physics comes with the hit-feel work). */
  updateHalves(dt: number, fold: number) {
    for (const h of this.halves) {
      h.t += dt;
      if (h.side > 0) {
        if (h.t >= 0.12) {
          h.v.y -= 15 * 0.55 * dt; h.holder.position.addScaledVector(h.v, dt);
          h.holder.rotation.x += h.w.x * dt; h.holder.rotation.y += h.w.y * dt; h.holder.rotation.z += h.w.z * dt;
          if (h.holder.position.y < 0.32) { h.holder.position.y = 0.32; h.v.multiplyScalar(0.35); h.v.y = Math.abs(h.v.y) * 0.3; h.w.multiplyScalar(0.45); }
        }
      } else {
        const k = clamp((h.t - 0.3) / 0.8, 0, 1);
        h.holder.rotation.z = -h.dir * (Math.PI / 2) * 0.94 * easeIn(k);
        h.holder.position.y = lerp(h.base.y, 0.3, easeIn(k)); h.holder.position.x = h.base.x + h.dir * 0.35 * easeIn(k);
        if (k >= 1 && !h.landed) { h.landed = true; this.onLand(h.holder.position.x + h.dir * 0.6, h.dir); }
      }
      h.holder.scale.y = Math.max(0.001, fold);
    }
  }

  dropHalves() {
    for (const h of this.halves) { this.scene.remove(h.holder); h.mats.forEach((m) => m.dispose()); h.marks.forEach((i) => i.mat.dispose()); }
    this.halves = [];
  }

  /** Where the blade's tip is in the world (for the dummy's glint). */
  tip(out: THREE.Vector3) { return out.set(1.15, 0, 0).applyMatrix4(this.rig.parts.blade.matrixWorld); }
}
