// Every sound effect by name. Each uses a recording from public/sfx/ when one is loaded (see RECORDINGS),
// otherwise a code-made version, so the game always has sound.

import { engine as E } from './engine';

/** Recordings to load: name -> files (a random one plays each time). Sources and licences: docs/sound.md. */
const f = (...names: string[]) => names.map((n) => `/sfx/${n}.ogg`);
const RECORDINGS: Record<string, string[]> = {
  clash: f('impactMetal_light_000', 'impactMetal_light_001', 'impactMetal_light_003'),
  block: f('impactPlate_light_000', 'impactPlate_light_002', 'impactPlate_light_003'),
  slice: f('knifeSlice2'), // light hits play it faster and quieter, heavies slower
  shing: f('drawKnife3'),
  page: f('bookFlip2', 'bookFlip3'),
  fold: f('cloth4'),
  land: f('impactSoft_medium_000', 'impactSoft_medium_001', 'impactSoft_medium_002'),
  ui: f('select_002'),
  tick: f('tick_001', 'tick_002'),
  clack: f('impactWood_light_000', 'impactWood_light_002'),
};
E.want(RECORDINGS);

// The music's scale (miyako-bushi on D) as semitones, shared with the stingers.
export const SCALE = [0, 1, 5, 7, 8];
export const note = (degree: number, base = 293.66) => {
  const oct = Math.floor(degree / SCALE.length), i = ((degree % SCALE.length) + SCALE.length) % SCALE.length;
  return base * Math.pow(2, oct + SCALE[i] / 12);
};

const later = (s: number) => (E.live ? E.live.currentTime + s : 0);

/** One wooden clapper strike (hyoshigi, the kabuki stage clappers). */
function clack(at: number, gain = 1, pan = 0) {
  const rec = E.sample('clack', { gain: 0.8 * gain, rate: 1.3, pan, at });
  if (rec) gain *= 0.5; // the recording carries the wood; the code version adds the bright crack
  E.tone({ f0: 2350, f1: 2200, dur: 0.07, gain: 0.28 * gain, at, pan });
  E.tone({ f0: 1180, f1: 1100, dur: 0.05, gain: 0.18 * gain, at, pan });
  E.hiss({ dur: 0.045, type: 'bandpass', freq: 2600, q: 3, gain: 0.7 * gain, at, pan });
}

/** A taiko drum hit: a deep thump that drops in pitch, with a skin slap on top. */
export function taiko(at?: number, gain = 1, bus?: AudioNode) {
  E.tone({ f0: 118, f1: 52, dur: 0.6, gain: 0.85 * gain, attack: 0.004, at, bus });
  E.tone({ f0: 240, f1: 120, dur: 0.12, gain: 0.25 * gain, at, bus });
  E.hiss({ dur: 0.09, type: 'lowpass', freq: 900, gain: 0.5 * gain, at, bus });
}

function arpeggio(degrees: number[], gap: number, gain: number, base?: number) {
  const t = later(0);
  degrees.forEach((d, i) => E.pluck({ freq: note(d, base), gain, at: t + i * gap }));
}

export const sfx = {
  /** The blade cutting the air, when a slash becomes active. */
  whoosh(heavy: boolean, pan: number) {
    if (E.sample(heavy ? 'whooshHeavy' : 'whoosh', { gain: heavy ? 0.9 : 0.6, pan })) return;
    if (heavy) E.hiss({ dur: 0.28, type: 'bandpass', freq: 900, sweep: 320, q: 1.2, gain: 0.5, attack: 0.05, pan });
    else E.hiss({ dur: 0.13, type: 'bandpass', freq: 1700, sweep: 700, q: 1.1, gain: 0.32, attack: 0.02, pan });
  },
  /** Every heavy's wind-up: a paper fold, the same whether it comes out or is feinted, so the sound alone never gives a feint away. */
  windup(pan: number) {
    if (!E.sample('fold', { gain: 1.5, pan })) E.hiss({ dur: 0.22, type: 'bandpass', freq: 1600, sweep: 900, gain: 0.25, pan });
  },
  /** Two attacks meeting: a bright double blade ring and a paper snap. The loudest "sword" sound. */
  clash(pan: number) {
    const t = later(0);
    // The recording is the hit; the code-made ring adds the long sword tail (quieter when the recording plays).
    const k = E.sample('clash', { gain: 0.9, pan }) ? 0.45 : 1;
    E.ring({ base: 1240, dur: 0.9, gain: 0.16 * k, at: t, pan: pan - 0.15 });
    E.ring({ base: 1395, dur: 0.75, gain: 0.12 * k, at: t + 0.012, pan: pan + 0.15 });
    E.hiss({ dur: 0.07, type: 'highpass', freq: 3500, gain: 0.55, at: t, pan });
    E.tone({ f0: 300, f1: 140, dur: 0.1, gain: 0.25, at: t, pan });
    E.duck(0.35, 0.05);
  },
  /** A slash stopped by a guard: a duller, shorter knock than a clash. */
  block(heavy: boolean, pan: number) {
    if (!E.sample('block', { gain: heavy ? 0.9 : 0.65, rate: heavy ? 0.85 : 1, pan })) {
      E.ring({ base: 760, dur: 0.22, gain: heavy ? 0.07 : 0.045, pan });
      E.tone({ f0: heavy ? 190 : 240, f1: 90, dur: 0.12, gain: heavy ? 0.45 : 0.3, pan });
    }
    E.hiss({ dur: 0.05, type: 'lowpass', freq: 1500, gain: heavy ? 0.5 : 0.35, pan });
  },
  /** A parry: a clean high ring and a rising chime. */
  parry(pan: number) {
    if (!E.sample('parry', { gain: 0.8, pan })) E.ring({ base: 1760, dur: 0.6, gain: 0.13, pan });
    E.tone({ f0: 1500, f1: 2600, dur: 0.16, type: 'triangle', gain: 0.1, pan });
    E.hiss({ dur: 0.05, type: 'highpass', freq: 3200, gain: 0.3, pan });
  },
  /** A light hit: a quick paper slice. */
  hit(pan: number) {
    // A quick blade pass with a soft paper snip; no high pitched tones (they squeak).
    if (!E.sample('slice', { gain: 0.45, rate: 1.3, pan })) E.hiss({ dur: 0.1, type: 'bandpass', freq: 2600, sweep: 1600, q: 0.9, gain: 0.35, pan });
    E.hiss({ dur: 0.06, type: 'bandpass', freq: 1800, q: 0.8, gain: 0.25, pan });
  },
  /** A heavy hit or riposte: a long paper tear with a body thump. */
  cut(pan: number) {
    // The blade (recording) plus a lower, softer paper tear in code: weight without squeak.
    const rec = E.sample('slice', { gain: 0.8, rate: 0.85, pan });
    E.hiss({ dur: 0.34, type: 'bandpass', freq: 1900, sweep: 700, q: 0.6, gain: rec ? 0.3 : 0.5, attack: 0.01, pan });
    E.tone({ f0: 150, f1: 60, dur: 0.22, gain: 0.45, pan });
    E.duck(0.4, 0.1);
  },
  /** A K.O.: a drum boom and a full tear. A counter cut adds a long blade ring. */
  ko(counter: boolean, pan: number) {
    const t = later(0);
    taiko(t, 1.1);
    if (!E.sample('slice', { gain: 0.9, rate: 0.8, pan })) E.hiss({ dur: 0.6, type: 'bandpass', freq: 2800, sweep: 700, q: 0.7, gain: 0.7, pan });
    if (counter) {
      if (!E.sample('shing', { gain: 2.5, pan })) E.ring({ base: 1980, dur: 1.8, gain: 0.12, at: t + 0.02, pan });
      E.hiss({ dur: 0.5, type: 'highpass', freq: 6000, gain: 0.2, attack: 0.01, at: t, pan });
    }
    E.duck(0.85, 1.4, 1.0);
  },
  hop(pan: number) { if (!E.sample('hop', { gain: 0.5, pan })) E.hiss({ dur: 0.1, type: 'lowpass', freq: 700, gain: 0.25, pan }); },
  land(pan: number) {
    if (E.sample('land', { gain: 0.5, pan })) return;
    E.tone({ f0: 120, f1: 70, dur: 0.09, gain: 0.25, pan });
    E.hiss({ dur: 0.07, type: 'lowpass', freq: 500, gain: 0.3, pan });
  },
  /** The notebook page turning between rounds. */
  page() { if (!E.sample('page', { gain: 1.6 })) E.hiss({ dur: 0.6, type: 'bandpass', freq: 700, sweep: 1400, q: 0.4, gain: 0.4, attack: 0.08 }); },

  /** "Round N": the clappers, speeding up, like a kabuki curtain call. */
  round() {
    const t = later(0.05);
    [0, 0.42, 0.72, 0.92].forEach((d, i) => clack(t + d, i === 3 ? 1.1 : 0.85));
  },
  /** "Cut!": the fight starts. */
  fight() {
    const t = later(0);
    taiko(t, 1); clack(t, 0.9);
    E.hiss({ dur: 0.2, type: 'bandpass', freq: 1400, sweep: 500, gain: 0.3, attack: 0.02, at: t + 0.04 });
  },
  /** The last ten seconds: a wood tick each second, sharper for the last three. */
  tick(secs: number) {
    const urgent = secs <= 3;
    if (E.sample('tick', { gain: urgent ? 0.6 : 0.4, rate: urgent ? 1.25 : 1 })) return;
    E.tone({ f0: urgent ? 1900 : 1450, dur: 0.05, gain: urgent ? 0.2 : 0.12 });
    E.hiss({ dur: 0.03, type: 'bandpass', freq: urgent ? 2400 : 1800, q: 3, gain: urgent ? 0.35 : 0.2 });
  },
  /** Time ran out: a low gong. */
  timeUp() {
    E.ring({ base: 196, dur: 2.2, gain: 0.2 });
    taiko(undefined, 0.8);
    E.duck(0.8, 1.2, 1);
  },
  /** A round won (by you, or by either side when watching): a rising pluck. Lost: falling. */
  roundEnd(won: boolean) {
    if (won) arpeggio([0, 2, 3, 5], 0.11, 0.5);
    else arpeggio([4, 3, 1, 0], 0.16, 0.42, 146.83);
  },
  /** The match is decided: a drum roll and a climbing run for the winner, a slow fall for the loser. */
  matchEnd(won: boolean) {
    const t = later(0);
    if (won) {
      [0, 0.12, 0.22, 0.3, 0.37, 0.43].forEach((d, i) => taiko(t + d, 0.4 + i * 0.1));
      arpeggio([0, 2, 3, 4, 5, 7, 8, 10], 0.09, 0.5);
      [0, 3, 5, 10].forEach((d) => E.pluck({ freq: note(d), gain: 0.4, at: t + 0.9, dur: 1.6 }));
    } else {
      taiko(t, 0.7);
      arpeggio([5, 4, 3, 1, 0], 0.24, 0.4, 146.83);
    }
  },
  /** A menu button: a soft paper tap. */
  ui() {
    if (E.sample('ui', { gain: 0.4 })) return;
    E.hiss({ dur: 0.04, type: 'bandpass', freq: 2200, q: 1.5, gain: 0.25 });
    E.tone({ f0: 880, f1: 700, dur: 0.04, type: 'triangle', gain: 0.06 });
  },
};
