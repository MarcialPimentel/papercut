// Papercut: menus, practice against the dummy, Endless runs against bots, online fights, and the 60-frames-a-second loop.

import './style.css';
import { Hud, botLevel } from './hud';
import { Controls } from './input';
import { Net } from './net/client';
import { Lockstep } from './net/lockstep';
import { normalizeCode, type ToClient } from './net/protocol';
import { engine } from './audio/engine';
import { music, type MusicMode, type Tension } from './audio/music';
import { sfx } from './audio/sounds';
import { View } from './render/view';
import { DEFAULT_CFG, ENDLESS_CFG, cleanCfg, roundsLabel, type MatchCfg } from './sim/config';
import { Dummy } from './sim/dummy';
import { hashState, newMatch, step, type State } from './sim/sim';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const stage = $('#stage'), canvas = $<HTMLCanvasElement>('#scene');
const STEP = 1 / 60;

let view: View;
try {
  view = new View(canvas, stage, $('#labels'));
} catch (e) {
  $('#fallback').textContent = 'Papercut needs WebGL, which is turned off or missing in this browser. Try Chrome, Edge or Firefox on a computer.';
  throw e;
}
const hud = new Hud();
const controls = new Controls(canvas, $('#chips'), $('#aim'));
const net = new Net();
const wakeAudio = () => { engine.wake(); };
$('#build').textContent = `build ${__BUILD__}`;

type Mode =
  | { kind: 'menu'; s: State }
  | { kind: 'practice'; s: State; dummy: Dummy; endless: boolean }
  | { kind: 'online'; lock: Lockstep; code: string };
let mode: Mode = { kind: 'menu', s: newMatch() };
const stateOf = (m: Mode) => (m.kind === 'online' ? m.lock.state : m.s);
const seatOf = (m: Mode) => (m.kind === 'online' ? m.lock.seat : 0);

// ---------- menus ----------
type Screen = 'main' | 'howto' | 'setup' | 'host' | 'search' | 'join' | 'error';
let screen: Screen | null = null;
function showMenu(to: Screen, opts: { code?: string; msg?: string } = {}) {
  screen = to;
  stage.classList.add('in-menu');
  $('#menu').hidden = false;
  for (const el of document.querySelectorAll<HTMLElement>('[data-screen]')) el.hidden = el.dataset.screen !== to;
  if (to === 'host' && opts.code) {
    const link = `${location.origin}/?room=${opts.code}`;
    $<HTMLInputElement>('#inviteLink').value = link;
    $('#inviteCode').textContent = opts.code;
    $('#hostWait').textContent = 'Send this link to a friend. The fight starts when they open it.';
  }
  if (to === 'host' && !opts.code) { $<HTMLInputElement>('#inviteLink').value = ''; $('#inviteCode').textContent = '····'; $('#hostWait').textContent = 'Making your room…'; }
  if (to === 'join') $('#joinWait').textContent = `Joining room ${opts.code}…`;
  if (to === 'error') $('#errorMsg').textContent = opts.msg ?? 'Something went wrong.';
  if (to === 'main') { const b = loadBest(); $('#bestRun').textContent = b > 0 ? `Your best run: ${b} bot${b === 1 ? '' : 's'}` : 'How many bots can you cut?'; }
}
function hideMenu() { showSound(false); screen = null; stage.classList.remove('in-menu'); $('#menu').hidden = true; }

function toMenu(to: Screen = 'main', opts: { msg?: string } = {}) {
  if (mode.kind === 'online') net.send({ t: 'cancel' });
  controls.active = false; controls.clear();
  controls.lockWanted = false; controls.unlock();
  mode = { kind: 'menu', s: newMatch() };
  view.reset(mode.s);
  hud.you = null; hud.online = false; hud.setNames();
  showMenu(to, opts);
}

// Endless: the best run is kept in this browser only.
const BEST_KEY = 'papercut.endlessBest';
function loadBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function saveBest(n: number) { try { if (n > loadBest()) localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage blocked: the run just isn't remembered */ } }

function startPractice(endless = false) {
  wakeAudio();
  const cfg = endless ? ENDLESS_CFG : DEFAULT_CFG;
  mode = { kind: 'practice', s: newMatch(cfg), dummy: new Dummy(), endless };
  hud.setRules(cfg); hud.best = loadBest();
  begin();
  hud.you = null; hud.online = false; hud.setNames(); view.you = 0;
}

function startOnline(seat: 0 | 1, delay: number, code: string, cfg: MatchCfg) {
  wakeAudio();
  const lock = new Lockstep(seat, delay, (m) => net.send(m), cfg);
  hud.setRules(cfg);
  mode = { kind: 'online', lock, code };
  begin();
  hud.you = seat; hud.online = true; hud.setNames(); view.you = seat;
  if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
}

function begin() {
  view.reset(stateOf(mode));
  controls.clear(); controls.active = true;
  controls.lockWanted = true; controls.lock(); // works when a click started the fight; otherwise the first click locks
  acc = 0;
  hideMenu();
}

function ensureNet(then: () => void) {
  if (net.open) { then(); return; }
  pendingSend = then;
  net.connect();
}
let pendingSend: (() => void) | null = null;

$('#bPractice').addEventListener('click', () => startPractice());
$('#bEndless').addEventListener('click', () => startPractice(true));
$('#bHowTo').addEventListener('click', () => showMenu('howto'));
$('#bHowToBack').addEventListener('click', () => showMenu('main'));
$('#bFriend').addEventListener('click', () => showMenu('setup'));
$('#setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = (id: string) => Number($<HTMLSelectElement>(id).value);
  const cfg = cleanCfg({ wins: v('#optWins'), maxHp: v('#optHp'), roundSecs: v('#optTime') });
  showMenu('host'); ensureNet(() => net.send({ t: 'host', cfg }));
});
$('#bQuick').addEventListener('click', () => { showMenu('search'); ensureNet(() => net.send({ t: 'quick' })); });
$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normalizeCode($<HTMLInputElement>('#joinCode').value);
  if (code.length < 4) return;
  showMenu('join', { code }); ensureNet(() => net.send({ t: 'join', code }));
});
for (const b of document.querySelectorAll('[data-cancel]')) b.addEventListener('click', () => { net.send({ t: 'cancel' }); toMenu(); });
$('#copyLink').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('#inviteLink');
  try { await navigator.clipboard.writeText(input.value); $('#copyLink').textContent = 'Copied'; }
  catch { input.select(); }
  setTimeout(() => { $('#copyLink').textContent = 'Copy link'; }, 1600);
});
$('#bLeave').addEventListener('click', () => toMenu());
// Sound: one panel with Music and Effects sliders, opened from the menu or the fight.
const soundBox = $('#soundBox');
const soundBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-sound]')];
function showSound(open: boolean, under?: HTMLElement) {
  soundBox.hidden = !open;
  for (const b of soundBtns) b.setAttribute('aria-expanded', String(open));
  if (open && under) {
    // Sit just under the button that opened it, kept on screen.
    const r = under.getBoundingClientRect(), w = soundBox.offsetWidth;
    soundBox.style.top = r.bottom + 8 + 'px';
    soundBox.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  }
}
for (const b of soundBtns) b.addEventListener('click', () => { wakeAudio(); showSound(soundBox.hidden, b); });
for (const [id, key] of [['#volMusic', 'music'], ['#volSfx', 'sfx']] as const) {
  const input = $<HTMLInputElement>(id);
  input.value = String(Math.round(engine.vol[key] * 100));
  input.addEventListener('input', () => engine.setVolumes({ [key]: Number(input.value) / 100 }));
  if (key === 'sfx') input.addEventListener('change', () => sfx.hit(0)); // a sample of the new level
}
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) showSound(false); }); // back in the fight
// A soft paper tap on every menu button.
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.mbtn, .hbtn')) { wakeAudio(); sfx.ui(); } });
$('#rematch').addEventListener('click', () => command('rematch'));

function command(c: 'restart' | 'menu' | 'rematch') {
  if (c === 'menu') { if (mode.kind !== 'menu') toMenu(); else if (screen === 'howto') showMenu('main'); return; }
  if (mode.kind === 'practice') {
    if (c === 'restart' || mode.s.phase === 'over') { mode.s = newMatch(mode.s.cfg); mode.dummy.reset(); hud.best = loadBest(); view.reset(mode.s); controls.lockWanted = true; controls.lock(); }
  } else if (mode.kind === 'online' && mode.lock.state.phase === 'over') controls.press('rematch');
}
controls.onCommand = command;
controls.onAnyInput = wakeAudio;

net.onStatus = (open) => {
  if (open && pendingSend) { const f = pendingSend; pendingSend = null; f(); }
  if (open) return;
  if (mode.kind === 'online') toMenu('error', { msg: 'Lost the connection to the server. Check your internet and try again.' });
  else if (screen === 'host' || screen === 'search' || screen === 'join') toMenu('error', { msg: 'Lost the connection to the server. It may be restarting: try again in a moment.' });
};
net.onMessage = (m: ToClient) => {
  switch (m.t) {
    case 'room': showMenu('host', { code: m.code }); break;
    case 'waiting': showMenu('search'); break;
    case 'start': startOnline(m.seat, m.delay, m.code, cleanCfg(m.cfg)); break;
    case 'in': case 'hash': if (mode.kind === 'online') mode.lock.receive(m); break;
    case 'gone': if (mode.kind === 'online') toMenu('error', { msg: 'Your rival left the fight.' }); break;
    case 'err': toMenu('error', { msg: m.msg }); break;
  }
};

/** Which music fits the moment: calm on menus, drums for "Round N", the full fight, silence from a K.O. to the next round. */
function musicFor(m: Mode, s: State): [MusicMode, Tension] {
  if (m.kind === 'menu') return ['menu', 0];
  if (s.phase === 'intro') return ['intro', 0];
  if (s.phase === 'over') return s.phaseT > 240 ? ['menu', 0] : ['off', 0];
  if (s.phase !== 'fight') return ['off', 0];
  const deciding = s.cfg.wins > 0 && s.f.every((f) => f.wins === s.cfg.wins - 1);
  const close = s.f.some((f) => f.hp <= s.cfg.maxHp * 0.3) || (s.cfg.roundSecs > 0 && s.clock <= 10 * 60);
  return ['fight', deciding || close ? 1 : 0];
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const statusEl = $('#status');
let lastStatus = '';
const rulesLabel = (c: MatchCfg) => `${roundsLabel(c.wins)}, ${c.maxHp} health, ${c.roundSecs ? c.roundSecs + 's' : 'no timer'}`;
function frame(now: number) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  const m = mode;
  const seat = seatOf(m);
  if (m.kind === 'practice') {
    acc += real;
    while (acc >= STEP) {
      const s = m.s;
      if (m.endless) m.dummy.level = botLevel(s.f[0].wins);
      const ev = step(s, [controls.sample(view.waistY(s, 0)), m.dummy.think(s)]);
      if (m.endless && ev.some((e) => e.k === 'over')) saveBest(s.f[0].wins);
      view.onStep(s, ev);
      acc -= STEP;
    }
  } else if (m.kind === 'online') {
    const lock = m.lock;
    acc += real;
    // A little faster when the rival's inputs pile up (we fell behind), so both stay close in time.
    if (lock.backlog > lock.delay + 3) acc += STEP;
    let n = 0;
    while (acc >= STEP && n < 5) {
      const ev = lock.tick(() => controls.sample(view.waistY(lock.state, seat)));
      if (!ev) { acc = Math.min(acc, STEP); break; }
      view.onStep(lock.state, ev);
      acc -= STEP; n++;
    }
  }
  const s = stateOf(m);
  if (m.kind !== 'menu') {
    hud.update(s, m.kind === 'online' ? seat : 0);
    // Hold the mouse while fighting; let it go when the match is over so Rematch and Leave can be clicked.
    controls.lockWanted = s.phase !== 'over';
    if (!controls.lockWanted) controls.unlock();
  }
  music.set(...musicFor(m, s));
  view.draw(s, real, m.kind === 'practice' ? { seat: 1, k: m.dummy.tell / m.dummy.tellFrames } : undefined);
  stage.style.background = view.sky;

  let status = '';
  if (m.kind === 'practice') status = m.endless ? `Endless · level ${botLevel(m.s.f[0].wins)} · Esc for the menu` : 'Practice: Sumi is a dummy · Esc for the menu';
  else if (m.kind === 'online') {
    const l = m.lock;
    status = l.desynced ? `Out of sync at frame ${l.frame}. Please tell Marz.`
      : l.waiting > 20 ? "Waiting for your rival's connection…"
      : `Online · room ${m.code} · ${rulesLabel(l.state.cfg)} · ${l.delay}-frame delay`;
  }
  if (m.kind !== 'menu' && controls.lockWanted && !controls.locked && matchMedia('(hover: hover) and (pointer: fine)').matches && !status.startsWith('Out')) {
    status = 'Click the fight to hold the mouse · ' + status;
  }
  if (status !== lastStatus) { statusEl.textContent = status; lastStatus = status; statusEl.classList.toggle('warn', status.startsWith('Out') || status.startsWith('Wait')); }
}

hud.setNames();
view.reset(stateOf(mode));
stage.classList.add('ready');
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) {
  const code = normalizeCode(roomParam);
  showMenu('join', { code });
  ensureNet(() => net.send({ t: 'join', code }));
} else {
  showMenu('main');
  net.connect(); // connect early so the server can measure the connection before a fight
}
requestAnimationFrame((t) => { last = t; frame(t); });

// For automated browser tests only.
(window as unknown as { __pc: unknown }).__pc = { get mode() { return mode; }, controls, view, hash: () => hashState(stateOf(mode)) };
