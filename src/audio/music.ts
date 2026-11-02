// Music made in code: taiko drums, a small high drum and a koto-like plucked melody on a Japanese scale.
// It follows the fight: calm on the menus, a drum pulse while "Round N" shows, full in the fight,
// busier when the round is close to deciding, and silent from the K.O. to the next round.

import { engine as E } from './engine';
import { note, taiko } from './sounds';

export type MusicMode = 'off' | 'menu' | 'intro' | 'fight';
/** 0 = normal, 1 = tense (deciding round, low health or the last seconds). */
export type Tension = 0 | 1;

type Phrase = (number | null)[]; // 32 sixteenth steps (two bars): a scale degree or a rest

const STEPS = 16;
// Which sixteenths each drum plays on, per mode and tension.
const DRUMS = {
  menu: { don: [0], ka: [], tick: [8] },
  intro: { don: [0, 8], ka: [], tick: [4, 12] },
  fight: { don: [0, 10], ka: [4, 12], tick: [2, 6, 8, 14] },
  tense: { don: [0, 3, 6, 10, 12, 14], ka: [4, 12], tick: [1, 2, 5, 7, 9, 11, 13, 15] },
} as const;
// Melody rhythms: the steps of two bars where a note may start.
const RHYTHMS = [
  [0, 3, 6, 8, 12, 16, 22, 24],
  [0, 4, 6, 10, 16, 19, 22, 28],
  [0, 2, 4, 8, 16, 18, 20, 24, 26],
  [0, 6, 8, 11, 16, 24, 28],
];

function makePhrase(dense: boolean, low: number): Phrase {
  const out: Phrase = new Array(32).fill(null);
  const rhythm = RHYTHMS[Math.floor(Math.random() * RHYTHMS.length)];
  let d = low + 2 + Math.floor(Math.random() * 4);
  rhythm.forEach((st, i) => {
    if (!dense && i % 3 === 2) return; // calmer: leave gaps
    d += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
    d = Math.max(low, Math.min(low + 9, d));
    out[st] = i === rhythm.length - 1 ? low + (Math.random() < 0.5 ? 0 : 3) : d; // end home or on the fifth
  });
  return out;
}

export class Music {
  private mode: MusicMode = 'off';
  private tension: Tension = 0;
  private gain: GainNode | null = null;
  private timer = 0;
  private next = 0; // audio time of the next sixteenth
  private step = 0;
  private bar = 0;
  private phrases: Phrase[] = [];
  private form = [0, 0, 1, 0]; // A A B A

  /** Call every frame; only acts when the mode or tension changes. */
  set(mode: MusicMode, tension: Tension = 0) {
    if (mode === this.mode && tension === this.tension) return;
    const a = E.live;
    if (!a) return; // audio not started yet: pick it up on a later frame
    const wasOff = this.mode === 'off';
    const newSong = mode !== this.mode && mode !== 'off' && !(this.mode === 'intro' && mode === 'fight');
    this.mode = mode; this.tension = tension;
    if (mode === 'off') { this.fade(0, 0.5); return; }
    if (newSong || wasOff) this.start(a);
  }

  private start(a: AudioContext) {
    if (this.gain) { const old = this.gain; old.gain.setTargetAtTime(0, a.currentTime, 0.15); setTimeout(() => old.disconnect(), 1500); }
    this.gain = a.createGain(); this.gain.gain.value = 0.0001; this.gain.connect(E.musicBus);
    this.fade(1, 0.4);
    this.next = a.currentTime + 0.06; this.step = 0; this.bar = 0;
    const low = this.mode === 'menu' ? 0 : 2;
    this.phrases = [makePhrase(this.mode !== 'menu', low), makePhrase(this.mode !== 'menu', low)];
    if (!this.timer) this.timer = window.setInterval(() => this.pump(), 25);
  }

  private fade(to: number, secs: number) {
    const a = E.live; if (!a || !this.gain) return;
    const g = this.gain.gain;
    g.cancelScheduledValues(a.currentTime); g.setValueAtTime(Math.max(0.0001, g.value), a.currentTime);
    g.exponentialRampToValueAtTime(Math.max(0.0001, to), a.currentTime + secs);
  }

  private get bpm() { return this.mode === 'menu' ? 76 : this.tension ? 112 : 100; }

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
      this.next += 60 / this.bpm / 4;
      this.step = (this.step + 1) % STEPS;
      if (this.step === 0) {
        this.bar++;
        // Every eight bars, write a fresh B phrase so long fights don't loop the same tune.
        if (this.bar % 8 === 0) this.phrases[1] = makePhrase(this.mode !== 'menu', this.mode === 'menu' ? 0 : 2);
      }
    }
  }

  private play(t: number, st: number) {
    const bus = this.gain!;
    const kit = this.mode === 'fight' && this.tension ? DRUMS.tense : DRUMS[this.mode as 'menu' | 'intro' | 'fight'];
    const menu = this.mode === 'menu';
    if ((kit.don as readonly number[]).includes(st) && !(menu && this.bar % 2)) taiko(t, st === 0 ? 0.7 : 0.45, bus);
    if ((kit.ka as readonly number[]).includes(st)) {
      E.hiss({ dur: 0.05, type: 'bandpass', freq: 1800, q: 4, gain: 0.35, at: t, bus });
      E.tone({ f0: 620, dur: 0.05, gain: 0.08, at: t, bus });
    }
    if ((kit.tick as readonly number[]).includes(st)) E.hiss({ dur: 0.03, type: 'bandpass', freq: 3800, q: 5, gain: 0.16, at: t, pan: 0.25, bus });

    if (this.mode === 'intro') return; // drums only while the banner shows
    // Bass pluck on the bar line: home, home, the fifth below, the flat second.
    if (st === 0) E.pluck({ freq: note([0, 0, -2, 1][this.bar % 4], 73.42), gain: 0.55, at: t, bus, dur: 1.4 });
    const ph = this.phrases[this.form[Math.floor(this.bar / 2) % 4]], d = ph[(this.bar % 2) * STEPS + st];
    if (d !== null && d !== undefined) E.pluck({ freq: note(d, menu ? 293.66 : 146.83), gain: menu ? 0.3 : 0.36, at: t, pan: -0.2, bus });
  }
}

export const music = new Music();
