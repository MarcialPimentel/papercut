// The mouse fights, the keyboard moves. Turns raw input into one frame of buttons for the fight.
// Presses are kept until the fight reads them, so a click is never lost between frames.
// During a fight the mouse is locked to the game (Pointer Lock), so it can't wander out of the window;
// the game then draws its own cursor and moves it by the mouse's movement.

import { BTN } from './sim/sim';

type PressName = 'light' | 'heavy' | 'feint' | 'jump' | 'dashL' | 'dashR' | 'rematch';
const KEYS: Record<string, 'left' | 'right' | 'jump' | 'feint'> = {
  KeyA: 'left', KeyD: 'right', ArrowLeft: 'left', ArrowRight: 'right', Space: 'jump', KeyW: 'jump', ArrowUp: 'jump', KeyQ: 'feint',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Controls {
  private held = { left: 0, right: 0 }; // bit 1 keyboard, bit 2 touch
  private presses = 0;
  private lastTap = { left: 0, right: 0 };
  private low = false;
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
  onCommand: (c: 'restart' | 'menu' | 'rematch' | 'hitboxes') => void = () => {};
  onAnyInput: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, chips: HTMLElement, aim: HTMLElement) {
    this.canvas = canvas; this.aim = aim;
    const typing = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
      if (e.code === 'Escape') { this.onCommand('menu'); return; }
      if (e.code === 'KeyR' && !e.repeat) { this.onCommand('restart'); return; }
      if (e.code === 'KeyH' && !e.repeat) { this.onCommand('hitboxes'); return; }
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
      if (this.locked) {
        // Locked: the real cursor is hidden and doesn't move, so steer our own one, kept inside the window.
        this.mouseX = clamp(this.mouseX + e.movementX, 0, canvas.clientWidth);
        this.mouseY = clamp((this.mouseY ?? canvas.clientHeight / 2) + e.movementY, 0, canvas.clientHeight);
        this.drawAim();
      } else this.track(e);
    });
    document.addEventListener('pointerlockchange', () => { this.aim.hidden = !this.locked; this.drawAim(); });
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

  /** Guard low? From the touch buttons, else the cursor against the fighter's waist line (with a small dead zone). */
  guardLow(waistY: number | null) {
    if (this.touchLow !== null) this.low = this.touchLow;
    else if (this.mouseY !== null && waistY !== null) {
      if (this.mouseY > waistY + 4) this.low = true;
      else if (this.mouseY < waistY - 4) this.low = false;
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
