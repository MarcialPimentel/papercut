// The mouse fights, the keyboard moves; or a controller does both. Turns raw input into one frame of buttons for the fight.
// Which key or button does what comes from bindings.ts (remapped on the Controls screen). Only the guard height and the
// buttons reach the fight, whatever the device, so online play stays the same.
// Presses are kept until the fight reads them, so a click is never lost between frames.
// During a fight the mouse is locked to the game (Pointer Lock), so it can't wander out of the window;
// the game then draws its own cursor and moves it by the mouse's movement.
// Two guard styles (a playtest A/B, picked in Settings):
// - 'flick' (default): flick the mouse up to guard high, down to guard low. Where the mouse is doesn't matter,
//   only which way it last moved (a short, quick movement; see GUARD in feel.ts). No cursor is drawn.
// - 'cursor': the original. A drawn crosshair, compared with your fighter's waist on screen.
// On a controller the left stick (or d-pad) moves left / right and sets the guard up / down (see pad.ts).

import { GUARD } from './feel';
import { BTN } from './sim/sim';
import { PAD, actionForKey, load as loadBindings, save as saveBindings, type Action, type Bindings } from './bindings';
import { PadReader, readPad, type Nav } from './pad';
import { store } from './store';

type PressName = 'light' | 'heavy' | 'feint' | 'jump' | 'dashL' | 'dashR' | 'rematch' | 'emote';
type Hold = 'left' | 'right' | 'guardLow';
/** Who is holding a direction or the low guard: bits, so letting go on one device doesn't cancel another. */
const KB = 1, TOUCH = 2, PADBIT = 4;
export type Device = 'mouse' | 'pad' | 'touch';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type Command = 'restart' | 'menu' | 'rematch' | 'hitboxes' | 'tune' | 'skip';
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
  private held: Record<Hold, number> = { left: 0, right: 0, guardLow: 0 };
  private presses = 0;
  private lastTap = { left: 0, right: 0 };
  private low = false;
  private flick = new Flick();
  mouseY: number | null = null;
  private mouseX = 0;
  /** Hold the mouse while fighting. Main turns it off when the match is over, so the buttons can be clicked.
   *  It also hides the pointer in Flick style, so menus and the Rematch screen keep a visible pointer. */
  private wantLock = false;
  get lockWanted() { return this.wantLock; }
  set lockWanted(v: boolean) { this.wantLock = v; this.showPointer(); }
  private aim: HTMLElement;
  private canvas: HTMLCanvasElement;
  /** Set by the on-screen High / Low buttons on touch screens. */
  touchLow: boolean | null = null;
  /** True while a fight is on screen: Space and arrows don't scroll the page. */
  active = false;
  onCommand: (c: Command) => void = () => {};
  onAnyInput: () => void = () => {};
  /** Menu moves from the controller (main moves the focus). */
  onNav: (n: Nav) => void = () => {};
  /** The device last used, so prompts can show its buttons. */
  device: Device = 'mouse';
  onDevice: (d: Device) => void = () => {};
  /** How the mouse sets the guard. See the top of this file. */
  guardStyle: GuardStyle = loadStyle();
  /** Which keys and buttons do what. */
  binds: Bindings = loadBindings();
  /** While set, the next key, click or controller button goes here instead of the game (the Controls screen). */
  capture: ((c: { key?: string; pad?: number; cancel?: boolean; quiet?: boolean }) => void) | null = null;
  /** Who set the guard last: the mouse or the controller stick. */
  private guardSrc: 'mouse' | 'pad' = 'mouse';
  private pad = new PadReader();
  private padLow = false;
  private padSide: -1 | 0 | 1 = 0;
  private dashPress = false;

  constructor(canvas: HTMLCanvasElement, chips: HTMLElement, aim: HTMLElement) {
    this.canvas = canvas; this.aim = aim;
    this.setGuardStyle(this.guardStyle);
    // Typing in a text box doesn't fight; a focused slider (the tuning panel) still lets R, T and Esc through.
    const typing = (e: Event) => (e.target instanceof HTMLInputElement && e.target.type !== 'range') || e.target instanceof HTMLTextAreaElement;
    addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        if (e.code === 'Escape') this.capture({ cancel: true }); else if (e.code) this.capture({ key: e.code });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
      this.setDevice('mouse');
      if (e.code === 'Escape') { this.onCommand('menu'); return; }
      const a = actionForKey(this.binds, e.code);
      if (!a) return;
      if (a === 'restart' || a === 'hitboxes' || a === 'tune') { if (!e.repeat) this.onCommand(a); return; }
      // The tutorial's skip (Tab by default). Outside a fight Tab keeps moving the focus through menus.
      if (a === 'skip') { if (this.active) { e.preventDefault(); if (!e.repeat) this.onCommand('skip'); } return; }
      if (!this.active) return;
      e.preventDefault();
      this.onAnyInput();
      this.down(a, KB, e.repeat);
    });
    addEventListener('keyup', (e) => { const a = actionForKey(this.binds, e.code); if (a) this.up(a, KB); });
    addEventListener('blur', () => { this.held.left = this.held.right = this.held.guardLow = 0; });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!e.movementX && !e.movementY && this.locked) return;
      if (this.guardStyle === 'flick') {
        const low = this.flick.move(e.movementY, e.timeStamp / 1000);
        if (low !== null) { this.low = low; this.touchLow = null; this.guardSrc = 'mouse'; }
      } else this.guardSrc = 'mouse';
      if (this.locked) {
        // Locked: the real cursor is hidden and doesn't move, so steer our own one, kept inside the window.
        this.mouseX = clamp(this.mouseX + e.movementX, 0, canvas.clientWidth);
        this.mouseY = clamp((this.mouseY ?? canvas.clientHeight / 2) + e.movementY, 0, canvas.clientHeight);
        this.drawAim();
      } else this.track(e);
      this.setDevice('mouse');
    });
    document.addEventListener('pointerlockchange', () => { this.showAim(); this.drawAim(); });
    // On the Controls screen, clicking the waiting box binds that mouse button ('Mouse0' left, 'Mouse1' middle, 'Mouse2' right).
    // A click anywhere else stops waiting (and still does what it normally does, like picking another box).
    addEventListener('mousedown', (e) => {
      if (!this.capture) return;
      if ((e.target as HTMLElement).closest('[data-bind].waiting')) { e.preventDefault(); e.stopPropagation(); this.capture({ key: `Mouse${e.button}` }); }
      else this.capture({ cancel: true, quiet: true });
    }, true);
    addEventListener('contextmenu', (e) => { if (this.capture) e.preventDefault(); });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || !this.active || this.capture) return;
      e.preventDefault();
      this.onAnyInput();
      this.setDevice('mouse');
      if (!this.locked) { this.track(e); if (this.lockWanted) this.lock(); }
      this.touchLow = null;
      const a = actionForKey(this.binds, `Mouse${e.button}`);
      if (a === 'restart' || a === 'hitboxes' || a === 'tune' || a === 'skip') this.onCommand(a);
      else if (a) this.down(a, KB, false);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      const a = actionForKey(this.binds, `Mouse${e.button}`);
      if (a) this.up(a, KB);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    for (const b of chips.querySelectorAll<HTMLButtonElement>('[data-act]')) {
      b.addEventListener('click', () => {
        this.onAnyInput();
        this.setDevice('touch');
        const a = b.dataset.act!;
        if (a === 'high' || a === 'low') this.touchLow = a === 'low';
        else if (a === 'restart') this.onCommand('restart');
        else this.press(a as PressName);
      });
    }
    for (const b of chips.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
      const k = b.dataset.hold as 'left' | 'right';
      const on = (e: Event) => { e.preventDefault(); this.held[k] |= TOUCH; this.onAnyInput(); this.setDevice('touch'); };
      const off = () => { this.held[k] &= ~TOUCH; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
  }

  /** A bound key or click went down. */
  private down(a: Action, bit: number, repeat: boolean) {
    if (a === 'left' || a === 'right') {
      if (!repeat) {
        const now = performance.now();
        if (now - this.lastTap[a] < 240) this.press(a === 'left' ? 'dashL' : 'dashR');
        this.lastTap[a] = now;
      }
      this.held[a] |= bit;
    } else if (a === 'guardLow') this.held.guardLow |= bit;
    else if (repeat) return;
    else if (a === 'dash') this.dashPress = true;
    else if (a === 'light' || a === 'heavy' || a === 'feint' || a === 'jump' || a === 'emote') this.press(a);
  }

  private up(a: Action, bit: number) { if (a === 'left' || a === 'right' || a === 'guardLow') this.held[a] &= ~bit; }

  private setDevice(d: Device) { if (d !== this.device) { this.device = d; this.onDevice(d); } }

  setBindings(b: Bindings) { this.binds = b; saveBindings(b); }

  /** Read the controller. Main calls this once per screen frame. */
  pollPad(now = performance.now()) {
    const snap = readPad();
    const set = (k: Hold, on: boolean) => { if (on) this.held[k] |= PADBIT; else this.held[k] &= ~PADBIT; };
    if (!snap) { set('left', false); set('right', false); set('guardLow', false); this.padSide = 0; return; }
    const f = this.pad.update(snap, now, this.binds);
    if (this.capture) {
      const b = f.down[0];
      if (b === PAD.Menu) this.capture({ cancel: true });
      else if (b !== undefined) this.capture({ pad: b });
      return;
    }
    if (f.any) { this.setDevice('pad'); this.onAnyInput(); }
    // A fight that a menu press starts this frame doesn't also get that press (A would jump).
    const fighting = this.active;
    for (const n of f.nav) this.onNav(n);
    set('guardLow', f.guardLowHeld);
    if (f.guardChanged && f.low !== null) { this.padLow = f.low; this.guardSrc = 'pad'; this.touchLow = null; }
    for (const a of f.presses) if (a === 'restart' || a === 'hitboxes' || a === 'tune' || a === 'skip') this.onCommand(a);
    if (!fighting || !this.active) { set('left', false); set('right', false); this.padSide = 0; return; }
    set('left', f.left); set('right', f.right);
    this.padSide = f.left && !f.right ? -1 : f.right && !f.left ? 1 : 0;
    if (f.tapDash) this.press(f.tapDash < 0 ? 'dashL' : 'dashR');
    for (const a of f.presses) {
      if (a === 'dash') this.dashPress = true;
      else if (a === 'light' || a === 'heavy' || a === 'feint' || a === 'jump' || a === 'emote') this.press(a);
    }
  }

  setGuardStyle(g: GuardStyle) {
    this.guardStyle = g;
    store.set(GUARD_KEY, g);
    this.showPointer();
    this.showAim();
  }

  /** Flick style draws no pointer during a fight; everywhere else (menus, match over, tuning) the normal one shows. */
  private showPointer() { this.canvas.classList.toggle('no-cursor', this.guardStyle === 'flick' && this.wantLock); }

  private showAim() { this.aim.hidden = !this.locked || this.guardStyle === 'flick'; }

  press(p: PressName) { this.presses |= BTN[p]; }

  get locked() { return document.pointerLockElement === this.canvas; }

  /** Capture the mouse. Browsers only allow this right after a click or key press. Not while playing on a controller. */
  lock() {
    if (this.locked || !this.lockWanted || this.device === 'pad' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    try { const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* not allowed now: the next click tries again */ }
  }

  unlock() { if (this.locked) document.exitPointerLock(); }

  private track(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
  }

  private drawAim() { this.aim.style.transform = `translate(${this.mouseX}px, ${this.mouseY ?? 0}px)`; }

  /**
   * Guard low? A held "guard low" key or button wins; then the touch buttons; then whichever of the mouse and
   * the controller stick set it last: the stick where it was last pushed, the last mouse flick (set as the mouse
   * moves), or in cursor style the crosshair against the fighter's waist with a small dead zone.
   */
  guardLow(waistY: number | null) {
    if (this.held.guardLow) return true;
    if (this.touchLow !== null) this.low = this.touchLow;
    else if (this.guardSrc === 'pad') this.low = this.padLow;
    else if (this.guardStyle === 'cursor' && this.mouseY !== null && waistY !== null) {
      if (this.mouseY > waistY + GUARD.deadZone) this.low = true;
      else if (this.mouseY < waistY - GUARD.deadZone) this.low = false;
    }
    return this.low;
  }

  /** This frame's buttons. Clears the presses it hands out. `facing` aims a dash with no direction held (a backdash). */
  sample(waistY: number | null, facing: 1 | -1 = 1): number {
    let b = this.presses;
    this.presses = 0;
    if (this.dashPress) {
      this.dashPress = false;
      const keys = (this.held.right & KB ? 1 : 0) - (this.held.left & KB ? 1 : 0);
      const dir = this.padSide || keys || -facing;
      b |= dir < 0 ? BTN.dashL : BTN.dashR;
    }
    if (this.held.left) b |= BTN.left;
    if (this.held.right) b |= BTN.right;
    if (this.guardLow(waistY)) b |= BTN.low;
    return b;
  }

  clear() { this.presses = 0; this.dashPress = false; this.held.left = this.held.right = this.held.guardLow = 0; }
}
