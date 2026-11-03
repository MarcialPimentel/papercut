// The balance numbers behind /stats: win rates, how rounds end, what each slash does.
// summarize() turns stored matches and Endless runs into numbers; page() draws them as plain HTML.

import { FPS } from '../src/sim/rules';
import type { AtkTally, SideTally } from '../src/sim/tally';
import { GUARDS } from './referee';
import type { EndlessRow, Filter, MatchRow } from './store';

type Atk = 'light' | 'heavy' | 'riposte';
const ATKS: Atk[] = ['light', 'heavy', 'riposte'];

export interface SlashStats { thrown: number; land: number; block: number; parried: number; whiff: number; clash: number; feint: number }

export interface Stats {
  matches: number;
  rounds: number;
  /** Seat 0 (Kami) match wins / finished matches. */
  kamiWins: number; finished: number;
  /** For each guard style: finished matches against a player using a different style, and how many it won. */
  styles: Record<(typeof GUARDS)[number], { mixed: number; wins: number }>;
  /** How rounds ended, as counts. */
  ends: { ko: number; counterWind: number; counterMiss: number; time: number; double: number };
  avgRoundSecs: number;
  /** Per player per match. */
  perPlayer: { light: number; heavy: number; riposte: number; feint: number; parries: number; blocks: number; jumps: number; dashes: number; counters: number };
  clashesPerMatch: number;
  slashes: Record<Atk, SlashStats>;
  staggers: number; staggerFollow: number;
  modes: Record<string, number>;
  endless: {
    runs: number; avgBots: number; medianBots: number; best: number;
    ends: { ko: number; counterWind: number; counterMiss: number; time: number };
    buckets: [string, number][];
    heavy: SlashStats;
  };
}

const slash = (): SlashStats => ({ thrown: 0, land: 0, block: 0, parried: 0, whiff: 0, clash: 0, feint: 0 });
function addSlash(to: SlashStats, a: AtkTally) {
  to.thrown += a.n; to.land += a.land; to.block += a.block; to.parried += a.parried; to.whiff += a.whiff; to.clash += a.clash; to.feint += a.feint;
}

export function summarize(matches: readonly MatchRow[], runs: readonly EndlessRow[]): Stats {
  const st: Stats = {
    matches: matches.length, rounds: 0, kamiWins: 0, finished: 0, styles: { flick: { mixed: 0, wins: 0 }, cursor: { mixed: 0, wins: 0 }, pad: { mixed: 0, wins: 0 } },
    ends: { ko: 0, counterWind: 0, counterMiss: 0, time: 0, double: 0 }, avgRoundSecs: 0,
    perPlayer: { light: 0, heavy: 0, riposte: 0, feint: 0, parries: 0, blocks: 0, jumps: 0, dashes: 0, counters: 0 },
    clashesPerMatch: 0, slashes: { light: slash(), heavy: slash(), riposte: slash() }, staggers: 0, staggerFollow: 0, modes: {},
    endless: { runs: runs.length, avgBots: 0, medianBots: 0, best: 0, ends: { ko: 0, counterWind: 0, counterMiss: 0, time: 0 }, buckets: [], heavy: slash() },
  };
  let frames = 0, clashes = 0;
  for (const m of matches) {
    st.modes[m.mode] = (st.modes[m.mode] ?? 0) + 1;
    if (m.winner === 0 || m.winner === 1) {
      st.finished++;
      if (m.winner === 0) st.kamiWins++;
      const [g0, g1] = m.guard;
      if (g0 && g1 && g0 !== g1) for (const [i, g] of [g0, g1].entries()) { st.styles[g].mixed++; if (m.winner === i) st.styles[g].wins++; }
    }
    for (const r of m.tally.rounds) {
      st.rounds++; frames += r.frames;
      if (r.how === 'Counter cut') { if (r.why === 'miss') st.ends.counterMiss++; else st.ends.counterWind++; }
      else if (r.how === 'Time') st.ends.time++;
      else if (r.how === 'Double K.O.') st.ends.double++;
      else st.ends.ko++;
    }
    clashes += m.tally.clashes;
    for (const s of m.tally.sides) addSide(st, s);
  }
  const players = matches.length * 2 || 1;
  for (const k of Object.keys(st.perPlayer) as (keyof Stats['perPlayer'])[]) st.perPlayer[k] /= players;
  st.clashesPerMatch = clashes / (matches.length || 1);
  st.avgRoundSecs = st.rounds ? frames / st.rounds / FPS : 0;

  const bots = runs.map((r) => r.bots).sort((a, b) => a - b);
  const E = st.endless;
  if (bots.length) {
    E.avgBots = bots.reduce((a, b) => a + b, 0) / bots.length;
    E.medianBots = bots[Math.floor(bots.length / 2)];
    E.best = bots[bots.length - 1];
  }
  for (const r of runs) {
    if (r.how === 'Counter cut') { if (r.why === 'miss') E.ends.counterMiss++; else E.ends.counterWind++; }
    else if (r.how === 'Time') E.ends.time++;
    else E.ends.ko++;
    addSlash(E.heavy, r.tally.sides[0].heavy);
  }
  const edges = [0, 5, 10, 15, 20, 30];
  E.buckets = edges.map((lo, i) => {
    const hi = edges[i + 1];
    return [hi ? `${lo}–${hi - 1}` : `${lo}+`, bots.filter((b) => b >= lo && (!hi || b < hi)).length];
  });
  return st;
}

function addSide(st: Stats, s: SideTally) {
  const p = st.perPlayer;
  p.light += s.light.n; p.heavy += s.heavy.n; p.riposte += s.riposte.n; p.feint += s.heavy.feint;
  p.parries += s.parries; p.blocks += s.blocks; p.jumps += s.jumps; p.dashes += s.dashes; p.counters += s.counterWind + s.counterMiss;
  for (const a of ATKS) addSlash(st.slashes[a], s[a]);
  st.staggers += s.staggers; st.staggerFollow += s.staggerFollow;
}

// ---- The page ----

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const num = (n: number) => (Math.round(n * 10) / 10).toString();

function row(label: string, value: string, note = '') {
  return `<tr><th>${label}</th><td>${value}</td><td class="note">${note}</td></tr>`;
}

function slashTable(rows: [string, SlashStats][]) {
  const head = '<tr><th></th><th>Thrown</th><th>Landed</th><th>Blocked</th><th>Parried</th><th>Missed</th><th>Clashed</th><th>Feinted</th></tr>';
  const body = rows.map(([name, s]) => {
    const d = s.thrown;
    return `<tr><th>${name}</th><td>${s.thrown}</td><td>${pct(s.land, d)}</td><td>${pct(s.block, d)}</td><td>${pct(s.parried, d)}</td><td>${pct(s.whiff, d)}</td><td>${pct(s.clash, d)}</td><td>${name === 'Heavy' ? pct(s.feint, d) : ''}</td></tr>`;
  }).join('');
  return `<table class="grid">${head}${body}</table>`;
}

function select(name: string, value: string, opts: [string, string][]) {
  return `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}

export function page(st: Stats, f: Filter, builds: string[], live: string): string {
  const e = st.ends, r = st.rounds, E = st.endless, P = st.perPlayer;
  const buildOpts: [string, string][] = [['', 'All builds'], ...builds.map((b): [string, string] => [b, b === live ? `${b} (live)` : b])];
  const endsRows = [
    row('K.O.', pct(e.ko, r), `${e.ko} rounds`),
    row('Counter cut on a heavy wind-up', pct(e.counterWind, r), `${e.counterWind}`),
    row('Counter cut after a miss', pct(e.counterMiss, r), `${e.counterMiss}`),
    row('Time ran out', pct(e.time, r), `${e.time}`),
    row('Double K.O.', pct(e.double, r), `${e.double}`),
  ].join('');
  const modes = Object.entries(st.modes).map(([m, n]) => `${n} ${m === 'quick' ? 'quick match' : m === 'room' ? 'invite room' : 'tournament'}`).join(', ') || 'none yet';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Papercut stats</title>
<style>
:root{--bg:#f4efe4;--card:#fffdf7;--ink:#1d1b2e;--soft:#6b6680;--line:#d9d1bf;--red:#c8323c}
@media (prefers-color-scheme:dark){:root{--bg:#16151f;--card:#211f2c;--ink:#efe9dc;--soft:#a39db3;--line:#3a3648;--red:#e5545d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}h1{margin:0 0 4px;font-size:26px}h1 span{color:var(--red)}
h2{font-size:17px;margin:28px 0 8px;border-bottom:2px solid var(--ink);padding-bottom:4px}
.sub{color:var(--soft);margin:0 0 16px}form{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
select{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)}
.big{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.big div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.big b{display:block;font-size:24px}.big small{color:var(--soft)}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px}
th,td{padding:6px 10px;text-align:left;border-top:1px solid var(--line)}tr:first-child th,tr:first-child td{border-top:0}
td{font-variant-numeric:tabular-nums}.note{color:var(--soft)}.grid td,.grid th{text-align:right}.grid th:first-child{text-align:left}
.wrap{overflow-x:auto}a{color:var(--red)}p.hint{color:var(--soft);font-size:13px}
</style></head><body><main>
<h1>Papercut <span>stats</span></h1>
<p class="sub">Every finished online match and Endless run, re-played and counted by the server. No personal data.</p>
<form method="get">
${select('build', f.build, buildOpts)}
${select('rules', f.rules, [['standard', 'Standard rules'], ['custom', 'Custom rules'], ['all', 'All rules']])}
${select('guard', f.guard, [['any', 'Any guard style'], ['flick', 'Both on Flick guard'], ['cursor', 'Both on Cursor guard'], ['pad', 'Both on a controller']])}
<noscript><button>Show</button></noscript>
</form>
<script>document.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>s.form.submit()))</script>

<h2>Online matches</h2>
<div class="big">
<div><b>${st.matches}</b><small>matches (${esc(modes)})</small></div>
<div><b>${r}</b><small>rounds</small></div>
<div><b>${num(st.avgRoundSecs)} s</b><small>average round</small></div>
<div><b>${pct(st.kamiWins, st.finished)}</b><small>matches won by Kami (left side)</small></div>
</div>

<h2>How rounds end</h2>
<table>${endsRows}</table>

<h2>What each slash does</h2>
<div class="wrap">${slashTable([['Light', st.slashes.light], ['Heavy', st.slashes.heavy], ['Riposte', st.slashes.riposte]])}</div>
<p class="hint">Counter cuts are counted on their own, not as "landed". A clash counts for both slashes.</p>
<table>
${row('Blocked heavy, then a cut lands', pct(st.staggerFollow, st.staggers), `${st.staggerFollow} of ${st.staggers} staggers`)}
${row('Flick guard wins against other styles', pct(st.styles.flick.wins, st.styles.flick.mixed), `${st.styles.flick.mixed} matches`)}
${row('Cursor guard wins against other styles', pct(st.styles.cursor.wins, st.styles.cursor.mixed), `${st.styles.cursor.mixed} matches`)}
${row('Controller wins against the mouse', pct(st.styles.pad.wins, st.styles.pad.mixed), `${st.styles.pad.mixed} matches`)}
</table>

<h2>Per player, per match</h2>
<table>
${row('Lights', num(P.light))}${row('Heavies', num(P.heavy))}${row('Ripostes', num(P.riposte))}${row('Feints', num(P.feint))}
${row('Parries', num(P.parries))}${row('Blocks', num(P.blocks))}${row('Counter cuts', num(P.counters))}
${row('Jumps', num(P.jumps))}${row('Dashes', num(P.dashes))}${row('Clashes (per match)', num(st.clashesPerMatch))}
</table>

<h2>Endless</h2>
<div class="big">
<div><b>${E.runs}</b><small>runs</small></div>
<div><b>${num(E.avgBots)}</b><small>bots per run (average)</small></div>
<div><b>${E.medianBots}</b><small>bots per run (median)</small></div>
<div><b>${E.best}</b><small>best run</small></div>
</div>
<table>
${row('Ended by a K.O.', pct(E.ends.ko, E.runs))}
${row('Ended by a counter cut on a heavy wind-up', pct(E.ends.counterWind, E.runs))}
${row('Ended by a counter cut after a miss', pct(E.ends.counterMiss, E.runs))}
${row('Ended when time ran out', pct(E.ends.time, E.runs))}
${row("Player's heavies that land", pct(E.heavy.land, E.heavy.thrown), `${E.heavy.thrown} thrown`)}
</table>
<h2>Bots reached</h2>
<table class="grid"><tr>${E.buckets.map(([l]) => `<th>${l}</th>`).join('')}</tr><tr>${E.buckets.map(([, n]) => `<td>${pct(n, E.runs)}</td>`).join('')}</tr></table>
<p class="hint">Endless numbers are as the browser reports them for now; the leaderboard build has the server re-play each run. Raw numbers: <a href="/api/stats${esc(query(f))}">/api/stats</a>. Live build ${esc(live)}.</p>
</main></body></html>`;
}

export function query(f: Filter) {
  const q = new URLSearchParams();
  if (f.build) q.set('build', f.build);
  if (f.rules !== 'standard') q.set('rules', f.rules);
  if (f.guard !== 'any') q.set('guard', f.guard);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Read the page's filters from a URL; anything unknown falls back to the default. */
export function readFilter(url: URL): Filter {
  const b = url.searchParams.get('build') ?? '';
  const rules = url.searchParams.get('rules');
  const guard = url.searchParams.get('guard');
  return {
    build: /^[0-9a-z]{1,12}$/.test(b) ? b : '',
    rules: rules === 'custom' || rules === 'all' ? rules : 'standard',
    guard: guard === 'flick' || guard === 'cursor' || guard === 'pad' ? guard : 'any',
  };
}
