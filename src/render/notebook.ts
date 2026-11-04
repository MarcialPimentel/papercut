// The world: a 3D notebook open on a desk, its pop-up scenery, lighting and the page turn.
// Ported from the art-direction mock-up (docs/art/papercut-mockup.html).

import * as THREE from 'three';
import { PAGES } from '../sim/rules';
import { C, coarse, mulberry32 } from './common';
import { PAGE_SEGS, PD, PW, PZ, pageY } from './page';
export { PD, PW, PZ };

/** Dojo Defence's front cover is the same marble board as the back cover, in daylight. */
const texKey = (key: string) => (key === 'front' ? 'cover' : key);

export class Notebook {
  readonly scene = new THREE.Scene();
  private hemi = new THREE.HemisphereLight(0xffffff, 0xe6e0d6, 1.5);
  private sun = new THREE.DirectionalLight(0xffffff, 1.8);
  private pageL: THREE.Mesh;
  private pageR: THREE.Mesh;
  private popups: THREE.Group | null = null;
  private leaf: THREE.Group | null = null;
  private tex: Record<string, THREE.CanvasTexture>;
  private texCache = new Map<string, THREE.Texture>();
  private lambertCache = new Map<string, THREE.MeshLambertMaterial>();
  page = -1;
  fold = 1;
  /** Sky color for the page behind the canvas. */
  sky = '#E9E4DA';

  constructor(private renderer: THREE.WebGLRenderer) {
    const { scene, hemi, sun } = this;
    this.tex = this.makeTextures();
    scene.add(hemi);
    sun.position.set(-5, 10, 8); sun.target.position.set(0, 0, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -6, near: 1, far: 34 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    scene.fog = new THREE.Fog(0xe9e4da, 26, 70);

    const book = new THREE.Group(); scene.add(book);
    this.pageL = new THREE.Mesh(this.pageGeo(-1), this.lambert('#FFFFFF'));
    this.pageR = new THREE.Mesh(this.pageGeo(1), this.lambert('#FFFFFF'));
    this.pageL.receiveShadow = this.pageR.receiveShadow = true;
    book.add(this.pageL, this.pageR);
    for (const s of [-1, 1]) {
      const e = (rx: number) => this.lambert('#FFFFFF', this.texRepeat('edges', rx, 1));
      const stack = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.1, 0.24, PD - 0.06), [e(1), e(1), this.lambert('#F2EEE4'), this.lambert('#F2EEE4'), e(3), e(3)]);
      stack.position.set(s * (PW / 2 + 0.02), -0.235, PZ); stack.receiveShadow = true; book.add(stack);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.3, 0.07, PD + 0.45), this.lambert('#FFFFFF', this.texRepeat('cover', 2.5, 1.6)));
      cover.position.set(s * (PW / 2 + 0.12), -0.39, PZ); cover.castShadow = cover.receiveShadow = true; book.add(cover);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, PD + 0.45, 8, 1, true, Math.PI / 2, Math.PI), this.lambert(C.ink));
    spine.rotation.x = Math.PI / 2; spine.position.set(0, -0.4, PZ); book.add(spine);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), this.lambert('#FFFFFF', this.texRepeat('kraft', 18, 12)));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.43; desk.receiveShadow = true; scene.add(desk);
    const pencil = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 5.2, 6), this.lambert(C.legal, null, true)); body.rotation.z = Math.PI / 2; pencil.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 6), this.lambert('#E9D3B0', null, true)); tip.rotation.z = -Math.PI / 2; tip.position.x = 2.8; pencil.add(tip);
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), this.lambert(C.ink, null, true)); lead.rotation.z = -Math.PI / 2; lead.position.x = 3.02; pencil.add(lead);
    pencil.position.set(-3, -0.32, 3.4); pencil.rotation.y = 0.18; pencil.traverse((o) => { o.castShadow = true; }); scene.add(pencil);
  }

  // ---------- paper textures (generated, no downloads) ----------
  private canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
    const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d')!, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); return t;
  }
  private makeTextures() {
    const grain = (g: CanvasRenderingContext2D, s: number, seed: number, a = 0.05) => {
      const r = mulberry32(seed);
      for (let i = 0; i < (s * s) / 70; i++) { g.fillStyle = `rgba(70,60,50,${(a * r()).toFixed(3)})`; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
    };
    const ruled = (bg: string, line: string, seed: number) => this.canvasTex(512, (g, s) => {
      g.fillStyle = bg; g.fillRect(0, 0, s, s); grain(g, s, seed); g.fillStyle = line;
      for (let i = 0; i < 8; i++) g.fillRect(0, (i * s) / 8 + s / 16, s, 3);
    });
    return {
      graph: this.canvasTex(512, (g, s) => {
        g.fillStyle = C.paper; g.fillRect(0, 0, s, s); grain(g, s, 3);
        const n = 10, st = s / n;
        for (let i = 0; i < n; i++) { const m = i % 5 === 0; g.fillStyle = m ? '#86B2D4' : '#B7D2E7'; const w = m ? 3 : 1.6; g.fillRect(i * st, 0, w, s); g.fillRect(0, i * st, s, w); }
      }),
      lined: ruled(C.paper, '#8FB0D3', 5),
      legal: ruled(C.legal, '#7FA3CC', 7),
      cover: this.canvasTex(512, (g, s) => {
        g.fillStyle = C.marble; g.fillRect(0, 0, s, s); const r = mulberry32(11);
        const blob = (x: number, y: number, rad: number, col: string) => {
          g.fillStyle = col; g.beginPath(); const k = 3 + Math.floor(r() * 4);
          for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2 + r() * 0.6, rr = rad * (0.5 + r() * 0.8); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.closePath(); g.fill();
        };
        for (let i = 0; i < 900; i++) {
          const x = r() * s, y = r() * s, rad = 1 + r() * 5, col = r() < 0.78 ? '#F1EFE8' : '#8E8B94';
          for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) if (x + ox > -12 && x + ox < s + 12 && y + oy > -12 && y + oy < s + 12) blob(x + ox, y + oy, rad, col);
        }
      }),
      kraft: this.canvasTex(256, (g, s) => {
        g.fillStyle = C.kraft; g.fillRect(0, 0, s, s); const r = mulberry32(13);
        for (let i = 0; i < 700; i++) {
          g.strokeStyle = `rgba(${r() < 0.5 ? '90,60,30' : '230,200,160'},${0.18 * r()})`; g.beginPath();
          const x = r() * s, y = r() * s, a = r() * Math.PI; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke();
        }
      }),
      edges: this.canvasTex(256, (g, s) => {
        g.fillStyle = '#F2EEE4'; g.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 4) { g.fillStyle = y % 8 ? '#DCD6C8' : '#E8E3D7'; g.fillRect(0, y, s, 1.5); }
      }),
    };
  }
  texRepeat(key: string, rx: number, ry: number) {
    const k = key + rx + ',' + ry;
    if (!this.texCache.has(k)) { const t = this.tex[key].clone(); t.needsUpdate = true; t.repeat.set(rx, ry); this.texCache.set(k, t); }
    return this.texCache.get(k)!;
  }
  lambert(color: string, map: THREE.Texture | null = null, flat = false) {
    const k = color + (map ? map.uuid : '') + flat;
    if (!this.lambertCache.has(k)) this.lambertCache.set(k, new THREE.MeshLambertMaterial({ color, map, flatShading: flat }));
    return this.lambertCache.get(k)!;
  }
  private paperMat(key: string) { return this.lambert('#FFFFFF', this.texRepeat(texKey(key), PW / 2.6, PD / 2.6)); }

  private pageGeo(side: number) {
    const g = new THREE.PlaneGeometry(PW, PD, PAGE_SEGS, 1); g.rotateX(-Math.PI / 2); g.translate((side * PW) / 2, 0, PZ);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, pageY(x)); }
    g.computeVertexNormals(); return g;
  }

  // ---------- pop-ups: everything here folds flat when the page turns ----------
  private flatCut(pts: number[][], mat: THREE.Material) {
    const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  flatShape(pts: number[][], mat: THREE.Material) { return this.flatCut(pts, mat); }
  private ngon(r: number, k = 16) { const p: number[][] = []; for (let i = 0; i < k; i++) { const a = Math.PI / k + (i / k) * Math.PI * 2; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
  private addFlat(par: THREE.Object3D, pts: number[][], mat: THREE.Material, x: number, y: number, z: number, hair = true) {
    const g = new THREE.Group(); g.position.set(x, y, z); const m = this.flatCut(pts, mat); m.position.z = 0.01; g.add(m);
    if (hair) g.add(this.flatCut(pts.map((p) => [p[0] * 1.04, p[1] * 1.04]), this.lambert(C.ink)));
    par.add(g); return g;
  }
  private backdrop(par: THREE.Group, key: string) {
    const out: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(PW * 0.94, 4.6, 1, 1); g.translate(s * PW * 0.47, 2.3, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * PW * 0.94) / 2.6, (uv.getY(i) * 4.6) / 2.6);
      const m = new THREE.Mesh(g, this.lambert('#FFFFFF', this.tex[texKey(key)])); m.receiveShadow = true;
      const holder = new THREE.Group(); holder.position.set(0, 0, PZ - PD / 2 + 0.25); holder.rotation.y = -s * 0.2; holder.add(m);
      const hairline = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.94 + 0.06, 4.66), this.lambert(C.ink)); hairline.position.set(s * PW * 0.47, 2.3, -0.01); holder.add(hairline);
      par.add(holder); out.push(holder);
    }
    return out;
  }
  private pyramid(par: THREE.Object3D, key: string, x: number, z: number, r: number, h: number, rotY = 0.3) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), this.lambert('#FFFFFF', this.texRepeat(key, 0.7, 0.7), true));
    m.position.set(x, h / 2, z); m.rotation.y = rotY; m.castShadow = m.receiveShadow = true; par.add(m);
  }
  private torii(par: THREE.Object3D, x: number, z: number, sc: number, mat: THREE.Material) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc); par.add(g);
    const add = (geo: THREE.BufferGeometry, px: number, py: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, 0); m.castShadow = true; g.add(m); };
    add(new THREE.CylinderGeometry(0.08, 0.09, 2.1, 6), -0.78, 1.05); add(new THREE.CylinderGeometry(0.08, 0.09, 2.1, 6), 0.78, 1.05);
    add(new THREE.BoxGeometry(2.2, 0.14, 0.16), 0, 1.66); add(new THREE.BoxGeometry(2.9, 0.18, 0.24), 0, 2.08); add(new THREE.BoxGeometry(0.14, 0.4, 0.12), 0, 1.86);
  }
  private bamboo(par: THREE.Object3D, x: number, z: number, h: number, r: number, rng: () => number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); par.add(g);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), this.lambert('#E8CD5E', null, true)); st.position.y = h / 2; st.castShadow = true; g.add(st);
    for (let y = 0.7 + rng() * 0.4; y < h; y += 0.8 + rng() * 0.4) { const n = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.04, 6), this.lambert(C.ink)); n.position.y = y; g.add(n); }
    for (let i = 0; i < 3; i++) {
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 3), this.lambert('#D4B640', null, true));
      lf.position.set(0, h * (0.5 + rng() * 0.45), 0); lf.rotation.set(rng() * 2, rng() * 6, Math.PI / 2 + (rng() - 0.5)); lf.castShadow = true; g.add(lf);
    }
  }
  private castle(par: THREE.Object3D, x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); par.add(g);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, py: number, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = py; m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); };
    const wall = this.lambert('#FFFFFF', this.texRepeat('lined', 0.6, 0.6), true);
    add(new THREE.BoxGeometry(2.4, 1.0, 1.6), this.lambert('#D9D4C8', null, true), 0.5);
    add(new THREE.BoxGeometry(1.6, 0.8, 1.1), wall, 1.4);
    add(new THREE.ConeGeometry(1.45, 0.5, 4), this.lambert(C.ink, null, true), 2.05, Math.PI / 4);
    add(new THREE.BoxGeometry(1.0, 0.6, 0.8), wall, 2.5);
    add(new THREE.ConeGeometry(0.95, 0.45, 4), this.lambert(C.ink, null, true), 3.0, Math.PI / 4);
  }
  private lantern(par: THREE.Object3D, x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); par.add(g);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), this.lambert(C.ink)); post.position.y = 0.95; g.add(post);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 6), new THREE.MeshBasicMaterial({ color: '#F9E58E' })); body.position.y = 2.1; g.add(body);
    for (const yy of [1.85, 2.35]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 6), this.lambert(C.ink)); c.position.y = yy; g.add(c); }
    const L = new THREE.PointLight(0xffd98a, 9, 7, 1.6); L.position.set(0, 2.1, 0.5); g.add(L);
  }
  private buildPopups(page: number) {
    const P = PAGES[page], g = new THREE.Group();
    const [bl, br] = this.backdrop(g, P.key);
    const mb = (s: number) => (s < 0 ? bl : br);
    if (P.key === 'graph') {
      this.addFlat(mb(1), this.ngon(0.85), new THREE.MeshBasicMaterial({ color: C.legal }), 4.3, 3.4, 0.05);
      this.addFlat(mb(-1), [[0, 0], [2.6, 0], [2.9, 0.24], [0.3, 0.24]], this.lambert('#FFFFFF', this.texRepeat('lined', 1, 0.3)), -6.6, 3.8, 0.05);
      this.addFlat(mb(1), [[0, 0], [1.8, 0], [2.1, 0.24], [0.3, 0.24]], this.lambert('#FFFFFF', this.texRepeat('lined', 1, 0.3)), 1.2, 3.0, 0.05);
      this.pyramid(g, 'cover', -4.6, PZ - 1.9, 1.7, 2.8, 0.2); this.pyramid(g, 'cover', 3.4, PZ - 2.1, 2.1, 2.3, 0.5); this.pyramid(g, 'cover', -1.4, PZ - 2.3, 1.3, 1.8, 0.1);
      this.torii(g, -5.6, PZ - 0.6, 1.15, this.lambert(C.ink, null, true));
    } else if (P.key === 'lined') {
      this.addFlat(mb(-1), this.ngon(0.7), new THREE.MeshBasicMaterial({ color: C.ink }), -4.4, 3.4, 0.05, false);
      this.addFlat(mb(1), [[0, 0], [2.6, 0], [2.9, 0.24], [0.3, 0.24]], this.lambert('#FFFFFF', this.texRepeat('graph', 1, 0.3)), 0.8, 3.9, 0.05);
      this.castle(g, 4.4, PZ - 1.6);
      this.pyramid(g, 'graph', -3.6, PZ - 2.0, 1.9, 2.4, 0.4);
      this.torii(g, -6.1, PZ - 0.5, 1.05, this.lambert('#FFFFFF', this.texRepeat('graph', 0.5, 0.5), true));
    } else if (P.key === 'legal') {
      this.addFlat(mb(1), this.ngon(0.7), new THREE.MeshBasicMaterial({ color: C.ink }), 4.6, 3.6, 0.05, false);
      const r = mulberry32(21);
      for (let i = 0; i < 24; i++) { let x = -8 + r() * 16; if (Math.abs(x) < 2.2) x += x < 0 ? -2.2 : 2.2; this.bamboo(g, x, PZ - 0.9 - r() * 1.7, 3.6 + r() * 2.4, 0.08 + r() * 0.05, r); }
    } else if (P.key === 'front') {
      // Dojo Defence: the front cover by day, the back cover's scenery mirrored, with a paper sun.
      this.addFlat(mb(1), this.ngon(0.85), new THREE.MeshBasicMaterial({ color: C.legal }), 4.0, 3.5, 0.05);
      this.pyramid(g, 'graph', 4.4, PZ - 1.9, 1.8, 2.6, 0.3); this.pyramid(g, 'graph', -3.8, PZ - 2.1, 2.0, 2.2, 0.6);
      this.torii(g, -5.2, PZ - 0.6, 1.1, this.lambert(C.ink, null, true));
    } else {
      this.addFlat(mb(-1), this.ngon(0.8), new THREE.MeshBasicMaterial({ color: '#F3F1EA' }), -4.0, 3.5, 0.05);
      this.pyramid(g, 'lined', -4.4, PZ - 1.9, 1.8, 2.6, 0.3); this.pyramid(g, 'lined', 3.8, PZ - 2.1, 2.0, 2.2, 0.6);
      this.torii(g, 5.2, PZ - 0.6, 1.1, this.lambert(C.paper, null, true));
      this.lantern(g, -2.6, PZ - 0.5); this.lantern(g, 2.6, PZ - 0.5);
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return g;
  }

  private setSpread(p: number, which: 'both' | 'left' | 'right' = 'both') {
    const mat = this.paperMat(PAGES[p].key);
    if (which !== 'right') this.pageL.material = mat;
    if (which !== 'left') this.pageR.material = mat;
  }

  /** Show a spread with its pop-ups and lighting. */
  setPage(p: number) {
    if (p === this.page) return;
    this.page = p;
    this.setSpread(p);
    if (this.popups) this.scene.remove(this.popups);
    this.popups = this.buildPopups(p); this.scene.add(this.popups);
    this.popups.scale.y = Math.max(0.001, this.fold);
    const P = PAGES[p];
    const L = 'night' in P ? { hemi: [0x9aa8d0, 0x1a1a24, 0.75], sun: [0xc9d6ff, 1.0], sky: '#0D0C10' }
      : P.key === 'legal' ? { hemi: [0xffffff, 0xf0e3b0, 1.45], sun: [0xfff6dd, 1.8], sky: '#EFE6CC' }
      : { hemi: [0xffffff, 0xe6e0d6, 1.5], sun: [0xffffff, 1.8], sky: '#E9E4DA' };
    this.hemi.color.set(L.hemi[0] as number); this.hemi.groundColor.set(L.hemi[1] as number); this.hemi.intensity = L.hemi[2] as number;
    this.sun.color.set(L.sun[0] as number); this.sun.intensity = L.sun[1] as number;
    this.sky = L.sky as string;
    this.scene.background = new THREE.Color(this.sky); (this.scene.fog as THREE.Fog).color.set(this.sky);
  }

  /** The pop-ups as solid shapes for the paper physics: each one's corners in world space, standing up. */
  popupHulls(): Float32Array[] {
    const g = this.popups;
    if (!g) return [];
    const was = g.scale.y; g.scale.y = 1; g.updateMatrixWorld(true);
    const out: Float32Array[] = [], v = new THREE.Vector3(), box = new THREE.Box3();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      box.setFromObject(m);
      const size = box.getSize(v);
      if (Math.max(size.x, size.y, size.z) < 0.25 || Math.min(size.x, size.y, size.z) < 0.02) return; // tiny bits and flat cut-outs
      const p = m.geometry.attributes.position, pts = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pts.set([v.x, v.y, v.z], i * 3); }
      out.push(pts);
    });
    g.scale.y = was; g.updateMatrixWorld(true);
    return out;
  }

  setFold(v: number) { this.fold = v; if (this.popups) this.popups.scale.y = Math.max(0.001, v); }

  /**
   * The page turn, driven by seconds since it began: 0-0.35 fold flat, 0.35-1.15 the leaf flips,
   * then the next spread pops up. `from`/`to` are page indexes. `back`: the left leaf flips over to the right
   * (Dojo Defence, running toward the front cover).
   */
  turn(t: number, from: number, to: number, back = false) {
    const easeIn = (k: number) => k * k, easeOut = (k: number) => 1 - (1 - k) * (1 - k);
    const easeIO = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const fold = t < 0.35 ? 1 - easeIn(t / 0.35) : t < 1.15 ? 0 : easeOut(Math.min(1, (t - 1.15) / 0.45));
    this.setFold(Math.max(0.001, fold));
    if (t >= 0.35 && t < 1.15 && !this.leaf) {
      const geo = new THREE.PlaneGeometry(PW, PD); geo.rotateX(-Math.PI / 2); geo.translate((back ? -PW : PW) / 2, 0.02, PZ);
      this.leaf = new THREE.Group();
      const top = new THREE.Mesh(geo, this.paperMat(PAGES[from].key));
      const under = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.paperMat(PAGES[to].key).map, side: THREE.BackSide }));
      top.castShadow = true; this.leaf.add(top, under); this.scene.add(this.leaf);
      this.setSpread(to, back ? 'left' : 'right');
    }
    if (this.leaf) {
      const k = Math.min(1, Math.max(0, (t - 0.35) / 0.8));
      this.leaf.rotation.z = (back ? -Math.PI : Math.PI) * easeIO(k); this.leaf.position.y = Math.sin(k * Math.PI) * 0.15;
      if (t >= 1.15) this.endTurn();
    }
  }
  endTurn() { if (this.leaf) { this.scene.remove(this.leaf); this.leaf = null; } }
}
