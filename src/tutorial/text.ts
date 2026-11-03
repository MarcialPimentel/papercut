// Every word the tutorial shows. Buttons are written as {tokens} and filled from a names table, so a gamepad
// (or any other scheme) only needs its own names table: pass it to fill() instead of MOUSE_KEYS.
// Tokens ending in "Tip" are whole sentences about the scheme (how the guard switches), put in as plain text.

export type InputToken = 'up' | 'down' | 'light' | 'heavy' | 'feint' | 'jump' | 'walk' | 'skip' | 'guardTip' | 'parryTip';
export type InputNames = Record<InputToken, string>;

/** Mouse and keyboard, Flick guard (the default): a quick move up or down switches the guard. */
export const MOUSE_KEYS: InputNames = {
  up: 'flick up',
  down: 'flick down',
  light: 'left click',
  heavy: 'right click',
  feint: 'left click (or Q)',
  jump: 'Space',
  walk: 'A / D',
  skip: 'Tab',
  guardTip: "A short, quick move of the mouse: up for high, down for low. A slow drift doesn't switch.",
  parryTip: 'Wait for her step in, then flick to her height. Switching too early is just a block.',
};

/** Mouse and keyboard, Cursor guard (picked in Settings): the crosshair against your fighter's waist. */
export const CURSOR_KEYS: InputNames = {
  ...MOUSE_KEYS,
  up: 'crosshair above your waist',
  down: 'crosshair below your waist',
  guardTip: "Move the crosshair above your fighter's waist, then below it.",
  parryTip: 'Wait for her step in, then move the crosshair to her height. Switching too early is just a block.',
};

/** A controller with the default layout (Xbox names; Steam Deck and PlayStation pads report the same buttons). */
export const PAD_KEYS: InputNames = {
  up: 'left stick ↑',
  down: 'left stick ↓',
  light: 'RB',
  heavy: 'RT',
  feint: 'B',
  jump: 'A',
  walk: 'left stick ◀ ▶',
  skip: 'LT',
  guardTip: 'Push the left stick up for high, down for low. The guard stays where you last pushed it.',
  parryTip: 'Wait for her step in, then push the stick to her height. Switching too early is just a block.',
};

/** The names table for a mouse guard style. */
export const mouseNames = (style: 'flick' | 'cursor'): InputNames => (style === 'cursor' ? CURSOR_KEYS : MOUSE_KEYS);

/** The buttons the player has bound (first name in each slot list), from the Controls screen. Missing = the default. */
export type Bound = Partial<Record<'light' | 'heavy' | 'feint' | 'jump' | 'skip' | 'left' | 'right', string[]>>;

/**
 * The names table for the device in use: the controller, or the mouse in its guard style. Button names follow the
 * player's own bindings, so a remapped key shows up in the prompts.
 */
export function namesFor(device: 'mouse' | 'pad' | 'touch', style: 'flick' | 'cursor', bound: Bound = {}): InputNames {
  const pad = device === 'pad';
  const base = pad ? PAD_KEYS : mouseNames(style);
  const one = (k: keyof Bound, d: string) => (bound[k] ? bound[k][0] ?? '' : d); // '' = the player left it unbound
  const light = one('light', base.light);
  // A light also feints, so on the mouse the prompt says "left click (or Q)"; a controller has its own feint button.
  const feintKey = one('feint', '');
  const feint = pad ? (feintKey || light) : feintKey ? `${light} (or ${feintKey})` : light;
  const lr = [bound.left?.[0], bound.right?.[0]].filter(Boolean);
  return {
    ...base,
    light, feint,
    heavy: one('heavy', base.heavy),
    jump: one('jump', base.jump),
    skip: one('skip', base.skip),
    walk: pad || lr.length < 2 ? base.walk : lr.join(' / '),
  };
}

export interface StepText {
  title: string;
  /** What to do. */
  line: string;
  /** A second part of the step, once the first is done (parry → riposte, stagger → follow-up). */
  then?: string;
  /** Shown after a few failed tries. */
  hint: string;
  /** Shown for a moment once the step is done: the lesson in one line. */
  cheer: string;
}

export const STEP_TEXT = {
  guard: {
    title: 'Guard',
    line: 'Guard high ({up}) and low ({down}). Try both.',
    hint: '{guardTip}',
    cheer: 'Your blade shows your guard. Sumi\'s shows hers.',
  },
  light: {
    title: 'Light slash',
    line: 'Sumi guards high. Guard low and {light} to cut under her blade.',
    hint: 'She blocked it. Guard low ({down}) first, then click.',
    cheer: 'Cut where they aren\'t guarding.',
  },
  block: {
    title: 'Block',
    line: 'When her blade glints, Sumi swings where it points. Guard the same height to block.',
    hint: 'Look at her blade while it glints: high or low? Put yours at the same height.',
    cheer: 'A slash at your guard\'s height is blocked.',
  },
  heavy: {
    title: 'Heavy slash',
    line: 'Throw a heavy with {heavy}. Even when she blocks it, it knocks her guard aside.',
    then: 'Staggered! You keep the turn: switch height and cut with {light}.',
    hint: 'She is still guarding where your heavy hit. Cut at the other height as soon as you can move.',
    cheer: 'A blocked heavy keeps the turn: they have to guess your next cut.',
  },
  feint: {
    title: 'Feint',
    line: 'Start a heavy ({heavy}), then {feint} straight away to cancel it.',
    hint: 'Cancel sooner: only the start of the wind-up can be feinted.',
    cheer: 'A feint baits them into swinging at nothing.',
  },
  jump: {
    title: 'Jump',
    line: 'When her blade glints, Sumi slashes low. Jump ({jump}) over it.',
    hint: 'Jump while the glint is still showing.',
    cheer: 'Low slashes pass under a jumper.',
  },
  parry: {
    title: 'Parry',
    line: 'Sumi glints, then swings a heavy. Guard the other height, then switch to hers just before it lands.',
    then: 'Parried! Slash back now for a riposte.',
    hint: '{parryTip}',
    cheer: 'A riposte is fast, cuts like a heavy and can\'t be parried.',
  },
  wind: {
    title: 'Counter cut',
    line: 'Hit someone while they wind up a heavy: instant K.O. Sumi winds up as her glint fades. Cut her then.',
    hint: 'Click a light just as the glint fades. A plain hit before her wind-up doesn\'t count.',
    cheer: 'Instant K.O. Never throw a heavy they can see coming.',
  },
  miss: {
    title: 'Counter cut on a miss',
    line: 'Right after a miss, you\'re open too. Swing at the air, just out of Sumi\'s reach, and see.',
    hint: 'Stand where she can\'t reach you, then click.',
    cheer: 'That\'s why you never swing at the air.',
  },
} satisfies Record<string, StepText>;

export type StepId = keyof typeof STEP_TEXT;

export const TUTORIAL_TEXT = {
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  skip: 'Skip step ({skip})',
  /** The skip button when no key is bound to skip. */
  skipPlain: 'Skip step',
  nice: 'Nice!',
  progress: (got: number, need: number) => `${got} of ${need}`,
};

/** Put button names into a line, as <kbd> labels. */
export function fill(line: string, names: InputNames = MOUSE_KEYS): string {
  return line.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in names)) return m;
    const v = names[k as InputToken];
    return k.endsWith('Tip') ? v : `<kbd>${v}</kbd>`;
  });
}
