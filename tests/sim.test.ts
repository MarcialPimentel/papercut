import { describe, expect, it } from 'vitest';
import { BTN, cloneState, hashState, newMatch, step, type FightEvent, type State } from '../src/sim/sim';
import { MOVES, RULES } from '../src/sim/rules';
import { Dummy } from '../src/sim/dummy';
import { DEFAULT_CFG, ENDLESS, ENDLESS_CFG, cleanCfg } from '../src/sim/config';

const { low, light, heavy, feint, jump } = BTN;

/** A match that is past the intro, with the fighters close together. Both guard high by default. */
function fightAt(gap = 1.2): State {
  const s = newMatch();
  while (s.phase !== 'fight') step(s, [0, 0]);
  s.f[0].x = -gap / 2; s.f[1].x = gap / 2;
  return s;
}

/** Run frames; `inp(frame)` gives both players' buttons. Returns every event. */
function run(s: State, frames: number, inp: (n: number) => [number, number] = () => [0, 0]) {
  const ev: FightEvent[] = [];
  for (let n = 0; n < frames; n++) ev.push(...step(s, inp(n)));
  return ev;
}
const kinds = (ev: FightEvent[]) => ev.map((e) => e.k);

describe('slashes', () => {
  it('a light slash at the wrong guard height cuts 10 of 80 health', () => {
    const s = fightAt();
    const ev = run(s, MOVES.light.wind + 1, (n) => [low | (n === 0 ? light : 0), 0]);
    expect(kinds(ev)).toContain('hit');
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp - MOVES.light.dmg);
    expect(s.f[1].state).toBe('stun');
  });

  it('a guard at the right height blocks; a heavy chips 3', () => {
    const s = fightAt();
    run(s, MOVES.light.wind + 1, (n) => [n === 0 ? light : 0, 0]);
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp);
    run(s, 40);
    const ev = run(s, MOVES.heavy.wind + 1, (n) => [n === 0 ? heavy : 0, 0]);
    expect(kinds(ev)).toContain('block');
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp - MOVES.heavy.chip);
  });

  it('a slash out of reach whiffs', () => {
    const s = fightAt(3);
    const ev = run(s, MOVES.light.wind + 1, (n) => [n === 0 ? light : 0, 0]);
    expect(kinds(ev)).toContain('whiff');
    expect(s.f[0].whiffed).toBe(true);
  });

  it('a low slash passes under a jump', () => {
    const s = fightAt();
    // Sumi jumps, then Kami slashes low while Sumi is in the air.
    const ev = run(s, 12 + MOVES.light.wind, (n) => [low | (n === 12 ? light : 0), n === 0 ? jump : 0]);
    const w = ev.find((e) => e.k === 'whiff');
    expect(w && w.k === 'whiff' && w.over).toBe(true);
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp);
  });
});

describe('jump', () => {
  /** Jump, slash in the air after `at` frames, then run until landing. */
  function jumpIn(s: State, at = 6) {
    let n = 0;
    run(s, at + 1, (k) => [(k === 0 ? jump : 0) | (k === at ? light : 0), 0]);
    expect(s.f[0].slash).toBe('high'); // a slash in the air always comes in high
    while (s.f[0].y > 0 && n++ < 200) step(s, [0, 0]);
  }

  it('landing after an air slash leaves you stuck for a moment', () => {
    const s = fightAt(3);
    jumpIn(s);
    expect(s.f[0].state).toBe('land');
    run(s, RULES.landLag);
    expect(s.f[0].state).toBe('guard');
  });

  it('a jump without a slash lands clean', () => {
    const s = fightAt(3);
    run(s, 1, () => [jump, 0]);
    while (s.f[0].y > 0) step(s, [0, 0]);
    expect(s.f[0].state).toBe('guard');
  });

  it('a fighter stuck on landing can be hit', () => {
    const s = fightAt(3);
    jumpIn(s);
    s.f[1].x = s.f[0].x + 1.2;
    const ev = run(s, MOVES.light.wind + 1, (n) => [0, low | (n === 0 ? light : 0)]);
    expect(kinds(ev)).toContain('hit');
  });
});

describe('parry and riposte', () => {
  it('switching guard to the right height at the last moment parries, and the next slash is a riposte', () => {
    const s = fightAt();
    // Kami slashes high. Sumi guards low until 2 frames before the hit, then flicks high.
    const hitFrame = MOVES.light.wind;
    const ev = run(s, hitFrame + 1, (n) => [n === 0 ? light : 0, n < hitFrame - 2 ? low : 0]);
    expect(kinds(ev)).toContain('parry');
    expect(s.f[0].state).toBe('stun');
    expect(s.f[1].riposte).toBeGreaterThan(0);
    // Sumi answers with a light slash at Kami's low side: it comes out as a riposte for heavy damage.
    const ev2 = run(s, 12, (n) => [0, low | (n === 0 ? light : 0)]);
    const hit = ev2.find((e) => e.k === 'hit');
    expect(hit && hit.k === 'hit' && hit.atk).toBe('riposte');
    expect(s.f[0].hp).toBe(DEFAULT_CFG.maxHp - MOVES.riposte.dmg);
  });

  it('a guard held early is a block, not a parry', () => {
    const s = fightAt();
    run(s, 20);
    const ev = run(s, MOVES.light.wind + 1, (n) => [n === 0 ? light : 0, 0]);
    expect(kinds(ev)).toContain('block');
    expect(kinds(ev)).not.toContain('parry');
  });

  it("a riposte can't be parried", () => {
    const s = fightAt();
    s.f[0].riposte = 30;
    const hitFrame = MOVES.riposte.wind;
    const ev = run(s, hitFrame + 1, (n) => [n === 0 ? light : 0, n < hitFrame - 2 ? low : 0]);
    expect(kinds(ev)).not.toContain('parry');
    expect(kinds(ev)).toContain('block');
  });
});

describe('counter cut', () => {
  it("hitting a heavy's wind-up is an instant K.O.", () => {
    const s = fightAt();
    const ev = run(s, 10, (n) => [low | (n === 2 ? light : 0), n === 0 ? heavy : 0]);
    const ko = ev.find((e) => e.k === 'ko');
    expect(ko && ko.k === 'ko' && ko.counter).toBe(true);
    expect(s.f[1].alive).toBe(false);
    expect(s.f[0].wins).toBe(1);
    expect(s.phase).toBe('ko');
    expect(s.how).toBe('Counter cut');
    expect(s.why).toBe('wind');
  });

  it("hitting a missed slash's recovery is an instant K.O.", () => {
    const s = fightAt(2.4);
    // Sumi throws a light from too far and misses; Kami dashes in and cuts the recovery.
    run(s, MOVES.light.wind + 1, (n) => [0, n === 0 ? light : 0]);
    expect(s.f[1].whiffed).toBe(true);
    s.f[0].x = s.f[1].x - 1.2;
    const ev = run(s, MOVES.light.wind + 1, (n) => [n === 0 ? light : 0, 0]);
    expect(ev.some((e) => e.k === 'ko' && e.counter)).toBe(true);
    expect(s.why).toBe('miss');
  });

  it('two light slashes on the same frame at different heights trade normal damage', () => {
    const s = fightAt();
    const ev = run(s, MOVES.light.wind + 1, (n) => [low | (n === 0 ? light : 0), n === 0 ? light : 0]);
    expect(kinds(ev).filter((k) => k === 'hit')).toHaveLength(2);
    expect(s.f[0].hp).toBe(DEFAULT_CFG.maxHp - MOVES.light.dmg);
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp - MOVES.light.dmg);
  });

  it('two identical slashes on the same frame clash', () => {
    const s = fightAt();
    const ev = run(s, MOVES.light.wind + 1, (n) => [n === 0 ? light : 0, n === 0 ? light : 0]);
    expect(kinds(ev)).toContain('clash');
    expect(s.f[0].hp).toBe(DEFAULT_CFG.maxHp);
    expect(s.f[1].hp).toBe(DEFAULT_CFG.maxHp);
  });
});

describe('feint', () => {
  it('cancels a heavy during its wind-up and returns to guard', () => {
    const s = fightAt();
    const ev = run(s, 6, (n) => [n === 0 ? heavy : n === 5 ? feint : 0, 0]);
    expect(kinds(ev)).toContain('feint');
    expect(s.f[0].state).toBe('feint');
    run(s, RULES.feintFrames);
    expect(s.f[0].state).toBe('guard');
  });

  it('left click during a heavy wind-up also feints', () => {
    const s = fightAt();
    run(s, 6, (n) => [n === 0 ? heavy : n === 5 ? light : 0, 0]);
    expect(s.f[0].state).toBe('feint');
  });

  it("can't feint once the heavy is nearly out", () => {
    const s = fightAt();
    run(s, RULES.feintBefore + 1, (n) => [n === 0 ? heavy : n === RULES.feintBefore ? feint : 0, 0]);
    expect(s.f[0].state).not.toBe('feint');
  });
});

describe('input buffer', () => {
  it('a press a few frames before recovery ends still comes out', () => {
    const s = fightAt(3);
    const total = MOVES.light.wind + MOVES.light.act + MOVES.light.rec;
    const ev = run(s, total + 2, (n) => [n === 0 || n === total - 3 ? light : 0, 0]);
    expect(kinds(ev).filter((k) => k === 'swing')).toHaveLength(2);
  });
});

describe('rounds', () => {
  it('time up gives the round to whoever has more strip left', () => {
    const s = fightAt();
    s.f[1].hp = 40;
    s.clock = 2;
    const ev = run(s, 3);
    expect(ev.find((e) => e.k === 'roundEnd')).toMatchObject({ winner: 0, how: 'Time' });
    expect(s.f[0].wins).toBe(1);
  });

  it('plays a best-of-5 to the back cover, then both players can ask for a rematch', () => {
    const s = newMatch();
    const pages: number[] = [];
    let over: FightEvent | undefined;
    for (let r = 0; r < DEFAULT_CFG.wins; r++) {
      while (s.phase !== 'fight') { for (const e of step(s, [0, 0])) if (e.k === 'swap') pages.push(e.page); }
      s.f[0].x = -0.6; s.f[1].x = 0.6;
      run(s, 10, (n) => [low | (n === 2 ? light : 0), n === 0 ? heavy : 0]);
      expect(s.phase).toBe('ko');
    }
    for (let n = 0; n < RULES.koFrames + RULES.turnFrames + 2 && !over; n++) {
      for (const e of step(s, [0, 0])) { if (e.k === 'over') over = e; if (e.k === 'swap') pages.push(e.page); }
    }
    expect(over).toMatchObject({ winner: 0 });
    expect(pages).toEqual([1, 2, 3]);
    expect(s.phase).toBe('over');
    step(s, [BTN.rematch, 0]);
    expect(s.phase).toBe('over');
    const ev = step(s, [0, BTN.rematch]);
    expect(kinds(ev)).toContain('restart');
    expect(s.round).toBe(1);
    expect(s.f[0].wins).toBe(0);
    expect(s.f[0].hp).toBe(DEFAULT_CFG.maxHp);
  });
});

describe('determinism', () => {
  function randomInputs(seed: number) {
    let a = seed;
    const r = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; };
    return () => {
      const one = () => (r() < 0.3 ? BTN.left : 0) | (r() < 0.3 ? BTN.right : 0) | (r() < 0.5 ? low : 0) |
        (r() < 0.04 ? light : 0) | (r() < 0.03 ? heavy : 0) | (r() < 0.02 ? feint : 0) | (r() < 0.01 ? jump : 0) |
        (r() < 0.01 ? BTN.dashL : 0) | (r() < 0.01 ? BTN.dashR : 0) | (r() < 0.01 ? BTN.rematch : 0);
      return [one(), one()] as [number, number];
    };
  }

  it('the same inputs always give the same fight', () => {
    const a = newMatch(), b = newMatch(), ia = randomInputs(7), ib = randomInputs(7);
    for (let n = 0; n < 20000; n++) { step(a, ia()); step(b, ib()); }
    expect(hashState(a)).toBe(hashState(b));
    expect(a).toEqual(b);
  });

  it('a copied state carries on exactly like the original (ready for rollback)', () => {
    const a = newMatch(), inp = randomInputs(3), log: [number, number][] = [];
    for (let n = 0; n < 2000; n++) step(a, inp());
    const b = cloneState(a);
    for (let n = 0; n < 3000; n++) log.push(inp());
    for (const i of log) step(a, i);
    for (const i of log) step(b, i);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('two dummies can play whole matches without getting stuck', () => {
    let seed = 11;
    const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
    const s = newMatch(), d0 = new Dummy(rand, 0), d1 = new Dummy(rand, 1);
    let overs = 0;
    for (let n = 0; n < 60 * 60 * 12; n++) {
      // The dummy only walks in to 2.4 m, so push one of them closer to keep the fight going.
      const near = Math.abs(s.f[0].x - s.f[1].x) < 1.5;
      for (const e of step(s, [d0.think(s) | (near ? 0 : BTN.right), d1.think(s)])) if (e.k === 'over') overs++;
    }
    expect(overs).toBeGreaterThan(0);
  });
});

describe('custom rules', () => {
  /** Kami counter-cuts Sumi's heavy: a quick, sure round win for seat 0. */
  function kamiWinsRound(s: State) {
    while (s.phase !== 'fight') step(s, [0, 0]);
    s.f[0].x = -0.6; s.f[1].x = 0.6;
    run(s, 10, (n) => [low | (n === 2 ? light : 0), n === 0 ? heavy : 0]);
    expect(s.phase).toBe('ko');
  }
  const untilNext = (s: State) => { const ev: FightEvent[] = []; for (let n = 0; n < 400 && (s.phase === 'ko' || s.phase === 'turn'); n++) ev.push(...step(s, [0, 0])); return ev; };

  it('best of 1 ends after one round', () => {
    const s = newMatch({ ...DEFAULT_CFG, wins: 1 });
    kamiWinsRound(s);
    untilNext(s);
    expect(s.phase).toBe('over');
  });

  it('endless rounds never end the match', () => {
    const s = newMatch({ ...DEFAULT_CFG, wins: 0 });
    for (let r = 0; r < 6; r++) { kamiWinsRound(s); untilNext(s); }
    expect(s.phase).toBe('intro');
    expect(s.f[0].wins).toBe(6);
  });

  it('the strip size and the timer follow the rules', () => {
    const s = newMatch({ ...DEFAULT_CFG, maxHp: 150, roundSecs: 0 });
    expect(s.f[0].hp).toBe(150);
    while (s.phase !== 'fight') step(s, [0, 0]);
    run(s, 60 * 70);
    expect(s.phase).toBe('fight'); // no timer: 70 seconds in, still fighting
  });

  it('room settings from the network are checked', () => {
    expect(cleanCfg({ wins: 2, maxHp: 50, roundSecs: 0 })).toEqual({ wins: 2, maxHp: 50, roundSecs: 0, gauntlet: false });
    expect(cleanCfg({ wins: 99, maxHp: -5, roundSecs: 'x', gauntlet: true })).toEqual({ ...DEFAULT_CFG, gauntlet: false });
    expect(cleanCfg(undefined)).toEqual(DEFAULT_CFG);
  });

  describe('Endless', () => {
    it('keeps your strip between bots, refills half every 5, and gives each bot a full strip', () => {
      const s = newMatch(ENDLESS_CFG);
      const heals: number[] = [];
      for (let r = 0; r < ENDLESS.healEvery; r++) {
        while (s.phase !== 'fight') step(s, [0, 0]);
        s.f[0].hp = 20; // took a beating
        kamiWinsRound(s);
        for (const e of untilNext(s)) if (e.k === 'heal') heals.push(e.amt);
        if (r < ENDLESS.healEvery - 1) expect(s.f[0].hp).toBe(20);
        expect(s.f[1].hp).toBe(ENDLESS_CFG.maxHp);
      }
      expect(heals).toEqual([ENDLESS_CFG.maxHp * ENDLESS.healShare]);
      expect(s.f[0].hp).toBe(20 + ENDLESS_CFG.maxHp * ENDLESS.healShare);
    });

    it('one lost round ends the run, and the bot stands on the back cover', () => {
      const s = newMatch(ENDLESS_CFG);
      kamiWinsRound(s); untilNext(s);
      while (s.phase !== 'fight') step(s, [0, 0]);
      s.f[0].x = -0.6; s.f[1].x = 0.6;
      run(s, 10, (n) => [n === 0 ? heavy : 0, low | (n === 2 ? light : 0)]); // Sumi counter-cuts Kami
      let over: FightEvent | undefined;
      for (const e of untilNext(s)) if (e.k === 'over') over = e;
      expect(over).toMatchObject({ winner: 1 });
      expect(s.f[0].wins).toBe(1);
    });

    it('bots at every level keep playing whole runs without getting stuck', () => {
      let seed = 3;
      const rand = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; return seed / 4294967296; };
      for (const level of [1, 3, 6]) {
        const s = newMatch(ENDLESS_CFG), you = new Dummy(rand, 0), bot = new Dummy(rand, 1);
        bot.level = level; you.level = 2;
        let overs = 0;
        for (let n = 0; n < 60 * 60 * 6 && !overs; n++) {
          const near = Math.abs(s.f[0].x - s.f[1].x) < 1.5;
          for (const e of step(s, [you.think(s) | (near ? 0 : BTN.right), bot.think(s)])) if (e.k === 'over') overs++;
        }
        expect(overs).toBe(1);
      }
    });
  });
});
