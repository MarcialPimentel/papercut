// Papercut: menus, practice against the dummy, Endless runs against bots, online fights, tournaments,
// and the 60-frames-a-second loop.

import '@fontsource/big-shoulders-stencil-display/600';
import '@fontsource/big-shoulders-stencil-display/800';
import '@fontsource/atkinson-hyperlegible/400';
import '@fontsource/atkinson-hyperlegible/700';
import './style.css';
import { Hud } from './hud';
import { Controls, type Command } from './input';
import { Net } from './net/client';
import { Lockstep } from './net/lockstep';
import { BYE_SLOT, normalizeCode, type RankInfo, type ToClient } from './net/protocol';
import { Spectator } from './net/spectator';
import { engine } from './audio/engine';
import { music, PAGE_TRACKS, type MusicMode, type Tension, type TrackKey } from './audio/music';
import { sfx } from './audio/sounds';
import { View } from './render/view';
import { loadDisplay, saveDisplay, skipFrame } from './settings';
import { desktop, store } from './store';
import { DEFAULT_CFG, ENDLESS_CFG, cleanCfg, roundsLabel, type MatchCfg } from './sim/config';
import { Dummy } from './sim/dummy';
import { applyTuning, isTuned, loadSaved, resetTuning } from './tuning';
import { TuningPanel } from './tuning-panel';
import { hashState, matchWinner, newMatch, step, type State } from './sim/sim';
import { Tally } from './sim/tally';
import { RunInputs, botInput, botLevel, endlessBot } from './sim/endless';

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
// Browsers only allow sound after the player presses something. Tournament guests arrive by link and their
// fights start from the server, so any press anywhere counts, not just fight keys and menu buttons.
const soundHints = () => document.querySelectorAll<HTMLElement>('[data-sound-hint]');
for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) {
  addEventListener(ev, () => { wakeAudio(); for (const h of soundHints()) h.hidden = true; }, { capture: true, passive: true });
}
$('#build').textContent = `build ${__BUILD__}`;
/** Where invite links point: this site, or the live site from the desktop app. */
const SITE = desktop ? desktop.server : location.origin;
// T in Practice: sliders for the fight's numbers (#9). Practice only; everything else resets them.
const tuner = new TuningPanel(stage, __BUILD__);
tuner.onClose = () => { controls.clear(); if (mode.kind === 'practice') { controls.active = true; controls.lockWanted = true; controls.lock(); } };

type Mode =
  | { kind: 'menu'; s: State }
  | { kind: 'practice'; s: State; dummy: Dummy; endless: boolean; tally: Tally; seed: number; inputs: RunInputs }
  | { kind: 'online'; lock: Lockstep; code: string }
  | { kind: 'watch'; spec: Spectator; code: string; names: [string, string] }; // watching a tournament fight
let mode: Mode = { kind: 'menu', s: newMatch() };
const stateOf = (m: Mode) => (m.kind === 'online' ? m.lock.state : m.kind === 'watch' ? m.spec.state : m.s);
const seatOf = (m: Mode) => (m.kind === 'online' ? m.lock.seat : 0);

// ---------- tournaments ----------
type BracketMsg = Extract<ToClient, { t: 'bracket' }>;
/** The tournament we're in (null = none). */
let tourney: {
  code: string;
  bracket: BracketMsg | null;
  /** The bracket spot of the fight on screen; when a bracket arrives without it, that fight is over. */
  fight: [number, number] | null;
  reported: boolean;
  /** When to go back to the bracket after the fight on screen ended (0 = not yet). */
  backAt: number;
} | null = null;
const NAME_KEY = 'papercut.name';
function myName() { return store.get(NAME_KEY) ?? ''; }
function saveName(n: string) { store.set(NAME_KEY, n); }
const rulesLabel = (c: MatchCfg) => `${roundsLabel(c.wins)}, ${c.maxHp} health, ${c.roundSecs ? c.roundSecs + 's' : 'no timer'}`;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- menus ----------
type Screen = 'main' | 'howto' | 'board' | 'settings' | 'setup' | 'host' | 'tlobby' | 'bracket' | 'search' | 'join' | 'error';
let screen: Screen | null = null;
function showMenu(to: Screen, opts: { code?: string; msg?: string } = {}) {
  screen = to;
  stage.classList.add('in-menu');
  $('#menu').hidden = false;
  for (const el of document.querySelectorAll<HTMLElement>('[data-screen]')) el.hidden = el.dataset.screen !== to;
  if (to === 'host' && opts.code) {
    const link = `${SITE}/?room=${opts.code}`;
    $<HTMLInputElement>('#inviteLink').value = link;
    $('#inviteCode').textContent = opts.code;
    $('#hostWait').textContent = 'Send this link to a friend. The fight starts when they open it.';
  }
  if (to === 'host' && !opts.code) { $<HTMLInputElement>('#inviteLink').value = ''; $('#inviteCode').textContent = '····'; $('#hostWait').textContent = 'Making your room…'; }
  if (to === 'join') $('#joinWait').textContent = `Joining room ${opts.code}…`;
  if (to === 'error') $('#errorMsg').textContent = opts.msg ?? 'Something went wrong.';
  if (to === 'settings') fillSettings();
  if (to === 'tlobby' || to === 'bracket') for (const h of soundHints()) h.hidden = !!engine.live;
  if (to === 'main') {
    showBest();
    if (loadBest() > 0) fetchBoard('all').then((b) => { myPlace = b?.you?.place ?? null; if (screen === 'main') showBest(); });
  }
  if (to === 'board') showBoard('all');
}
function hideMenu() { showSound(false); screen = null; stage.classList.remove('in-menu'); $('#menu').hidden = true; }

function toMenu(to: Screen = 'main', opts: { msg?: string } = {}) {
  tuner.toggle(false); resetTuning();
  if (mode.kind === 'online' || tourney) net.send({ t: 'cancel' });
  tourney = null; hud.tourney = false; hud.names = null; hud.ranks = null; hud.rankNote = '';
  controls.active = false; controls.clear();
  controls.lockWanted = false; controls.unlock();
  mode = { kind: 'menu', s: newMatch() };
  view.reset(mode.s);
  hud.you = null; hud.online = false; hud.setNames();
  showMenu(to, opts);
}

// Endless: the best run is kept in this browser, or on disk in the desktop app.
const BEST_KEY = 'papercut.endlessBest';
function loadBest() { return Number(store.get(BEST_KEY)) || 0; }
function saveBest(n: number) { if (n > loadBest()) store.set(BEST_KEY, String(n)); }
// Ranked: this browser's secret token (who you are to the server; it only keeps a hash of it).
const ID_KEY = 'papercut.id';
function myId(): string {
  let id = store.get(ID_KEY);
  if (!id || !/^[0-9a-f]{32}$/.test(id)) {
    id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');
    store.set(ID_KEY, id);
  }
  return id;
}
/** Your ranked standing, from the server. */
let myRank: RankInfo | null = null;
function showRank() {
  $('#rankLine').textContent = !myRank ? 'Rated fights, paper-grade divisions'
    : myRank.placed ? `${myRank.division} · ${myRank.points} points` : `${myRank.division} · your first 5 matches place you`;
}

// ---------- Endless leaderboard ----------
type Period = 'day' | 'week' | 'all';
const PERIOD_NAMES: Record<Period, string> = { day: 'today', week: 'this week', all: 'all time' };
/** Your place on the all-time board (null: not on it, or not known yet). */
let myPlace: number | null = null;

/** A fresh seed for an Endless run: the bot's dice for this run. */
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/**
 * Send a finished Endless run: its seed and your inputs. The server re-plays it, and only the score
 * the re-play reaches goes on the leaderboard (and into the stats).
 */
function reportRun(seed: number, inputs: number[], bots: number) {
  hud.placeNote = '';
  const body = JSON.stringify({ seed, inputs, bots, guard: controls.guardStyle, id: myId(), name: myName() });
  fetch(`${SITE}/api/endless`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 })
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (!ok) { hud.placeNote = `Not posted to the leaderboard (${j.error ?? 'refused'}).`; return; }
      const places = (j.places ?? {}) as Partial<Record<Period, number>>;
      if (places.all) myPlace = places.all;
      const parts = (['day', 'week', 'all'] as Period[]).filter((p) => places[p]).map((p) => `#${places[p]} ${PERIOD_NAMES[p]}`);
      hud.placeNote = parts.length ? `Leaderboard: ${parts.join(', ')}.` : '';
    })
    .catch(() => { hud.placeNote = 'Not posted to the leaderboard (no connection).'; });
}

interface BoardReply { period: Period; top: { name: string; bots: number; secs: number; you: boolean }[]; you: { place: number; bots: number } | null }
async function fetchBoard(period: Period): Promise<BoardReply | null> {
  try {
    const r = await fetch(`${SITE}/api/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period, id: myId() }) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
async function showBoard(period: Period) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-period]')) b.classList.toggle('on', b.dataset.period === period);
  $('#boardList').innerHTML = '<li class="muted">Loading…</li>';
  const b = await fetchBoard(period);
  if (screen !== 'board') return;
  if (!b) { $('#boardList').innerHTML = '<li class="muted">The leaderboard is not available right now.</li>'; $('#boardYou').textContent = ''; return; }
  $('#boardList').innerHTML = b.top.length
    ? b.top.map((r, i) => `<li class="${r.you ? 'you' : ''}"><span>${i + 1}</span><b>${esc(r.name)}</b><span>${r.bots} bot${r.bots === 1 ? '' : 's'}</span><span class="muted">${clock(r.secs)}</span></li>`).join('')
    : `<li class="muted">No runs ${PERIOD_NAMES[period]} yet. Be the first.</li>`;
  $('#boardYou').textContent = b.you ? `You: #${b.you.place} ${PERIOD_NAMES[period]} with ${b.you.bots} bot${b.you.bots === 1 ? '' : 's'}.` : `You have no run ${PERIOD_NAMES[period]} yet.`;
}
/** The title screen's Endless line: your best run, and your place if you have one. */
function showBest() {
  const b = loadBest();
  $('#bestRun').textContent = b > 0 ? `Your best run: ${b} bot${b === 1 ? '' : 's'}${myPlace ? ` · #${myPlace} on the leaderboard` : ''}` : 'How many bots can you cut?';
}

function startPractice(endless = false) {
  wakeAudio();
  const cfg = endless ? ENDLESS_CFG : DEFAULT_CFG;
  // Practice plays with the numbers kept from the tuning panel; Endless (a scored run) never does.
  if (endless) resetTuning(); else applyTuning(loadSaved());
  const seed = newSeed();
  mode = { kind: 'practice', s: newMatch(cfg), dummy: endless ? endlessBot(seed) : new Dummy(), endless, tally: new Tally(), seed, inputs: new RunInputs() };
  hud.placeNote = '';
  hud.setRules(cfg); hud.best = loadBest();
  begin();
  hud.you = null; hud.online = false; hud.setNames(); view.you = 0;
}

function startOnline(seat: 0 | 1, delay: number, code: string, cfg: MatchCfg, names: [string, string] | null = null) {
  wakeAudio();
  tuner.toggle(false); resetTuning();
  const lock = new Lockstep(seat, delay, (m) => net.send(m), cfg);
  hud.setRules(cfg);
  mode = { kind: 'online', lock, code };
  begin();
  hud.you = seat; hud.online = true; hud.tourney = !!tourney; hud.names = names; hud.setNames(); view.you = seat;
  if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
}

/** Watch a tournament fight between two other players. */
function startWatching(delay: number, code: string, cfg: MatchCfg, names: [string, string]) {
  tuner.toggle(false); resetTuning();
  mode = { kind: 'watch', spec: new Spectator(cfg, delay), code, names };
  hud.setRules(cfg);
  view.reset(mode.spec.state);
  controls.clear(); controls.active = false; controls.lockWanted = false; controls.unlock();
  acc = 0;
  hideMenu();
  hud.you = null; hud.online = true; hud.tourney = true; hud.names = names; hud.setNames(); view.you = -1;
}

/** Leave the fight on screen (if any) and show the tournament's bracket. */
function toBracket() {
  if (!tourney) return;
  controls.active = false; controls.clear(); controls.lockWanted = false; controls.unlock();
  if (mode.kind !== 'menu') { mode = { kind: 'menu', s: newMatch() }; view.reset(mode.s); }
  tourney.fight = null; tourney.backAt = 0;
  hud.you = null; hud.names = null; hud.setNames();
  showMenu('bracket');
  renderBracket();
}

function renderLobby(m: Extract<ToClient, { t: 'lobby' }>) {
  $('#tCode').textContent = m.code;
  $<HTMLInputElement>('#tLink').value = `${SITE}/?room=${m.code}`;
  $('#tRules').textContent = `${rulesLabel(m.cfg)} per fight. Knockout: lose once and you're out.`;
  $('#tPlayers').innerHTML = m.names.map((n, i) => `<li${i === m.you ? ' class="me"' : ''}>${esc(n)}${i === 0 ? ' (host)' : ''}${i === m.you ? ' · you' : ''}</li>`).join('');
  const nameIn = $<HTMLInputElement>('#tName');
  if (document.activeElement !== nameIn) nameIn.value = m.names[m.you];
  const enough = m.names.length >= 3;
  $('#tBegin').hidden = !m.host;
  $<HTMLButtonElement>('#tBegin').disabled = !enough;
  $('#tBegin').textContent = `Start tournament (${m.names.length}/8)`;
  $('#tWait').textContent = m.host
    ? enough ? 'Start when everyone is in. Up to 8 players.' : 'Send the link to friends: 3 players needed to start.'
    : 'Waiting for the host to start…';
}

function renderBracket() {
  const b = tourney?.bracket;
  if (!b) return;
  const nm = (i: number | null) => (i === null ? '…' : i === BYE_SLOT ? '(bye)' : b.names[i]);
  const label = (r: number) => (r === b.rounds.length - 1 ? 'Final' : r === b.rounds.length - 2 ? 'Semis' : `Round ${r + 1}`);
  $('#bracket').innerHTML = b.rounds.map((round, r) => `<div class="col"><b>${label(r)}</b>${round.map((m, i) => {
    const now = !!b.current && b.current[0] === r && b.current[1] === i;
    const row = (p: number | null) => {
      const cls = [m.winner !== null && p === m.winner ? 'w' : m.winner !== null && p !== BYE_SLOT ? 'lost' : '', p !== null && p === b.you ? 'me' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}">${esc(nm(p))}</div>`;
    };
    return `<div class="m${now ? ' now' : ''}">${row(m.a)}${row(m.b)}</div>`;
  }).join('')}</div>`).join('');
  const cur = b.current && b.rounds[b.current[0]][b.current[1]];
  $('#bTitle').textContent = b.champion !== null ? `${b.names[b.champion]} wins!` : 'Bracket';
  $('#bAgain').hidden = !b.restart;
  $('#bNext').textContent = b.champion !== null ? (b.champion === b.you ? 'You won the tournament!' : 'The tournament is over.')
    : cur ? `Now: ${nm(cur.a)} vs ${nm(cur.b)}` : 'Next fight in a few seconds…';
  $('#bLeaveT').textContent = b.champion !== null ? 'Back to the menu' : 'Leave tournament';
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
$('#bBoard').addEventListener('click', () => showMenu('board'));
$('#bBoardBack').addEventListener('click', () => showMenu('main'));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-period]')) b.addEventListener('click', () => showBoard(b.dataset.period as Period));
// Guard style (playtest A/B): Flick (mouse up / down, no cursor) or Cursor (crosshair against your waist).
const GUARD_HOW = {
  flick: 'Flick the mouse <b>up</b> to guard high, <b>down</b> to guard low. Only the direction counts, not where the mouse is.',
  cursor: "Move the crosshair <b>above</b> your fighter's waist to guard high, <b>below</b> to guard low.",
};
function showGuardStyle() { $('#howGuard').innerHTML = GUARD_HOW[controls.guardStyle]; }
/** Tell the server this browser's guard style, so the stats can compare Line and Cursor. */
function sayHello() { net.send({ t: 'hello', guard: controls.guardStyle, id: myId() }); }
showGuardStyle();

// ---------- settings ----------
let display = loadDisplay();
const isFullscreen = () => (desktop ? desktop.isFullscreen() : !!document.fullscreenElement);
function setFullscreen(on: boolean) {
  if (desktop) desktop.setFullscreen(on);
  else if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function fillSettings() {
  $<HTMLSelectElement>('#setWindow').value = isFullscreen() ? 'full' : 'win';
  $<HTMLSelectElement>('#setScale').value = String(display.scale);
  $<HTMLSelectElement>('#setFps').value = String(display.fps);
  $<HTMLSelectElement>('#setVsync').value = display.vsync ? 'on' : 'off';
  $<HTMLSelectElement>('#setGuard').value = controls.guardStyle;
  syncVolumeInputs();
  $('#setNote').textContent = desktop
    ? 'Vsync changes apply the next time you start Papercut. F11 or Alt+Enter also switches fullscreen.'
    : "In a browser the frame rate can't go above your screen's. Settings are kept in this browser.";
}
function readSettings() {
  display = {
    fullscreen: $<HTMLSelectElement>('#setWindow').value === 'full',
    scale: Number($<HTMLSelectElement>('#setScale').value),
    fps: Number($<HTMLSelectElement>('#setFps').value),
    vsync: $<HTMLSelectElement>('#setVsync').value === 'on',
  };
  saveDisplay(display);
  view.setScale(display.scale);
}
$('#setWindow').addEventListener('change', () => { readSettings(); setFullscreen(display.fullscreen); });
for (const id of ['#setScale', '#setFps', '#setVsync']) $(id).addEventListener('change', readSettings);
$('#setGuard').addEventListener('change', () => { controls.setGuardStyle($<HTMLSelectElement>('#setGuard').value === 'cursor' ? 'cursor' : 'flick'); showGuardStyle(); sayHello(); });
$('#settingsForm').addEventListener('submit', (e) => { e.preventDefault(); showMenu('main'); });
$('#bSettings').addEventListener('click', () => showMenu('settings'));
for (const el of document.querySelectorAll<HTMLElement>('[data-desktop-only]')) el.hidden = !desktop;
if (desktop) {
  $('#bQuit').hidden = false;
  $('#bQuit').addEventListener('click', () => desktop!.quit());
  // F11 / Alt+Enter (handled by the app) and the Settings screen both land here, so the saved choice follows.
  desktop.onFullscreen((on) => {
    if (display.fullscreen !== on) { display = { ...display, fullscreen: on }; saveDisplay(display); }
    if (screen === 'settings') $<HTMLSelectElement>('#setWindow').value = on ? 'full' : 'win';
  });
}
view.setScale(display.scale);
let setupFor: 'room' | 'tourney' = 'room';
function openSetup(kind: 'room' | 'tourney') {
  setupFor = kind;
  $('#setupTitle').textContent = kind === 'room' ? 'Room rules' : 'Tournament rules';
  $('#setupNote').textContent = kind === 'room' ? 'Your friend plays by these rules too.' : 'Every fight in the bracket uses these rules.';
  // Every bracket fight has to end, so no endless rounds in a tournament.
  const endless = $<HTMLOptionElement>('#optWins option[value="0"]');
  endless.hidden = endless.disabled = kind === 'tourney';
  if (kind === 'tourney' && $<HTMLSelectElement>('#optWins').value === '0') $<HTMLSelectElement>('#optWins').value = '3';
  showMenu('setup');
}
$('#bFriend').addEventListener('click', () => openSetup('room'));
$('#bTourney').addEventListener('click', () => openSetup('tourney'));
$('#setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = (id: string) => Number($<HTMLSelectElement>(id).value);
  const cfg = cleanCfg({ wins: v('#optWins'), maxHp: v('#optHp'), roundSecs: v('#optTime') });
  if (setupFor === 'room') { showMenu('host'); ensureNet(() => net.send({ t: 'host', cfg })); }
  else { showMenu('join', { code: 'for your tournament' }); ensureNet(() => net.send({ t: 'tourney', cfg, name: myName() })); }
});
$('#tName').addEventListener('change', () => {
  const n = $<HTMLInputElement>('#tName').value.trim();
  if (n) { saveName(n); net.send({ t: 'name', name: n }); }
});
$('#tBegin').addEventListener('click', () => net.send({ t: 'begin' }));
$('#bAgain').addEventListener('click', () => net.send({ t: 'restart' }));
$('#tCopy').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('#tLink');
  try { await navigator.clipboard.writeText(input.value); $('#tCopy').textContent = 'Copied'; }
  catch { input.select(); }
  setTimeout(() => { $('#tCopy').textContent = 'Copy link'; }, 1600);
});
$('#bQuick').addEventListener('click', () => { searching(false); ensureNet(() => net.send({ t: 'quick' })); });
$('#bRanked').addEventListener('click', () => { searching(true); ensureNet(() => net.send({ t: 'ranked', name: myName() })); });
function searching(ranked: boolean) {
  $('#searchTitle').textContent = ranked ? 'Looking for a ranked rival…' : 'Looking for a rival…';
  $('#searchNote').textContent = ranked
    ? "You'll be paired with someone close to your rating. The longer you wait, the wider the search."
    : "You'll be paired with the next person who presses 'Find a fight'. Send a friend to papercut.marz.gg to make it quicker.";
  showMenu('search');
}
$('#joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normalizeCode($<HTMLInputElement>('#joinCode').value);
  if (code.length < 4) return;
  showMenu('join', { code }); ensureNet(() => net.send({ t: 'join', code, name: myName() }));
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
  if (open) syncVolumeInputs();
  for (const b of soundBtns) b.setAttribute('aria-expanded', String(open));
  if (open && under) {
    // Sit just under the button that opened it, kept on screen.
    const r = under.getBoundingClientRect(), w = soundBox.offsetWidth;
    soundBox.style.top = r.bottom + 8 + 'px';
    soundBox.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  }
}
for (const b of soundBtns) b.addEventListener('click', () => { wakeAudio(); showSound(soundBox.hidden, b); });
// The same two sliders sit in the fight's Sound panel and on the Settings screen.
const VOLUME_INPUTS = [['#volMusic', 'music'], ['#volSfx', 'sfx'], ['#setMusic', 'music'], ['#setSfx', 'sfx']] as const;
function syncVolumeInputs() { for (const [id, key] of VOLUME_INPUTS) $<HTMLInputElement>(id).value = String(Math.round(engine.vol[key] * 100)); }
for (const [id, key] of VOLUME_INPUTS) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener('input', () => { wakeAudio(); engine.setVolumes({ [key]: Number(input.value) / 100 }); });
  if (key === 'sfx') input.addEventListener('change', () => sfx.hit(0)); // a sample of the new level
}
syncVolumeInputs();
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) showSound(false); }); // back in the fight
// A soft paper tap on every menu button.
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.mbtn, .hbtn')) { wakeAudio(); sfx.ui(); } });
$('#rematch').addEventListener('click', () => command('rematch'));

function command(c: Command) {
  if (c === 'hitboxes') { view.hitboxes.toggle(); return; }
  if (c === 'tune') {
    if (mode.kind !== 'practice' || mode.endless) return;
    tuner.toggle();
    if (tuner.open) { controls.clear(); controls.active = false; controls.lockWanted = false; controls.unlock(); }
    return;
  }
  if (c === 'menu' && tuner.open) { tuner.toggle(false); return; }
  if (c === 'menu') { if (mode.kind !== 'menu') toMenu(); else if (screen === 'howto' || screen === 'settings' || screen === 'board') showMenu('main'); return; }
  if (mode.kind === 'practice') {
    if (c === 'restart' || mode.s.phase === 'over') {
      mode.s = newMatch(mode.s.cfg); mode.tally = new Tally(); mode.inputs = new RunInputs(); hud.placeNote = '';
      if (mode.endless) { mode.seed = newSeed(); mode.dummy = endlessBot(mode.seed); } else mode.dummy.reset();
      hud.best = loadBest(); view.reset(mode.s); if (!tuner.open) { controls.lockWanted = true; controls.lock(); } }
  } else if (mode.kind === 'online' && !hud.ranks && mode.lock.state.phase === 'over') controls.press('rematch');
}
controls.onCommand = command;
controls.onAnyInput = wakeAudio;

net.onStatus = (open) => {
  if (open) sayHello();
  if (open && pendingSend) { const f = pendingSend; pendingSend = null; f(); }
  if (open) return;
  if (mode.kind === 'online' || mode.kind === 'watch' || tourney) toMenu('error', { msg: 'Lost the connection to the server. Check your internet and try again.' });
  else if (screen === 'host' || screen === 'search' || screen === 'join') toMenu('error', { msg: 'Lost the connection to the server. It may be restarting: try again in a moment.' });
};
net.onMessage = (m: ToClient) => {
  switch (m.t) {
    case 'room': showMenu('host', { code: m.code }); break;
    case 'waiting': if (screen !== 'search') searching(!!m.ranked); break;
    case 'start':
      startOnline(m.seat, m.delay, m.code, cleanCfg(m.cfg), m.ranks ? [m.ranks[0].name, m.ranks[1].name] : null);
      hud.ranks = m.ranks ?? null; hud.rankNote = ''; hud.setNames();
      break;
    case 'rank': myRank = m.you; showRank(); break;
    case 'ranked': {
      myRank = m.you; showRank();
      const pts = `${m.delta >= 0 ? '+' : ''}${m.delta}`;
      hud.rankNote = `${m.won ? 'Win' : 'Loss'} ${pts}: ${m.you.placed ? `${m.you.division} ${m.you.points}` : m.you.division}.`;
      break;
    }
    case 'in': case 'hash':
      if (mode.kind === 'online') mode.lock.receive(m);
      else if (mode.kind === 'watch') mode.spec.receive(m);
      break;
    case 'lobby':
      if (!tourney) tourney = { code: m.code, bracket: null, fight: null, reported: false, backAt: 0 };
      if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
      if (screen !== 'tlobby') showMenu('tlobby');
      renderLobby(m);
      break;
    case 'bracket':
      if (!tourney) break;
      tourney.bracket = m;
      if (mode.kind === 'menu') { if (screen !== 'bracket') showMenu('bracket'); renderBracket(); break; }
      if (tourney.fight && !(m.current && m.current[0] === tourney.fight[0] && m.current[1] === tourney.fight[1])) {
        // The fight on screen is decided. A walkover (someone left) goes straight back; otherwise let the end play out.
        if (m.rounds[tourney.fight[0]][tourney.fight[1]].forfeit) toBracket();
        else if (!tourney.backAt) tourney.backAt = performance.now() + 6000;
      }
      break;
    case 'match':
      if (!tourney) break;
      tourney.fight = tourney.bracket?.current ?? null; tourney.reported = false; tourney.backAt = 0;
      if (m.seat === -1) startWatching(m.delay, m.code, cleanCfg(m.cfg), m.names);
      else startOnline(m.seat, m.delay, m.code, cleanCfg(m.cfg), m.names);
      break;
    case 'gone':
      if (mode.kind === 'online' && !tourney) {
        const ranked = hud.ranks && mode.lock.state.phase !== 'over' ? ` The ranked win is yours. ${hud.rankNote}` : '';
        if (hud.ranks && mode.lock.state.phase === 'over') break; // the match was already decided: stay on the result
        toMenu('error', { msg: 'Your rival left the fight.' + ranked });
      }
      break;
    case 'err': toMenu('error', { msg: m.msg }); break;
  }
};

/** Which music fits the moment. Each spread, the menu, Endless, tournaments and the back cover have their own
 *  track; within a track: drums for "Round N", the full fight, busier when close, silence from a K.O. to the next round. */
function musicFor(m: Mode, s: State): [MusicMode, Tension, TrackKey, number] {
  if (m.kind === 'menu') return ['menu', 0, tourney ? 'tourney' : 'menu', 1];
  const endless = m.kind === 'practice' && m.endless;
  const track: TrackKey = tourney ? 'tourney' : endless ? 'endless' : PAGE_TRACKS[s.page] ?? 'dojo';
  const level = endless ? botLevel(s.f[0].wins) : 1;
  if (s.phase === 'intro') return ['intro', 0, track, level];
  if (s.phase === 'over') return s.phaseT > 240 ? ['menu', 0, 'cover', 1] : ['off', 0, track, level];
  if (s.phase !== 'fight') return ['off', 0, track, level];
  const final = !!tourney?.bracket && !!tourney.fight && tourney.fight[0] === tourney.bracket.rounds.length - 1;
  const deciding = s.cfg.wins > 0 && s.f.every((f) => f.wins === s.cfg.wins - 1);
  const close = s.f.some((f) => f.hp <= s.cfg.maxHp * 0.3) || (s.cfg.roundSecs > 0 && s.clock <= 10 * 60);
  return ['fight', final || deciding || close ? 1 : 0, track, level];
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const statusEl = $('#status');
let lastStatus = '';
function frame(now: number) {
  requestAnimationFrame(frame);
  if (skipFrame(display.fps, now - last)) return; // frame cap: the time is counted on the next drawn frame
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  const m = mode;
  const seat = seatOf(m);
  if (m.kind === 'practice' && tuner.open) acc = 0; // paused while tuning
  else if (m.kind === 'practice') {
    acc += real;
    while (acc >= STEP) {
      const s = m.s;
      const mine = controls.sample(view.waistY(s, 0));
      // Endless: the bot's level follows your score, and your inputs are kept so the server can re-play the run.
      if (m.endless) m.inputs.add(s.frame, mine);
      const ev = step(s, [mine, m.endless ? botInput(m.dummy, s) : m.dummy.think(s)]);
      const done = m.tally.feed(s, ev);
      if (m.endless && done) { saveBest(s.f[0].wins); reportRun(m.seed, m.inputs.list, s.f[0].wins); }
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
    // A tournament fight: once the match is over, tell the server who won.
    if (tourney && !tourney.reported && lock.state.phase === 'over') {
      tourney.reported = true;
      net.send({ t: 'result', winner: matchWinner(lock.state) });
    }
  } else if (m.kind === 'watch') {
    const spec = m.spec;
    acc += real;
    // Catch up if the fighters are ahead of us.
    if (spec.backlog > 8) acc += STEP * 2;
    let n = 0;
    while (acc >= STEP && n < 6) {
      const ev = spec.tick();
      if (!ev) { acc = Math.min(acc, STEP); break; }
      view.onStep(spec.state, ev);
      acc -= STEP; n++;
    }
  }
  // Back to the bracket a moment after a tournament fight ends.
  if (tourney && tourney.fight && m.kind !== 'menu') {
    if (stateOf(m).phase === 'over' && !tourney.backAt) tourney.backAt = performance.now() + 2500;
    if (tourney.backAt && performance.now() > tourney.backAt) toBracket();
  }
  const s = stateOf(m);
  if (m.kind !== 'menu') {
    hud.update(s, m.kind === 'online' ? seat : m.kind === 'watch' ? null : 0);
    // Hold the mouse while fighting; let it go when the match is over so Rematch and Leave can be clicked.
    controls.lockWanted = m.kind !== 'watch' && s.phase !== 'over' && !tuner.open;
    if (!controls.lockWanted) controls.unlock();
  }
  music.set(...musicFor(m, s));
  view.draw(s, real, m.kind === 'practice' ? { seat: 1, k: m.dummy.tell / m.dummy.tellFrames } : undefined);
  stage.style.background = view.sky;

  let status = '';
  if (m.kind === 'practice') status = m.endless ? `Endless · level ${botLevel(m.s.f[0].wins)} · Esc for the menu` : `Practice: Sumi is a dummy · T to tune${isTuned() ? ' (tuned numbers)' : ''} · Esc for the menu`;
  else if (m.kind === 'online') {
    const l = m.lock;
    status = l.desynced ? `Out of sync at frame ${l.frame}. Please tell Marz.`
      : l.waiting > 20 ? "Waiting for your rival's connection…"
      : `${tourney ? 'Tournament' : 'Online'} · room ${m.code} · ${rulesLabel(l.state.cfg)} · ${l.delay}-frame delay`;
  } else if (m.kind === 'watch') {
    status = `Watching ${m.names[0]} vs ${m.names[1]} · tournament ${m.code} · Esc to leave`;
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
  ensureNet(() => net.send({ t: 'join', code, name: myName() }));
} else {
  showMenu('main');
  net.connect(); // connect early so the server can measure the connection before a fight
}
requestAnimationFrame((t) => { last = t; frame(t); });

// For automated browser tests only.
(window as unknown as { __pc: unknown }).__pc = { get mode() { return mode; }, controls, view, hash: () => hashState(stateOf(mode)) };
