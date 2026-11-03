// Shared look values and small helpers for drawing. Nothing here affects the fight.

export const C = {
  paper: '#FBFAF6', fold: '#DCD8CF', ink: '#18171C', red: '#D7262E', redDeep: '#8F1219',
  steel: '#E9EEF2', indigo: '#2E3F8F', gold: '#D9A21B', kraft: '#B98B5E', legal: '#F6E27F',
  marble: '#141316', white: '#FFFFFF',
} as const;

/** A fighter's look: colours by Blender material role (robe, kimono, hakama, accent...), and which fighter's own
 *  paper pieces it wears (`variant`: Kami's topknot and wide sleeves, or Sumi's straw hat and tied-back sleeves;
 *  pieces named "kami_..." / "sumi_..." in the Blender file). The samurai is painted as Kami in Blender; a look
 *  only lists what it changes. */
export interface Look { name: string; colors: Record<string, string>; variant?: 'kami' | 'sumi' }
export const KAMI: Look = { name: 'Kami', colors: {}, variant: 'kami' };
// Sumi wears Kami's robes inverted: a cream robe over an indigo kimono, indigo prints (Marz's pick), and their own
// straw hat and tied-back sleeves (#37, Marz's pick).
export const SUMI: Look = { name: 'Sumi', colors: { robe: '#F2E3C0', kimono: '#3C3A7E' }, variant: 'sumi' };
export const LOOKS = [KAMI, SUMI] as const;

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeIn = (k: number) => k * k;
export const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
export const easeIO = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const D = Math.PI / 180;
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = matchMedia('(pointer: coarse)').matches;
