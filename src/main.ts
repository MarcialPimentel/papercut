// Papercut: menus, practice against the dummy, online fights, and the 60-frames-a-second loop.

import './style.css';
import { Hud } from './hud';
import { Controls } from './input';
import { Net } from './net/client';
import { Lockstep } from './net/lockstep';
import { normalizeCode, type ToClient } from './net/protocol';
import { sound, wakeAudio } from './render/sfx';
import { View } from './render/view';
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
const controls = new Controls(canvas, $('#chips'));
const net = new Net();
$('#build').textContent = `build ${__BUILD__}`;

type Mode =
  | { kind: 'menu'; s: State }
  | { kind: 'practice'; s: State; dummy: Dummy }
  | { kind: 'online'; lock: Lockstep; code: string };
let mode: Mode = { kind: 'menu', s: newMatch() };
const stateOf = (m: Mode) => (m.kind === 'online' ? m.lock.state : m.s);
const seatOf = (m: Mode) => (m.kind === 'online' ? m.lock.seat : 0);

// ---------- menus ----------
type Screen = 'main' | 'host' | 'search' | 'join' | 'error';
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
}
function hideMenu() { screen = null; stage.classList.remove('in-menu'); $('#menu').hidden = true; }

function toMenu(to: Screen = 'main', opts: { msg?: string } = {}) {
  if (mode.kind === 'online') net.send({ t: 'cancel' });
  controls.active = false; controls.clear();
  mode = { kind: 'menu', s: newMatch() };
  view.reset(mode.s);
  hud.you = null; hud.online = false; hud.setNames();
  showMenu(to, opts);
}

function startPractice() {
  wakeAudio();
  mode = { kind: 'practice', s: newMatch(), dummy: new Dummy() };
  begin();
  hud.you = null; hud.online = false; hud.setNames();
}

function startOnline(seat: 0 | 1, delay: number, code: string) {
  wakeAudio();
  const lock = new Lockstep(seat, delay, (m) => net.send(m));
  mode = { kind: 'online', lock, code };
  begin();
  hud.you = seat; hud.online = true; hud.setNames();
  if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
}

function begin() {
  view.reset(stateOf(mode));
  controls.clear(); controls.active = true;
  acc = 0;
  hideMenu();
}

function ensureNet(then: () => void) {
  if (net.open) { then(); return; }
  pendingSend = then;
  net.connect();
}
let pendingSend: (() => void) | null = null;

$('#bPractice').addEventListener('click', startPractice);
$('#bFriend').addEventListener('click', () => { showMenu('host'); ensureNet(() => net.send({ t: 'host' })); });
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
$('#bSound').addEventListener('click', () => { sound.on = !sound.on; $('#bSound b').textContent = sound.on ? 'On' : 'Off'; });
$('#rematch').addEventListener('click', () => command('rematch'));

function command(c: 'restart' | 'menu' | 'rematch') {
  if (c === 'menu') { if (mode.kind !== 'menu') toMenu(); return; }
  if (mode.kind === 'practice') {
    if (c === 'restart' || mode.s.phase === 'over') { mode.s = newMatch(); mode.dummy.reset(); view.reset(mode.s); }
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
    case 'start': startOnline(m.seat, m.delay, m.code); break;
    case 'in': case 'hash': if (mode.kind === 'online') mode.lock.receive(m); break;
    case 'gone': if (mode.kind === 'online') toMenu('error', { msg: 'Your rival left the fight.' }); break;
    case 'err': toMenu('error', { msg: m.msg }); break;
  }
};

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const statusEl = $('#status');
let lastStatus = '';
function frame(now: number) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  const m = mode;
  const seat = seatOf(m);
  if (m.kind === 'practice') {
    acc += real;
    while (acc >= STEP) {
      const s = m.s;
      const ev = step(s, [controls.sample(view.waistY(s, 0)), m.dummy.think(s)]);
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
  if (m.kind !== 'menu') hud.update(s, m.kind === 'online' ? seat : 0);
  view.draw(s, real, m.kind === 'practice' ? { seat: 1, k: m.dummy.tell / m.dummy.tellFrames } : undefined);
  stage.style.background = view.sky;

  let status = '';
  if (m.kind === 'practice') status = 'Practice: Sumi is a dummy · Esc for the menu';
  else if (m.kind === 'online') {
    const l = m.lock;
    status = l.desynced ? `Out of sync at frame ${l.frame}. Please tell Marz.`
      : l.waiting > 20 ? "Waiting for your rival's connection…"
      : `Online · room ${m.code} · ${l.delay}-frame delay`;
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
