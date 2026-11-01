// Hit feel on screen: razor slash lines, paper flecks, the dummy's glint, and pop-up word stickers.

import * as THREE from 'three';
import { C, easeIn, easeOut } from './common';

interface Anim { t: number; dur: number; fn(k: number): void; done(): void }
interface Fleck { m: THREE.Mesh; v: THREE.Vector3; s: THREE.Vector3; rest: boolean }

const lineGeo = new THREE.PlaneGeometry(1, 1);
const fleckGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.045, -0.03, 0), new THREE.Vector3(0.05, -0.02, 0), new THREE.Vector3(0, 0.05, 0)]);
const fleckMats = new Map<string, THREE.Material>();
const fleckMat = (c: string) => { if (!fleckMats.has(c)) fleckMats.set(c, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); return fleckMats.get(c)!; };

export class Fx {
  private anims: Anim[] = [];
  private flecks: Fleck[] = [];
  readonly glint = new THREE.Group();
  private _p = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private labels: HTMLElement, flat: (pts: number[][], m: THREE.Material) => THREE.Mesh) {
    const star = [[0, 0.16], [0.035, 0.035], [0.16, 0], [0.035, -0.035], [0, -0.16], [-0.035, -0.035], [-0.16, 0], [-0.035, 0.035]];
    const o = flat(star.map((p) => [p[0] * 1.25, p[1] * 1.25]), new THREE.MeshBasicMaterial({ color: C.ink, depthTest: false }));
    const f = flat(star, new THREE.MeshBasicMaterial({ color: C.legal, depthTest: false }));
    f.position.z = 0.002; o.renderOrder = 11; f.renderOrder = 12; this.glint.add(o, f);
    this.glint.visible = false; scene.add(this.glint);
  }

  razor(x: number, y: number, ang: number, color: string, len = 3.6) {
    const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false }));
    const halo = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, depthTest: false }));
    m.renderOrder = 10; halo.renderOrder = 9; m.position.set(x, y, 0.7); halo.position.set(x, y, 0.69); m.rotation.z = halo.rotation.z = ang;
    this.scene.add(m, halo);
    const mm = m.material as THREE.MeshBasicMaterial, hm = halo.material as THREE.MeshBasicMaterial;
    this.anims.push({
      t: 0, dur: 0.32,
      fn(k) { const g = easeOut(Math.min(1, k * 5)); m.scale.set(len * g, 0.024 * (1 - k * 0.7), 1); halo.scale.set(len * g, 0.07 * (1 - k), 1); mm.opacity = 1 - easeIn(k); hm.opacity = 0.9 * (1 - k); },
      done: () => { this.scene.remove(m, halo); mm.dispose(); hm.dispose(); },
    });
  }

  burst(x: number, y: number, colors: string[], count: number, dir: number) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(fleckGeo, fleckMat(colors[i % colors.length]));
      m.position.set(x, y, (Math.random() - 0.5) * 0.5); m.castShadow = true; m.scale.setScalar(0.7 + Math.random()); this.scene.add(m);
      this.flecks.push({ m, v: new THREE.Vector3(dir * (0.6 + Math.random() * 2.2), 0.6 + Math.random() * 2.6, (Math.random() - 0.5) * 2.6), s: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), rest: false });
    }
    while (this.flecks.length > 260) this.scene.remove(this.flecks.shift()!.m);
  }

  /** A word sticker that pops up over a point in the world ("Parry", "Cut"...). */
  label(text: string, x: number, y: number, cls = '') {
    const el = document.createElement('div'); el.className = 'wlabel pop ' + cls; el.textContent = text;
    this._p.set(x, y, 0).project(this.camera);
    el.style.left = ((this._p.x + 1) / 2) * this.labels.clientWidth + 'px';
    el.style.top = ((1 - this._p.y) / 2) * this.labels.clientHeight + 'px';
    this.labels.appendChild(el); setTimeout(() => el.remove(), 1100);
  }

  clearFlecks() { for (const f of this.flecks) this.scene.remove(f.m); this.flecks = []; }

  update(real: number, scaled: number, fold: number) {
    for (const f of this.flecks) {
      f.m.visible = fold > 0.5;
      if (f.rest) continue;
      const dt = scaled;
      f.v.y -= 7.5 * dt; f.v.multiplyScalar(1 - dt * 1.4); f.m.position.addScaledVector(f.v, dt);
      f.m.rotation.x += f.s.x * dt; f.m.rotation.y += f.s.y * dt; f.m.rotation.z += f.s.z * dt;
      if (f.m.position.y < 0.004) { f.m.position.y = 0.006 + Math.random() * 0.004; f.m.rotation.set(-Math.PI / 2, 0, Math.random() * 6); f.m.castShadow = false; f.rest = true; }
    }
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]; a.t += real; const k = Math.min(1, a.t / a.dur); a.fn(k);
      if (k >= 1) { a.done(); this.anims.splice(i, 1); }
    }
  }
}
