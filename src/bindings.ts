// Which keys, mouse buttons and controller buttons do what. Remapped on the Controls screen, saved in this browser.
// Nothing here touches the fight: input.ts turns these into the same frame buttons the fight always got.

export type Action = 'light' | 'heavy' | 'feint' | 'left' | 'right' | 'jump' | 'dash' | 'guardLow' | 'restart' | 'hitboxes';
export const ACTIONS: { id: Action; name: string; note?: string }[] = [
  { id: 'light', name: 'Light slash' },
  { id: 'heavy', name: 'Heavy slash' },
  { id: 'feint', name: 'Feint', note: 'during a heavy wind-up; light also feints' },
  { id: 'left', name: 'Move left', note: 'double-tap to dash; controller: left stick or d-pad' },
  { id: 'right', name: 'Move right', note: 'double-tap to dash; controller: left stick or d-pad' },
  { id: 'jump', name: 'Jump' },
  { id: 'dash', name: 'Dash', note: 'the way you are moving; backdash when still' },
  { id: 'guardLow', name: 'Guard low (hold)', note: 'instead of the mouse' },
  { id: 'restart', name: 'Restart / rematch' },
  { id: 'hitboxes', name: 'Hitbox view' },
];

/** Slots per action and device. */
export const SLOTS = 2;
/** Keyboard codes (KeyboardEvent.code) or 'Mouse0' / 'Mouse1' / 'Mouse2' (left, middle, right). '' = empty. */
export type KeySlots = string[];
/** Standard-layout controller button numbers. -1 = empty. */
export type PadSlots = number[];
export interface Bindings { keys: Record<Action, KeySlots>; pad: Record<Action, PadSlots> }

// Standard controller layout (Xbox names; Steam Deck and PlayStation pads report the same numbers).
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, View: 8, Menu: 9, LS: 10, RS: 11, Up: 12, Down: 13, Left: 14, Right: 15 } as const;
/** Buttons the game keeps for itself on a controller: Menu opens the menu, the d-pad moves and guards. */
export const PAD_FIXED: number[] = [PAD.Menu, PAD.Up, PAD.Down, PAD.Left, PAD.Right];
/** Keys the game keeps: Esc frees the mouse and opens the menu (the browser's rule). */
export const KEY_FIXED = ['Escape'];

export const DEFAULTS: Bindings = {
  keys: {
    light: ['Mouse0', ''], heavy: ['Mouse2', ''], feint: ['KeyQ', 'Mouse1'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space', 'KeyW'],
    dash: ['', ''], guardLow: ['', ''], restart: ['KeyR', ''], hitboxes: ['KeyH', ''],
  },
  pad: {
    light: [PAD.RB, PAD.X], heavy: [PAD.RT, PAD.Y], feint: [PAD.B, -1],
    left: [-1, -1], right: [-1, -1], jump: [PAD.A, -1],
    dash: [PAD.LB, -1], guardLow: [-1, -1], restart: [PAD.View, -1], hitboxes: [-1, -1],
  },
};

const clone = (b: Bindings): Bindings => JSON.parse(JSON.stringify(b));
export const defaults = () => clone(DEFAULTS);

/** Read saved bindings; anything missing or broken falls back to the default for that slot. */
export function parse(raw: string | null): Bindings {
  const b = defaults();
  if (!raw) return b;
  let saved: Partial<Bindings>;
  try { saved = JSON.parse(raw); } catch { return b; }
  for (const { id } of ACTIONS) {
    const k = saved?.keys?.[id], p = saved?.pad?.[id];
    if (Array.isArray(k)) for (let i = 0; i < SLOTS; i++) b.keys[id][i] = typeof k[i] === 'string' && !KEY_FIXED.includes(k[i]) ? k[i] : '';
    if (Array.isArray(p)) for (let i = 0; i < SLOTS; i++) b.pad[id][i] = Number.isInteger(p[i]) && p[i] >= 0 && p[i] < 32 && !PAD_FIXED.includes(p[i]) ? p[i] : -1;
  }
  return b;
}

const STORE = 'papercut.bindings';
export function load(): Bindings { try { return parse(localStorage.getItem(STORE)); } catch { return defaults(); } }
export function save(b: Bindings) { try { localStorage.setItem(STORE, JSON.stringify(b)); } catch { /* storage blocked: kept for this visit only */ } }

/**
 * Put a key (or mouse button) in one slot. It is taken off any other action that had it, so one key never does two things.
 * Returns the action it was taken from, if any.
 */
export function bindKey(b: Bindings, a: Action, slot: number, code: string): Action | null {
  if (KEY_FIXED.includes(code)) return null;
  let from: Action | null = null;
  for (const { id } of ACTIONS) for (let i = 0; i < SLOTS; i++) {
    if (b.keys[id][i] === code && !(id === a && i === slot)) { b.keys[id][i] = ''; if (id !== a) from = id; }
  }
  b.keys[a][slot] = code;
  return from;
}

/** Same as bindKey, for a controller button. */
export function bindPad(b: Bindings, a: Action, slot: number, btn: number): Action | null {
  if (PAD_FIXED.includes(btn)) return null;
  let from: Action | null = null;
  for (const { id } of ACTIONS) for (let i = 0; i < SLOTS; i++) {
    if (b.pad[id][i] === btn && !(id === a && i === slot)) { b.pad[id][i] = -1; if (id !== a) from = id; }
  }
  b.pad[a][slot] = btn;
  return from;
}

/** Which action a key or mouse button does, if any. */
export function actionForKey(b: Bindings, code: string): Action | null {
  for (const { id } of ACTIONS) if (b.keys[id].includes(code)) return id;
  return null;
}

// ---------- names shown to players ----------
const KEY_NAMES: Record<string, string> = {
  Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Space: 'Space',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt', AltRight: 'Right Alt', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', CapsLock: 'Caps Lock',
};
export function keyName(code: string): string {
  if (!code) return '';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L-stick click', 'R-stick click', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'];
export function padName(btn: number): string { return btn < 0 ? '' : PAD_NAMES[btn] ?? `Button ${btn}`; }
