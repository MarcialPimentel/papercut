// The mouse fights, the keyboard moves. Turns raw input into one frame of buttons for the fight.
// Presses are kept until the fight reads them, so a click is never lost between frames.
// During a fight the mouse is locked to the game (Pointer Lock), so it can't wander out of the window;
// the game then draws its own cursor and moves it by the mouse's movement.
// Two guard styles (a playtest A/B, picked in Settings):
// - 'flick' (default): flick the mouse up to guard high, down to guard low. Where the mouse is doesn't matter,
//   only which way it last moved (a short, quick movement; see GUARD in feel.ts). No cursor is drawn.
// - 'cursor': the original. A drawn crosshair, compared with your fighter's waist on screen.

import { GUARD } from './feel';
import { BTN } from './sim/sim';
import { store } from './store';

type PressName = 'light' | 'heavy' | 'feint' | 'jump' | 'dashL' | 'dashR' | 'rematch';
const KEYS: Record<string, 'left' | 'right' | 'jump' | 'feint'> = {
  KeyA: 'left', KeyD: 'right', ArrowLeft: 'left', ArrowRight: 'right', Space: 'jump', KeyW: 'jump', ArrowUp: 'jump', KeyQ: 'feint',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type Command = 'restart' | 'menu' | 'rematch' | 'hitboxes' | 'tune';
export type GuardStyle = 'flick' | 'cursor';
const GUARD_KEY = 'papercut.guard';
// Anything but 'cursor' (including the old 'line' trial) plays as flick.
function loadStyle(): GuardStyle { return store.get(GUARD_KEY) === 'cursor' ? 'cursor' : 'flick'; }

/** Flick style: vertical movement added up in one direction. Kept apart from the DOM so it can be tested. */
export class Flick {
  private sum = 0;
  private last = -Infinity;
  /** Mouse moved dy pixels (down is +) at time t (seconds). Returns true (low), false (high) or null (no switch). */
  move(dy: number, t: number): boolean | null {
    if (dy === 0) return null;
    // A change of direction or a pause starts the count again.
    if (Math.sign(dy) !== Math.sign(this.sum) || t - this.last > GUARD.flickReset) this.sum = 0;
    this.sum += dy; this.last = t;
    if (this.sum >= GUARD.flick) { this.sum = 0; return true; }
    if (this.sum <= -GUARD.flick) { this.sum = 0; return false; }
    return null;
  }
}

export class Controls {
  private held = { left: 0, right: 0 }; // bit 1 keyboard, bit 2 touch
  private presses = 0;
  private lastTap = { left: 0, right: 0 };
  private low = false;
  private flick = new Flick();
  mouseY: number | null = null;
  private mouseX = 0;
  /** Hold the mouse while fighting. Main turns it off when the match is over, so the buttons can be clicked. */
  lockWanted = false;
  private aim: HTMLElement;
  private canvas: HTMLCanvasElement;
  /** Set by the on-screen High / Low buttons on touch screens. */
  touchLow: boolean | null = null;
  /** True while a fight is on screen: Space and arrows don't scroll the page. */
  active = false;
  onCommand: (c: Command) => void = () => {};
  onAnyInput: () => void = () => {};
  /** How the mouse sets the guard. See the top of this file. */
  guardStyle: GuardStyle = loadStyle();

  constructor(canvas: HTMLCanvasElement, chips: HTMLElement, aim: HTMLElement) {
    this.canvas = canvas; this.aim = aim;
    this.setGuardStyle(this.guardStyle);
    // Typing in a text box doesn't fight; a focused slider (the tuning panel) still lets R, T and Esc through.
    const typing = (e: Event) => (e.target instanceof HTMLInputElement && e.target.type !== 'range') || e.target instanceof HTMLTextAreaElement;
    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
      if (e.code === 'Escape') { this.onCommand('menu'); return; }
      if (e.code === 'KeyR' && !e.repeat) { this.onCommand('restart'); return; }
      if (e.code === 'KeyH' && !e.repeat) { this.onCommand('hitboxes'); return; }
      if (e.code === 'KeyT' && !e.repeat) { this.onCommand('tune'); return; }
      const k = KEYS[e.code];
      if (!k || !this.active) return;
      e.preventDefault();
      this.onAnyInput();
      if (k === 'left' || k === 'right') {
        if (!e.repeat) {
          const now = performance.now();
          if (now - this.lastTap[k] < 240) this.press(k === 'left' ? 'dashL' : 'dashR');
          this.lastTap[k] = now;
        }
        this.held[k] |= 1;
      } else if (!e.repeat) this.press(k);
    });
    addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k === 'left' || k === 'right') this.held[k] &= ~1; });
    addEventListener('blur', () => { this.held.left = this.held.right = 0; });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (this.guardStyle === 'flick') {
        const low = this.flick.move(e.movementY, e.timeStamp / 1000);
        if (low !== null) { this.low = low; this.touchLow = null; }
      }
      if (this.locked) {
        // Locked: the real cursor is hidden and doesn't move, so steer our own one, kept inside the window.
        this.mouseX = clamp(this.mouseX + e.movementX, 0, canvas.clientWidth);
        this.mouseY = clamp((this.mouseY ?? canvas.clientHeight / 2) + e.movementY, 0, canvas.clientHeight);
        this.drawAim();
      } else this.track(e);
    });
    document.addEventListener('pointerlockchange', () => { this.showAim(); this.drawAim(); });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || !this.active) return;
      e.preventDefault();
      this.onAnyInput();
      if (!this.locked) { this.track(e); if (this.lockWanted) this.lock(); }
      this.touchLow = null;
      this.press(e.button === 2 ? 'heavy' : e.button === 0 ? 'light' : 'feint');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    for (const b of chips.querySelectorAll<HTMLButtonElement>('[data-act]')) {
      b.addEventListener('click', () => {
        this.onAnyInput();
        const a = b.dataset.act!;
        if (a === 'high' || a === 'low') this.touchLow = a === 'low';
        else if (a === 'restart') this.onCommand('restart');
        else this.press(a as PressName);
      });
    }
    for (const b of chips.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
      const k = b.dataset.hold as 'left' | 'right';
      const on = (e: Event) => { e.preventDefault(); this.held[k] |= 2; this.onAnyInput(); };
      const off = () => { this.held[k] &= ~2; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
  }

  setGuardStyle(g: GuardStyle) {
    this.guardStyle = g;
    store.set(GUARD_KEY, g);
    this.canvas.classList.toggle('no-cursor', g === 'flick');
    this.showAim();
  }

  private showAim() { this.aim.hidden = !this.locked || this.guardStyle === 'flick'; }

  press(p: PressName) { this.presses |= BTN[p]; }

  get locked() { return document.pointerLockElement === this.canvas; }

  /** Capture the mouse. Browsers only allow this right after a click or key press. */
  lock() {
    if (this.locked || !this.lockWanted || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    try { const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* not allowed now: the next click tries again */ }
  }

  unlock() { if (this.locked) document.exitPointerLock(); }

  private track(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
  }

  private drawAim() { this.aim.style.transform = `translate(${this.mouseX}px, ${this.mouseY ?? 0}px)`; }

  /** Guard low? From the touch buttons; else, in flick style, the last flick (set as the mouse moves);
   *  else the cursor against the fighter's waist, with a small dead zone. */
  guardLow(waistY: number | null) {
    if (this.touchLow !== null) this.low = this.touchLow;
    else if (this.guardStyle === 'cursor' && this.mouseY !== null && waistY !== null) {
      if (this.mouseY > waistY + GUARD.deadZone) this.low = true;
      else if (this.mouseY < waistY - GUARD.deadZone) this.low = false;
    }
    return this.low;
  }

  /** This frame's buttons. Clears the presses it hands out. */
  sample(waistY: number | null): number {
    let b = this.presses;
    this.presses = 0;
    if (this.held.left) b |= BTN.left;
    if (this.held.right) b |= BTN.right;
    if (this.guardLow(waistY)) b |= BTN.low;
    return b;
  }

  clear() { this.presses = 0; this.held.left = this.held.right = 0; }
}
