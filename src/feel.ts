// Numbers that shape how the fight feels on this screen but never decide it: how the mouse turns into a guard
// height, and the camera's shake and slow motion. The fight's own numbers are in sim/rules.ts.
// The tuning panel (T in Practice) changes these live.

export const GUARD = {
  /** Line style: how far (pixels) the hidden mouse can go above or below the line. Small, so a short flick switches. */
  band: 60,
  /** Ignore tiny wobbles across the line (pixels). */
  deadZone: 4,
};

export const FEEL = {
  /** Screen shake strength (1 = as designed). */
  shake: 1,
  /** K.O. slow motion: how long it lasts (seconds of real time). */
  slowmo: 1.0,
  /** K.O. slow motion: how fast the fight runs during it (1 = normal speed). */
  slowSpeed: 0.22,
};
