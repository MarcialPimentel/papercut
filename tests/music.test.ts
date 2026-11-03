import { describe, expect, it } from 'vitest';
import { arrangement, endlessLayers, ENDLESS_TOP, PAGE_TRACKS, TRACKS, type TrackKey } from '../src/audio/music';
import { FINAL_PAGE, PAGES } from '../src/sim/rules';

const keys = Object.keys(TRACKS) as TrackKey[];

describe('music tracks', () => {
  it('has a different track for every page of the notebook', () => {
    expect(PAGE_TRACKS.length).toBe(PAGES.length);
    expect(new Set(PAGE_TRACKS).size).toBe(PAGES.length);
    expect(PAGE_TRACKS[FINAL_PAGE]).toBe('cover');
  });

  it('gives each track its own sound (scale, key or tempo differ)', () => {
    const sig = keys.map((k) => { const t = TRACKS[k]; return `${t.scale.join()}|${t.root}|${t.bpm}|${t.lead.join()}`; });
    expect(new Set(sig).size).toBe(keys.length);
  });

  it('only uses valid drum steps and five-note scales', () => {
    for (const k of keys) {
      const t = TRACKS[k];
      expect(t.scale.length).toBe(5);
      for (const kit of [t.calm, t.intro, t.fight, t.tense]) {
        for (const st of [...kit.don, ...kit.ka, ...kit.tick, ...(kit.clap ?? [])]) expect(st >= 0 && st < 16).toBe(true);
      }
      expect(t.tenseBpm).toBeGreaterThanOrEqual(t.bpm);
    }
  });

  it('is drums only under the "Round N" banner', () => {
    for (const k of keys) expect(arrangement(k, 'intro', 0).melody).toBe(false);
  });

  it('gets faster and busier when a round is tense', () => {
    for (const k of PAGE_TRACKS.slice(0, FINAL_PAGE)) {
      const calm = arrangement(k, 'fight', 0), tense = arrangement(k, 'fight', 1);
      expect(tense.bpm).toBeGreaterThan(calm.bpm);
      const hits = (a: typeof calm) => a.kit.don.length + a.kit.ka.length + a.kit.tick.length + (a.kit.clap?.length ?? 0);
      expect(hits(tense)).toBeGreaterThan(hits(calm));
    }
  });

  it('makes the title screen livelier than the other menu-screen tracks', () => {
    const hits = (a: ReturnType<typeof arrangement>) => a.kit.don.length + a.kit.ka.length + a.kit.tick.length + (a.kit.clap?.length ?? 0);
    const title = arrangement('menu', 'menu', 0);
    for (const k of ['tourney', 'cover'] as const) {
      const other = arrangement(k, 'menu', 0);
      expect(title.bpm).toBeGreaterThan(other.bpm);
      expect(hits(title)).toBeGreaterThan(hits(other));
    }
  });

  it('builds Endless up with each level and tops out', () => {
    let prev = endlessLayers(1, 0);
    const hits = (l: typeof prev) => l.kit.don.length + l.kit.ka.length + l.kit.tick.length + (l.kit.clap?.length ?? 0);
    for (let lv = 2; lv <= ENDLESS_TOP; lv++) {
      const cur = endlessLayers(lv, 0);
      expect(cur.bpm).toBeGreaterThan(prev.bpm);
      expect(hits(cur)).toBeGreaterThan(hits(prev));
      prev = cur;
    }
    expect(endlessLayers(ENDLESS_TOP + 5, 0)).toEqual(endlessLayers(ENDLESS_TOP, 0));
    expect(arrangement('endless', 'fight', 0, 3).bpm).toBe(endlessLayers(3, 0).bpm);
  });
});
