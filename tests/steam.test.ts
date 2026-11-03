// Steamworks (#31): the achievement checks, and what Steam Cloud carries between PCs.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, forDivision, forEndless, fromEvents } from '../src/achievements';
import { newMatch, type FightEvent } from '../src/sim/sim';
import { DIVISIONS } from '../server/rating';

const require = createRequire(import.meta.url);
const cloud = require('../desktop/cloud.cjs') as {
  CLOUD_FILE: string; CLOUD_KEYS: string[];
  pick(d: Record<string, string>): Record<string, string>;
  merge(local: Record<string, string>, c: unknown): Record<string, string>;
};
const steam = require('../desktop/steam.cjs') as { APP_ID: number };

const at = { x: 0, y: 1, ang: 0 };

describe('achievements', () => {
  it('has the 13 agreed achievements with unique ids', () => {
    expect(ACHIEVEMENTS).toHaveLength(13);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(13);
  });

  it('a parry counts for the fighter who parried, not the one parried', () => {
    const s = newMatch();
    const ev: FightEvent[] = [{ k: 'parry', p: 1, ...at }];
    expect(fromEvents(s, ev, 0, false)).toEqual(['PARRY']);
    expect(fromEvents(s, ev, 1, false)).toEqual([]);
  });

  it('a riposte that lands, and a counter cut K.O., count for the one who cut', () => {
    const s = newMatch();
    const hit: FightEvent = { k: 'hit', p: 0, ...at, heavy: false, atk: 'riposte', dmg: 10 };
    expect(fromEvents(s, [hit], 0, false)).toEqual(['RIPOSTE']);
    expect(fromEvents(s, [{ ...hit, atk: 'light' }], 0, false)).toEqual([]);
    const ko: FightEvent = { k: 'ko', p: 1, ...at, counter: true, dmg: 0, why: 'miss' };
    expect(fromEvents(s, [ko], 1, false)).toEqual(['COUNTER_CUT']);
    expect(fromEvents(s, [ko], 0, false)).toEqual([]);
  });

  it('a won match counts as an online win only online', () => {
    const s = newMatch();
    const over: FightEvent = { k: 'over', winner: 1 };
    expect(fromEvents(s, [over], 1, true)).toEqual(['ONLINE_WIN']);
    expect(fromEvents(s, [over], 1, false)).toEqual([]);
    expect(fromEvents(s, [over], 0, true)).toEqual([]);
  });

  it('a division also earns every division below it', () => {
    expect(forDivision('Tissue')).toEqual([]);
    expect(forDivision('Washi')).toEqual(['DIV_NEWSPRINT', 'DIV_CARDSTOCK', 'DIV_WASHI']);
    expect(forDivision('Placement 2/5')).toEqual([]);
    // Every ranked division the server can give, except the first, has an achievement.
    for (const d of DIVISIONS.slice(1)) expect(forDivision(d.name).at(-1)).toMatch(/^DIV_/);
  });

  it('Endless milestones at 10, 25 and 50', () => {
    expect(forEndless(9)).toEqual([]);
    expect(forEndless(25)).toEqual(['ENDLESS_10', 'ENDLESS_25']);
    expect(forEndless(80)).toEqual(['ENDLESS_10', 'ENDLESS_25', 'ENDLESS_50']);
  });
});

describe('Steam Cloud', () => {
  it('carries progress but not display settings or tuning', () => {
    const local = { 'papercut.name': 'Marz', 'papercut.settings': '{"fps":60}', 'papercut.tuning': '{}', 'papercut.id': 'abc' };
    expect(cloud.pick(local)).toEqual({ 'papercut.name': 'Marz', 'papercut.id': 'abc' });
  });

  it('the cloud copy wins, but the best Endless run and a finished tutorial are kept', () => {
    const local = { 'papercut.name': 'Old', 'papercut.endlessBest': '30', 'papercut.tutorial': 'done', 'papercut.settings': 'deck' };
    const fromCloud = { 'papercut.name': 'Marz', 'papercut.endlessBest': '12', 'papercut.tutorial': 'offered', 'papercut.settings': 'pc' };
    expect(cloud.merge(local, fromCloud)).toEqual({ 'papercut.name': 'Marz', 'papercut.endlessBest': '30', 'papercut.tutorial': 'done', 'papercut.settings': 'deck' });
    expect(cloud.merge({ 'papercut.endlessBest': '3' }, { 'papercut.endlessBest': '41' })['papercut.endlessBest']).toBe('41');
    expect(cloud.merge(local, null)).toEqual(local);
  });

  it('every saved key is either synced or deliberately kept on one PC', () => {
    const LOCAL_ONLY = ['papercut.settings', 'papercut.tuning', 'papercut.sideBoard'];
    const keys = new Set<string>();
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(dir, f.name));
        else if (f.name.endsWith('.ts')) for (const m of readFileSync(join(dir, f.name), 'utf8').matchAll(/'(papercut\.[A-Za-z]+)'/g)) keys.add(m[1]);
      }
    };
    walk(join(__dirname, '..', 'src'));
    for (const k of keys) expect([...cloud.CLOUD_KEYS, ...LOCAL_ONLY], `${k}: add it to CLOUD_KEYS in desktop/cloud.cjs or to LOCAL_ONLY here`).toContain(k);
  });

  it('the app ID lives in one place (480 = Valve test app until Papercut has its own)', () => {
    expect(Number.isInteger(steam.APP_ID)).toBe(true);
  });
});
