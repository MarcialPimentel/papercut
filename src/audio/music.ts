// The title screen and regular fights play recorded songs (SONGS, below); everything else is the code-made band.
// Music made in code: taiko drums, a small high drum, wooden clappers, a temple bell, and koto-like plucks
// or a bamboo flute on Japanese scales. Every page, the menu, Endless, tournaments and the back cover has its
// own track (tempo, scale, drums and lead), so a session never loops one tune.
// Each track still follows the fight: a drum pulse while "Round N" shows, full in the fight, busier when the
// round is close to deciding, and silent from the K.O. to the next round.

import { engine as E } from './engine';
import { note, taiko } from './sounds';

export type MusicMode = 'off' | 'menu' | 'intro' | 'fight';
/** 0 = normal, 1 = tense (deciding round, low health, the last seconds, or a tournament final). */
export type Tension = 0 | 1;
export type TrackKey = 'menu' | 'dojo' | 'courtyard' | 'grove' | 'endless' | 'tourney' | 'cover';

/** Which sixteenths (0-15 of a bar) each drum plays on. `clap` is the wooden clappers (a recording). */
export interface Kit { don: readonly number[]; ka: readonly number[]; tick: readonly number[]; clap?: readonly number[] }

interface Track {
  /** Five-note scale as semitones; degree 0 of the melody is `root` (Hz), the bass is `bass` (Hz). */
  scale: readonly number[];
  root: number;
  bass: number;
  /** The bass pluck's scale degree on each bar, repeating. */
  bassLine: readonly number[];
  bpm: number; tenseBpm: number; calmBpm: number;
  calm: Kit; intro: Kit; fight: Kit; tense: Kit;
  /** Instruments carrying the melody. Koto plays an octave below the flute when both play. */
  lead: readonly ('koto' | 'flute')[];
  /** Share of the rhythm's notes that are played (1 = all). */
  density: number;
  /** Ring the temple bell every N bars (0 = never). */
  bell: number;
  /** A soft wind swell every two bars. */
  wind: boolean;
  /** A low held drone every two bars. */
  drone: boolean;
  /** Lively on menu screens: the taiko plays every bar and the melody is as full as in a fight
   *  (other tracks' menu versions play the taiko every other bar and thin the melody). */
  lively?: boolean;
  /** Which sixteenths the bass plucks on (default: the bar line only). */
  bassSteps?: readonly number[];
  /** Overall level (default 1). */
  level?: number;
}

// Scales (semitones). All have five notes, as Japanese folk scales do.
const MIYAKO = [0, 1, 5, 7, 8]; // miyako-bushi: the classic koto sound, a little dark
const YO = [0, 2, 5, 7, 9]; // yo: open and bright, folk songs and festivals
const INSEN = [0, 1, 5, 7, 10]; // in-sen: the shakuhachi's dark, hollow scale
const KUMOI = [0, 2, 3, 7, 9]; // kumoi: restless, between bright and dark
const HIRAJOSHI = [0, 2, 3, 7, 8]; // hirajoshi: still and wistful

const CALM: Kit = { don: [0], ka: [], tick: [8] };
const INTRO: Kit = { don: [0, 8], ka: [], tick: [4, 12] };

export const TRACKS: Record<TrackKey, Track> = {
  // Title screen and menus: bright and eager, "the show is about to start". A rolling taiko groove,
  // clappers on the backbeat and a full koto line, but lighter than any fight track.
  menu: {
    scale: YO, root: 293.66, bass: 73.42, bassLine: [0, -2, 0, 1, 0, -2, 2, 1], bassSteps: [0, 10],
    bpm: 96, tenseBpm: 96, calmBpm: 96,
    calm: { don: [0, 7, 8], ka: [4, 12], tick: [2, 6, 10, 14], clap: [12] }, intro: INTRO, fight: CALM, tense: CALM,
    lead: ['koto'], density: 0.85, bell: 0, wind: false, drone: false, lively: true,
    level: 0.78, // a touch under the fight tracks, so the first fight still feels like a step up
  },
  // Graph Paper Dojo: the steady taiko and koto from the first sound pass.
  dojo: {
    scale: MIYAKO, root: 146.83, bass: 73.42, bassLine: [0, 0, -2, 1],
    bpm: 100, tenseBpm: 112, calmBpm: 76, calm: CALM, intro: INTRO,
    fight: { don: [0, 10], ka: [4, 12], tick: [2, 6, 8, 14] },
    tense: { don: [0, 3, 6, 10, 12, 14], ka: [4, 12], tick: [1, 2, 5, 7, 9, 11, 13, 15] },
    lead: ['koto'], density: 1, bell: 0, wind: false, drone: false,
  },
  // Ruled Courtyard: brighter and lighter, a bamboo flute over quick clappers.
  courtyard: {
    scale: YO, root: 329.63, bass: 82.41, bassLine: [0, -2, 0, -3],
    bpm: 108, tenseBpm: 120, calmBpm: 84, calm: CALM, intro: { don: [0, 8], ka: [], tick: [4, 12], clap: [6, 14] },
    fight: { don: [0, 8], ka: [4, 12], tick: [2, 10], clap: [6, 14] },
    tense: { don: [0, 6, 8, 14], ka: [4, 12], tick: [2, 3, 10, 11], clap: [3, 6, 11, 14] },
    lead: ['flute'], density: 0.85, bell: 0, wind: false, drone: false,
  },
  // Legal Pad Grove: darker and slower, a low drone, sparse koto and a temple bell.
  grove: {
    scale: INSEN, root: 220, bass: 55, bassLine: [0, 0, -1, -2],
    bpm: 84, tenseBpm: 96, calmBpm: 66, calm: CALM, intro: { don: [0], ka: [], tick: [8] },
    fight: { don: [0, 10], ka: [], tick: [8] },
    tense: { don: [0, 3, 8, 10, 14], ka: [12], tick: [4, 8, 12] },
    lead: ['koto'], density: 0.55, bell: 4, wind: true, drone: true,
  },
  // Endless: restless; the drums and tempo build with each level (see endlessKit).
  endless: {
    scale: KUMOI, root: 261.63, bass: 65.41, bassLine: [0, 0, -2, -1],
    bpm: 92, tenseBpm: 100, calmBpm: 76, calm: CALM, intro: INTRO,
    fight: { don: [0, 8], ka: [], tick: [] }, tense: { don: [0, 8], ka: [], tick: [] },
    lead: ['koto'], density: 0.45, bell: 0, wind: false, drone: false,
  },
  // Tournaments (fights and the bracket screen): festival drums, clappers on the backbeat, flute and koto together.
  tourney: {
    scale: YO, root: 349.23, bass: 87.31, bassLine: [0, -2, 0, -1],
    bpm: 116, tenseBpm: 128, calmBpm: 90,
    calm: { don: [0, 8], ka: [], tick: [4, 12], clap: [12] },
    intro: { don: [0, 8], ka: [], tick: [], clap: [4, 12] },
    fight: { don: [0, 6, 8, 14], ka: [4, 12], tick: [0, 2, 4, 6, 8, 10, 12, 14], clap: [4, 12] },
    tense: { don: [0, 3, 6, 8, 11, 14], ka: [4, 10, 12], tick: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], clap: [4, 12, 14] },
    lead: ['flute', 'koto'], density: 0.9, bell: 0, wind: false, drone: false,
  },
  // The back cover after a match: still and wistful, a bell and wind.
  cover: {
    scale: HIRAJOSHI, root: 220, bass: 55, bassLine: [0, 0, -2, -1],
    bpm: 64, tenseBpm: 64, calmBpm: 64, calm: { don: [0], ka: [], tick: [] }, intro: INTRO, fight: CALM, tense: CALM,
    lead: ['koto'], density: 0.5, bell: 4, wind: true, drone: false,
  },
};

/** The track for each notebook page (PAGES order: Graph, Ruled, Legal Pad, the back cover, and Dojo Defence's
 *  front cover, which shares the back cover's track). */
export const PAGE_TRACKS: readonly TrackKey[] = ['dojo', 'courtyard', 'grove', 'cover', 'cover'];

export const ENDLESS_TOP = 6;
/** Endless gets denser with each bot level: 1 = drums and bass, then ticks, the high drum, clappers,
 *  busier taiko with the flute joining, and the bell. Tempo rises 4 beats a minute per level. */
export function endlessLayers(level: number, tension: Tension) {
  const L = Math.max(1, Math.min(ENDLESS_TOP, Math.floor(level)));
  const kit: Kit = {
    don: L >= 5 ? [0, 3, 8, 10, 14] : tension ? [0, 8, 14] : [0, 8],
    ka: L >= 3 ? (tension ? [4, 10, 12] : [4, 12]) : [],
    tick: L >= 6 ? [1, 2, 5, 7, 9, 11, 13, 15] : L >= 2 ? [2, 6, 10, 14] : [],
    clap: L >= 4 ? [6, 14] : [],
  };
  return {
    kit,
    bpm: 92 + 4 * (L - 1) + (tension ? 8 : 0),
    density: [0.45, 0.55, 0.65, 0.8, 0.9, 1][L - 1],
    lead: (L >= 5 ? ['koto', 'flute'] : ['koto']) as readonly ('koto' | 'flute')[],
    bell: L >= 6 ? 4 : 0,
  };
}

/** What plays right now: the drums, tempo and instruments for a track in a mode. */
export function arrangement(key: TrackKey, mode: MusicMode, tension: Tension, level = 1) {
  const t = TRACKS[key];
  const base = { kit: t.fight, bpm: t.bpm, density: t.density, lead: t.lead, bell: t.bell, melody: true, bass: true };
  if (mode === 'menu') return { ...base, kit: t.calm, bpm: t.calmBpm, density: t.lively ? t.density : Math.min(t.density, 0.7) };
  if (mode === 'intro') return { ...base, kit: t.intro, melody: false, bass: false, bell: 0 }; // drums only under the banner
  if (key === 'endless') return { ...base, ...endlessLayers(level, tension) };
  return tension ? { ...base, kit: t.tense, bpm: t.tenseBpm, density: Math.min(1, t.density + 0.15) } : base;
}

type Phrase = (number | null)[]; // 32 sixteenth steps (two bars): a scale degree or a rest

const STEPS = 16;
// Melody rhythms: the steps of two bars where a note may start.
const RHYTHMS = [
  [0, 3, 6, 8, 12, 16, 22, 24],
  [0, 4, 6, 10, 16, 19, 22, 28],
  [0, 2, 4, 8, 16, 18, 20, 24, 26],
  [0, 6, 8, 11, 16, 24, 28],
  [0, 8, 12, 16, 20, 24],
];

function makePhrase(density: number): Phrase {
  const out: Phrase = new Array(32).fill(null);
  const rhythm = RHYTHMS[Math.floor(Math.random() * RHYTHMS.length)];
  let d = 2 + Math.floor(Math.random() * 4);
  rhythm.forEach((st, i) => {
    const last = i === rhythm.length - 1;
    if (!last && i > 0 && Math.random() > density) return; // sparser tracks leave gaps
    d += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
    d = Math.max(0, Math.min(9, d));
    out[st] = last ? (Math.random() < 0.5 ? 0 : 3) : d; // end home or on the fifth
  });
  return out;
}

// ---------- recorded songs ----------
// Two songs Marz made with Suno replace the code-made music on the title screen and in regular fights.
// Each file is baked as a seamless loop: it plays from the start once, then loops loopStart..loopEnd
// (the file's last beats already crossfade into the audio just before loopStart). Sources: docs/sound.md.

export type SongKey = 'title' | 'fight';
export interface Song { url: string; loopStart: number; loopEnd: number; gain: number }
export const SONGS: Record<SongKey, Song> = {
  title: { url: '/music/title.ogg', loopStart: 66.8297, loopEnd: 136.394, gain: 0.7 }, // 刀の合戦, 141 bpm
  fight: { url: '/music/fight.ogg', loopStart: 57.0057, loopEnd: 154.204, gain: 0.8 }, // 祭りの合図, 131 bpm
};
E.want(Object.fromEntries(Object.entries(SONGS).map(([k, s]) => [`song:${k}`, [s.url]])));

/** Which recorded song (if any) replaces the code-made track. "Round N" keeps its drums, Endless keeps its
 *  build-up, tournaments keep their festival theme, and the bracket and back cover stay calm. */
export function songFor(track: TrackKey, mode: MusicMode): SongKey | null {
  if (mode === 'menu') return track === 'menu' ? 'title' : null;
  if (mode === 'fight') return track === 'dojo' || track === 'courtyard' || track === 'grove' ? 'fight' : null;
  return null;
}

/** Where a song that started at `offset` is after `elapsed` seconds, folding into its loop. */
export function songPos(s: Song, offset: number, elapsed: number): number {
  const p = offset + elapsed;
  return p < s.loopEnd ? p : s.loopStart + ((p - s.loopStart) % (s.loopEnd - s.loopStart));
}

export class Music {
  private mode: MusicMode = 'off';
  /** The recorded song playing now (null = the code-made track), its source, and where it started. */
  private song: SongKey | null = null;
  private src: AudioBufferSourceNode | null = null;
  private srcStart = 0;
  private srcOffset = 0;
  /** The fight song carries on from round to round within a match, instead of restarting. */
  private resume: Partial<Record<SongKey, number>> = {};
  private tension: Tension = 0;
  private track: TrackKey = 'menu';
  private level = 1;
  private arr = arrangement('menu', 'menu', 0);
  private gain: GainNode | null = null;
  private timer = 0;
  private next = 0; // audio time of the next sixteenth
  private step = 0;
  private bar = 0;
  private phrases: Phrase[] = [];
  private form = [0, 0, 1, 0]; // A A B A

  /** Call every frame; only acts when something changes. A new track or mode starts a new song;
   *  tension and the Endless level change the song in place. */
  set(mode: MusicMode, tension: Tension = 0, track: TrackKey = 'dojo', level = 1) {
    const want = songFor(track, mode);
    const song = want && E.has(`song:${want}`) ? want : null; // the code-made track plays until the file loads
    if (mode === this.mode && tension === this.tension && track === this.track && level === this.level && song === this.song) return;
    const a = E.live;
    if (!a) return; // audio not started yet: pick it up on a later frame
    const wasOff = this.mode === 'off';
    const newSong = mode !== 'off' && (track !== this.track || song !== this.song || (mode !== this.mode && !(this.mode === 'intro' && mode === 'fight')));
    if (mode === 'off' || newSong) this.stopSong(a);
    if (mode === 'menu') this.resume = {}; // a new match starts the fight song from the top
    this.mode = mode; this.tension = tension; this.track = track; this.level = level; this.song = mode === 'off' ? null : song;
    this.arr = arrangement(track, mode, tension, level);
    if (mode === 'off') { this.fade(0, 0.5); return; }
    if (newSong || wasOff) this.start(a);
  }

  /** Stop the recorded song (after the fade-out) and remember where it got to. */
  private stopSong(a: AudioContext) {
    if (!this.src || !this.song) return;
    this.resume[this.song] = songPos(SONGS[this.song], this.srcOffset, a.currentTime - this.srcStart);
    this.src.stop(a.currentTime + 1.5);
    this.src = null;
  }

  private start(a: AudioContext) {
    if (this.gain) { const old = this.gain; old.gain.setTargetAtTime(0, a.currentTime, 0.15); setTimeout(() => old.disconnect(), 1500); }
    this.gain = a.createGain(); this.gain.gain.value = 0.0001; this.gain.connect(E.musicBus);
    const song = this.song ? SONGS[this.song] : null, buf = this.song ? E.buffer(`song:${this.song}`) : null;
    if (song && buf && this.song) {
      this.fade(song.gain, 0.4);
      const src = a.createBufferSource();
      src.buffer = buf; src.loop = true;
      src.loopStart = song.loopStart; src.loopEnd = Math.min(song.loopEnd, buf.duration);
      src.connect(this.gain);
      const at = a.currentTime + 0.02, offset = Math.min(this.resume[this.song] ?? 0, song.loopEnd);
      src.start(at, offset);
      this.src = src; this.srcStart = at; this.srcOffset = offset;
      if (this.timer) { clearInterval(this.timer); this.timer = 0; } // no code-made notes under a song
      return;
    }
    this.fade(TRACKS[this.track].level ?? 1, 0.4);
    this.next = a.currentTime + 0.06; this.step = 0; this.bar = 0;
    this.phrases = [makePhrase(this.arr.density), makePhrase(this.arr.density)];
    if (!this.timer) this.timer = window.setInterval(() => this.pump(), 25);
  }

  private fade(to: number, secs: number) {
    const a = E.live; if (!a || !this.gain) return;
    const g = this.gain.gain;
    g.cancelScheduledValues(a.currentTime); g.setValueAtTime(Math.max(0.0001, g.value), a.currentTime);
    g.exponentialRampToValueAtTime(Math.max(0.0001, to), a.currentTime + secs);
  }

  private get stepLen() { return 60 / this.arr.bpm / 4; }

  /** Schedule the notes due in the next ~120 ms. */
  private pump() {
    const a = E.live;
    if (!a || !this.gain) return;
    if (this.mode === 'off') {
      if (this.gain.gain.value < 0.001) { clearInterval(this.timer); this.timer = 0; }
      return;
    }
    // A hidden tab can fall behind; skip ahead rather than playing a pile of late notes at once.
    if (this.next < a.currentTime - 0.1) this.next = a.currentTime + 0.05;
    while (this.next < a.currentTime + 0.12) {
      this.play(this.next, this.step);
      this.next += this.stepLen;
      this.step = (this.step + 1) % STEPS;
      if (this.step === 0) {
        this.bar++;
        // Every eight bars, write a fresh B phrase so long fights don't loop the same tune.
        if (this.bar % 8 === 0) this.phrases[1] = makePhrase(this.arr.density);
      }
    }
  }

  private play(t: number, st: number) {
    const bus = this.gain!, tr = TRACKS[this.track], arr = this.arr, kit = arr.kit;
    const calm = this.mode === 'menu' && !tr.lively;
    if (kit.don.includes(st) && !(calm && this.bar % 2)) taiko(t, st === 0 ? 0.7 : 0.45, bus);
    if (kit.ka.includes(st)) {
      E.hiss({ dur: 0.05, type: 'bandpass', freq: 1800, q: 4, gain: 0.35, at: t, bus });
      E.tone({ f0: 620, dur: 0.05, gain: 0.08, at: t, bus });
    }
    if (kit.tick.includes(st)) E.hiss({ dur: 0.03, type: 'bandpass', freq: 3800, q: 5, gain: 0.16, at: t, pan: 0.25, bus });
    if (kit.clap?.includes(st) && !E.sample('clack', { gain: 0.32, rate: 1.5, at: t, pan: -0.3, bus })) {
      E.hiss({ dur: 0.04, type: 'bandpass', freq: 2600, q: 3, gain: 0.3, at: t, pan: -0.3, bus });
    }

    if (st === 0) {
      const barLen = this.stepLen * STEPS;
      if (arr.bell && this.bar % arr.bell === 0 && !E.sample('bell', { gain: 0.35, rate: 1, at: t, pan: 0.35, bus })) {
        E.ring({ base: tr.bass * 4, dur: 2.5, gain: 0.09, at: t, pan: 0.35, bus });
      }
      if (this.mode !== 'intro' && this.bar % 2 === 0) {
        if (tr.wind) E.hiss({ dur: barLen * 2, type: 'bandpass', freq: 450, sweep: 1100, q: 0.7, gain: 0.06, attack: barLen * 0.8, at: t, pan: -0.4, bus });
        if (tr.drone) {
          E.tone({ f0: tr.bass, dur: barLen * 2, type: 'triangle', gain: 0.14, attack: 0.6, at: t, bus });
          E.tone({ f0: tr.bass * 1.5, dur: barLen * 2, type: 'sine', gain: 0.06, attack: 0.9, at: t, bus });
        }
      }
    }

    if (!arr.melody) return;
    // Bass plucks (on the bar line unless the track says otherwise), walking through its bass line.
    const bassSteps = tr.bassSteps ?? [0], bi = bassSteps.indexOf(st);
    if (bi >= 0) {
      const deg = tr.bassLine[(this.bar * bassSteps.length + bi) % tr.bassLine.length];
      E.pluck({ freq: note(deg, tr.bass, tr.scale), gain: bi === 0 ? 0.55 : 0.4, at: t, bus, dur: bi === 0 ? 1.4 : 0.8 });
    }
    const pos = (this.bar % 2) * STEPS + st;
    const ph = this.phrases[this.form[Math.floor(this.bar / 2) % 4]], d = ph[pos];
    if (d === null || d === undefined) return;
    const both = arr.lead.length > 1;
    for (const lead of arr.lead) {
      if (lead === 'flute') {
        let gap = 1; // hold the flute until the next note (at most two beats)
        while (gap < 8 && ph[(pos + gap) % 32] === null) gap++;
        E.flute({ freq: note(d, tr.root, tr.scale), dur: gap * this.stepLen * 0.95, gain: calm ? 0.1 : 0.13, at: t, pan: 0.15, bus });
      } else {
        E.pluck({ freq: note(d, both ? tr.root / 2 : tr.root, tr.scale), gain: calm ? 0.3 : both ? 0.24 : 0.36, at: t, pan: -0.2, bus });
      }
    }
  }
}

export const music = new Music();
