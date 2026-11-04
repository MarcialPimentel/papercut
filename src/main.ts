// Papercut: menus, the tutorial, practice against the dummy, Endless runs against bots, online fights,
// tournaments, and the 60-frames-a-second loop.

import '@fontsource/big-shoulders-stencil-display/600';
import '@fontsource/big-shoulders-stencil-display/800';
import '@fontsource/atkinson-hyperlegible/400';
import '@fontsource/atkinson-hyperlegible/700';
import './style.css';
import { Hud } from './hud';
import { Controls, type Command } from './input';
import { keysFor, navigate, renderPrompts, restartLabel, setupControlsScreen } from './controlsUi';
import { Net } from './net/client';
import { Lockstep } from './net/lockstep';
import { BYE_SLOT, cleanName, normalizeCode, type RankInfo, type ToClient } from './net/protocol';
import { Spectator } from './net/spectator';
import { ReplayPlayer, type ReplayInputs } from './net/replay';
import { engine } from './audio/engine';
import { music, PAGE_TRACKS, type MusicMode, type Tension, type TrackKey } from './audio/music';
import { sfx } from './audio/sounds';
import { View } from './render/view';
import { LOOKS } from './render/common';
import { DEFAULT_PICK, SUMI_PICK, decodePick, encodePick, lookOf, pairPicks, randomPick, type Pick } from './render/looks';
import { FighterScreen, myPick } from './fighter-screen';
import { myName, saveName } from './name';
import { loadDisplay, saveDisplay, skipFrame } from './settings';
import { desktop, store } from './store';
import { DEFAULT_CFG, DEFENCE_CFG, ENDLESS_CFG, cleanCfg, roundsLabel, type MatchCfg } from './sim/config';
import { Dummy } from './sim/dummy';
import { applyTuning, isTuned, loadSaved, resetTuning } from './tuning';
import { forDivision, forEndless, fromEvents, unlock } from './achievements';
import { TuningPanel } from './tuning-panel';
import { hashState, newMatch, step, type State } from './sim/sim';
import { Tally } from './sim/tally';
import { RunInputs, botInput, botLevel, endlessBot } from './sim/endless';
import { HINT_AFTER, STEPS, TUTORIAL_CFG, Tutorial, freshFight } from './tutorial/tutorial';
import { STEP_TEXT, TUTORIAL_TEXT, fill, namesFor } from './tutorial/text';

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
  | { kind: 'practice'; s: State; dummy: Dummy; endless: boolean; defence: boolean; tally: Tally; seed: number; inputs: RunInputs }
  | { kind: 'tutorial'; s: State; tut: Tutorial }
  | { kind: 'online'; lock: Lockstep; code: string }
  | { kind: 'watch'; spec: Spectator; code: string; names: [string, string] } // watching a tournament fight
  | { kind: 'replay'; rp: ReplayPlayer; names: [string, string]; paused: boolean; speed: number }; // a saved online fight
let mode: Mode = { kind: 'menu', s: newMatch() };
const stateOf = (m: Mode) => (m.kind === 'online' ? m.lock.state : m.kind === 'watch' ? m.spec.state : m.kind === 'replay' ? m.rp.state : m.s);
const seatOf = (m: Mode) => (m.kind === 'online' ? m.lock.seat : 0);

// ---------- tournaments ----------
type BracketMsg = Extract<ToClient, { t: 'bracket' }>;
/** The tournament we're in (null = none). */
let tourney: {
  code: string;
  bracket: BracketMsg | null;
  /** The bracket spot of the fight on screen; when a bracket arrives without it, that fight is over. */
  fight: [number, number] | null;
  /** When to go back to the bracket after the fight on screen ended (0 = not yet). */
  backAt: number;
} | null = null;
const rulesLabel = (c: MatchCfg) => c.defence ? 'Dojo Defence' : `${roundsLabel(c.wins)}, ${c.maxHp} health, ${c.roundSecs ? c.roundSecs + 's' : 'no timer'}`;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- looks (issue #38) ----------
/** Dress both fighters: seat 0 and seat 1, with the who's-who rule (one dark robe, one light). */
function dress(a: Pick, b: Pick) {
  const [p0, p1] = pairPicks(a, b);
  view.setLooks([lookOf(p0, LOOKS[0].name), lookOf(p1, LOOKS[1].name)]);
}
/** The looks from a 'start' or 'match' message ('' or anything unknown is the default Kami / Sumi look). */
const dressOnline = (looks?: [string, string]) => dress(decodePick(looks?.[0], DEFAULT_PICK), decodePick(looks?.[1], SUMI_PICK));
/** Your look, as sent to the server with every request to play. */
const myLook = () => encodePick(myPick());

// ---------- menus ----------
type Screen = 'main' | 'defence' | 'fighter' | 'howto' | 'board' | 'replays' | 'settings' | 'controls' | 'setup' | 'host' | 'tlobby' | 'bracket' | 'search' | 'join' | 'error' | 'welcome' | 'tutdone';
let screen: Screen | null = null;
function showMenu(to: Screen, opts: { code?: string; msg?: string } = {}) {
  if (screen === 'controls' && to !== 'controls') bindScreen.cancel();
  if (screen === 'fighter' && to !== 'fighter') fighterScreen.close();
  const moved = screen !== to;
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
  if (to === 'fighter') fighterScreen.open();
  if (to === 'error') $('#errorMsg').textContent = opts.msg ?? 'Something went wrong.';
  if (to === 'settings') fillSettings();
  if (to === 'tlobby' || to === 'bracket') for (const h of soundHints()) h.hidden = !!engine.live;
  // On a controller, put the focus on the screen's first button so A does something straight away.
  if (moved && controls.device === 'pad') requestAnimationFrame(() => navigate('up', $('#menu .card'), () => {}));
  $('#sideBoard').hidden = to !== 'main';
  if (to === 'main') {
    showSide();
    showBest();
    if (loadBest() > 0) fetchBoard('all').then((b) => { myPlace = b?.you?.place ?? null; if (screen === 'main') showBest(); });
  }
  if (to === 'board') showBoard('all');
  if (to === 'replays') showReplays();
}
function hideMenu() { showSound(false); if (screen === 'fighter') fighterScreen.close(); screen = null; stage.classList.remove('in-menu'); $('#menu').hidden = true; }

function toMenu(to: Screen = 'main', opts: { msg?: string } = {}) {
  tuner.toggle(false); resetTuning();
  if (mode.kind === 'online' || tourney) net.send({ t: 'cancel' });
  tourney = null; hud.tourney = false; hud.replay = false; $('#replayBar').hidden = true; hud.names = null; hud.ranks = null; hud.rankNote = ''; hud.tutorial = false; showTut(null);
  controls.active = false; controls.clear();
  controls.lockWanted = false; controls.unlock();
  mode = { kind: 'menu', s: newMatch() };
  view.spawnLook = null; dress(myPick(), SUMI_PICK);
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
  const body = JSON.stringify({ seed, inputs, bots, guard: controls.device === 'pad' ? 'pad' : controls.guardStyle, id: myId(), name: myName() });
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
// The title screen's leaderboard panel: Ranked (placed players by rating) or Endless (best runs, all time).
type Side = 'ranked' | 'endless';
const SIDE_KEY = 'papercut.sideBoard';
/** How many places the panel shows (the full Endless list has 100). */
const SIDE_ROWS = 10;
let side: Side = store.get(SIDE_KEY) === 'endless' ? 'endless' : 'ranked';
let sideAsk = 0;
interface RankedReply { top: (RankInfo & { you: boolean })[]; you: (RankInfo & { place: number | null }) | null }
async function fetchRanked(): Promise<RankedReply | null> {
  try {
    const r = await fetch(`${SITE}/api/ranked-board`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId() }) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function showSide(which: Side = side) {
  side = which;
  store.set(SIDE_KEY, which);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-side]')) {
    const on = b.dataset.side === which;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  }
  $('#sideMore').hidden = which !== 'endless';
  const list = $('#sideList'), you = $('#sideYou'), ask = ++sideAsk;
  if (!list.children.length) list.innerHTML = '<li class="muted">Loading…</li>';
  const row = (i: number, name: string, right: string, mine: boolean) =>
    `<li class="${mine ? 'you' : ''}"><span>${i + 1}</span><b>${esc(name)}</b><span>${right}</span></li>`;
  if (which === 'ranked') {
    const b = await fetchRanked();
    if (ask !== sideAsk) return;
    if (!b) { list.innerHTML = '<li class="muted">Not available right now.</li>'; you.textContent = ''; return; }
    list.innerHTML = b.top.length
      ? b.top.slice(0, SIDE_ROWS).map((r, i) => row(i, r.name, `${esc(r.division)} <span class="muted">${r.points}</span>`, r.you)).join('')
      : '<li class="muted">No ranked players yet. Play 5 ranked matches to appear here.</li>';
    you.textContent = !b.you || b.you.place === null
      ? `You: ${b.you ? b.you.division : `Placement 0/5`} · your first 5 ranked matches place you.`
      : `You: #${b.you.place} · ${b.you.division} ${b.you.points}`;
  } else {
    const b = await fetchBoard('all');
    if (ask !== sideAsk) return;
    if (!b) { list.innerHTML = '<li class="muted">Not available right now.</li>'; you.textContent = ''; return; }
    list.innerHTML = b.top.length
      ? b.top.slice(0, SIDE_ROWS).map((r, i) => row(i, r.name, `${r.bots} bot${r.bots === 1 ? '' : 's'} <span class="muted">${clock(r.secs)}</span>`, r.you)).join('')
      : '<li class="muted">No Endless runs yet. Be the first.</li>';
    you.textContent = b.you ? `You: #${b.you.place} with ${b.you.bots} bot${b.you.bots === 1 ? '' : 's'}` : 'You: no run yet. Press Endless to start one.';
  }
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-side]')) b.addEventListener('click', () => showSide(b.dataset.side as Side));
$('#sideMore').addEventListener('click', () => showMenu('board'));

/** The title screen's Endless line: your best run, and your place if you have one. */
function showBest() {
  const b = loadBest();
  $('#bestRun').textContent = b > 0 ? `Your best run: ${b} bot${b === 1 ? '' : 's'}${myPlace ? ` · #${myPlace} on the leaderboard` : ''}` : 'How many bots can you cut?';
}

/** The Dojo Defence bot: the Endless bot's reads at a fixed level. */
const DEFENCE_BOT_LEVEL = 2;
function defenceBot() { const d = new Dummy(); d.level = DEFENCE_BOT_LEVEL; return d; }

function startPractice(endless = false, defence = false) {
  wakeAudio();
  const cfg = endless ? ENDLESS_CFG : defence ? DEFENCE_CFG : DEFAULT_CFG;
  // Practice plays with the numbers kept from the tuning panel; Endless (a scored run) and Dojo Defence never do.
  if (endless || defence) resetTuning(); else applyTuning(loadSaved());
  const seed = newSeed();
  mode = { kind: 'practice', s: newMatch(cfg), dummy: endless ? endlessBot(seed) : defence ? defenceBot() : new Dummy(), endless, defence, tally: new Tally(), seed, inputs: new RunInputs() };
  hud.placeNote = '';
  // Practice is against Sumi; in Endless every bot wears a random look.
  const mine = myPick(), botLook = () => lookOf(pairPicks(mine, randomPick(Math.random))[1], LOOKS[1].name);
  view.spawnLook = endless ? botLook : null;
  dress(mine, SUMI_PICK);
  if (endless) view.fighters[1].setLook(botLook());
  hud.setRules(cfg); hud.best = loadBest();
  begin();
  hud.you = null; hud.online = false; hud.setNames(); view.you = 0;
}

// ---------- the tutorial ----------
// Offered once on the first visit; always on the title screen. Remembered with the other settings (store.ts).
// ---------- replays ----------
interface ReplayRow { n: number; at: number; mode: string; seat: 0 | 1; names: [string, string]; winner: number | null; fight: string }
interface ReplayData { n: number; mode: string; cfg: MatchCfg; start: number; inputs: ReplayInputs; frames: number | null; names: [string, string]; looks: [string, string]; fight: string }
const MODE_NAMES: Record<string, string> = { quick: 'Quick match', room: 'Friend room', tourney: 'Tournament', ranked: 'Ranked' };
const SPEEDS = [0.25, 0.5, 1, 2];
let replayAsk = 0;
/** The Replays screen: your last online fights, newest first, from the server. */
async function showReplays() {
  const ask = ++replayAsk, list = $('#replayList');
  list.innerHTML = '<p class="muted">Loading your fights…</p>';
  let rows: ReplayRow[] | null = null;
  try {
    const r = await fetch(`${SITE}/api/replays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId() }) });
    if (r.ok) rows = (await r.json()).list;
  } catch { /* offline */ }
  if (ask !== replayAsk || screen !== 'replays') return;
  if (!rows) { list.innerHTML = '<p class="muted">Replays are not available right now.</p>'; return; }
  if (!rows.length) { list.innerHTML = '<p class="muted">No replays yet. Your online fights show up here once they end.</p>'; return; }
  list.innerHTML = rows.map((r) => {
    const rival = esc(r.names[1 - r.seat] || 'Ronin');
    const result = r.winner === null ? 'Unfinished' : r.winner === r.seat ? 'Won' : 'Lost';
    const when = new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const old = r.fight !== __FIGHT__;
    return `<button class="mbtn" type="button" data-replay="${r.n}" data-seat="${r.seat}"${old ? ' disabled' : ''}>`
      + `${result} vs ${rival}<small>${MODE_NAMES[r.mode] ?? esc(r.mode)} · ${when}${old ? ' · older rules, can&#39;t play back' : ''}</small></button>`;
  }).join('');
}
$('#replayList').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-replay]');
  if (b && !b.disabled) openReplay(Number(b.dataset.replay), Number(b.dataset.seat) === 1 ? 1 : 0, b);
});
async function openReplay(n: number, seat: 0 | 1, btn: HTMLButtonElement) {
  btn.disabled = true;
  let d: ReplayData | null = null;
  try {
    const r = await fetch(`${SITE}/api/replay?n=${n}`);
    d = r.ok ? ((await r.json()) as ReplayData) : null;
  } catch { /* offline */ }
  if (screen !== 'replays') return;
  if (!d || d.fight !== __FIGHT__) { btn.querySelector('small')!.textContent = d ? 'Older rules, can\'t play back.' : 'Could not load this replay.'; return; }
  startReplay(d, seat);
}
/** Play a saved fight back, seen from your side. */
function startReplay(d: ReplayData, seat: 0 | 1) {
  tuner.toggle(false); resetTuning(); // replays run the game's own numbers, like every online fight
  view.spawnLook = null; dressOnline(d.looks);
  const cfg = cleanCfg(d.cfg);
  mode = { kind: 'replay', rp: new ReplayPlayer(cfg, d.start, d.inputs, d.frames), names: d.names, paused: false, speed: 1 };
  hud.setRules(cfg);
  view.reset(mode.rp.state);
  controls.clear(); controls.active = false; controls.lockWanted = false; controls.unlock();
  acc = 0;
  hideMenu();
  hud.you = seat; hud.online = true; hud.replay = true; hud.names = d.names; hud.setNames(); view.you = seat;
  $('#replayBar').hidden = false;
  showReplayBar();
}
function showReplayBar() {
  if (mode.kind !== 'replay') return;
  $('#rpPause').textContent = mode.paused ? 'Play' : 'Pause';
  $('#rpSpeed').textContent = `Speed ${mode.speed}x`;
}
/** Replay controls: pause, one frame on, back 5 seconds, speed, from the start. */
function replayCmd(c: 'pause' | 'step' | 'back' | 'slower' | 'faster' | 'speed' | 'restart') {
  if (mode.kind !== 'replay') return;
  const m = mode, i = SPEEDS.indexOf(m.speed);
  if (c === 'pause') m.paused = !m.paused;
  else if (c === 'step') { m.paused = true; const ev = m.rp.tick(); if (ev) view.onStep(m.rp.state, ev); }
  else if (c === 'back' || c === 'restart') { m.rp.seek(c === 'restart' ? 0 : m.rp.at - 5 * 60); view.reset(m.rp.state); acc = 0; }
  else if (c === 'slower') m.speed = SPEEDS[Math.max(0, i - 1)];
  else if (c === 'faster') m.speed = SPEEDS[Math.min(SPEEDS.length - 1, i + 1)];
  else m.speed = SPEEDS[(i + 1) % SPEEDS.length];
  showReplayBar();
}
for (const [id, c] of [['rpPause', 'pause'], ['rpStep', 'step'], ['rpBack', 'back'], ['rpSpeed', 'speed'], ['rpRestart', 'restart']] as const) {
  $(`#${id}`).addEventListener('click', () => replayCmd(c));
}
$('#rpList').addEventListener('click', () => toMenu('replays'));
addEventListener('keydown', (e) => {
  if (mode.kind !== 'replay' || screen || e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code === 'Space' ? 'pause' : e.code === 'ArrowRight' || e.code === 'Period' ? 'step' : e.code === 'ArrowLeft' || e.code === 'Comma' ? 'back'
    : e.code === 'ArrowUp' ? 'faster' : e.code === 'ArrowDown' ? 'slower' : null;
  if (!c) return;
  e.preventDefault();
  if (!e.repeat || c === 'step') replayCmd(c);
});
$('#bReplays').addEventListener('click', () => showMenu('replays'));
$('#bReplaysBack').addEventListener('click', () => showMenu('main'));

const TUT_KEY = 'papercut.tutorial';
function tutorialSeen() { return store.get(TUT_KEY) !== null; }
function markTutorial(v: 'offered' | 'done') { if (store.get(TUT_KEY) !== 'done') store.set(TUT_KEY, v); }

function startTutorial() {
  wakeAudio();
  markTutorial('offered');
  tuner.toggle(false); resetTuning(); // the tutorial always teaches the real numbers
  mode = { kind: 'tutorial', s: freshFight(), tut: new Tutorial() };
  view.spawnLook = null; dress(myPick(), SUMI_PICK); // your own look against the real Sumi
  hud.setRules(TUTORIAL_CFG);
  begin();
  hud.you = 0; hud.online = false; hud.tutorial = true; hud.setNames(); view.you = 0;
}

/** The paper prompt: which step, what to do, and progress or a hint. Cheap to call every frame. */
const tutEl = $('#tut');
let tutKey = '';
function showTut(t: Tutorial | null) {
  const id = t?.step ?? null;
  if (!t || !id) { if (tutKey) { tutEl.hidden = true; tutKey = ''; } return; }
  const text: { title: string; line: string; then?: string; hint: string; cheer: string } = STEP_TEXT[id];
  const nice = t.cheer > 0;
  const line = nice ? text.cheer : t.part === 1 && text.then ? text.then : text.line;
  const sub = nice ? '' : t.fails >= HINT_AFTER ? text.hint : t.need ? TUTORIAL_TEXT.progress(t.got, t.need) : '';
  const hint = !nice && t.fails >= HINT_AFTER;
  // The words follow the device in use (controller or mouse), the guard style in Settings, and the player's own bindings.
  const bound = Object.fromEntries((['light', 'heavy', 'feint', 'jump', 'skip', 'left', 'right'] as const).map((a) => [a, keysFor(controls, a)]));
  const names = namesFor(controls.device, controls.guardStyle, bound);
  const key = [id, line, sub, nice, JSON.stringify(names)].join('|');
  if (key === tutKey) return;
  tutKey = key;
  tutEl.hidden = false;
  tutEl.classList.toggle('nice', nice);
  $('#tutStep').textContent = nice ? TUTORIAL_TEXT.nice : `${TUTORIAL_TEXT.stepOf(t.i + 1, STEPS.length)} · ${text.title}`;
  $('#tutLine').innerHTML = fill(line, names);
  const subEl = $('#tutSub');
  subEl.innerHTML = fill(sub, names);
  subEl.classList.toggle('hint', hint);
  $('#tutSkip').innerHTML = names.skip ? fill(TUTORIAL_TEXT.skip, names) : TUTORIAL_TEXT.skipPlain;
}
$('#tutSkip').addEventListener('click', () => command('skip'));

function startOnline(seat: 0 | 1, delay: number, code: string, cfg: MatchCfg, names: [string, string] | null = null, looks?: [string, string]) {
  wakeAudio();
  view.spawnLook = null; dressOnline(looks);
  tuner.toggle(false); resetTuning();
  const lock = new Lockstep(seat, delay, (m) => net.send(m), cfg);
  hud.setRules(cfg);
  mode = { kind: 'online', lock, code };
  begin();
  hud.you = seat; hud.online = true; hud.tourney = !!tourney; hud.names = names; hud.setNames(); view.you = seat;
  if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
}

/** Watch a tournament fight between two other players. */
function startWatching(delay: number, code: string, cfg: MatchCfg, names: [string, string], looks?: [string, string]) {
  view.spawnLook = null; dressOnline(looks);
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
  // Opened with Esc while watching: the fight plays on underneath, one click away.
  $('#bWatch').hidden = mode.kind !== 'watch';
  $('#bWatch').querySelector('small')!.textContent = controls.device === 'pad' ? 'B or Menu also takes you back' : 'Esc also takes you back';
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
$('#bTutorial').addEventListener('click', () => startTutorial());
$('#bWelcomeGo').addEventListener('click', () => startTutorial());
$('#bWelcomeSkip').addEventListener('click', () => showMenu('main'));
$('#bTutPractice').addEventListener('click', () => startPractice());
$('#bTutEndless').addEventListener('click', () => startPractice(true));
$('#bTutMenu').addEventListener('click', () => showMenu('main'));
$('#bEndless').addEventListener('click', () => startPractice(true));
$('#bDefence').addEventListener('click', () => showMenu('defence'));
$('#bDefSolo').addEventListener('click', () => startPractice(false, true));
$('#bDefRoom').addEventListener('click', () => { showMenu('host'); ensureNet(() => net.send({ t: 'host', cfg: DEFENCE_CFG, name: myName(), look: myLook() })); });
$('#bDefBack').addEventListener('click', () => showMenu('main'));
$('#bHowTo').addEventListener('click', () => showMenu('howto'));
const fighterScreen = new FighterScreen($<HTMLCanvasElement>('#fCanvas'), $('#fPicks'), $('#fWho'), $<HTMLInputElement>('#fName'), $('#fNameTag'), view.physics, (p) => { if (mode.kind === 'menu') dress(p, SUMI_PICK); });
$('#bFighter').addEventListener('click', () => showMenu('fighter'));
$('#bFighterDone').addEventListener('click', () => showMenu('main'));
$('#bHowToBack').addEventListener('click', () => showMenu('main'));
$('#bBoard').addEventListener('click', () => showMenu('board'));
$('#bBoardBack').addEventListener('click', () => showMenu('main'));
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-period]')) b.addEventListener('click', () => showBoard(b.dataset.period as Period));
// Controls: remap keys and controller buttons.
const bindScreen = setupControlsScreen(controls);
$('#bControls').addEventListener('click', () => showMenu('controls'));
$('#bindBack').addEventListener('click', () => showMenu('main'));
// Prompts follow the device in use: keyboard and mouse, or controller.
controls.onDevice = () => { renderPrompts(controls); sayHello(); hud.restartKey = restartLabel(controls); if (controls.device === 'pad') controls.unlock(); };
hud.restartKey = restartLabel(controls);
// Menus on a controller: the stick or d-pad moves, A picks, B goes back, Menu leaves a fight.
controls.onNav = (n) => {
  if (!soundBox.hidden && (n === 'back' || n === 'menu')) { showSound(false); return; }
  if (!soundBox.hidden) { navigate(n, soundBox, () => showSound(false)); return; }
  // The tuning panel (Practice): stick moves between sliders, left / right changes one, B or Menu closes it.
  if (tuner.open) { if (n === 'menu') command('menu'); else navigate(n, tuner.el, () => tuner.toggle(false)); return; }
  if (screen) {
    if (n === 'menu') { if (screen !== 'main') command('menu'); return; }
    navigate(n, $('#menu'), () => {
      // B on the bracket never leaves the tournament: it goes back to the fight being watched, or does nothing.
      if (screen === 'bracket') { if (mode.kind === 'watch') hideMenu(); return; }
      const back = [...document.querySelectorAll<HTMLElement>('#menu [data-cancel], #bDefBack, #bHowToBack, #bindBack, #bFighterDone, #bBoardBack, #bReplaysBack, #settingsForm [type=submit], #bWelcomeSkip, #bTutMenu')].find((b) => !b.closest('[hidden]'));
      back?.click();
    });
    return;
  }
  if (n === 'menu') { command('menu'); return; }
  // A replay: the stick moves along its controls, A presses one, B goes back to the list.
  if (mode.kind === 'replay') { navigate(n, $('#replayBar'), () => toMenu('replays')); return; }
  // In a fight, the menu buttons only matter once the match is over (Rematch, Leave). A is jump until then.
  if (mode.kind !== 'menu' && stateOf(mode).phase === 'over') {
    const re = $('#rematch');
    if (n === 'ok' && !re.hidden && !(document.activeElement instanceof HTMLButtonElement)) { re.click(); return; }
    navigate(n, $('#stage'), () => toMenu());
  }
};
// The How to play text follows the guard style (and the device in use).
function showGuardStyle() { renderPrompts(controls); }
/** Tell the server how this player guards (Flick, Cursor, or a controller), so the stats can compare them. */
function sayHello() { net.send({ t: 'hello', guard: controls.device === 'pad' ? 'pad' : controls.guardStyle, id: myId() }); }
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
  if (setupFor === 'room') { showMenu('host'); ensureNet(() => net.send({ t: 'host', cfg, name: myName(), look: myLook() })); }
  else { showMenu('join', { code: 'for your tournament' }); ensureNet(() => net.send({ t: 'tourney', cfg, name: myName(), look: myLook() })); }
});
$('#tName').addEventListener('change', () => {
  const input = $<HTMLInputElement>('#tName');
  input.value = saveName(input.value); // the same name as on the Fighter screen (empty: a Ronin name)
  net.send({ t: 'name', name: input.value });
});
$('#tBegin').addEventListener('click', () => net.send({ t: 'begin' }));
$('#bAgain').addEventListener('click', () => net.send({ t: 'restart' }));
$('#bWatch').addEventListener('click', () => { if (mode.kind === 'watch') hideMenu(); });
$('#tCopy').addEventListener('click', async () => {
  const input = $<HTMLInputElement>('#tLink');
  try { await navigator.clipboard.writeText(input.value); $('#tCopy').textContent = 'Copied'; }
  catch { input.select(); }
  setTimeout(() => { $('#tCopy').textContent = 'Copy link'; }, 1600);
});
$('#bQuick').addEventListener('click', () => { searching(false); ensureNet(() => net.send({ t: 'quick', name: myName(), look: myLook() })); });
$('#bRanked').addEventListener('click', () => { searching(true); ensureNet(() => net.send({ t: 'ranked', name: myName(), look: myLook() })); });
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
  showMenu('join', { code }); ensureNet(() => net.send({ t: 'join', code, name: myName(), look: myLook() }));
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
// Moving the mouse onto a menu button: the same quick flick as the stick and d-pad.
document.addEventListener('mouseover', (e) => {
  const b = (e.target as HTMLElement).closest('.mbtn, .hbtn');
  if (b && !b.contains(e.relatedTarget as Node | null)) sfx.nav();
});
$('#rematch').addEventListener('click', () => command('rematch'));

function command(c: Command) {
  if (c === 'hitboxes') { view.hitboxes.toggle(); return; }
  if (c === 'tune') {
    if (mode.kind !== 'practice' || mode.endless || mode.defence) return;
    tuner.toggle();
    if (tuner.open) { controls.clear(); controls.active = false; controls.lockWanted = false; controls.unlock(); }
    return;
  }
  if (c === 'menu' && tuner.open) { tuner.toggle(false); return; }
  // Watching a tournament fight: Esc shows the bracket over it (and back), never leaves the tournament.
  if (c === 'menu' && mode.kind === 'watch') { if (screen === 'bracket') hideMenu(); else { showMenu('bracket'); renderBracket(); } return; }
  if (c === 'menu' && mode.kind === 'replay') { toMenu('replays'); return; }
  if (mode.kind === 'replay') { if (c === 'restart') replayCmd('restart'); return; }
  if (c === 'menu') { if (mode.kind !== 'menu') toMenu(); else if (screen === 'defence' || screen === 'replays' || screen === 'howto' || screen === 'settings' || screen === 'controls' || screen === 'fighter' || screen === 'welcome' || screen === 'tutdone' || screen === 'board') showMenu('main'); return; }
  if (mode.kind === 'tutorial') {
    if (c === 'skip') mode.tut.skip();
    if (c === 'restart') { mode.s = freshFight(); view.reset(mode.s); }
    return;
  }
  if (c === 'skip') return;
  if (mode.kind === 'practice') {
    if (c === 'restart' || mode.s.phase === 'over') {
      mode.s = newMatch(mode.s.cfg); mode.tally = new Tally(); mode.inputs = new RunInputs(); hud.placeNote = '';
      if (mode.endless) { mode.seed = newSeed(); mode.dummy = endlessBot(mode.seed); } else if (mode.defence) mode.dummy = defenceBot(); else mode.dummy.reset();
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
      startOnline(m.seat, m.delay, m.code, cleanCfg(m.cfg), m.names ? [cleanName(m.names[0], LOOKS[0].name), cleanName(m.names[1], LOOKS[1].name)]
        : m.ranks ? [m.ranks[0].name, m.ranks[1].name] : null, m.looks);
      hud.ranks = m.ranks ?? null; hud.rankNote = ''; hud.setNames();
      break;
    case 'rank': myRank = m.you; showRank(); if (m.you.placed) unlock(forDivision(m.you.division)); break;
    case 'ranked': {
      myRank = m.you; showRank();
      if (m.you.placed) unlock(forDivision(m.you.division));
      const pts = `${m.delta >= 0 ? '+' : ''}${m.delta}`;
      hud.rankNote = `${m.won ? 'Win' : 'Loss'} ${pts}: ${m.you.placed ? `${m.you.division} ${m.you.points}` : m.you.division}.`;
      break;
    }
    case 'in': case 'hash':
      if (mode.kind === 'online') mode.lock.receive(m);
      else if (mode.kind === 'watch') mode.spec.receive(m);
      break;
    case 'lobby':
      if (!tourney) tourney = { code: m.code, bracket: null, fight: null, backAt: 0 };
      if (new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
      if (screen !== 'tlobby') showMenu('tlobby');
      renderLobby(m);
      break;
    case 'bracket':
      if (!tourney) break;
      tourney.bracket = m;
      if (m.champion !== null && m.champion === m.you) unlock(['TOURNEY_WIN']);
      if (mode.kind === 'menu') { if (screen !== 'bracket') showMenu('bracket'); renderBracket(); break; }
      if (screen === 'bracket') renderBracket(); // a watcher looking at the bracket over the fight
      if (tourney.fight && !(m.current && m.current[0] === tourney.fight[0] && m.current[1] === tourney.fight[1])) {
        // The fight on screen is decided. A walkover (someone left) goes straight back; otherwise let the end play out.
        if (m.rounds[tourney.fight[0]][tourney.fight[1]].forfeit) toBracket();
        else if (!tourney.backAt) tourney.backAt = performance.now() + 6000;
      }
      break;
    case 'match':
      if (!tourney) break;
      tourney.fight = tourney.bracket?.current ?? null; tourney.backAt = 0;
      if (m.seat === -1) startWatching(m.delay, m.code, cleanCfg(m.cfg), m.names, m.looks);
      else startOnline(m.seat, m.delay, m.code, cleanCfg(m.cfg), m.names, m.looks);
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

/** Steam rich presence: what friends see you doing (tokens in steam/rich_presence.vdf). Desktop app only. */
let presenceShown = '';
function showPresence(m: Mode, s: State) {
  const steam = desktop?.steam;
  if (!steam) return;
  const [token, vars]: [string, Record<string, string>] =
    m.kind === 'menu' ? [tourney ? '#Tournament' : '#Menu', {}]
    : m.kind === 'tutorial' ? ['#Tutorial', {}]
    : m.kind === 'practice' ? (m.endless ? ['#Endless', { level: String(botLevel(s.f[0].wins)) }] : ['#Practice', {}])
    : m.kind === 'watch' ? ['#Watching', {}]
    : m.kind === 'replay' ? ['#Menu', {}]
    : tourney ? ['#Tournament', {}]
    : hud.ranks ? ['#Ranked', { division: myRank?.placed ? myRank.division : 'Placement' }]
    : ['#Online', {}];
  const key = token + JSON.stringify(vars);
  if (key !== presenceShown) { presenceShown = key; steam.presence(token, vars); }
}

// ---------- the loop ----------
const menuHint = () => controls.device === 'pad' ? 'Menu button for the menu' : 'Esc for the menu';
let last = performance.now(), acc = 0;
const statusEl = $('#status');
let lastStatus = '';
function frame(now: number) {
  requestAnimationFrame(frame);
  if (skipFrame(display.fps, now - last)) return; // frame cap: the time is counted on the next drawn frame
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  const m = mode;
  const seat = seatOf(m);
  controls.pollPad(now);
  if (m.kind === 'practice' && tuner.open) acc = 0; // paused while tuning
  else if (m.kind === 'practice') {
    acc += real;
    while (acc >= STEP) {
      const s = m.s;
      const mine = controls.sample(view.waistY(s, 0), s.f[0].facing);
      // Endless: the bot's level follows your score, and your inputs are kept so the server can re-play the run.
      if (m.endless) m.inputs.add(s.frame, mine);
      const ev = step(s, [mine, m.endless ? botInput(m.dummy, s) : m.dummy.think(s)]);
      const done = m.tally.feed(s, ev);
      // Achievements: never with the tuning panel's numbers changed.
      if (m.endless) unlock([...fromEvents(s, ev, 0, false), ...forEndless(s.f[0].wins)]);
      else if (!isTuned()) unlock(fromEvents(s, ev, 0, false));
      if (m.endless && done) { saveBest(s.f[0].wins); reportRun(m.seed, m.inputs.list, s.f[0].wins); }
      view.onStep(s, ev);
      acc -= STEP;
    }
  } else if (m.kind === 'tutorial') {
    acc += real;
    while (acc >= STEP) {
      const ev = step(m.s, [controls.sample(view.waistY(m.s, 0)), m.tut.think(m.s)]);
      m.tut.after(m.s, ev);
      unlock(fromEvents(m.s, ev, 0, false));
      view.onStep(m.s, ev);
      if (m.tut.resetDue(m.s)) { m.s = freshFight(); view.reset(m.s); }
      acc -= STEP;
    }
  } else if (m.kind === 'online') {
    const lock = m.lock;
    acc += real;
    // A little faster when the rival's inputs pile up (we fell behind), so both stay close in time.
    if (lock.backlog > lock.delay + 3) acc += STEP;
    let n = 0;
    while (acc >= STEP && n < 5) {
      const ev = lock.tick(() => controls.sample(view.waistY(lock.state, seat), lock.state.f[seat].facing));
      if (!ev) { acc = Math.min(acc, STEP); break; }
      unlock(fromEvents(lock.state, ev, seat, true));
      view.onStep(lock.state, ev);
      acc -= STEP; n++;
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
  } else if (m.kind === 'replay') {
    if (m.paused) acc = 0;
    else acc += real * m.speed;
    let n = 0;
    while (acc >= STEP && n < 8) {
      const ev = m.rp.tick();
      if (!ev) { acc = 0; break; }
      view.onStep(m.rp.state, ev);
      acc -= STEP; n++;
    }
  }
  // Back to the bracket a moment after a tournament fight ends.
  if (tourney && tourney.fight && m.kind !== 'menu') {
    if (stateOf(m).phase === 'over' && !tourney.backAt) tourney.backAt = performance.now() + 2500;
    if (tourney.backAt && performance.now() > tourney.backAt) toBracket();
  }
  if (m.kind === 'tutorial' && m.tut.finished) {
    markTutorial('done');
    unlock(['TUTORIAL_DONE']);
    toMenu('tutdone');
    return;
  }
  showTut(m.kind === 'tutorial' ? m.tut : null);
  const s = stateOf(m);
  if (m.kind !== 'menu') {
    hud.update(s, m.kind === 'online' ? seat : m.kind === 'watch' || m.kind === 'replay' ? null : 0);
    // Hold the mouse while fighting; let it go when the match is over so Rematch and Leave can be clicked.
    controls.lockWanted = m.kind !== 'watch' && m.kind !== 'replay' && s.phase !== 'over' && !tuner.open;
    if (!controls.lockWanted) controls.unlock();
  }
  music.set(...musicFor(m, s));
  showPresence(m, s);
  const glint = m.kind === 'practice' ? m.dummy.tell / m.dummy.tellFrames : m.kind === 'tutorial' ? m.tut.tell / m.tut.tellFrames : -1;
  view.draw(s, real, glint >= 0 ? { seat: 1, k: glint } : undefined);
  stage.style.background = view.sky;

  let status = '';
  if (m.kind === 'tutorial') status = `Tutorial · ${menuHint()}`;
  else if (m.kind === 'practice') {
    const tune = keysFor(controls, 'tune')[0];
    status = m.endless ? `Endless · level ${botLevel(m.s.f[0].wins)} · ${menuHint()}`
      : m.defence ? `Dojo Defence · solo against a bot · ${menuHint()}`
      : `Practice: Sumi is a dummy · ${tune ? `${tune} to tune${isTuned() ? ' (tuned numbers)' : ''} · ` : ''}${menuHint()}`;
  }
  else if (m.kind === 'online') {
    const l = m.lock;
    status = l.desynced ? `Out of sync at frame ${l.frame}. Please tell Marz.`
      : l.waiting > 20 ? "Waiting for your rival's connection…"
      : `${tourney ? 'Tournament' : 'Online'} · room ${m.code} · ${rulesLabel(l.state.cfg)} · ${l.delay}-frame delay`;
  } else if (m.kind === 'watch') {
    status = `Watching ${m.names[0]} vs ${m.names[1]} · tournament ${m.code} · ${controls.device === 'pad' ? 'Menu' : 'Esc'} for the bracket`;
  } else if (m.kind === 'replay') {
    const t = (f: number) => clock(Math.floor(f / 60));
    status = `Replay · ${m.names[0]} vs ${m.names[1]} · ${t(m.rp.at)}${m.rp.frames !== null ? ' / ' + t(m.rp.frames) : ''}${m.paused ? ' · paused' : ''}`
      + (controls.device === 'pad' ? ' · B for your replays' : ' · Space pause · → one frame · ← back 5s · ↑↓ speed · Esc for your replays');
  }
  if (m.kind !== 'menu' && controls.lockWanted && !controls.locked && controls.device !== 'pad' && matchMedia('(hover: hover) and (pointer: fine)').matches && !status.startsWith('Out')) {
    status = 'Click the fight to hold the mouse · ' + status;
  }
  if (status !== lastStatus) { statusEl.textContent = status; lastStatus = status; statusEl.classList.toggle('warn', status.startsWith('Out') || status.startsWith('Wait')); }
}

hud.setNames();
dress(myPick(), SUMI_PICK);
view.reset(stateOf(mode));
stage.classList.add('ready');
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) {
  const code = normalizeCode(roomParam);
  showMenu('join', { code });
  ensureNet(() => net.send({ t: 'join', code, name: myName(), look: myLook() }));
} else {
  // First visit: offer the tutorial once.
  if (tutorialSeen()) showMenu('main');
  else { markTutorial('offered'); showMenu('welcome'); }
  net.connect(); // connect early so the server can measure the connection before a fight
}
requestAnimationFrame((t) => { last = t; frame(t); });

// For automated browser tests only.
(window as unknown as { __pc: unknown }).__pc = { get mode() { return mode; }, controls, view, hash: () => hashState(stateOf(mode)) };
