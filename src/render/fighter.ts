// Cut-out paper fighters: flat card pieces pinned at the joints, made in Blender (art/fighters/puppet.blend).
// The game adds the card's thickness, a white sticker border with an ink edge, red slash marks, the K.O.
// split and the falling halves. Poses snap between held key poses, like cut-out animation, while the body
// glides. Poses are worked out here from the fight's state; nothing here changes the fight.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { MOVES } from '../sim/rules';
import type { Fighter } from '../sim/sim';
import { C, D, clamp, easeIn, lerp, type Look } from './common';
import { ccw, clipConvex, clipHalf, offset, slashLens, type Line, type Pt } from './paper2d';
import { PIECE_NAMES, loadPuppet, type Piece, type PieceName, type Puppet } from './puppet';
import type { PaperPhysics } from './physics';

const T = 0.022; // card thickness
const SW = 0.03, IW = 0.047; // white sticker border and ink edge, measured from the card's edge
const GAP = 0.03; // the white stops this short of a K.O. cut, so a thin red edge shows
const HALF_Z = 0.15; // a falling half squashes its layers together, like paper
const MAX_PILES = 5; // Endless: halves of the last 5 cut bots stay on the page
const BACK = new Set<PieceName>(['legB', 'footB', 'armBU', 'armBL']);
const THIN = new Set<PieceName>(['sword']);
const L2 = 0.31; // forearm pin to the middle of the fist
const GRIP_F = -0.07, GRIP_B = -0.22; // where each hand holds the handle, from the sword's pin

// ---------- building flat pieces ----------
// Double-sided: mirrored fighters (and halves cut from them) flip their triangles' winding.
const LIT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const FLAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const _c = new THREE.Color();

function slab(p: Pt[], depth: number, color: THREE.Color): THREE.BufferGeometry {
  const shape = new THREE.Shape(ccw(p).map((q) => new THREE.Vector2(q[0], q[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

interface PieceGeo { lit: THREE.BufferGeometry[]; flat: THREE.BufferGeometry[]; outline: Pt[][] }
/** One piece as geometry: ink edge, sticker border, the card, printed details and red slash marks.
 *  With `cut`, only the kept side of the line: the white stops GAP short, so a red edge shows. */
function pieceGeo(piece: Piece, look: Look, marks: Pt[][], cut: Line | null): PieceGeo {
  const out: PieceGeo = { lit: [], flat: [], outline: [] };
  const name = piece.name as PieceName, sc = THIN.has(name) ? 0.5 : 1;
  const keep = (p: Pt[], gap: number) => (cut ? clipHalf(p, cut, gap) : p);
  const color = (role: string, own: string) => {
    _c.set(look.colors[role] ?? own);
    return BACK.has(name) ? _c.clone().multiplyScalar(0.88) : _c.clone();
  };
  const add = (list: THREE.BufferGeometry[], p: Pt[], depth: number, col: THREE.Color) => { if (p.length >= 3) list.push(slab(p, depth, col)); };
  const ink = new THREE.Color(C.ink), white = new THREE.Color(C.white), red = new THREE.Color(C.red);
  piece.shells.forEach((s, i) => {
    add(out.flat, keep(offset(s.pts, IW * sc), GAP), T * 0.5, ink);
    add(out.flat, keep(offset(s.pts, SW * sc), GAP), T * 0.75, white);
    if (cut) add(out.flat, clipHalf(s.pts, cut), T * 0.88, red);
    const card = keep(s.pts, GAP);
    add(out.lit, card, T + i * 0.002, color(s.role, s.color));
    if (card.length >= 3) out.outline.push(card);
  });
  piece.details.forEach((d, i) => add(out.lit, keep(d.pts, GAP), T + 0.006 + i * 0.0004, color(d.role, d.color)));
  for (const lens of marks) for (const s of piece.shells) add(out.flat, keep(clipConvex(s.pts, lens), GAP), T + 0.014, red);
  return out;
}
/** Merge a piece (or a whole half) into two meshes: lit paper and unlit edges, so draw calls stay low. */
function meshes(lit: THREE.BufferGeometry[], flat: THREE.BufferGeometry[]) {
  const out: THREE.Mesh[] = [];
  for (const [list, mat] of [[lit, LIT], [flat, FLAT]] as const) {
    if (!list.length) continue;
    const g = mergeGeometries(list); list.forEach((x) => x.dispose());
    if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.castShadow = true; out.push(m);
  }
  return out;
}
const disposeTree = (o: THREE.Object3D) => o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });

// ---------- the rig: where the pins are, read from the Blender rest layout ----------
interface Dims { legF: Pt; legB: Pt; legLenF: number; legLenB: number; footDxF: number; footDxB: number; neck: Pt; shF: Pt; shB: Pt; l1F: number; l1B: number }
function dimsOf(p: Puppet): Dims {
  const hip = p.torso.rest, rel = (n: PieceName): Pt => [p[n].rest.x - hip.x, p[n].rest.y - hip.y];
  const foot = (leg: PieceName, ft: PieceName) => ({ dx: p[ft].rest.x - p[leg].rest.x, len: p[leg].rest.y - p[ft].rest.y - 0.06 });
  const f = foot('legF', 'footF'), b = foot('legB', 'footB');
  return {
    legF: rel('legF'), legB: rel('legB'), legLenF: f.len, legLenB: b.len, footDxF: f.dx, footDxB: b.dx,
    neck: rel('head'), shF: rel('armFU'), shB: rel('armBU'),
    l1F: p.armFL.rest.distanceTo(p.armFU.rest), l1B: p.armBL.rest.distanceTo(p.armBU.rest),
  };
}
interface Rig { root: THREE.Group; parts: Record<PieceName, THREE.Group> }

// ---------- poses: 2D in the fighter's side plane ----------
export interface Pose { hipY: number; lean: number; legB: number; legF: number; hilt: [number, number]; sword: number; head: number }
const rot = (a: number, v: Pt): Pt => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; };
const vadd = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
function setPart(p: THREE.Object3D, pos: Pt, r: number) { p.position.x = pos[0]; p.position.y = pos[1]; p.rotation.z = r; }
function ik(S: Pt, G: Pt, L1: number, L2: number) {
  const dx = G[0] - S[0], dy = G[1] - S[1], d = clamp(Math.hypot(dx, dy), 0.05, L1 + L2 - 1e-3), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), up = base - A, E = vadd(S, [L1 * Math.cos(up), L1 * Math.sin(up)]);
  return { up, E, lo: Math.atan2(G[1] - E[1], G[0] - E[0]) };
}
function applyPose(pr: Record<PieceName, THREE.Group>, P: Pose, d: Dims) {
  const hip: Pt = [0, P.hipY], hb = vadd(hip, d.legB), hf = vadd(hip, d.legF);
  setPart(pr.legB, hb, P.legB); setPart(pr.legF, hf, P.legF);
  const fb = vadd(hb, rot(P.legB, [0, -d.legLenB])), ff = vadd(hf, rot(P.legF, [0, -d.legLenF]));
  setPart(pr.footB, [fb[0] + d.footDxB, Math.max(0, fb[1] - 0.06)], 0); setPart(pr.footF, [ff[0] + d.footDxF, Math.max(0, ff[1] - 0.06)], 0);
  setPart(pr.torso, hip, P.lean);
  setPart(pr.head, vadd(hip, rot(P.lean, d.neck)), P.lean * 0.6 + P.head);
  const H = vadd(hip, rot(P.lean, P.hilt)), a = P.sword + P.lean;
  setPart(pr.sword, H, a);
  const SF = vadd(hip, rot(P.lean, d.shF)), SB = vadd(hip, rot(P.lean, d.shB));
  let k = ik(SF, vadd(H, rot(a, [GRIP_F, 0])), d.l1F, L2); setPart(pr.armFU, SF, k.up); setPart(pr.armFL, k.E, k.lo);
  k = ik(SB, vadd(H, rot(a, [GRIP_B, 0])), d.l1B, L2); setPart(pr.armBU, SB, k.up); setPart(pr.armBL, k.E, k.lo);
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
// How far toward the full wind-up / strike each move's key pose goes (lights are smaller motions).
const MOTION = { light: { windK: 0.45, strikeK: 0.8 }, heavy: { windK: 1, strikeK: 1 }, riposte: { windK: 0.6, strikeK: 1 } };
const POSE_KEYS = ['hipY', 'lean', 'legB', 'legF', 'sword', 'head'] as const;
function lerpPose(a: Pose, b: Pose, k: number, out = {} as Pose): Pose {
  for (const key of POSE_KEYS) out[key] = lerp(a[key], b[key], k);
  out.hilt = [lerp(a.hilt[0], b.hilt[0], k), lerp(a.hilt[1], b.hilt[1], k)]; return out;
}
const copyPose = (p: Pose) => lerpPose(p, p, 0);
// Turning around: the card flips through edge-on in two held steps.
const FLIP = [0.3, 0.3, 0.7, 0.7, 1];

/** The key pose a cut-out animator would draw for this moment, and a name for it. */
function keyPose(f: Fighter, walkT: number): [Pose, string] {
  const g = POSE.guard[f.stance], mo = MOTION[f.atk], mv = MOVES[f.atk];
  const wind = () => lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK), strike = (k = 1) => lerpPose(POSE.guard[f.slash], POSE.strike[f.slash], mo.strikeK * k);
  switch (f.state) {
    case 'wind': return [wind(), 'w' + f.slash + f.atk];
    case 'active': return [strike(), 'a' + f.slash];
    case 'recover': return f.t < mv.rec * 0.45 ? [strike(0.85), 'r' + f.slash] : [g, 'g' + f.stance];
    case 'feint': return [lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK * 0.4), 'f' + f.slash];
    case 'stun': return [{ ...g, lean: 0.34, head: -0.18 }, 'st'];
    case 'land': return [{ ...g, lean: -0.18, legB: 0.55, legF: -0.55 }, 'ld'];
    case 'dash': { const back = f.dashDir !== f.facing; return [{ ...g, lean: back ? 0.2 : -0.2, legB: 0.45, legF: -0.45 }, back ? 'db' : 'df']; }
    default:
      if (f.y > 0) return f.vy > 0 ? [{ ...g, legB: 0.75, legF: -0.15, lean: -0.1 }, 'j1' + f.stance] : [{ ...g, legB: 0.45, legF: -0.45 }, 'j2' + f.stance];
      if (f.walk) { const s = Math.floor(walkT / 8) % 2; return [{ ...g, legB: g.legB + (s ? 0.22 : -0.12), legF: g.legF - (s ? 0.22 : -0.12), hipY: g.hipY - (s ? 0.03 : 0) }, 'k' + s + f.stance]; }
      return [g, 'g' + f.stance];
  }
}

// ---------- halves after a K.O. ----------
interface Half {
  holder: THREE.Group; body: RigidBody | null; side: number; t: number; base: THREE.Vector3; dir: number;
  landed: boolean; vy: number; folding: number;
  v: THREE.Vector3; w: THREE.Vector3; // for the scripted fall when physics isn't loaded
}

const PUPPET = loadPuppet();

/** One fighter on screen: follows its fighter in the fight and adds the paper effects. */
export class FighterView {
  rig: Rig | null = null;
  private puppet: Puppet | null = null;
  private dims: Dims | null = null;
  pose: Pose;
  private ibFrom: Pose; private ib = 0; private sig = '';
  private yaw: number; private yawFrom: number; private yawTo: number; private flipT = 99;
  private walkT = 0;
  /** Slash marks per piece, as polygons in the piece's own plane. */
  private marks: Partial<Record<PieceName, Pt[][]>> = {};
  halves: Half[] = [];
  /** Earlier bots' halves (Endless), oldest first. */
  private piles: Half[][] = [];
  private folding: Half[] = [];
  /** Called when a half lands: shake the camera, throw paper. */
  onLand: (x: number, dir: number) => void = () => {};

  constructor(private scene: THREE.Scene, readonly look: Look, readonly seat: number, private physics: PaperPhysics) {
    this.pose = copyPose(POSE.guard[seat === 0 ? 'high' : 'low']);
    this.ibFrom = copyPose(this.pose);
    this.yaw = this.yawFrom = this.yawTo = seat === 0 ? 0 : Math.PI;
    PUPPET.then((p) => this.build(p)).catch((e) => console.error('Could not load the fighters:', e));
  }

  private build(p: Puppet) {
    this.puppet = p; this.dims = dimsOf(p);
    const root = new THREE.Group(), parts = {} as Record<PieceName, THREE.Group>;
    for (const name of PIECE_NAMES) { const g = new THREE.Group(); g.position.z = p[name].rest.z; root.add(g); parts[name] = g; }
    this.rig = { root, parts };
    for (const name of PIECE_NAMES) this.rebuild(name);
    this.scene.add(root);
  }

  private rebuild(name: PieceName) {
    if (!this.rig || !this.puppet) return;
    const g = this.rig.parts[name];
    for (const c of [...g.children]) { g.remove(c); disposeTree(c); }
    const pg = pieceGeo(this.puppet[name], this.look, this.marks[name] ?? [], null);
    g.add(...meshes(pg.lit, pg.flat));
  }

  /** Back to a fresh round: whole again, no cuts. With `keep` (Endless), the halves stay on the page. */
  reset(f: Fighter, keep = false) {
    this.clearMarks();
    if (keep) this.pileUp(); else this.dropHalves();
    if (this.rig && !this.rig.root.parent) this.scene.add(this.rig.root);
    this.pose = copyPose(POSE.guard[f.stance]); this.ib = 0; this.sig = '';
    this.yaw = this.yawFrom = this.yawTo = f.facing > 0 ? 0 : Math.PI; this.flipT = 99;
  }

  /** Update the pose for one fight frame: hold the key pose, with one in-between when it changes. */
  stepPose(f: Fighter) {
    if (f.walk && f.y <= 0) this.walkT++;
    const [key, sig] = keyPose(f, this.walkT);
    if (sig !== this.sig) { this.ibFrom = copyPose(this.pose); this.ib = f.state === 'active' ? 1 : 2; this.sig = sig; }
    if (this.ib > 0) { lerpPose(this.ibFrom, key, 0.5, this.pose); this.ib--; } else lerpPose(key, key, 0, this.pose);
    const want = f.facing > 0 ? 0 : Math.PI;
    if (want !== this.yawTo) { this.yawFrom = this.yaw; this.yawTo = want; this.flipT = 0; }
    this.yaw = lerp(this.yawFrom, this.yawTo, FLIP[Math.min(FLIP.length - 1, this.flipT >> 1)]);
    this.flipT++;
  }

  /** Place the model for this screen frame. */
  draw(f: Fighter, _real: number, fold: number, _clock: number) {
    if (!this.rig || !this.dims) return;
    const r = this.rig.root;
    r.visible = f.alive;
    if (!f.alive) return;
    // Facing left is drawn mirrored rather than turned around, so the layers keep their order (sash and
    // front arm in front). The turn still passes through edge-on: past 90 degrees the card shows mirrored.
    const mirror = this.yaw > Math.PI / 2;
    r.position.set(f.x, f.y, 0); r.rotation.y = mirror ? this.yaw - Math.PI : this.yaw;
    r.scale.set(mirror ? -1 : 1, Math.max(0.001, fold), 1);
    applyPose(this.rig.parts, this.pose, this.dims);
  }

  /** A clean hit: a red slash where the blade crossed, cut through every layer of paper it passes. */
  addCut(_f: Fighter, P: [number, number], ang: number, heavy: boolean) {
    if (!this.rig || !this.puppet) return;
    this.rig.root.updateMatrixWorld(true);
    const lens = slashLens(P, ang, heavy ? 0.5 : 0.32, heavy ? 0.03 : 0.016), v = new THREE.Vector3();
    for (const name of PIECE_NAMES) {
      if (THIN.has(name)) continue;
      const inv = this.rig.parts[name].matrixWorld.clone().invert();
      const local = lens.map((q): Pt => { v.set(q[0], q[1], 0).applyMatrix4(inv); return [v.x, v.y]; });
      if (!this.puppet[name].shells.some((s) => clipConvex(s.pts, local).length)) continue;
      (this.marks[name] ??= []).push(local);
      this.rebuild(name);
    }
  }

  private clearMarks() {
    const had = Object.keys(this.marks) as PieceName[];
    this.marks = {};
    for (const name of had) this.rebuild(name);
  }

  /** The K.O. split: every piece is cut along the blade's path; each side becomes one paper half. */
  split(P: [number, number], ang: number, dirAway: number) {
    if (!this.rig || !this.puppet) return;
    const root = this.rig.root;
    root.updateMatrixWorld(true);
    if (this.piles.length >= MAX_PILES) this.foldAway(this.piles.shift()!);
    const n = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const wp = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(P[0], P[1], 0));
    const v = new THREE.Vector3();
    for (const side of [1, -1]) {
      const holder = new THREE.Group(); holder.position.set(P[0], P[1], 0);
      this.scene.add(holder); holder.updateMatrixWorld(true);
      const hinv = holder.matrixWorld.clone().invert(), lit: THREE.BufferGeometry[] = [], flat: THREE.BufferGeometry[] = [], hull: number[] = [];
      for (const name of PIECE_NAMES) {
        const M = this.rig.parts[name].matrixWorld;
        const lp = wp.clone().applyMatrix4(M.clone().invert()), l = Math.hypot(lp.normal.x, lp.normal.y) || 1;
        const L: Line = { nx: (side * lp.normal.x) / l, ny: (side * lp.normal.y) / l, c: (-side * lp.constant) / l };
        const pg = pieceGeo(this.puppet[name], this.look, this.marks[name] ?? [], L);
        const m = hinv.clone().multiply(M); m.elements[14] *= HALF_Z;
        for (const g of [...pg.lit, ...pg.flat]) g.applyMatrix4(m);
        lit.push(...pg.lit); flat.push(...pg.flat);
        for (const loop of pg.outline) for (const q of loop) for (const z of [-T, T]) { v.set(q[0], q[1], z).applyMatrix4(m); hull.push(v.x, v.y, v.z); }
      }
      holder.add(...meshes(lit, flat));
      const up = side > 0;
      // The top flies off along the blade; the legs keel over (a card can't stand on its own).
      const vel = new THREE.Vector3(dirAway * (up ? 1.8 : 0.8), up ? 1.6 : 0.4, (Math.random() - 0.5) * 0.5);
      const spin = up ? new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, -dirAway * 5)
        : new THREE.Vector3(-(1.8 + Math.random() * 1.4), (Math.random() - 0.5) * 2, -dirAway * 2.5);
      const body = hull.length >= 12 ? this.physics.addHalf(new Float32Array(hull), holder.position, holder.quaternion, vel, spin) : null;
      this.halves.push({ holder, body, side, t: 0, base: holder.position.clone(), dir: dirAway, landed: false, vy: 0, folding: -1, v: vel.clone().multiplyScalar(0.6), w: spin.clone() });
    }
    root.visible = false;
    this.scene.remove(root);
  }

  /** Move the halves: physics when it's loaded, otherwise a scripted fall onto the page. */
  updateHalves(dt: number, fold: number) {
    for (const h of [...this.halves, ...this.piles.flat(), ...this.folding]) {
      h.t += dt;
      const o = h.holder;
      if (h.body) {
        const p = h.body.translation(), q = h.body.rotation(), vy = h.body.linvel().y;
        o.position.set(p.x, p.y, p.z); o.quaternion.set(q.x, q.y, q.z, q.w);
        if (!h.landed && h.t > 0.15 && h.vy < -1.2 && vy > -0.3) { h.landed = true; this.onLand(p.x, h.dir); }
        h.vy = vy;
      } else if (!h.landed && h.t > 0.1) {
        h.v.y -= 9 * dt; o.position.addScaledVector(h.v, dt);
        o.rotation.z += h.w.z * dt * 0.5;
        const k = clamp((h.t - 0.1) / 0.8, 0, 1);
        o.rotation.x = (-Math.PI / 2) * easeIn(k);
        if (o.position.y <= 0.05) { o.position.y = 0.05; h.v.set(0, 0, 0); }
        if (k >= 1) { h.landed = true; this.onLand(o.position.x, h.dir); }
      }
      const shrink = h.folding >= 0 ? Math.max(0, 1 - (h.folding += dt) / 0.35) : 1;
      o.scale.y = Math.max(0.001, fold * shrink);
    }
    this.folding = this.folding.filter((h) => { if (h.folding < 0.35) return true; this.removeHalf(h); return false; });
  }

  /** Endless: the cut bot's halves join the pile on the page. */
  private pileUp() { if (this.halves.length) this.piles.push(this.halves); this.halves = []; }
  /** Fold a pile flat into the page, then remove it. */
  private foldAway(pile: Half[]) { for (const h of pile) h.folding = 0; this.folding.push(...pile); }
  private removeHalf(h: Half) { this.scene.remove(h.holder); disposeTree(h.holder); if (h.body) this.physics.remove(h.body); }

  dropHalves() {
    for (const h of [...this.halves, ...this.piles.flat(), ...this.folding]) this.removeHalf(h);
    this.halves = []; this.piles = []; this.folding = [];
  }

  /** Where the blade's tip is in the world (for the dummy's glint). */
  tip(out: THREE.Vector3) { return this.rig ? out.set(1.18, 0, 0).applyMatrix4(this.rig.parts.sword.matrixWorld) : out.set(0, 0, 0); }
}
