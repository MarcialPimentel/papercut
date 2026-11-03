// Reads a controller once per screen frame and turns it into game actions. Plain logic (no browser calls),
// so tests can feed it made-up controller states.
// Left stick (or d-pad): left / right moves, up / down sets the guard. The stick springs back to the middle,
// so the guard stays where it was last pushed, just as the mouse stays where you left it.

import { ACTIONS, PAD, type Action, type Bindings } from './bindings';

export interface PadSnap { buttons: boolean[]; axes: number[] }

/** How far the stick must lean to walk. */
export const WALK_AT = 0.4;
/** How far the stick must lean up or down to switch the guard, and how upright it must be (|y| at least this times |x|). */
export const GUARD_AT = 0.6;
export const GUARD_UPRIGHT = 0.75;
/** Back under this counts as the stick at rest (for double-taps and menu steps). */
const REST = 0.25;
/** Double-tap window for a dash, as on the keyboard. */
export const DOUBLE_TAP_MS = 240;
/** Menus: hold a direction and the focus steps again after this long, then faster. */
const NAV_FIRST = 380, NAV_NEXT = 120;

export type Nav = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'menu';

export interface PadFrame {
  /** Buttons pressed this frame, by action. */
  presses: Action[];
  /** A dash from a double-tap of the stick or d-pad: -1 left, 1 right, 0 none. */
  tapDash: -1 | 0 | 1;
  /** Held this frame. */
  left: boolean; right: boolean; guardLowHeld: boolean;
  /** The guard the stick last set (null until it is first pushed up or down). */
  low: boolean | null;
  /** True when the stick was pushed up or down this frame (a fresh push, even to the same height), so it takes
   *  the guard back from the mouse. */
  guardChanged: boolean;
  /** Menu moves this frame. */
  nav: Nav[];
  /** Raw buttons that went down this frame (for the Controls screen). */
  down: number[];
  /** Anything touched at all this frame. */
  any: boolean;
}

export class PadReader {
  private prev: boolean[] = [];
  private prevSide: -1 | 0 | 1 = 0;
  private lastTap = { side: 0, at: -1e9 };
  private low: boolean | null = null;
  private pushed = false;
  private navHeld: Nav | null = null;
  private navNext = 0;

  reset() { this.prev = []; this.prevSide = 0; this.navHeld = null; this.pushed = false; }

  update(s: PadSnap, now: number, b: Bindings): PadFrame {
    const btn = (i: number) => !!s.buttons[i];
    const went = (i: number) => btn(i) && !this.prev[i];
    const down: number[] = [];
    for (let i = 0; i < s.buttons.length; i++) if (went(i)) down.push(i);

    const x = s.axes[0] ?? 0, y = s.axes[1] ?? 0;
    const left = x < -WALK_AT || btn(PAD.Left) || b.pad.left.some(btn);
    const right = x > WALK_AT || btn(PAD.Right) || b.pad.right.some(btn);
    const up = (y < -GUARD_AT && -y >= Math.abs(x) * GUARD_UPRIGHT) || btn(PAD.Up);
    const dn = (y > GUARD_AT && y >= Math.abs(x) * GUARD_UPRIGHT) || btn(PAD.Down);

    // Guard: latched on the last push.
    let guardChanged = false;
    const push = up !== dn;
    if (push && (dn !== this.low || !this.pushed)) { this.low = dn; guardChanged = true; }
    this.pushed = push;

    // Double-tap a side to dash.
    const atRest = Math.abs(x) < REST && !btn(PAD.Left) && !btn(PAD.Right) && !b.pad.left.some(btn) && !b.pad.right.some(btn);
    const side: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0;
    let tapDash: -1 | 0 | 1 = 0;
    if (side !== 0 && this.prevSide === 0) {
      if (this.lastTap.side === side && now - this.lastTap.at < DOUBLE_TAP_MS) { tapDash = side; this.lastTap.at = -1e9; }
      else this.lastTap = { side, at: now };
    }
    if (side !== 0) this.prevSide = side; else if (atRest) this.prevSide = 0;

    const presses: Action[] = [];
    for (const { id } of ACTIONS) {
      if (id === 'left' || id === 'right' || id === 'guardLow') continue;
      if (b.pad[id].some((i) => i >= 0 && went(i))) presses.push(id);
    }
    const guardLowHeld = b.pad.guardLow.some((i) => i >= 0 && btn(i));

    // Menus: stick or d-pad steps the focus (repeating while held), A picks, B goes back, Menu opens or closes the menu.
    const nav: Nav[] = [];
    const dirNow: Nav | null = y < -0.5 || btn(PAD.Up) ? 'up' : y > 0.5 || btn(PAD.Down) ? 'down'
      : x < -0.5 || btn(PAD.Left) ? 'left' : x > 0.5 || btn(PAD.Right) ? 'right' : null;
    if (dirNow !== this.navHeld) { this.navHeld = dirNow; if (dirNow) { nav.push(dirNow); this.navNext = now + NAV_FIRST; } }
    else if (dirNow && now >= this.navNext) { nav.push(dirNow); this.navNext = now + NAV_NEXT; }
    if (went(PAD.A)) nav.push('ok');
    if (went(PAD.B)) nav.push('back');
    if (went(PAD.Menu)) nav.push('menu');

    const any = down.length > 0 || Math.abs(x) > WALK_AT || Math.abs(y) > WALK_AT;
    this.prev = s.buttons.slice();
    return { presses, tapDash, left, right, guardLowHeld, low: this.low, guardChanged, nav, down, any };
  }
}

/** The first connected controller, as a plain snapshot (triggers count as pressed past halfway). */
export function readPad(): PadSnap | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    return { buttons: p.buttons.map((x) => x.pressed || x.value > 0.5), axes: p.axes.slice() };
  }
  return null;
}
