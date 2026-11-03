// The Fighter screen (issue #38): type your name, pick a colour set, dark or light robe, an outfit and a sword,
// and see your samurai turn its guard in a small 3D preview. Name and pick are kept in this browser and sent once
// when you start an online match. Nothing here touches the fight.

import * as THREE from 'three';
import { FighterView } from './render/fighter';
import { COLOUR_SETS, DEFAULT_PICK, FIGHTERS, OUTFITS, SWORDS, decodePick, encodePick, lookOf, type Pick } from './render/looks';
import type { PaperPhysics } from './render/physics';
import { newMatch } from './sim/sim';
import { myName, saveName } from './name';
import { cleanName } from './net/protocol';
import { store } from './store';

const KEY = 'papercut.look';
/** Your saved look (the default Kami look if none, or if storage is blocked). */
export function myPick(): Pick { return decodePick(store.get(KEY), DEFAULT_PICK); }
function savePick(p: Pick) { store.set(KEY, encodePick(p)); }

/** Pages to check the look against (the CSS draws them behind the preview). */
const PAPERS = [['graph', 'Graph'], ['ruled', 'Ruled'], ['legal', 'Legal pad'], ['marble', 'Back cover']] as const;

export class FighterScreen {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 50);
  private fighter: FighterView;
  private dummy = newMatch().f[0];
  private raf = 0;
  private t = 0;
  private last = 0;
  private pick = myPick();
  private paper: string = 'graph';

  constructor(private canvas: HTMLCanvasElement, private picks: HTMLElement, private who: HTMLElement, private nameIn: HTMLInputElement, private nameTag: HTMLElement,
    physics: PaperPhysics, private onChange: (p: Pick) => void) {
    // The tag under the preview follows your typing; the name is saved when you leave the box (or press Enter).
    nameIn.addEventListener('input', () => { nameTag.textContent = cleanName(nameIn.value, ''); });
    nameIn.addEventListener('change', () => { nameIn.value = nameTag.textContent = saveName(nameIn.value); });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameIn.blur(); });
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe6e0d6, 1.5), sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-3, 6, 8);
    this.scene.add(hemi, sun);
    this.dummy.x = 0; this.dummy.y = 0; this.dummy.facing = 1;
    this.fighter = new FighterView(this.scene, lookOf(this.pick, 'You'), 0, physics);
    this.camera.position.set(0.5, 1.12, 4.4);
    this.camera.lookAt(0.5, 1.05, 0);
    const onPick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-k]');
      if (!b) return;
      const k = b.dataset.k!, v = b.dataset.v!;
      if (k === 'paper') this.paper = v;
      else {
        if (k === 'light') this.pick = { ...this.pick, light: v === '1' };
        else this.pick = { ...this.pick, [k]: v };
        savePick(this.pick);
        this.fighter.setLook(lookOf(this.pick, 'You'));
        this.onChange(this.pick);
      }
      this.render();
      document.getElementById(b.id)?.focus();
    };
    picks.addEventListener('click', onPick);
    who.addEventListener('click', onPick);
  }

  open() {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    }
    this.nameIn.value = this.nameTag.textContent = myName();
    this.render();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(now); };
    this.raf = requestAnimationFrame(loop);
  }

  close() {
    // Leaving with the box still focused: keep what was typed.
    if (cleanName(this.nameIn.value, '') !== myName()) this.nameIn.value = saveName(this.nameIn.value);
    cancelAnimationFrame(this.raf); this.raf = 0;
  }

  /** The guard turns high and low every second or so, so you see the blade both ways. */
  private frame(now: number) {
    const r = this.renderer!, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * r.getPixelRatio())) { r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.t += Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.dummy.stance = Math.floor(this.t / 1.3) % 2 ? 'low' : 'high';
    this.fighter.stepPose(this.dummy);
    this.fighter.draw(this.dummy, 0, 1, this.t);
    r.render(this.scene, this.camera);
  }

  private render() {
    const p = this.pick;
    const chip = (k: string, v: string, label: string, on: boolean, swatch = '') =>
      `<button class="pchip" type="button" id="fp-${k}-${v}" data-k="${k}" data-v="${v}" aria-pressed="${on}">${swatch ? `<i style="background:${swatch}"></i>` : ''}${label}</button>`;
    const row = (title: string, body: string) => `<div class="frow"><b>${title}</b><div class="chips" data-choices>${body}</div></div>`;
    // Kami or Sumi, at the top next to the title: which fighter's own paper pieces you wear.
    this.who.innerHTML = FIGHTERS.map((f) => chip('fighter', f.id, f.name, p.fighter === f.id)).join('');
    this.picks.innerHTML =
      row('Colours', COLOUR_SETS.map((c) => chip('set', c.id, c.name, p.set === c.id, c.robe)).join('')) +
      row('Robe', chip('light', '0', 'Dark', !p.light) + chip('light', '1', 'Light', p.light)) +
      row('Outfit', OUTFITS.map((o) => chip('outfit', o.id, o.name, p.outfit === o.id)).join('')) +
      row('Sword', SWORDS.map((s) => chip('sword', s.id, s.name, p.sword === s.id)).join('')) +
      row('Page', PAPERS.map(([id, name]) => chip('paper', id, name, this.paper === id)).join(''));
    this.canvas.parentElement!.dataset.paper = this.paper;
    const sword = SWORDS.find((s) => s.id === p.sword)!;
    this.canvas.parentElement!.title = `${sword.name}: ${sword.note}`;
  }
}
