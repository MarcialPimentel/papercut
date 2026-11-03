// Draws the fight: listens to each fight frame and its events, and turns them into the 3D scene.

import * as THREE from 'three';
import { PAGES, RULES } from '../sim/rules';
import type { FightEvent, State } from '../sim/sim';
import { C, LOOKS, clamp, lerp, reduceMotion, type Look } from './common';
import { FighterView } from './fighter';
import { PaperPhysics } from './physics';
import { Fx } from './fx';
import { Hitboxes } from './hitboxes';
import { Notebook } from './notebook';
import { sfx } from '../audio/sounds';
import { FEEL } from '../feel';

/** Stereo position of a spot on the lane: left of the page plays left. */
const pan = (x: number) => clamp(x / RULES.edge, -1, 1) * 0.6;

export class View {
  readonly renderer: THREE.WebGLRenderer;
  // Near plane 0.5 (the camera never comes closer than ~6 units): depth precision for the thin paper layers.
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 160);
  readonly book: Notebook;
  readonly fighters: FighterView[];
  readonly fx: Fx;
  readonly physics = new PaperPhysics();
  /** The hitbox view (H): what the fight checks, drawn over the art. */
  readonly hitboxes: Hitboxes;
  private sceneryPage = -1;
  /** Endless: the look for each fresh bot (null = keep the current one). */
  spawnLook: (() => Look) | null = null;
  /** Called when a fighter loses part of the strip (for the HUD's falling sliver). */
  onStrip: (seat: number, hp: number, lost: number) => void = () => {};
  private shake = 0;
  private slowmo = 0;
  private killCam = 0;
  private koSeat = -1;
  private turnFrom = 0;
  private clock = 0;
  private cam = { x: 0, y: 1.1, dist: 11, yaw: 0.16, pitch: 0.2 };
  private _w = new THREE.Vector3();
  /** Your seat (for win/lose sounds); seat 0 offline. */
  you = 0;
  // Last frame's fighter states, height and clock second, to hear slashes start, landings and the countdown.
  private was = [{ state: '', y: 0 }, { state: '', y: 0 }];
  private lastSec = 0;

  constructor(canvas: HTMLCanvasElement, private stage: HTMLElement, labels: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.book = new Notebook(this.renderer);
    this.fighters = LOOKS.map((look, i) => new FighterView(this.book.scene, look, i, this.physics));
    this.hitboxes = new Hitboxes(this.book.scene);
    this.fx = new Fx(this.book.scene, this.camera, labels, (p, m) => this.book.flatShape(p, m));
    for (const f of this.fighters) f.onLand = (x, dir) => { this.shake = Math.max(this.shake, 0.07); this.fx.burst(x, 0.1, [C.paper, C.red], 8, dir); };
    this.setPage(0);
    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();
  }

  /** Show a spread, and give its pop-ups to the paper physics. */
  private setPage(p: number) {
    this.book.setPage(p);
    if (this.sceneryPage !== p) { this.sceneryPage = p; this.physics.setScenery(this.book.popupHulls()); }
  }

  /** Resolution scale from the Settings screen (0.5-1): draw fewer pixels on weaker machines. */
  setScale(scale: number) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * scale);
    this.resize();
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return; // not laid out yet
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Dress both fighters (seat 0, seat 1) for the match. */
  setLooks(looks: [Look, Look]) { this.fighters.forEach((f, i) => f.setLook(looks[i])); }

  /** Start drawing a new match from this state. */
  reset(s: State) {
    this.fx.clearFlecks();
    this.book.endTurn(); this.book.setFold(1); this.setPage(s.page);
    this.fighters.forEach((v, i) => v.reset(s.f[i]));
    this.shake = this.slowmo = this.killCam = 0; this.koSeat = -1;
    this.was = s.f.map((f) => ({ state: f.state, y: f.y })); this.lastSec = Math.ceil(s.clock / 60);
  }

  /** Screen y (pixels from the top of the canvas) of a fighter's waist: the cursor's guard line. */
  waistY(s: State, seat: number) {
    const f = s.f[seat];
    this._w.set(f.x, f.y + 1.0, 0).project(this.camera);
    return ((1 - this._w.y) / 2) * this.renderer.domElement.clientHeight;
  }

  /** One fight frame happened. */
  onStep(s: State, events: FightEvent[]) {
    for (const e of events) this.event(s, e);
    s.f.forEach((f, i) => { if (f.alive) this.fighters[i].stepPose(f); });
    this.listen(s);
  }

  /** Sounds that come from state changes rather than events. */
  private listen(s: State) {
    s.f.forEach((f, i) => {
      const w = this.was[i];
      if (f.alive && w.state === 'wind' && f.state === 'active') sfx.whoosh(f.atk !== 'light', pan(f.x));
      if (f.alive && w.y > 0 && f.y <= 0) sfx.land(pan(f.x));
      w.state = f.state; w.y = f.y;
    });
    const sec = Math.ceil(s.clock / 60);
    if (s.phase === 'fight' && sec !== this.lastSec && sec <= 10 && sec > 0) sfx.tick(sec);
    this.lastSec = sec;
    // The round result sounds when its banner appears.
    if (s.phase === 'ko' && s.phaseT === 54 && s.roundWinner >= 0 && !(s.cfg.wins > 0 && s.f.some((f) => f.wins >= s.cfg.wins))) sfx.roundEnd(s.roundWinner === this.you);
  }

  private event(s: State, e: FightEvent) {
    const fx = this.fx;
    switch (e.k) {
      case 'swing': if (e.atk === 'heavy') sfx.windup(pan(s.f[e.p].x)); break;
      case 'feint': fx.label('Feint', s.f[e.p].x, s.f[e.p].y + 2.3, 'gold'); break; // silent: the fold already played when the heavy started
      case 'jump': case 'dash': sfx.hop(pan(s.f[e.p].x)); break;
      case 'whiff':
        fx.razor(e.x, e.y, e.ang, C.ink, e.heavy ? 2.8 : 1.8);
        if (e.over) fx.label('Over', s.f[1 - e.p].x, s.f[1 - e.p].y + 2.2, 'gold');
        break;
      case 'clash':
        fx.razor(e.x, e.y, e.ang, C.ink, 2.2); fx.burst(e.x, e.y, [C.paper, C.ink], 10, 1); fx.label('Clash', e.x, e.y + 0.6); sfx.clash(pan(e.x));
        this.shake = 0.08;
        break;
      case 'block': {
        const dir = s.f[e.p].facing;
        fx.razor(e.x, e.y, e.ang, C.ink, 2.2); fx.burst(e.x, e.y, [C.paper, C.paper, C.ink], 8, dir); fx.label(e.stagger ? 'Stagger' : 'Block', e.x, e.y + 0.6, e.stagger ? 'gold' : undefined); sfx.block(e.heavy, pan(e.x));
        this.shake = e.stagger ? 0.11 : e.heavy ? 0.08 : 0.04;
        if (e.chip) this.onStrip(1 - e.p, s.f[1 - e.p].hp, e.chip);
        break;
      }
      case 'parry':
        fx.razor(e.x, e.y, e.ang, C.legal, 2.4); fx.burst(e.x, e.y, [C.legal, C.paper], 10, s.f[e.p].facing); fx.label('Parry', e.x, e.y + 0.6, 'gold'); sfx.parry(pan(e.x));
        this.shake = 0.06;
        break;
      case 'hit': {
        const def = 1 - e.p, dir = s.f[e.p].facing, y = e.y + (Math.random() - 0.5) * 0.06;
        this.fighters[def].addCut(s.f[def], [e.x, y], e.ang + (Math.random() - 0.5) * 0.17, e.heavy);
        fx.razor(e.x, y, e.ang, C.red, e.heavy ? 3.8 : 2.4); fx.burst(e.x, y, [C.red, C.paper, C.redDeep], e.heavy ? 18 : 8, dir);
        if (e.heavy) { fx.label(e.atk === 'riposte' ? 'Riposte' : 'Cut', e.x, y + 0.6, 'cut'); sfx.cut(pan(e.x)); } else sfx.hit(pan(e.x));
        this.shake = e.heavy ? 0.14 : 0.05;
        this.onStrip(def, s.f[def].hp, e.dmg);
        break;
      }
      case 'ko': {
        const def = 1 - e.p, dir = s.f[e.p].facing;
        fx.label(e.counter ? 'Counter cut' : 'K.O.', e.x, e.y + 0.9, 'cut');
        fx.razor(e.x, e.y, e.ang, C.red, 4.6); fx.burst(e.x, e.y, [C.red, C.redDeep, C.paper, C.red], 30, dir); sfx.ko(e.counter, pan(e.x));
        this.shake = 0.2; this.slowmo = FEEL.slowmo; this.killCam = 1.6; this.koSeat = def;
        this.fighters[def].split([e.x, e.y], e.ang, dir);
        this.onStrip(def, 0, e.dmg);
        break;
      }
      case 'heal': fx.label(`Strip +${e.amt}`, s.f[e.p].x, s.f[e.p].y + 2.3, 'gold'); break;
      case 'turn': sfx.page(); this.turnFrom = s.page; break;
      case 'swap':
        this.fx.clearFlecks();
        this.setPage(e.page);
        this.fighters.forEach((v, i) => v.reset(s.f[i]));
        this.killCam = 0; this.koSeat = -1;
        break;
      case 'spawn':
        // Endless: a fresh bot stands in; the cut bots' halves stay on the page (the last 5). Your own cuts stay too.
        this.fx.clearFlecks();
        if (this.spawnLook) this.fighters[e.p].setLook(this.spawnLook());
        this.fighters[e.p].reset(s.f[e.p], true);
        this.killCam = 0; this.koSeat = -1;
        break;
      case 'restart': this.reset(s); break;
      case 'cut': sfx.fight(); break;
      case 'round': sfx.round(); break;
      case 'roundEnd': if (e.how === 'Time') sfx.timeUp(); break;
      case 'over': sfx.matchEnd(e.winner === this.you); break;
    }
  }

  /** Draw one screen frame. `glint` shows the dummy's tell (0-1) on that seat's blade. */
  draw(s: State, real: number, glint?: { seat: number; k: number }) {
    this.clock += real;
    let scale = 1;
    if (this.slowmo > 0) { this.slowmo -= real; scale = this.slowmo > 0.25 ? FEEL.slowSpeed : lerp(1, FEEL.slowSpeed, this.slowmo / 0.25); }
    this.killCam = Math.max(0, this.killCam - real);
    this.shake = Math.max(0, this.shake - real * 0.9);
    if (s.phase === 'turn') this.book.turn(s.phaseT / 60, this.turnFrom, s.turnTo);
    else if (this.book.fold !== 1) { this.book.endTurn(); this.book.setFold(1); }
    const fold = this.book.fold;
    this.physics.step(real * scale);
    s.f.forEach((f, i) => { this.fighters[i].draw(f, real, fold, this.clock); this.fighters[i].updateHalves(real * scale, fold); });
    this.fx.update(real, real * scale, fold);
    this.hitboxes.update(s);
    const g = this.fx.glint;
    if (glint && glint.k > 0 && s.f[glint.seat].alive) {
      const tip = this.fighters[glint.seat].tip(new THREE.Vector3());
      g.position.set(tip.x, tip.y, tip.z + 0.3); g.visible = true;
      const k = 1 - glint.k;
      g.scale.setScalar(0.4 + Math.sin(k * Math.PI) * 1.1); g.quaternion.copy(this.camera.quaternion); g.rotateZ(k * 2);
    } else g.visible = false;
    this.updateCamera(s, real);
    this.renderer.render(this.book.scene, this.camera);
  }

  get sky() { return this.book.sky; }
  get pageName() { return PAGES[this.book.page]?.name ?? ''; }

  private updateCamera(s: State, real: number) {
    const alive = s.f.filter((f) => f.alive);
    const xs = alive.length ? alive.map((f) => f.x) : [0];
    let cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = 1.1, yaw = 0.16, pitch = 0.2;
    const vf = THREE.MathUtils.degToRad(this.camera.fov / 2), aspect = this.camera.aspect, portrait = aspect < 1;
    const half = (Math.max(...xs) - Math.min(...xs)) / 2 + (portrait ? 1.3 : 2.1), vhalf = portrait ? 1.7 : 1.6;
    let dist = Math.max(half / (Math.tan(vf) * aspect), vhalf / Math.tan(vf));
    const halves = this.koSeat >= 0 ? this.fighters[this.koSeat].halves : [];
    if (this.killCam > 0 && halves.length) {
      const h = halves[halves.length - 1];
      cx = h.base.x + h.dir * 0.4; cy = 0.95; dist *= 0.82; yaw = 0.72 * h.dir; pitch = 0.18;
    }
    if (s.phase === 'turn') { cx = 0; cy = 0.4; dist = Math.max(dist, portrait ? 26 : 17); pitch = 0.62; yaw = 0.12; }
    if (s.phase === 'over') { cx = 0; cy = 1.2; yaw = 0.5; pitch = 0.25; dist = Math.max(dist * 0.8, 8); }
    const k = 1 - Math.exp(-real * (this.killCam > 0 || s.phase === 'turn' ? 5 : 4));
    const c = this.cam;
    if (!Number.isFinite(dist)) return;
    c.x = lerp(c.x, cx, k); c.y = lerp(c.y, cy, k); c.dist = lerp(c.dist, dist, k); c.yaw = lerp(c.yaw, yaw, k); c.pitch = lerp(c.pitch, pitch, k);
    const P = clamp(c.pitch, -0.05, 1.1);
    const sh = this.shake * FEEL.shake * (reduceMotion ? 0.3 : 1), sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    this.camera.position.set(c.x + Math.sin(c.yaw) * Math.cos(P) * c.dist + sx, c.y + Math.sin(P) * c.dist + sy, Math.cos(c.yaw) * Math.cos(P) * c.dist);
    this.camera.lookAt(c.x + sx * 0.5, c.y, 0);
  }
}
