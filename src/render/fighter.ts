// Papercraft fighters, built from the samurai in Blender (art/fighters/samurai.blend, after Marz's model guide):
// flat paper pieces stacked in layers, each turning on one pivot, like a cardboard puppet. The game adds a thick
// ink line round every paper piece, a thin cream rim round the whole figure, the sword's own outline, red slash
// marks, the K.O. split and the falling halves. The body faces the camera with the head in profile toward the
// rival; poses snap between held key poses, like stop-motion. Nothing here changes the fight.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { MOVES } from '../sim/rules';
import type { Fighter } from '../sim/sim';
import { C, D, clamp, easeIn, lerp, type Look } from './common';
import { ccw, clipConvex, clipHalf, offset, slashLens, type Line, type Pt } from './paper2d';
import { dressPiece } from './looks';
import { PIECE_NAMES, SCALE, loadPuppet, type Piece, type PieceName, type Puppet } from './puppet';
import type { PaperPhysics } from './physics';

const T = 0.005; // paper thickness
const RIM = '#F4EAD2'; // the thin off-white rim round the whole figure
// Round the whole figure, outermost first: [colour, width from the paper's edge, depth]. They sit behind every layer.
const BODY_EDGE: [string, number, number][] = [[RIM, 0.04, -0.15], [C.ink, 0.025, -0.145]];
// The sword's own outline, just behind the sword.
const SWORD_EDGE: [string, number, number][] = [[RIM, 0.022, -0.004], [C.ink, 0.013, -0.003]];
const SEAM = 0.016; // the ink line round every paper piece, seen wherever it overlaps paper behind it
const GAP = 0.02; // the paper stops this short of a K.O. cut, so a thin red edge shows
const MAX_PILES = 5; // Endless: halves of the last 5 cut bots stay on the page
const SWORD: PieceName = 'sword';
const L2 = 0.14 * SCALE; // hand pivot (at the sleeve opening) to the middle of the fist
const HALF_Z = 0.25; // a falling half squashes its layers together, so it falls flat like paper
// Where each hand holds the handle, back from the guard: the left hand by the guard, the right at the end.
const GRIP_L = -0.15 * SCALE, GRIP_R = -0.45 * SCALE;

// ---------- building flat pieces ----------
const LIT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const FLAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

function slab(p: Pt[], depth: number, color: THREE.Color, z = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(ccw(p).map((q) => new THREE.Vector2(q[0], q[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z - depth / 2);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

interface PieceGeo { lit: THREE.BufferGeometry[]; flat: THREE.BufferGeometry[]; outline: { pts: Pt[]; z: number }[] }
/** One piece as geometry: its share of the figure's rim and ink line (behind everything), an ink line and the
 *  paper for every paper shape, the prints, red slash marks. With `cut`, only the kept side of the line: the
 *  paper stops GAP short, so a thin red edge shows. */
function pieceGeo(piece: Piece, look: Look, marks: Pt[][], cut: Line | null): PieceGeo {
  const out: PieceGeo = { lit: [], flat: [], outline: [] };
  const sword = piece.name === SWORD;
  const keep = (p: Pt[], gap: number) => (cut ? clipHalf(p, cut, gap) : p);
  const add = (list: THREE.BufferGeometry[], p: Pt[], depth: number, col: THREE.Color, z: number) => { if (p.length >= 3) list.push(slab(p, depth, col, z)); };
  const ink = new THREE.Color(C.ink), red = new THREE.Color(C.red);
  const papers = dressPiece(piece, look).filter((s) => s.paper), back = Math.min(...papers.map((s) => s.z));
  for (const s of dressPiece(piece, look)) {
    const col = new THREE.Color(look.colors[s.role] ?? s.color);
    if (!s.paper) { add(out.lit, keep(s.pts, GAP), T, col, s.z); continue; }
    for (const [c, w, z] of sword ? SWORD_EDGE : BODY_EDGE) add(out.flat, keep(offset(s.pts, w), GAP), 0.003, new THREE.Color(c), sword ? back + z : z);
    add(out.flat, keep(offset(s.pts, SEAM), GAP), T * 0.6, ink, s.z);
    if (cut) add(out.flat, clipHalf(s.pts, cut), T * 0.8, red, s.z);
    const card = keep(s.pts, GAP);
    add(out.lit, card, T, col, s.z);
    if (card.length >= 3) out.outline.push({ pts: card, z: s.z });
    if (!sword) for (const lens of marks) add(out.flat, keep(clipConvex(s.pts, lens), GAP), T * 1.3, red, s.z);
  }
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

// ---------- the rig, read from the Blender rest pose ----------
const v2 = (p: THREE.Vector2): Pt => [p.x, p.y];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const vadd = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const rot = (a: number, v: Pt): Pt => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1]]; };
interface Arm { shoulder: Pt; l1: number; rest: number }
interface Dims { torso: Pt; head: Pt; skirtL: Pt; skirtR: Pt; armL: Arm; armR: Arm }
function dimsOf(p: Puppet): Dims {
  const arm = (a: PieceName, h: PieceName): Arm => {
    const d = sub(v2(p[h].rest), v2(p[a].rest));
    return { shoulder: v2(p[a].rest), l1: Math.hypot(d[0], d[1]), rest: Math.atan2(d[1], d[0]) };
  };
  return { torso: v2(p.torso.rest), head: v2(p.head.rest), skirtL: v2(p.skirt_L.rest), skirtR: v2(p.skirt_R.rest), armL: arm('arm_L', 'hand_L'), armR: arm('arm_R', 'hand_R') };
}
interface Rig { root: THREE.Group; parts: Record<PieceName, THREE.Group> }

// ---------- poses ----------
/** spreadF / spreadB: how far the front (rival-side) and back hakama halves swing out; the body drops to keep the
 *  feet on the page. lean: the torso's tilt (negative leans toward the rival). hilt / sword: where the sword's
 *  guard is (from the feet) and its angle. head: extra head tilt. */
export interface Pose { spreadF: number; spreadB: number; lean: number; head: number; hilt: [number, number]; sword: number }
function ik(S: Pt, G: Pt, L1: number, L2: number) {
  const dx = G[0] - S[0], dy = G[1] - S[1], d = clamp(Math.hypot(dx, dy), 0.02, L1 + L2 - 1e-3), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), up = base - A, E = vadd(S, [L1 * Math.cos(up), L1 * Math.sin(up)]);
  return { up, E, lo: Math.atan2(G[1] - E[1], G[0] - E[0]) };
}
function setPart(p: THREE.Object3D, pos: Pt, r: number) { p.position.x = pos[0]; p.position.y = pos[1]; p.rotation.z = r; }
function applyPose(pr: Record<PieceName, THREE.Group>, P: Pose, d: Dims) {
  const drop = d.torso[1] * (1 - Math.cos(Math.max(P.spreadF, P.spreadB)));
  setPart(pr.skirt_L, [d.skirtL[0], d.skirtL[1] - drop], P.spreadF);
  setPart(pr.skirt_R, [d.skirtR[0], d.skirtR[1] - drop], -P.spreadB);
  const hip: Pt = [d.torso[0], d.torso[1] - drop], onTorso = (p: Pt) => vadd(hip, rot(P.lean, sub(p, d.torso)));
  setPart(pr.torso, hip, P.lean);
  setPart(pr.head, onTorso(d.head), P.lean + P.head);
  const H = P.hilt, a = P.sword;
  setPart(pr.sword, H, a);
  for (const [arm, hand, A, grip] of [['arm_L', 'hand_L', d.armL, GRIP_L], ['arm_R', 'hand_R', d.armR, GRIP_R]] as const) {
    const S = onTorso(A.shoulder), k = ik(S, vadd(H, rot(a, [grip, 0])), A.l1, L2);
    setPart(pr[arm], S, k.up - A.rest);
    setPart(pr[hand], k.E, k.lo + Math.PI / 2); // the hand hangs straight down in the rest pose
  }
}
const POSE = {
  guard: {
    high: { spreadF: 0.14, spreadB: 0.1, lean: -0.05, head: -0.04, hilt: [0.42, 1.25], sword: 42 * D },
    low: { spreadF: 0.16, spreadB: 0.12, lean: -0.08, head: -0.02, hilt: [0.44, 0.98], sword: -25 * D },
  },
  wind: {
    high: { spreadF: 0.12, spreadB: 0.1, lean: 0.04, head: -0.06, hilt: [0.25, 1.95], sword: 62 * D },
    low: { spreadF: 0.16, spreadB: 0.14, lean: 0.06, head: 0.0, hilt: [-0.1, 0.95], sword: -150 * D },
  },
  // The cut itself (the active frames): the blade lies across the height it cuts (chest high or knee low), and its
  // tip is where the fight's reach ends (MOVES.reach, 1.8 m ahead of the centre). Check with the hitbox view (H).
  strike: {
    high: { spreadF: 0.28, spreadB: 0.2, lean: -0.16, head: -0.06, hilt: [0.6, 1.47], sword: -1 * D },
    low: { spreadF: 0.3, spreadB: 0.22, lean: -0.2, head: -0.04, hilt: [0.62, 0.86], sword: -12 * D },
  },
  // The follow-through (early recovery): the blade carries on past the cut.
  follow: {
    high: { spreadF: 0.28, spreadB: 0.2, lean: -0.16, head: -0.06, hilt: [0.55, 1.1], sword: -15 * D },
    low: { spreadF: 0.28, spreadB: 0.2, lean: -0.14, head: -0.04, hilt: [0.42, 1.05], sword: 12 * D },
  },
} as Record<'guard' | 'wind' | 'strike' | 'follow', Record<'high' | 'low', Pose>>;
// How far toward the full wind-up each move's key pose goes (lights are smaller motions). Every move cuts with
// the same strike pose, so its reach matches what's drawn.
const MOTION = { light: { windK: 0.45 }, heavy: { windK: 1 }, riposte: { windK: 0.6 } };
// A blocked heavy knocks the guard aside: blade thrown up and back, body rocked away.
const STAGGER: Pose = { spreadF: 0.1, spreadB: 0.24, lean: 0.2, head: 0.12, hilt: [0.15, 1.6], sword: 80 * D };
const POSE_KEYS = ['spreadF', 'spreadB', 'lean', 'head', 'sword'] as const;
function lerpPose(a: Pose, b: Pose, k: number, out = {} as Pose): Pose {
  for (const key of POSE_KEYS) out[key] = lerp(a[key], b[key], k);
  out.hilt = [lerp(a.hilt[0], b.hilt[0], k), lerp(a.hilt[1], b.hilt[1], k)]; return out;
}
const copyPose = (p: Pose) => lerpPose(p, p, 0);
// Turning around: the cut-out flips through edge-on in two held steps.
const FLIP = [0.3, 0.3, 0.7, 0.7, 1];

/** The key pose a puppeteer would set for this moment, and a name for it. */
function keyPose(f: Fighter, walkT: number): [Pose, string] {
  const g = POSE.guard[f.stance], mo = MOTION[f.atk], mv = MOVES[f.atk];
  const wind = () => lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK);
  switch (f.state) {
    case 'wind': return [wind(), 'w' + f.slash + f.atk];
    case 'active': return [POSE.strike[f.slash], 'a' + f.slash];
    case 'recover': return f.t < mv.rec * 0.45 ? [POSE.follow[f.slash], 'r' + f.slash] : [g, 'g' + f.stance];
    case 'stagger': return [STAGGER, 'sg'];
    case 'feint': return [lerpPose(POSE.guard[f.slash], POSE.wind[f.slash], mo.windK * 0.4), 'f' + f.slash];
    case 'stun': return [{ ...g, lean: 0.14, head: 0.16, hilt: [0.3, 0.95], sword: -35 * D }, 'st'];
    case 'land': return [{ ...g, spreadF: 0.3, spreadB: 0.26, lean: -0.1 }, 'ld'];
    case 'dash': { const back = f.dashDir !== f.facing; return [{ ...g, lean: back ? 0.12 : -0.12, spreadF: 0.24, spreadB: 0.2 }, back ? 'db' : 'df']; }
    default:
      if (f.y > 0) return f.vy > 0 ? [{ ...g, spreadF: 0.05, spreadB: 0.3, lean: -0.06 }, 'j1' + f.stance] : [{ ...g, spreadF: 0.2, spreadB: 0.2 }, 'j2' + f.stance];
      if (f.walk) { const s = Math.floor(walkT / 8) % 2; return [{ ...g, spreadF: s ? 0.24 : 0.06, spreadB: s ? 0.06 : 0.2 }, 'k' + s + f.stance]; }
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

  constructor(private scene: THREE.Scene, public look: Look, readonly seat: number, private physics: PaperPhysics) {
    this.pose = copyPose(POSE.guard[seat === 0 ? 'high' : 'low']);
    this.ibFrom = copyPose(this.pose);
    this.yaw = this.yawFrom = this.yawTo = seat === 0 ? 0 : Math.PI;
    PUPPET.then((p) => this.build(p)).catch((e) => console.error('Could not load the fighters:', e));
  }

  private build(p: Puppet) {
    this.puppet = p; this.dims = dimsOf(p);
    const root = new THREE.Group(), parts = {} as Record<PieceName, THREE.Group>;
    for (const name of PIECE_NAMES) { const g = new THREE.Group(); root.add(g); parts[name] = g; }
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

  /** Wear another look (between matches or bots). Cut marks and halves already on the page keep theirs. */
  setLook(look: Look) {
    if ((look.key ?? look.name) === (this.look.key ?? this.look.name)) return;
    this.look = look;
    if (this.rig) for (const name of PIECE_NAMES) this.rebuild(name);
  }

  /** Back to a fresh round: whole again, no cuts. With `keep` (Endless), the halves stay on the page. */
  reset(f: Fighter, keep = false) {
    this.clearMarks();
    if (keep) this.pileUp(); else this.dropHalves();
    if (this.rig && !this.rig.root.parent) this.scene.add(this.rig.root);
    this.pose = copyPose(POSE.guard[f.stance]); this.ib = 0; this.sig = '';
    this.yaw = this.yawFrom = this.yawTo = f.facing > 0 ? 0 : Math.PI; this.flipT = 99;
  }

  /** Update the pose for one fight frame: snap to the key pose, with one in-between when it changes. */
  stepPose(f: Fighter) {
    if (f.walk && f.y <= 0) this.walkT++;
    const [key, sig] = keyPose(f, this.walkT);
    if (sig !== this.sig) { this.ibFrom = copyPose(this.pose); this.ib = f.state === 'active' ? 0 : 1; this.sig = sig; }
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
    // Facing left is drawn mirrored rather than turned around, so the layers keep their order.
    // The turn still passes through edge-on: past 90 degrees the cut-out shows mirrored.
    const mirror = this.yaw > Math.PI / 2;
    r.position.set(f.x, f.y, 0); r.rotation.y = mirror ? this.yaw - Math.PI : this.yaw;
    r.scale.set(mirror ? -1 : 1, Math.max(0.001, fold), 1);
    applyPose(this.rig.parts, this.pose, this.dims);
  }

  /** A clean hit: a red slash where the blade crossed, cut through every piece of paper it passes. */
  addCut(_f: Fighter, P: [number, number], ang: number, heavy: boolean) {
    if (!this.rig || !this.puppet) return;
    this.rig.root.updateMatrixWorld(true);
    const lens = slashLens(P, ang, heavy ? 0.5 : 0.32, heavy ? 0.03 : 0.016), v = new THREE.Vector3();
    for (const name of PIECE_NAMES) {
      if (name === SWORD) continue;
      const inv = this.rig.parts[name].matrixWorld.clone().invert();
      const local = lens.map((q): Pt => { v.set(q[0], q[1], 0).applyMatrix4(inv); return [v.x, v.y]; });
      if (!this.puppet[name].shapes.some((s) => s.paper && clipConvex(s.pts, local).length)) continue;
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
        const m = new THREE.Matrix4().makeScale(1, 1, HALF_Z).multiply(hinv).multiply(M);
        for (const g of [...pg.lit, ...pg.flat]) g.applyMatrix4(m);
        lit.push(...pg.lit); flat.push(...pg.flat);
        for (const o of pg.outline) for (const q of o.pts) for (const z of [o.z - T, o.z + T]) { v.set(q[0], q[1], z).applyMatrix4(m); hull.push(v.x, v.y, v.z); }
      }
      holder.add(...meshes(lit, flat));
      // The top flies off along the blade; the legs keel over (a card can't stand on its own).
      const up = side > 0;
      const vel = new THREE.Vector3(dirAway * (up ? 1.8 : 0.8), up ? 1.6 : 0.4, (Math.random() - 0.5) * 0.5);
      const spin = up ? new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, -dirAway * 5)
        : new THREE.Vector3(-(3.2 + Math.random() * 1.2), (Math.random() - 0.5) * 2, -dirAway * 2.5);
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
  tip(out: THREE.Vector3) { return this.rig ? out.set(2.3 * SCALE, 0, 0).applyMatrix4(this.rig.parts.sword.matrixWorld) : out.set(0, 0, 0); }
}
