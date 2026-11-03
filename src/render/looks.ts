// Player looks (issue #38): a colour set worn dark or light, an outfit print and a sword style. Every look is
// made from the same samurai pieces: only colours and printed shapes change, never the outline, the sword's
// length or anything in the fight. Bright red is never used: it stays reserved for cuts. The one exception is
// Oxblood, a dark brown-red far darker than a cut, so a fresh red slash still pops on it.
// Looks travel online once, at match start, as a short text code (see encodePick); they are never fight inputs.
// No three.js and no browser APIs here, so it can be unit-tested.

import { clipConvex, type Pt } from './paper2d';
import type { Look } from './common';
import type { Piece, Shape } from './puppet';

export interface ColourSet { id: string; name: string; robe: string; kimono: string; hakama: string; hakamaDark: string }
/** Dark side: `robe` over `kimono`. Light side: the two swapped. Hakama stays. No bright red, pink, orange or
 *  yellow; Oxblood's dark red is the only red allowed (see the rule check in tests/looks.test.ts). */
export const COLOUR_SETS: readonly ColourSet[] = [
  { id: 'indigo', name: 'Indigo', robe: '#3C3A7E', kimono: '#F2E3C0', hakama: '#4A4A7E', hakamaDark: '#33345F' },
  { id: 'kraft', name: 'Kraft', robe: '#9A6A42', kimono: '#F2E3C0', hakama: '#5A4030', hakamaDark: '#3E2C22' },
  { id: 'sumi', name: 'Sumi ink', robe: '#25242A', kimono: '#EBE6DA', hakama: '#4A4950', hakamaDark: '#313036' },
  { id: 'pine', name: 'Pine', robe: '#3D5E3E', kimono: '#EFE6C8', hakama: '#3D4A3A', hakamaDark: '#2A3428' },
  { id: 'sky', name: 'Graph blue', robe: '#5F8DB8', kimono: '#F4EFE2', hakama: '#34507A', hakamaDark: '#263B5C' },
  { id: 'plum', name: 'Plum', robe: '#5A3A6C', kimono: '#EFE4D6', hakama: '#47364F', hakamaDark: '#31253A' },
  { id: 'oxblood', name: 'Oxblood', robe: '#5C2328', kimono: '#F0E4CF', hakama: '#3A2A2D', hakamaDark: '#281D20' },
];

export const OUTFITS = [
  { id: 'waves', name: 'Waves', note: 'Waves at the hems, a crest on each sleeve' },
  { id: 'stripes', name: 'Stripes', note: 'Bold stripes down the robe and sleeves' },
  { id: 'plain', name: 'Plain', note: 'A clean robe with just the hem band' },
] as const;
export type OutfitId = (typeof OUTFITS)[number]['id'];

export interface SwordStyle {
  id: string; name: string; note: string;
  blade: string; guard: string | null; handle: string; wrap: string;
  /** The guard's shape: the model's bar, a bigger square plate, or none. */
  guardShape: 'bar' | 'square' | 'none';
  /** A print on the blade: a centre fold, wood grain, or an ink temper line. */
  mark: 'crease' | 'grain' | 'hamon' | null; markColor: string;
}
/** Every style keeps the model's blade outline, so the tip (and the fight's reach) never moves. Blades stay pale
 *  so the guard height still reads from the blade alone. */
export const SWORDS: readonly SwordStyle[] = [
  { id: 'katana', name: 'Katana', note: 'Steel, black guard, gold wrap', blade: '#EEF0F2', guard: '#18171C', handle: '#2A2220', wrap: '#E0A82E', guardShape: 'bar', mark: null, markColor: '' },
  { id: 'folded', name: 'Folded', note: 'A white paper blade folded down the middle', blade: '#FBFAF6', guard: '#FBFAF6', handle: '#B98B5E', wrap: '#3C3A7E', guardShape: 'bar', mark: 'crease', markColor: '#CFC9BB' },
  { id: 'bokken', name: 'Bokken', note: 'A wooden practice sword cut from kraft card', blade: '#D9BC92', guard: null, handle: '#D9BC92', wrap: '#18171C', guardShape: 'none', mark: 'grain', markColor: '#B08A5E' },
  { id: 'hamon', name: 'Hamon', note: 'Steel with an ink temper line, square guard', blade: '#EEF0F2', guard: '#18171C', handle: '#18171C', wrap: '#8A8794', guardShape: 'square', mark: 'hamon', markColor: '#9AA3AD' },
];

/** What a player picked on the Fighter screen. */
export interface Pick { set: string; light: boolean; outfit: OutfitId; sword: string }
export const DEFAULT_PICK: Pick = { set: 'indigo', light: false, outfit: 'waves', sword: 'katana' };
/** The practice dummy and the default player 2: Indigo worn light, as Sumi always was. */
export const SUMI_PICK: Pick = { ...DEFAULT_PICK, light: true };

const byId = <T extends { id: string }>(list: readonly T[], id: string) => list.find((x) => x.id === id);

/** A pick as a short text code for the server, e.g. "kraft.l.stripes.folded". */
export const encodePick = (p: Pick) => `${p.set}.${p.light ? 'l' : 'd'}.${p.outfit}.${p.sword}`;
/** Read a pick back; anything unknown falls back to the default, so a bad code can only look plain. */
export function decodePick(code: unknown, fallback: Pick = DEFAULT_PICK): Pick {
  const [set, side, outfit, sword] = typeof code === 'string' ? code.split('.') : [];
  return {
    set: byId(COLOUR_SETS, set ?? '') ? set : fallback.set,
    light: side === 'l' ? true : side === 'd' ? false : fallback.light,
    outfit: byId(OUTFITS, outfit ?? '') ? (outfit as OutfitId) : fallback.outfit,
    sword: byId(SWORDS, sword ?? '') ? sword : fallback.sword,
  };
}

/** Who's who: one fighter always wears a dark robe and the other a light one. On a tie, player 2 flips. */
export function pairPicks(a: Pick, b: Pick): [Pick, Pick] {
  return [a, a.light === b.light ? { ...b, light: !a.light } : b];
}

/** A random look for an Endless bot (rand returns 0..1). */
export function randomPick(rand: () => number): Pick {
  const any = <T>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  return { set: any(COLOUR_SETS).id, light: rand() < 0.5, outfit: any(OUTFITS).id, sword: any(SWORDS).id };
}

/** The look the fighter is drawn with: colours by Blender material role, plus the outfit and sword. */
export function lookOf(p: Pick, name: string): Look {
  const c = byId(COLOUR_SETS, p.set) ?? COLOUR_SETS[0];
  const [robe, kimono] = p.light ? [c.kimono, c.robe] : [c.robe, c.kimono];
  return { name, key: encodePick(p), colors: { robe, kimono, hakama: c.hakama, hakamaDark: c.hakamaDark }, outfit: p.outfit, sword: p.sword };
}

// ---------- dressing the pieces ----------
/** The paper objects that carry the robe's prints. */
const ROBE_OBJS = new Set(['robe_L', 'robe_R', 'sleeve_L', 'sleeve_R']);
/** Kami's and Sumi's own sleeves ("kami_sleeve_L", "sumi_sleeve_R") count as the sleeves (#37). */
const isRobe = (obj: string) => ROBE_OBJS.has(obj.replace(/^(kami|sumi)_/i, ''));
/** Sumi's sleeve cord (#37) ties the sleeve back: part of the outline, kept with every outfit, and it is that
 *  sleeve's band. It is printed in the look's contrast colour (the kimono's), never red: red is for cuts. */
const CORD = 'cord';
const KIMONO = '#F2E3C0';
const SCALE = 2.1 / 4; // as in puppet.ts (the model is 4 units tall)
const PRINT = 0.004 * SCALE; // a print sits this far in front of its paper, like the Blender model's prints
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function bbox(p: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

/** The robe prints that stay with every outfit: each robe object's first print, the straight hem band. */
function hemBands(shapes: Shape[]) {
  const first = new Map<string, Shape>();
  const corded = new Set(shapes.filter((s) => s.role === CORD).map((s) => s.obj));
  for (const s of shapes) if (!s.paper && isRobe(s.obj) && !corded.has(s.obj)) { const f = first.get(s.obj); if (!f || s.z < f.z) first.set(s.obj, s); }
  return new Set(first.values());
}

/** Outfit prints: the model's waves and crests, or stripes, or just the hem band. */
function dressOutfit(input: Shape[], outfit: string): Shape[] {
  const shapes = input.map((s) => (s.role === CORD ? { ...s, role: 'kimono', color: KIMONO } : s));
  if (outfit === 'waves') return shapes;
  const keep = hemBands(input), out: Shape[] = [];
  for (const [i, s] of shapes.entries()) {
    if (!s.paper && isRobe(s.obj) && input[i].role !== CORD && !keep.has(input[i])) continue;
    out.push(s);
    if (outfit === 'stripes' && s.paper && s.role === 'robe' && isRobe(s.obj)) {
      const b = bbox(s.pts), step = 0.22 * SCALE, w = 0.09 * SCALE;
      // Just behind the hem band, so the band runs over the stripes.
      for (let x = b.x0 + 0.06 * SCALE; x < b.x1; x += step) {
        const pts = clipConvex(s.pts, rect(x, b.y0 - 1, x + w, b.y1 + 1));
        if (pts.length >= 3) out.push({ pts, role: 'kimono', color: '#F2E3C0', z: s.z + PRINT * 0.6, paper: false, obj: s.obj });
      }
    }
  }
  return out;
}

/** The sword in a style: same blade outline, new colours, guard and blade print. The model's sword is a handle,
 *  a guard (ink), the blade (steel) and the hilt wrap (accent). */
function dressSword(shapes: Shape[], st: SwordStyle): Shape[] {
  const out: Shape[] = [];
  const blade = shapes.find((s) => s.role === 'steel');
  for (const s of shapes) {
    if (s.role === 'steel') out.push({ ...s, role: 'blade', color: st.blade });
    else if (s.role === 'handle') out.push({ ...s, role: 'grip', color: st.handle });
    else if (s.role === 'accent') out.push({ ...s, role: 'wrap', color: st.wrap });
    else if (s.role === 'ink') {
      if (st.guardShape === 'none' || !st.guard) continue;
      const b = bbox(s.pts), grow = st.guardShape === 'square' ? 0.02 * SCALE : 0, tall = st.guardShape === 'square' ? 0.04 * SCALE : 0;
      out.push({ ...s, role: 'guard', color: st.guard, pts: grow || tall ? rect(b.x0 - grow, b.y0 - tall, b.x1 + grow, b.y1 + tall) : s.pts });
    } else out.push(s);
  }
  if (blade && st.mark) {
    const b = bbox(blade.pts), h = b.y1 - b.y0, len = b.x1 - b.x0, z = blade.z + PRINT * 0.6, col = st.markColor;
    const mark = (pts: Pt[]) => out.push({ pts, role: 'bladeMark', color: col, z, paper: false, obj: blade.obj });
    if (st.mark === 'crease') mark(rect(b.x0, b.y0 + h * 0.45, b.x0 + len * 0.86, b.y0 + h * 0.55));
    if (st.mark === 'grain') for (const k of [0.17, 0.46, 0.75]) mark(rect(b.x0 + len * k, b.y0 + h * 0.3, b.x0 + len * (k + 0.17), b.y0 + h * 0.4));
    if (st.mark === 'hamon') {
      // A zigzag temper line along the edge (the lower side), straight segments only.
      const end = b.x0 + len * 0.9, n = 18, pts: Pt[] = [[b.x0, b.y0 + h * 0.08]];
      for (let i = 0; i <= n; i++) pts.push([b.x0 + ((end - b.x0) * i) / n, b.y0 + h * (i % 2 ? 0.3 : 0.15)]);
      pts.push([end, b.y0 + h * 0.08]);
      mark(pts);
    }
  }
  return out;
}

const dressed = new WeakMap<Piece, Map<string, Shape[]>>();
/** A piece's shapes for a look (cached). Nothing changes the paper outline except the sword's guard. */
export function dressPiece(piece: Piece, look: Look): Shape[] {
  const key = `${look.outfit ?? 'waves'}|${look.sword ?? 'katana'}`;
  let m = dressed.get(piece);
  if (!m) { m = new Map(); dressed.set(piece, m); }
  let out = m.get(key);
  if (!out) {
    out = piece.name === 'sword' ? dressSword(piece.shapes, byId(SWORDS, look.sword ?? '') ?? SWORDS[0]) : dressOutfit(piece.shapes, look.outfit ?? 'waves');
    out.sort((a, b) => a.z - b.z);
    m.set(key, out);
  }
  return out;
}
