// Flat paper maths for the cut-out fighters. Every piece is a flat card, so outlines, cut marks and
// the K.O. split are worked out as 2D polygons in the piece's own plane (x right, y up).
// No three.js here, so it can be unit-tested.

export type Pt = [number, number];
/** The side of a line kept by a cut: points where nx*x + ny*y >= c. */
export interface Line { nx: number; ny: number; c: number }

export function area(p: Pt[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; }
  return a / 2;
}
/** The same polygon, wound counter-clockwise. */
export const ccw = (p: Pt[]): Pt[] => (area(p) < 0 ? p.slice().reverse() : p);

/** Grow a polygon outwards by d (mitred corners, capped so sharp tips don't spike). */
export function offset(p0: Pt[], d: number): Pt[] {
  const p = ccw(p0), n = p.length, out: Pt[] = [];
  const nrm = (x: number, y: number): Pt => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const n1 = nrm(b[1] - a[1], a[0] - b[0]), n2 = nrm(c[1] - b[1], b[0] - c[0]);
    const m = nrm(n1[0] + n2[0], n1[1] + n2[1]), k = Math.max(0.4, m[0] * n1[0] + m[1] * n1[1]);
    out.push([b[0] + (m[0] * d) / k, b[1] + (m[1] * d) / k]);
  }
  return out;
}

/** Keep the part of a polygon on the kept side of a line, moved `extra` further in. */
export function clipHalf(p: Pt[], L: Line, extra = 0): Pt[] {
  const out: Pt[] = [], f = (q: Pt) => L.nx * q[0] + L.ny * q[1] - L.c - extra;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

/** The part of a polygon inside a convex shape (used for slash-shaped cut marks). */
export function clipConvex(p: Pt[], convex: Pt[]): Pt[] {
  const c = ccw(convex);
  let out = p;
  for (let i = 0; i < c.length && out.length >= 3; i++) {
    const a = c[i], b = c[(i + 1) % c.length], dx = b[0] - a[0], dy = b[1] - a[1];
    out = clipHalf(out, { nx: -dy, ny: dx, c: -dy * a[0] + dx * a[1] });
  }
  return out.length >= 3 ? out : [];
}

/** A slash mark: a long thin six-sided lens through P along angle `ang`. */
export function slashLens(P: Pt, ang: number, reach: number, w: number): Pt[] {
  const t: Pt = [Math.cos(ang), Math.sin(ang)], n: Pt = [-t[1], t[0]];
  const at = (u: number, v: number): Pt => [P[0] + t[0] * u + n[0] * v, P[1] + t[1] * u + n[1] * v];
  return [at(-reach, 0), at(-reach * 0.45, -w), at(reach * 0.45, -w), at(reach, 0), at(reach * 0.45, w), at(-reach * 0.45, w)];
}

/**
 * Outlines of a flat mesh: each connected group of triangles gives its outer edge as one polygon,
 * plus how far in front (z) that group sits. Used to read pieces exported from Blender.
 */
export function loopsFromTriangles(pos: ArrayLike<number>, index: ArrayLike<number> | null): { pts: Pt[]; z: number }[] {
  const ids = new Map<string, number>(), vx: number[][] = [];
  const vid = (i: number) => {
    const k = pos[i * 3].toFixed(4) + ',' + pos[i * 3 + 1].toFixed(4) + ',' + pos[i * 3 + 2].toFixed(4);
    let id = ids.get(k);
    if (id === undefined) { id = vx.length; ids.set(k, id); vx.push([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]); }
    return id;
  };
  const n = index ? index.length : pos.length / 3, tris: number[][] = [];
  for (let t = 0; t + 2 < n; t += 3) tris.push([0, 1, 2].map((j) => vid(index ? index[t + j] : t + j)));
  const parent = vx.map((_, i) => i), find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const [a, b, c] of tris) { parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const groups = new Map<number, number[][]>();
  for (const t of tris) { const r = find(t[0]); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(t); }
  const out: { pts: Pt[]; z: number }[] = [];
  for (const g of groups.values()) {
    const count = new Map<string, number>(), next = new Map<number, number>();
    for (const t of g) for (let j = 0; j < 3; j++) { const a = t[j], b = t[(j + 1) % 3], k = a < b ? a + ':' + b : b + ':' + a; count.set(k, (count.get(k) ?? 0) + 1); }
    for (const t of g) for (let j = 0; j < 3; j++) { const a = t[j], b = t[(j + 1) % 3]; if (count.get(a < b ? a + ':' + b : b + ':' + a) === 1) next.set(a, b); }
    let best: Pt[] = [];
    const used = new Set<number>();
    for (const start of next.keys()) {
      if (used.has(start)) continue;
      const loop: Pt[] = [];
      for (let v = start, guard = 0; guard < 10000; guard++) {
        used.add(v); loop.push([vx[v][0], vx[v][1]]);
        const w = next.get(v); if (w === undefined || w === start) break;
        if (used.has(w)) break; // two shapes touching at one corner (a pinch): stop instead of walking in circles
        v = w;
      }
      if (Math.abs(area(loop)) > Math.abs(area(best))) best = loop;
    }
    if (best.length < 3) continue;
    const vs = new Set(g.flat());
    let z = 0; for (const v of vs) z += vx[v][2];
    out.push({ pts: ccw(best), z: z / vs.size });
  }
  return out;
}
