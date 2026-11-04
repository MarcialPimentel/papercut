import { describe, expect, it } from 'vitest';
import { BTN, hashState, matchWinner, newMatch, step, type FightEvent, type State } from '../src/sim/sim';
import { DEFENCE, MOVES, RULES, defencePage } from '../src/sim/rules';
import { DEFENCE_CFG, cleanCfg } from '../src/sim/config';
import { Dummy } from '../src/sim/dummy';
import { seeded } from '../src/sim/endless';

const { low, light, heavy, right, left, jump } = BTN;

function run(s: State, frames: number, inp: (n: number) => [number, number] = () => [0, 0]) {
  const ev: FightEvent[] = [];
  for (let n = 0; n < frames; n++) ev.push(...step(s, inp(n)));
  return ev;
}
const kinds = (ev: FightEvent[]) => ev.map((e) => e.k);

/** A Dojo Defense match past its intro, fighters close together. */
function fightAt(gap = 1.2): State {
  const s = newMatch(DEFENCE_CFG);
  while (s.phase !== 'fight') step(s, [0, 0]);
  s.f[0].x = -gap / 2; s.f[1].x = gap / 2;
  return s;
}

/** Kami cuts Sumi down with a heavy at the wrong guard height. */
function kamiKills(s: State) {
  return run(s, MOVES.heavy.wind + 2, (n) => [low | (n === 0 ? heavy : 0), 0]);
}

describe('Dojo Defense', () => {
  it('starts on the Ruled Courtyard with nobody holding the way', () => {
    const s = newMatch(DEFENCE_CFG);
    expect(s.zone).toBe(0);
    expect(s.page).toBe(defencePage(0));
    expect(s.way).toBe(-1);
    expect(s.f[0].hp).toBe(MOVES.heavy.dmg);
  });

  it('one heavy empties the strip; four lights do too', () => {
    const s = fightAt();
    expect(kinds(kamiKills(s))).toContain('ko');
    expect(s.f[1].alive).toBe(false);
    expect(Math.ceil(DEFENCE_CFG.maxHp / MOVES.light.dmg)).toBe(4);
  });

  it('a K.O. gives the killer the way and keeps the fight going', () => {
    const s = fightAt();
    kamiKills(s);
    expect(s.way).toBe(0);
    expect(s.phase).toBe('fight');
    expect(s.f[0].wins).toBe(1);
  });

  it('the cut fighter unfolds again 6 m ahead of the winner, unhittable for a moment', () => {
    const s = fightAt();
    kamiKills(s);
    const ev = run(s, DEFENCE.respawn + 1);
    expect(ev.some((e) => e.k === 'spawn' && e.p === 1)).toBe(true);
    expect(s.f[1].alive).toBe(true);
    expect(s.f[1].x - s.f[0].x).toBeCloseTo(DEFENCE.gap, 5);
    expect(s.f[1].unfold).toBeGreaterThan(0);
    expect(s.f[0].hp).toBe(DEFENCE_CFG.maxHp);
  });

  it('without the way, the page edge is a wall', () => {
    const s = fightAt();
    run(s, 400, () => [left, 0]);
    expect(s.phase).toBe('fight');
    expect(s.f[0].x).toBeCloseTo(-RULES.edge, 5);
  });

  it("nobody passes a living rival, not even by jumping over", () => {
    const s = fightAt(1.6);
    run(s, 120, (n) => [right | (n % 40 === 0 ? jump : 0), 0]);
    expect(s.f[0].x).toBeLessThan(s.f[1].x);
    expect(s.f[1].x - s.f[0].x).toBeGreaterThanOrEqual(RULES.bodyGap - 1e-9);
  });

  it('the runner walks off the edge, the page turns, and the rival is waiting ahead', () => {
    const s = fightAt();
    kamiKills(s);
    let turned = false;
    for (let n = 0; n < 1200 && !turned; n++) { if (step(s, [right, 0]).some((e) => e.k === 'turn')) turned = true; }
    expect(turned).toBe(true);
    run(s, RULES.turnFrames);
    expect(s.phase).toBe('fight');
    expect(s.zone).toBe(1);
    expect(s.page).toBe(defencePage(1));
    expect(s.f[0].x).toBeCloseTo(-(RULES.edge - DEFENCE.entry), 5);
    expect(s.f[1].alive).toBe(true);
    expect(s.f[1].x - s.f[0].x).toBeCloseTo(DEFENCE.gap, 5);
  });

  it('crossing the rival cover wins the match', () => {
    const s = fightAt();
    kamiKills(s);
    s.zone = DEFENCE.goal; s.respawnT = 0; s.respawnWho = -1; // Sumi stays down
    const ev = run(s, 600, () => [right, 0]);
    expect(kinds(ev)).toContain('over');
    expect(s.phase).toBe('over');
    expect(matchWinner(s)).toBe(0);
  });

  it('Sumi runs the other way, toward the front cover', () => {
    const s = fightAt();
    run(s, MOVES.heavy.wind + 2, (n) => [0, low | (n === 0 ? heavy : 0)]);
    expect(s.way).toBe(1);
    let turned = false;
    for (let n = 0; n < 1200 && !turned; n++) { if (step(s, [0, left]).some((e) => e.k === 'turn' && e.back)) turned = true; }
    expect(turned).toBe(true);
    run(s, RULES.turnFrames);
    expect(s.zone).toBe(-1);
    expect(s.f[0].x).toBeLessThan(s.f[1].x);
  });

  it('a double K.O. takes the way from both, and both unfold again', () => {
    const s = fightAt(); s.way = 1; s.f[0].hp = 1; s.f[1].hp = 1;
    // Both slash on the same frame at different heights: neither is guarding, so both land.
    run(s, MOVES.light.wind + 1, (n) => [low | (n === 0 ? light : 0), n === 0 ? light : 0]);
    expect(s.f.every((f) => !f.alive)).toBe(true);
    expect(s.way).toBe(-1);
    run(s, DEFENCE.respawn + 1);
    expect(s.f.every((f) => f.alive)).toBe(true);
    expect(s.f[0].x).toBeLessThan(s.f[1].x);
  });

  it('room rules keep Defense, with its fixed numbers', () => {
    expect(cleanCfg({ defence: true, maxHp: 150, wins: 3 })).toEqual(DEFENCE_CFG);
    expect(cleanCfg({ maxHp: 80 }).defence).toBeFalsy();
  });

  it('the same inputs give the same fight (online needs it)', () => {
    const play = () => {
      const s = newMatch(DEFENCE_CFG);
      const r = seeded(7), b = new Dummy(seeded(9), 1);
      b.level = 3;
      // Kami walks in and swings at random heights; Sumi is the bot.
      for (let n = 0; n < 60 * 90; n++) {
        const dx = s.f[1].x - s.f[0].x;
        const mine = (dx > 2 ? right : 0) | (r() < 0.5 ? low : 0) | (n % 37 === 0 ? (r() < 0.5 ? heavy : light) : 0);
        step(s, [s.way === 0 && !s.f[1].alive ? right : mine, b.think(s)]);
      }
      return { h: hashState(s), zone: s.zone, cuts: s.f[0].wins + s.f[1].wins };
    };
    const one = play(), two = play();
    expect(one).toEqual(two);
    expect(one.cuts).toBeGreaterThan(0);
  });

  it('the bot runs for its cover once it has the way', () => {
    const s = fightAt();
    run(s, MOVES.heavy.wind + 2, (n) => [0, low | (n === 0 ? heavy : 0)]);
    const bot = new Dummy(seeded(1), 1);
    const x0 = s.f[1].x;
    run(s, 90, () => [0, bot.think(s)]);
    expect(s.f[1].x).toBeLessThan(x0 - 1);
  });
});
