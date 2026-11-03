// Ranked ratings: Glicko-2 (one match at a time) and the paper-grade divisions.
// Glicko-2 tracks how sure it is of each rating (RD), so a new player's rating moves fast and
// settles in about ten matches. Reference: Mark Glickman, "Example of the Glicko-2 system" (2013).

export interface Rating { rating: number; rd: number; vol: number }

export const START: Rating = { rating: 1500, rd: 350, vol: 0.06 };
/** RD never drops below this, so even a settled rating keeps moving a little. */
const MIN_RD = 40;
const TAU = 0.5;
const SCALE = 173.7178;

/** Lowest to highest. A division starts at its `from` rating. */
export const DIVISIONS = [
  { name: 'Tissue', from: -Infinity },
  { name: 'Newsprint', from: 1350 },
  { name: 'Cardstock', from: 1475 },
  { name: 'Washi', from: 1600 },
  { name: 'Gold Leaf', from: 1750 },
] as const;
/** Matches before a division is shown. */
export const PLACEMENT = 5;

export function divisionOf(rating: number): string {
  let d: string = DIVISIONS[0].name;
  for (const x of DIVISIONS) if (rating >= x.from) d = x.name;
  return d;
}

/** What a player sees: "Cardstock" or "Placement 2/5", and the rounded points. */
export function badge(r: Rating & { games: number }) {
  return { division: r.games < PLACEMENT ? `Placement ${r.games}/${PLACEMENT}` : divisionOf(r.rating), points: Math.round(r.rating), placed: r.games >= PLACEMENT };
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/** A's new rating after one match against B. score: 1 = A won, 0 = A lost. */
export function rate(a: Rating, b: Rating, score: 0 | 1): Rating {
  const mu = (a.rating - 1500) / SCALE, phi = a.rd / SCALE;
  const muB = (b.rating - 1500) / SCALE, phiB = b.rd / SCALE;
  const gB = g(phiB), E = 1 / (1 + Math.exp(-gB * (mu - muB)));
  const v = 1 / (gB * gB * E * (1 - E));
  const delta = v * gB * (score - E);

  // New volatility (the Illinois method from the reference).
  const A0 = Math.log(a.vol * a.vol), d2 = delta * delta, p2 = phi * phi;
  const f = (x: number) => (Math.exp(x) * (d2 - p2 - v - Math.exp(x))) / (2 * (p2 + v + Math.exp(x)) ** 2) - (x - A0) / (TAU * TAU);
  let A = A0, B: number;
  if (d2 > p2 + v) B = Math.log(d2 - p2 - v);
  else { let k = 1; while (f(A0 - k * TAU) < 0) k++; B = A0 - k * TAU; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(p2 + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gB * (score - E);
  return { rating: 1500 + SCALE * muNew, rd: Math.max(MIN_RD, Math.min(START.rd, SCALE * phiNew)), vol };
}
