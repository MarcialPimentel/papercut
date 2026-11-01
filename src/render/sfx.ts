// Paper sounds made in code (no files). Audio starts only after the player presses something.

let actx: AudioContext | null = null;
export const sound = { on: true };

function ac(): AudioContext | null {
  if (!sound.on) return null;
  if (!actx) { try { actx = new AudioContext(); } catch { return null; } }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}
export const wakeAudio = () => { ac(); };

function noise(dur: number, type: BiquadFilterType, freq: number, q: number, gain: number) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = gain;
  s.connect(f).connect(g).connect(a.destination); s.start();
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}

export const sfx = {
  whoosh() { noise(0.13, 'bandpass', 1100, 0.9, 0.2); },
  cut() { noise(0.4, 'highpass', 2200, 0.5, 0.6); tone(1800, 360, 0.45, 'sawtooth', 0.04); },
  block() { tone(380, 260, 0.08, 'square', 0.05); noise(0.05, 'lowpass', 1400, 0.7, 0.35); },
  parry() { tone(1500, 2400, 0.12, 'triangle', 0.08); noise(0.06, 'highpass', 3000, 0.7, 0.3); },
  hit() { noise(0.06, 'highpass', 3200, 0.7, 0.4); tone(2200, 1500, 0.06, 'triangle', 0.05); },
  hop() { noise(0.09, 'lowpass', 600, 0.7, 0.2); },
  page() { noise(0.6, 'bandpass', 700, 0.4, 0.35); },
  fold() { noise(0.25, 'bandpass', 1600, 0.6, 0.2); },
};
