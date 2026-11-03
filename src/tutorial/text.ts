// Every word the tutorial shows. Buttons are written as {tokens} and filled from a names table, so a gamepad
// (or any other scheme) only needs its own names table: pass it to fill() instead of MOUSE_KEYS.

export type InputToken = 'up' | 'down' | 'light' | 'heavy' | 'feint' | 'jump' | 'walk' | 'skip';
export type InputNames = Record<InputToken, string>;

/** Mouse and keyboard (the only scheme today). */
export const MOUSE_KEYS: InputNames = {
  up: 'mouse up',
  down: 'mouse down',
  light: 'left click',
  heavy: 'right click',
  feint: 'left click (or Q)',
  jump: 'Space',
  walk: 'A / D',
  skip: 'Tab',
};

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
    line: 'Guard high with {up}, low with {down}. Try both.',
    hint: 'Move the mouse well past the middle of the screen, up and then down.',
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
    hint: 'Wait for her step in, then flick to her height. Switching too early is just a block.',
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
  nice: 'Nice!',
  progress: (got: number, need: number) => `${got} of ${need}`,
};

/** Put button names into a line, as <kbd> labels. */
export function fill(line: string, names: InputNames = MOUSE_KEYS): string {
  return line.replace(/\{(\w+)\}/g, (m, k: string) => (k in names ? `<kbd>${names[k as InputToken]}</kbd>` : m));
}
