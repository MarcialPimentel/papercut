// Player looks (issue #38): codes, the who's-who rule, the rule checks, and looks travelling online.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Lobby, type Peer } from '../server/lobby';
import type { ToClient } from '../src/net/protocol';
import {
  COLOUR_SETS, DEFAULT_PICK, FIGHTERS, OUTFITS, SUMI_PICK, SWORDS, decodePick, dressPiece, encodePick, lookOf, pairPicks, randomPick, type Pick,
} from '../src/render/looks';
import { PIECE_NAMES, puppetFrom, wornBy, type Puppet } from '../src/render/puppet';

let puppet: Puppet;
beforeAll(async () => {
  const buf = readFileSync('public/models/samurai.glb');
  const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  puppet = puppetFrom(gltf.scene);
});

const ALL: Pick[] = COLOUR_SETS.flatMap((c) => [false, true].flatMap((light) => OUTFITS.flatMap((o) => SWORDS.flatMap((s) => FIGHTERS.map((f) => ({ set: c.id, light, outfit: o.id, sword: s.id, fighter: f.id }))))));

/** Hue (degrees), saturation and lightness of a #RRGGBB colour. */
function hueSat(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return { h: 0, s: 0, l };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(max + min - 1)), l };
}
/** Too close to cut red (#D7262E) or the paper's red inside (#8F1219). A dark, muted red like Oxblood is
 *  allowed: at most 30% lightness and 55% saturation, so a fresh slash still pops on it. */
function cutRed(hex: string) {
  const { h, s, l } = hueSat(hex);
  return s > 0.35 && (h < 15 || h > 345) && !(l <= 0.3 && s <= 0.55);
}

describe('look codes', () => {
  it('round-trips every combination', () => {
    for (const p of ALL) expect(decodePick(encodePick(p))).toEqual(p);
  });
  it('falls back to the default for anything unknown', () => {
    expect(decodePick('')).toEqual(DEFAULT_PICK);
    expect(decodePick(undefined, SUMI_PICK)).toEqual(SUMI_PICK);
    expect(decodePick('red.l.bikini.laser')).toEqual({ ...DEFAULT_PICK, light: true });
    expect(decodePick(42)).toEqual(DEFAULT_PICK);
  });
  it("Kami or Sumi travels in the code; older codes without it keep the seat's own fighter", () => {
    expect(encodePick({ ...DEFAULT_PICK, fighter: 'sumi' })).toBe('indigo.d.waves.katana.s');
    expect(decodePick('indigo.d.waves.katana.s').fighter).toBe('sumi');
    expect(decodePick('indigo.l.waves.katana.k', SUMI_PICK).fighter).toBe('kami');
    expect(decodePick('indigo.d.waves.katana').fighter).toBe('kami');
    expect(decodePick('indigo.d.waves.katana', SUMI_PICK).fighter).toBe('sumi');
    expect(lookOf({ ...DEFAULT_PICK, fighter: 'sumi' }, 'x').variant).toBe('sumi');
    expect(lookOf(SUMI_PICK, 'x').key).not.toBe(lookOf({ ...SUMI_PICK, fighter: 'kami' }, 'x').key);
  });
  it('random bot looks are always valid', () => {
    let seed = 3;
    const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 200; i++) { const p = randomPick(rand); expect(decodePick(encodePick(p))).toEqual(p); }
  });
});

describe("who's who", () => {
  it('always shows one dark robe and one light robe', () => {
    for (const a of ALL.filter((_, i) => i % 7 === 0)) for (const b of ALL.filter((_, i) => i % 11 === 0)) {
      const [p0, p1] = pairPicks(a, b);
      expect(p0).toEqual(a);
      expect(p0.light).not.toBe(p1.light);
      expect({ ...p1, light: b.light }).toEqual(b); // only the robe side ever changes
    }
  });
  it('two default players look like Kami and Sumi, as before', () => {
    const [k, s] = pairPicks(DEFAULT_PICK, DEFAULT_PICK);
    expect(lookOf(k, 'Kami').colors).toMatchObject({ robe: '#3C3A7E', kimono: '#F2E3C0' });
    expect(lookOf(s, 'Sumi').colors).toMatchObject({ robe: '#F2E3C0', kimono: '#3C3A7E' });
  });
});

describe('rule checks', () => {
  it('no look uses bright red, pink or orange: red is for cuts (dark Oxblood is the one red allowed)', () => {
    const colours = [...COLOUR_SETS.flatMap((c) => [c.robe, c.kimono, c.hakama, c.hakamaDark]), ...SWORDS.flatMap((s) => [s.blade, s.handle, s.wrap, s.markColor, s.guard ?? '#000000'].filter(Boolean))];
    for (const c of colours) {
      const { h, s, l } = hueSat(c);
      const red = cutRed(c); // any bright red (brown kraft, gold and dark Oxblood are fine)
      const loud = s > 0.6 && l > 0.45 && (h < 35 || h > 300); // bright orange or pink
      expect(red || loud, `${c} is too close to cut red`).toBe(false);
    }
  });

  it('outfits never change the paper outline, only the prints', () => {
    for (const o of OUTFITS) {
      const look = lookOf({ ...DEFAULT_PICK, outfit: o.id }, 'x');
      for (const name of PIECE_NAMES) {
        if (name === 'sword') continue;
        const paper = (shapes: { paper: boolean; pts: unknown }[]) => shapes.filter((s) => s.paper).map((s) => s.pts);
        expect(paper(dressPiece(puppet[name], look))).toEqual(paper(puppet[name].shapes));
      }
    }
  });

  it('every outfit keeps the straight hem band, and stripes stay on the robe', () => {
    for (const o of OUTFITS) {
      const torso = dressPiece(puppet.torso, lookOf({ ...DEFAULT_PICK, outfit: o.id }, 'x'));
      expect(torso.some((s) => !s.paper && s.obj === 'robe_L')).toBe(true);
    }
    const torso = dressPiece(puppet.torso, lookOf({ ...DEFAULT_PICK, outfit: 'stripes' }, 'x'));
    const robe = puppet.torso.shapes.find((s) => s.paper && s.obj === 'robe_L')!;
    const xs = robe.pts.map((p) => p[0]), ys = robe.pts.map((p) => p[1]);
    for (const s of torso.filter((s) => s.obj === 'robe_L' && !s.paper)) for (const [x, y] of s.pts) {
      expect(x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-6); expect(x).toBeLessThanOrEqual(Math.max(...xs) + 1e-6);
      expect(y).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6); expect(y).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
    }
  });

  it('every sword keeps the same blade outline, so the reach never changes', () => {
    const steel = puppet.sword.shapes.find((s) => s.role === 'steel')!;
    for (const st of SWORDS) {
      const shapes = dressPiece(puppet.sword, lookOf({ ...DEFAULT_PICK, sword: st.id }, 'x'));
      const blade = shapes.find((s) => s.role === 'blade')!;
      expect(blade.pts).toEqual(steel.pts);
      expect(blade.color).toBe(st.blade);
      // Nothing reaches past the blade's tip.
      const tip = Math.max(...steel.pts.map((p) => p[0]));
      for (const s of shapes) for (const [x] of s.pts) expect(x).toBeLessThanOrEqual(tip + 1e-9);
    }
  });

  it('blades stay pale, so the guard height reads from the blade on every page', () => {
    for (const st of SWORDS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(st.blade.slice(i, i + 2), 16));
      expect(0.299 * r + 0.587 * g + 0.114 * b, st.name).toBeGreaterThan(170);
    }
  });
});

describe("Kami's and Sumi's own pieces with every look (#37 + #38)", () => {
  const arms = ['arm_L', 'arm_R'] as const;
  const prints = (p: Puppet, look: ReturnType<typeof lookOf>, side: string) =>
    arms.flatMap((a) => dressPiece(p[a], look)).filter((s) => !s.paper && s.obj.endsWith('sleeve_' + side));

  it('every colour set, robe side, outfit and sword dresses both fighters with no red and the same outline', () => {
    for (const v of ['kami', 'sumi'] as const) {
      const p = wornBy(puppet, v);
      for (const pick of ALL) {
        const look = lookOf(pick, 'x');
        for (const name of PIECE_NAMES) {
          const shapes = dressPiece(p[name], look);
          if (name !== 'sword') expect(shapes.filter((s) => s.paper).map((s) => s.pts)).toEqual(p[name].shapes.filter((s) => s.paper).map((s) => s.pts));
          for (const s of shapes) {
            const c = look.colors[s.role] ?? s.color;
            expect(cutRed(c), `${v} ${encodePick(pick)} ${s.obj} ${s.role} ${c}`).toBe(false);
          }
        }
      }
    }
  });

  it("Sumi's sleeve cord stays with every outfit, in the look's contrast colour", () => {
    const sumi = wornBy(puppet, 'sumi');
    for (const pick of ALL.filter((p) => p.sword === 'katana')) {
      const look = lookOf(pick, 'x');
      for (const side of ['L', 'R']) {
        const cords = prints(sumi, look, side).filter((s) => s.obj.startsWith('sumi_') && s.role === 'kimono' && s.color === '#F2E3C0');
        expect(cords.length, `${encodePick(pick)} ${side}`).toBeGreaterThan(0);
        expect(look.colors.kimono).not.toBe(look.colors.robe);
      }
    }
  });

  it('plain and stripes drop the sleeve crest and waves on both fighters; stripes reach Sumi sleeves', () => {
    for (const v of ['kami', 'sumi'] as const) {
      const p = wornBy(puppet, v);
      const n = (outfit: (typeof OUTFITS)[number]['id']) => prints(p, lookOf({ ...DEFAULT_PICK, outfit }, 'x'), 'L').length;
      expect(n('plain'), v).toBeLessThan(n('waves'));
      expect(n('plain'), v).toBe(1); // Kami's cuff band, or Sumi's cord
      expect(n('stripes'), v).toBeGreaterThan(n('plain'));
    }
  });

  it('each fighter wears only their own pieces', () => {
    const objs = (v: 'kami' | 'sumi') => new Set(PIECE_NAMES.flatMap((n) => wornBy(puppet, v)[n].shapes.map((s) => s.obj)));
    expect([...objs('sumi')].filter((o) => o.startsWith('kami_'))).toEqual([]);
    expect([...objs('kami')].filter((o) => o.startsWith('sumi_'))).toEqual([]);
    expect(objs('sumi')).toContain('sumi_hair');
    expect(objs('sumi')).not.toContain('kami_hair');
    expect(objs('kami')).toContain('kami_hair');
  });
});

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  rtt = 40;
  look?: string;
  send(m: ToClient) { this.inbox.push(m); }
  last<K extends ToClient['t']>(t: K) {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Extract<ToClient, { t: K }>;
    return undefined;
  }
}

describe('looks online', () => {
  it('both players get both looks when an invite room starts', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'host', look: 'pine.d.stripes.hamon' });
    lobby.message(b, { t: 'join', code: a.last('room')!.code, look: 'kraft.l.plain.bokken' });
    for (const p of [a, b]) expect(p.last('start')!.looks).toEqual(['pine.d.stripes.hamon', 'kraft.l.plain.bokken']);
  });

  it('quick match carries looks too, and junk is dropped', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'quick', look: '<script>alert(1)</script>' });
    lobby.message(b, { t: 'quick', look: 'plum.l.waves.folded' });
    expect(a.last('start')!.looks).toEqual(['', 'plum.l.waves.folded']);
  });

  it('tournament fighters and watchers all see the two fighters\' looks', () => {
    const queue: (() => void)[] = [];
    const lobby = new Lobby(() => 0.5, (fn) => { queue.push(fn); return 0; });
    const ps = [new FakePeer(), new FakePeer(), new FakePeer()];
    lobby.message(ps[0], { t: 'tourney', name: 'A', look: 'sky.d.waves.katana' });
    const code = ps[0].last('lobby')!.code;
    lobby.message(ps[1], { t: 'join', code, name: 'B', look: 'sumi.l.stripes.folded' });
    lobby.message(ps[2], { t: 'join', code, name: 'C', look: 'pine.d.plain.bokken' });
    lobby.message(ps[0], { t: 'begin' });
    const byPeer = new Map(ps.map((p, i) => [p, ['sky.d.waves.katana', 'sumi.l.stripes.folded', 'pine.d.plain.bokken'][i]]));
    const m = ps.map((p) => p.last('match')!);
    const fighters = ps.filter((p) => p.last('match')!.seat !== -1).sort((x, y) => x.last('match')!.seat - y.last('match')!.seat);
    expect(fighters.length).toBe(2);
    for (const x of m) expect(x.looks).toEqual([byPeer.get(fighters[0]), byPeer.get(fighters[1])]);
  });
});
