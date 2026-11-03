// Display settings from the Settings screen. Volume and guard style keep their own keys (audio engine, controls).
// The desktop app's main process also reads this key at launch (fullscreen, vsync), so keep the names stable.

import { store } from './store';

export const SETTINGS_KEY = 'papercut.settings';

export interface Display {
  /** Start (and stay) fullscreen. In a browser this is only the current state; browsers can't start fullscreen. */
  fullscreen: boolean;
  /** Resolution scale, 0.5-1: lower draws fewer pixels for weaker machines (Steam Deck on battery). */
  scale: number;
  /** Frame cap in frames per second, 0 = match the screen. */
  fps: number;
  /** Desktop app only: wait for the screen's refresh (no tearing). Off lets the frame cap go above the screen's rate. */
  vsync: boolean;
}

export const FPS_CHOICES = [0, 30, 60, 120, 144, 240] as const;
export const SCALE_CHOICES = [0.5, 0.67, 0.75, 0.85, 1] as const;
export const DEFAULT_DISPLAY: Display = { fullscreen: true, scale: 1, fps: 0, vsync: true };

/** Keep only known values, so a hand-edited or old file can't break the game. */
export function cleanDisplay(v: unknown): Display {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Record<keyof Display, unknown>>;
  const pick = <T>(x: unknown, ok: readonly T[], d: T) => (ok.includes(x as T) ? (x as T) : d);
  return {
    fullscreen: typeof o.fullscreen === 'boolean' ? o.fullscreen : DEFAULT_DISPLAY.fullscreen,
    scale: pick(o.scale, SCALE_CHOICES, DEFAULT_DISPLAY.scale),
    fps: pick(o.fps, FPS_CHOICES, DEFAULT_DISPLAY.fps),
    vsync: typeof o.vsync === 'boolean' ? o.vsync : DEFAULT_DISPLAY.vsync,
  };
}

export function loadDisplay(): Display {
  try { return cleanDisplay(JSON.parse(store.get(SETTINGS_KEY) || 'null')); } catch { return { ...DEFAULT_DISPLAY }; }
}
export function saveDisplay(d: Display) { store.set(SETTINGS_KEY, JSON.stringify(d)); }

/** Skip drawing this screen refresh? Keeps the frame cap without touching the fight's fixed 60 Hz clock. */
export function skipFrame(fps: number, sinceLastMs: number) {
  return fps > 0 && sinceLastMs < 1000 / fps - 1; // 1 ms slack so a 60 cap on a 60 Hz screen never drops frames
}
