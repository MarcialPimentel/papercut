// The open notebook's size and the shape of its pages. Shared by the drawn pages (notebook.ts) and the paper
// physics floor (physics.ts), so a K.O. half lands exactly on the paper you see. No browser APIs here, so tests
// can use it.

/** Page width (each side of the spine), depth, and the pages' centre in z. */
export const PW = 8.6, PD = 5.8, PZ = -0.7;

/** The drawn page is this many flat strips per side; the physics floor uses the same strips. */
export const PAGE_SEGS = 32;
/** Height of the page surface at x: it dips into the spine and lifts a little toward the outer edges. */
export const pageY = (x: number) => -0.09 * Math.exp(-Math.abs(x) * 1.5) + 0.02 * Math.pow(Math.abs(x) / PW, 2);

/** The physics floor sits this far above the drawn paper, so a resting half never shares a plane with it. */
export const FLOOR_LIFT = 0.006;
/** Inner faces of the invisible side walls that keep halves on the page. */
export const WALL_X = PW - 0.3;

/**
 * Where to start a K.O. half so its shape is fully above the floor and inside the side walls. A half that
 * starts inside the floor can be pushed out the wrong side and stay stuck under the page. `minX`/`maxX`/`minY`
 * are the half's world-space extent at its cut position; returns how far to move it.
 */
export function spawnNudge(minX: number, maxX: number, minY: number, margin = 0.01): { dx: number; dy: number } {
  let dx = 0;
  if (maxX - minX >= 2 * (WALL_X - margin)) dx = -(minX + maxX) / 2;
  else if (maxX > WALL_X - margin) dx = WALL_X - margin - maxX;
  else if (minX < -WALL_X + margin) dx = -WALL_X + margin - minX;
  // The floor's highest point under the half (the page rises toward the edges, so check both ends and the middle).
  let top = -Infinity;
  for (let i = 0; i <= 8; i++) top = Math.max(top, pageY(minX + dx + ((maxX - minX) * i) / 8));
  const floor = top + FLOOR_LIFT + margin;
  return { dx, dy: minY < floor ? floor - minY : 0 };
}
