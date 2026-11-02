import { describe, expect, it } from 'vitest';
import { area, clipConvex, clipHalf, loopsFromTriangles, offset, slashLens, type Pt } from '../src/render/paper2d';

const square: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

describe('flat paper maths', () => {
  it('grows a polygon outwards by the border width', () => {
    const big = offset(square, 0.1);
    expect(area(big)).toBeCloseTo(1.44, 5);
    expect(big[0][0]).toBeCloseTo(-0.1, 5);
    expect(big[0][1]).toBeCloseTo(-0.1, 5);
  });

  it('keeps one side of a cut line, with a gap for the red edge', () => {
    const top = clipHalf(square, { nx: 0, ny: 1, c: 0.5 });
    expect(area(top)).toBeCloseTo(0.5, 5);
    const short = clipHalf(square, { nx: 0, ny: 1, c: 0.5 }, 0.1);
    expect(area(short)).toBeCloseTo(0.4, 5);
    expect(clipHalf(square, { nx: 0, ny: 1, c: 2 })).toEqual([]);
  });

  it('cuts a slash-shaped mark only where it crosses the paper', () => {
    const lens = slashLens([0.5, 0.5], 0, 0.4, 0.05);
    const mark = clipConvex(square, lens);
    expect(mark.length).toBeGreaterThanOrEqual(3);
    expect(Math.abs(area(mark))).toBeCloseTo(Math.abs(area(lens)), 5);
    expect(clipConvex(square, slashLens([3, 3], 0, 0.4, 0.05))).toEqual([]);
  });

  it('reads the outline and depth of each flat group in a mesh', () => {
    // A quad made of two triangles at z=0, and a small triangle printed in front at z=0.002.
    const pos = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0.2, 0.2, 0.002, 0.4, 0.2, 0.002, 0.3, 0.4, 0.002];
    const loops = loopsFromTriangles(pos, null).sort((a, b) => a.z - b.z);
    expect(loops).toHaveLength(2);
    expect(loops[0].pts).toHaveLength(4);
    expect(area(loops[0].pts)).toBeCloseTo(1, 5);
    expect(loops[1].z).toBeCloseTo(0.002, 5);
  });

  it('stays sane when two shapes touch at one corner', () => {
    // Two triangles sharing only the point (1,1).
    const pos = [0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 2, 1, 0, 2, 2, 0];
    const loops = loopsFromTriangles(pos, null);
    for (const l of loops) expect(l.pts.length).toBeLessThanOrEqual(6);
  });
});
