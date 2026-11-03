// The tuning panel's numbers (#9): which ones can be changed, their limits, and how changes are applied,
// kept in this browser, reset and copied out.
// Changes are written straight into the fight's own number tables (MOVES and RULES in sim/rules.ts, GUARD
// and FEEL in feel.ts), so Practice plays with them at once. They are for Practice only: everything else
// (online fights, watching, Endless, the menu) calls resetTuning() first, so both online players always run
// the game's own numbers. Numbers Marz likes are copied out and put into the code in a PR.

import { GUARD, FEEL } from './feel';
import { MOVES, RULES } from './sim/rules';

export interface Knob {
  /** Where the number lives, e.g. "moves.heavy.wind". Also the key it is kept and copied under. */
  key: string;
  group: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Shown after the value: "f" for frames, "px", "x", "s". */
  unit: string;
}

const ROOT: Record<string, unknown> = { moves: MOVES, rules: RULES, guard: GUARD, feel: FEEL };

const MOVE_NAMES = { light: 'Light', heavy: 'Heavy', riposte: 'Riposte' } as const;
const moveKnobs = (m: keyof typeof MOVE_NAMES): Knob[] => {
  const g = MOVE_NAMES[m], k = `moves.${m}.`;
  return [
    { key: k + 'wind', group: g, label: 'Wind-up', min: 1, max: 40, step: 1, unit: 'f' },
    { key: k + 'act', group: g, label: 'Active', min: 1, max: 15, step: 1, unit: 'f' },
    { key: k + 'rec', group: g, label: 'Recovery', min: 1, max: 50, step: 1, unit: 'f' },
    { key: k + 'dmg', group: g, label: 'Damage', min: 0, max: 80, step: 1, unit: '' },
    { key: k + 'chip', group: g, label: 'Chip on block', min: 0, max: 20, step: 1, unit: '' },
    { key: k + 'stun', group: g, label: 'Hit stun', min: 0, max: 60, step: 1, unit: 'f' },
    { key: k + 'hitstop', group: g, label: 'Hitstop', min: 0, max: 20, step: 1, unit: 'f' },
    { key: k + 'lunge', group: g, label: 'Step-in', min: 0, max: 1.5, step: 0.05, unit: 'm' },
    { key: k + 'push', group: g, label: 'Push on hit', min: 0, max: 1.5, step: 0.05, unit: 'm' },
  ];
};

/** Every number with a slider, in the panel's order. Reach and body size are left out on purpose: they match the drawn samurai. */
export const KNOBS: Knob[] = [
  ...moveKnobs('light'),
  ...moveKnobs('heavy'),
  ...moveKnobs('riposte'),
  { key: 'rules.parryWindow', group: 'Windows', label: 'Parry window', min: 0, max: 20, step: 1, unit: 'f' },
  { key: 'rules.parryStun', group: 'Windows', label: 'Parried stun', min: 0, max: 60, step: 1, unit: 'f' },
  { key: 'rules.riposteWindow', group: 'Windows', label: 'Riposte window', min: 0, max: 90, step: 1, unit: 'f' },
  { key: 'rules.feintBefore', group: 'Windows', label: 'Feint until wind-up frame', min: 0, max: 40, step: 1, unit: 'f' },
  { key: 'rules.feintFrames', group: 'Windows', label: 'Feint back to guard', min: 1, max: 30, step: 1, unit: 'f' },
  { key: 'rules.missOpen', group: 'Windows', label: 'Counter cut after a miss', min: 0, max: 50, step: 1, unit: 'f' },
  { key: 'rules.blockStagger', group: 'Windows', label: 'Heavy block stagger', min: 0, max: 60, step: 1, unit: 'f' },
  { key: 'rules.buffer', group: 'Windows', label: 'Input buffer', min: 0, max: 15, step: 1, unit: 'f' },
  { key: 'rules.landLag', group: 'Windows', label: 'Air-slash landing lag', min: 0, max: 30, step: 1, unit: 'f' },
  { key: 'rules.hitstop.block', group: 'Hitstop', label: 'Block', min: 0, max: 20, step: 1, unit: 'f' },
  { key: 'rules.hitstop.blockHeavy', group: 'Hitstop', label: 'Blocked heavy', min: 0, max: 20, step: 1, unit: 'f' },
  { key: 'rules.hitstop.parry', group: 'Hitstop', label: 'Parry', min: 0, max: 20, step: 1, unit: 'f' },
  { key: 'rules.hitstop.clash', group: 'Hitstop', label: 'Clash', min: 0, max: 20, step: 1, unit: 'f' },
  { key: 'rules.hitstop.ko', group: 'Hitstop', label: 'K.O.', min: 0, max: 30, step: 1, unit: 'f' },
  { key: 'guard.band', group: 'Guard (mouse)', label: 'Line: mouse travel', min: 10, max: 300, step: 5, unit: 'px' },
  { key: 'guard.deadZone', group: 'Guard (mouse)', label: 'Dead zone', min: 0, max: 40, step: 1, unit: 'px' },
  { key: 'feel.shake', group: 'Camera', label: 'Screen shake', min: 0, max: 3, step: 0.1, unit: 'x' },
  { key: 'feel.slowmo', group: 'Camera', label: 'K.O. slow motion length', min: 0, max: 3, step: 0.1, unit: 's' },
  { key: 'feel.slowSpeed', group: 'Camera', label: 'K.O. slow motion speed', min: 0.05, max: 1, step: 0.01, unit: 'x' },
];
const BY_KEY = new Map(KNOBS.map((k) => [k.key, k]));

function holder(key: string): [Record<string, number>, string] {
  const parts = key.split('.');
  let o = ROOT as Record<string, unknown>;
  for (const p of parts.slice(0, -1)) o = o[p] as Record<string, unknown>;
  return [o as Record<string, number>, parts[parts.length - 1]];
}
export function getValue(key: string): number { const [o, k] = holder(key); return o[k]; }
function write(key: string, v: number) { const [o, k] = holder(key); o[k] = v; }

/** The game's own numbers, as the code ships them. */
export const DEFAULTS: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(KNOBS.map((k) => [k.key, getValue(k.key)])));

/** A value kept inside its slider's limits and on its step (whole frames stay whole). */
export function clean(key: string, v: unknown): number | null {
  const k = BY_KEY.get(key);
  if (!k || typeof v !== 'number' || !Number.isFinite(v)) return null;
  const snapped = Math.round(v / k.step) * k.step;
  return Number(Math.min(k.max, Math.max(k.min, snapped)).toFixed(4));
}

/** Change one number. Returns the value actually used. */
export function setValue(key: string, v: number): number {
  const c = clean(key, v);
  if (c === null) return getValue(key);
  write(key, c);
  return c;
}

/** Back to the game's own numbers. Called before anything that isn't Practice. */
export function resetTuning() { for (const k of KNOBS) write(k.key, DEFAULTS[k.key]); }

/** Only the numbers that differ from the game's own. */
export function changes(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of KNOBS) if (getValue(k.key) !== DEFAULTS[k.key]) out[k.key] = getValue(k.key);
  return out;
}
export const isTuned = () => Object.keys(changes()).length > 0;

/** Start from the game's numbers, then apply a saved set (anything unknown or out of range is skipped or clamped). */
export function applyTuning(saved: unknown) {
  resetTuning();
  if (!saved || typeof saved !== 'object') return;
  for (const [key, v] of Object.entries(saved as Record<string, unknown>)) {
    const c = clean(key, v);
    if (c !== null) write(key, c);
  }
}

// ---------- kept in this browser ----------
const STORE_KEY = 'papercut.tuning';
export function loadSaved(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
export function saveCurrent() {
  try {
    const c = changes();
    if (Object.keys(c).length) localStorage.setItem(STORE_KEY, JSON.stringify(c));
    else localStorage.removeItem(STORE_KEY);
  } catch { /* storage blocked: the numbers just aren't remembered */ }
}

/** The text "Copy numbers" puts on the clipboard: one line per changed number, game value → new value. */
export function copyText(build = ''): string {
  const c = changes();
  const lines = Object.entries(c).map(([key, v]) => `${key}: ${DEFAULTS[key]} -> ${v}`);
  const head = `Papercut tuning${build ? ` (build ${build})` : ''}`;
  return lines.length ? `${head}, please make these the game's numbers:\n${lines.join('\n')}` : `${head}: no changes, the game's own numbers.`;
}
