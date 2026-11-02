// The hitbox view (H): draws what the fight checks, over the art, so you can see whether a hit should land.
// Each fighter's body is a box (green; red while open to a counter cut). A slash shows its cut line out to the
// blade's tip: faint while winding up (where it will reach, step-in included), solid while it cuts.
// Drawing only: it reads the fight and never changes it.

import * as THREE from 'three';
import { BODY, MOVES, RULES } from '../sim/rules';
import { slashLine, type Fighter, type State } from '../sim/sim';

const Z = 0; // in the fighters' plane (drawn on top of everything)
const MAX = 64; // line segments

export class Hitboxes {
  on = false;
  private pos = new Float32Array(MAX * 6);
  private col = new Float32Array(MAX * 6);
  private geo = new THREE.BufferGeometry();
  private lines: THREE.LineSegments;
  private n = 0;

  constructor(scene: THREE.Scene) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true });
    this.lines = new THREE.LineSegments(this.geo, mat);
    this.lines.renderOrder = 999; this.lines.frustumCulled = false; this.lines.visible = false;
    scene.add(this.lines);
  }

  toggle() { this.on = !this.on; this.lines.visible = this.on; }

  private seg(x1: number, y1: number, x2: number, y2: number, c: THREE.Color) {
    if (this.n >= MAX) return;
    const i = this.n++ * 6;
    this.pos.set([x1, y1, Z, x2, y2, Z], i);
    this.col.set([c.r, c.g, c.b, c.r, c.g, c.b], i);
  }

  private box(x1: number, y1: number, x2: number, y2: number, c: THREE.Color) {
    this.seg(x1, y1, x2, y1, c); this.seg(x2, y1, x2, y2, c); this.seg(x2, y2, x1, y2, c); this.seg(x1, y2, x1, y1, c);
  }

  update(s: State) {
    if (!this.on) return;
    this.n = 0;
    for (const f of s.f) if (f.alive) this.fighter(f);
    this.geo.setDrawRange(0, this.n * 2);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }

  private fighter(f: Fighter) {
    const open = (f.state === 'wind' && f.atk === 'heavy') || (f.state === 'recover' && f.whiffed && f.t < RULES.missOpen);
    const body = open ? RED : f.state === 'stagger' || f.state === 'stun' ? GOLD : GREEN;
    this.box(f.x - BODY.half, f.y + BODY.feet, f.x + BODY.half, f.y + BODY.top, body);
    if (f.state !== 'wind' && f.state !== 'active') return;
    const M = MOVES[f.atk], y = slashLine(f).y;
    // While winding up: where the slash will reach once the step-in is done. While cutting: its reach now.
    const left = f.state === 'wind' ? M.lunge * Math.min(1, (M.wind - f.t) / Math.min(4, M.wind)) : 0;
    const tip = f.x + f.facing * (M.reach + left);
    const c = f.state === 'active' ? BLADE : FAINT;
    this.seg(f.x, y, tip, y, c);
    this.seg(tip, y - 0.12, tip, y + 0.12, c);
  }
}

const GREEN = new THREE.Color('#2fbf4a'), RED = new THREE.Color('#e0262f'), GOLD = new THREE.Color('#e6a817');
const BLADE = new THREE.Color('#1060ff'), FAINT = new THREE.Color('#8fb0ff');
