// The audio graph: one context, a music bus and an effects bus, a soft limiter, and loaded recordings.
// Audio only starts after the player presses something (browsers require it).
// Sound never touches the fight rules, so Math.random is fine here.

import { store } from '../store';

export interface Volumes { music: number; sfx: number } // 0-1 each

const KEY = 'papercut.volume';
function loadVolumes(): Volumes {
  try {
    const v = JSON.parse(store.get(KEY) || 'null');
    if (v && typeof v.music === 'number' && typeof v.sfx === 'number') return { music: v.music, sfx: v.sfx };
  } catch { /* private window or blocked storage: use the defaults */ }
  return { music: 0.6, sfx: 0.8 };
}

export class Engine {
  ctx: AudioContext | null = null;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  /** Music level under the player's setting, for ducking under big hits and K.O.s. */
  musicDuck!: GainNode;
  vol: Volumes = loadVolumes();
  private samples = new Map<string, AudioBuffer[]>();
  private noiseBuf: AudioBuffer | null = null;
  private wanted: Record<string, string[]> = {};

  /** Create the context on the first press; returns null if audio is unavailable. */
  wake(): AudioContext | null {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return null; }
      const a = this.ctx;
      const limiter = a.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 8;
      limiter.attack.value = 0.003; limiter.release.value = 0.2;
      limiter.connect(a.destination);
      this.sfxBus = a.createGain(); this.sfxBus.connect(limiter);
      this.musicDuck = a.createGain(); this.musicDuck.connect(limiter);
      this.musicBus = a.createGain(); this.musicBus.connect(this.musicDuck);
      this.applyVolumes();
      for (const [name, urls] of Object.entries(this.wanted)) void this.fetchSample(name, urls);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** The context only if it is running (no sound is queued before the first press). */
  get live(): AudioContext | null { return this.ctx && this.ctx.state === 'running' ? this.ctx : null; }

  setVolumes(v: Partial<Volumes>) {
    Object.assign(this.vol, v);
    store.set(KEY, JSON.stringify(this.vol));
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    // Squared so the slider feels even to the ear.
    this.sfxBus.gain.value = this.vol.sfx * this.vol.sfx;
    this.musicBus.gain.value = this.vol.music * this.vol.music * 0.55;
  }

  /** Lower the music for a moment (big hits), or hold it down (`hold` seconds). */
  duck(depth: number, hold: number, release = 0.6) {
    const a = this.live; if (!a) return;
    const g = this.musicDuck.gain, t = a.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - depth, t + 0.03);
    g.setValueAtTime(1 - depth, t + 0.03 + hold);
    g.linearRampToValueAtTime(1, t + 0.03 + hold + release);
  }

  /** Ask for recordings by name (several files = random pick). Missing files are skipped quietly. */
  want(list: Record<string, string[]>) {
    Object.assign(this.wanted, list);
    if (this.ctx) for (const [name, urls] of Object.entries(list)) void this.fetchSample(name, urls);
  }
  private async fetchSample(name: string, urls: string[]) {
    const a = this.ctx!;
    const bufs: AudioBuffer[] = [];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        bufs.push(await a.decodeAudioData(await r.arrayBuffer()));
      } catch { /* missing or unreadable: the code-made sound plays instead */ }
    }
    if (bufs.length) this.samples.set(name, bufs);
  }
  has(name: string) { return this.samples.has(name); }

  /** Where a sound goes: the effects bus, panned left/right (-1..1). */
  out(pan = 0, bus: AudioNode = this.sfxBus): AudioNode {
    const a = this.ctx!;
    if (!pan) return bus;
    const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(bus);
    return p;
  }

  /** Play a loaded recording. Returns false when it isn't loaded, so the caller can fall back. */
  sample(name: string, o: { gain?: number; rate?: number; pan?: number; at?: number; bus?: AudioNode } = {}): boolean {
    const a = this.live, bufs = this.samples.get(name);
    if (!a || !bufs) return false;
    const s = a.createBufferSource();
    s.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    s.playbackRate.value = (o.rate ?? 1) * (0.95 + Math.random() * 0.1);
    const g = a.createGain(); g.gain.value = o.gain ?? 1;
    s.connect(g).connect(this.out(o.pan, o.bus));
    s.start(o.at ?? a.currentTime);
    return true;
  }

  // ---------- code-made building blocks ----------

  private noise(): AudioBuffer {
    if (!this.noiseBuf) {
      const a = this.ctx!, len = a.sampleRate * 2;
      this.noiseBuf = a.createBuffer(1, len, a.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /** A burst of filtered noise. `sweep` moves the filter to that frequency over the burst. */
  hiss(o: { dur: number; type: BiquadFilterType; freq: number; q?: number; gain: number; sweep?: number; attack?: number; at?: number; pan?: number; bus?: AudioNode }) {
    const a = this.live; if (!a) return;
    const t = o.at ?? a.currentTime;
    const s = a.createBufferSource(); s.buffer = this.noise();
    const f = a.createBiquadFilter(); f.type = o.type; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.freq, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
    const g = a.createGain(), att = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f).connect(g).connect(this.out(o.pan, o.bus));
    s.start(t, Math.random() * 1.5); s.stop(t + o.dur + 0.02);
  }

  /** An oscillator with a pitch glide and a fast-attack, exponential-decay envelope. */
  tone(o: { f0: number; f1?: number; dur: number; type?: OscillatorType; gain: number; attack?: number; at?: number; pan?: number; bus?: AudioNode }) {
    const a = this.live; if (!a) return;
    const t = o.at ?? a.currentTime;
    const osc = a.createOscillator(); osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = a.createGain(), att = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(this.out(o.pan, o.bus));
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }

  /** A struck metal blade: a few out-of-tune partials ringing at once (what makes metal sound like metal). */
  ring(o: { base: number; dur: number; gain: number; at?: number; pan?: number; bus?: AudioNode }) {
    const partials = [[1, 1], [2.76, 0.55], [5.4, 0.32], [8.93, 0.18], [1.5, 0.25]];
    for (const [r, k] of partials) {
      this.tone({ f0: o.base * r * (0.995 + Math.random() * 0.01), dur: o.dur * (1.1 - r / 12), gain: o.gain * k, type: 'sine', attack: 0.001, at: o.at, pan: o.pan, bus: o.bus });
    }
  }

  /** A breathy bamboo flute (shinobue-like) note: a soft triangle tone that swells in, a vibrato that
   *  comes in late, and a puff of breath noise at the start. */
  flute(o: { freq: number; dur: number; gain: number; at?: number; pan?: number; bus?: AudioNode }) {
    const a = this.live; if (!a) return;
    const t = o.at ?? a.currentTime, end = t + Math.max(0.12, o.dur);
    const out = this.out(o.pan, o.bus);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(8000, o.freq * 4); lp.Q.value = 0.5;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + 0.06);
    g.gain.setValueAtTime(o.gain, Math.max(t + 0.06, end - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g).connect(out);
    const vib = a.createOscillator(); vib.frequency.value = 5.2;
    const depth = a.createGain(); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(o.freq * 0.008, t + Math.min(0.5, o.dur));
    vib.connect(depth);
    for (const [mul, k, type] of [[1, 1, 'triangle'], [2, 0.12, 'sine']] as const) {
      const osc = a.createOscillator(); osc.type = type; osc.frequency.value = o.freq * mul;
      depth.connect(osc.frequency);
      const kg = a.createGain(); kg.gain.value = k; osc.connect(kg).connect(lp);
      osc.start(t); osc.stop(end + 0.02);
    }
    vib.start(t); vib.stop(end + 0.02);
    this.hiss({ dur: 0.09, type: 'bandpass', freq: o.freq * 2.5, q: 1.5, gain: o.gain * 0.45, attack: 0.01, at: t, pan: o.pan, bus: o.bus });
  }

  /** A plucked string (Karplus-Strong), cached by pitch. Used for the koto-like music and stingers. */
  private plucks = new Map<number, AudioBuffer>();
  pluckBuf(freq: number): AudioBuffer {
    const key = Math.round(freq * 10);
    let b = this.plucks.get(key);
    if (b) return b;
    const a = this.ctx!, sr = a.sampleRate, len = Math.floor(sr * 1.6);
    b = a.createBuffer(1, len, sr);
    const d = b.getChannelData(0), period = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0; i < len; i++) {
      const j = i % period, v = ring[j];
      // Averaging neighbours damps the high end over time: a bright pluck that mellows, like a koto string.
      ring[j] = 0.996 * 0.5 * (v + ring[(j + 1) % period]);
      d[i] = v * 0.6;
    }
    this.plucks.set(key, b);
    return b;
  }
  pluck(o: { freq: number; gain: number; at?: number; pan?: number; bus?: AudioNode; dur?: number }) {
    const a = this.live; if (!a) return;
    const t = o.at ?? a.currentTime;
    const s = a.createBufferSource(); s.buffer = this.pluckBuf(o.freq);
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(9000, o.freq * 7);
    const g = a.createGain(); g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur ?? 1.5));
    s.connect(f).connect(g).connect(this.out(o.pan, o.bus));
    s.start(t); s.stop(t + (o.dur ?? 1.5));
  }
}

export const engine = new Engine();
