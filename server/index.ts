// Papercut's server: serves the built game, runs the rooms that pair players online, and keeps
// the balance stats (/stats). Stats go to Papercut's database when DATABASE_URL is set (the hub),
// otherwise to memory. Health check: GET /api/health.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { readClaim, verifyRun } from './endless';
import { fightVersion } from './fightVersion';
import { Lobby, type Peer } from './lobby';
import { page, readFilter, summarize } from './stats';
import { Ranked, playerId, rankInfo, tokenOk } from './ranked';
import { cleanName } from './tourney';
import { BOARD_SIZE, PERIODS, openStore, type Period } from './store';
import type { ToServer } from '../src/net/protocol';

const PORT = Number(process.env.PORT || 8790);
const BUILD = (process.env.BUILD_SHA || 'dev').slice(0, 7);
const CAPACITY = Number(process.env.CAPACITY || 200);
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
/** The fight rules this server pairs players for: the same fingerprint the game is built with. */
const FIGHT = fightVersion(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'sim'));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};

const store = await openStore();
const saveError = (what: string) => (e: Error) => console.error(`Could not save ${what}:`, e.message);
// Ranked ratings need the database to last; on your own PC they're kept in memory like the stats.
const ranked = new Ranked(store);
const lobby = new Lobby(Math.random, setTimeout, FIGHT, (r) => { store.addMatch(BUILD, r).catch(saveError('a match')); }, ranked);
setInterval(() => lobby.tick(), 1000).unref();
const started = Date.now();
// Inputs older than 90 days are dropped once a day (and once at start).
const prune = () => store.prune().catch(saveError('the input clean-up'));
prune();
setInterval(prune, 86400e3).unref();

/** Endless reports per address per minute, so nobody can flood the stats. */
const REPORTS_PER_MIN = 20;
const reports = new Map<string, number>();
setInterval(() => reports.clear(), 60e3).unref();

function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((done) => {
    let size = 0; const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > limit) { done(null); req.destroy(); } else parts.push(c); });
    req.on('end', () => done(Buffer.concat(parts).toString('utf8')));
    req.on('error', () => done(null));
  });
}

function tooMany(req: IncomingMessage) {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  const n = (reports.get(ip) ?? 0) + 1;
  reports.set(ip, n);
  return n > REPORTS_PER_MIN;
}

const json = (res: ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const body = await readBody(req, limit);
  try { return body ? JSON.parse(body) : null; } catch { return null; }
}

/** The places a player holds on the three leaderboards. */
async function placesOf(pid: string) {
  const out: Partial<Record<Period, number>> = {};
  for (const p of PERIODS) { const pl = await store.place(pid, p); if (pl) out[p] = pl.place; }
  return out;
}

/**
 * A finished Endless run: the server re-plays it from its seed and inputs and keeps only the score
 * the re-play reaches. With the player's token it also goes on the leaderboard.
 */
async function endlessReport(req: IncomingMessage, res: ServerResponse) {
  if (tooMany(req)) return json(res, 429, { error: 'Too many runs at once. Try again in a minute.' });
  const claim = readClaim(await readJson(req, 4 * 1024 * 1024));
  if (typeof claim === 'string') return json(res, 400, { error: claim });
  const checked = await verifyRun(claim);
  if (typeof checked === 'string') return json(res, 400, { error: checked });
  const pid = tokenOk(claim.token) ? playerId(claim.token) : undefined;
  if (pid) {
    // If the player can't be loaded, keep the run but leave their name alone (never save over a row we couldn't read).
    const p = await ranked.load(pid).catch(() => null);
    if (p) {
      p.name = cleanName(claim.name, p.name);
      await store.savePlayer(p).catch(saveError('a player'));
    }
  }
  await store.addEndless(BUILD, { ...checked.run, player: pid }).catch(saveError('an Endless run'));
  json(res, 200, { ok: true, bots: checked.run.bots, places: pid ? await placesOf(pid).catch(() => ({})) : {} });
}

/** The leaderboard. GET: the top list. POST with the player's token: the top list marked with them, and their place. */
async function leaderboard(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  const body = (req.method === 'POST' ? await readJson(req, 4096) : null) as Record<string, unknown> | null;
  const asked = body?.period ?? url.searchParams.get('period');
  const period: Period = PERIODS.includes(asked as Period) ? (asked as Period) : 'all';
  const pid = body && tokenOk(body.id) ? playerId(body.id) : undefined;
  const top = await store.board(period, BOARD_SIZE);
  const you = pid ? await store.place(pid, period) : null;
  json(res, 200, {
    period,
    top: top.map((r) => ({ name: r.name || 'Ronin', bots: r.bots, secs: Math.round(r.frames / 60), you: r.player === pid })),
    you,
  });
}

/** The ranked list: placed players by rating. POST with the player's token also gives their place. */
async function rankedBoard(req: IncomingMessage, res: ServerResponse) {
  const body = (req.method === 'POST' ? await readJson(req, 4096) : null) as Record<string, unknown> | null;
  const pid = body && tokenOk(body.id) ? playerId(body.id) : undefined;
  const top = await store.rankedTop(BOARD_SIZE);
  const me = pid ? await store.player(pid) : null;
  json(res, 200, {
    top: top.map((p) => ({ ...rankInfo(p), you: p.id === pid })),
    you: me ? { ...rankInfo(me), place: await store.rankedPlace(me.id) } : null,
  });
}

async function statsPage(req: IncomingMessage, res: ServerResponse, json: boolean) {
  const f = readFilter(new URL(req.url || '/', 'http://x'));
  try {
    const [m, e, builds] = await Promise.all([store.matches(f), store.endless(f), store.builds()]);
    const st = summarize(m, e);
    res.writeHead(200, { 'Content-Type': json ? 'application/json' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(json ? JSON.stringify({ filter: f, build: BUILD, ...st }) : page(st, f, builds, BUILD));
  } catch (err) {
    console.error('Stats page failed:', (err as Error).message);
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('The stats are not available right now.');
  }
}

async function serveFile(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(DIST, path);
  if (!file.startsWith(DIST)) { res.writeHead(400).end(); return; }
  try {
    if (!path || (await stat(file)).isDirectory()) throw new Error('dir');
  } catch {
    file = join(DIST, 'index.html'); path = 'index.html';
  }
  try {
    const body = await readFile(file);
    // Built files have a content hash in their name, so they can be cached forever; the page itself never.
    const cache = path.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not built yet: run npm run build.');
  }
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, build: BUILD, fight: FIGHT, uptime: Math.round((Date.now() - started) / 1000), stats: store.kind, ...lobby.stats }));
    return;
  }
  const path = (req.url || '/').split('?')[0];
  if (path.startsWith('/api/')) {
    // The desktop app's page isn't served from this site, so it needs permission to call the API.
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }).end();
      return;
    }
  }
  if (path === '/api/endless' && req.method === 'POST') { endlessReport(req, res).catch(() => json(res, 500, { error: 'server error' })); return; }
  if (path === '/api/ranked-board' && (req.method === 'GET' || req.method === 'POST')) { rankedBoard(req, res).catch(() => json(res, 503, { error: 'not available' })); return; }
  if (path === '/api/leaderboard' && (req.method === 'GET' || req.method === 'POST')) { leaderboard(req, res).catch(() => json(res, 503, { error: 'not available' })); return; }
  if ((path === '/stats' || path === '/api/stats') && req.method === 'GET') { statsPage(req, res, path === '/api/stats').catch(() => res.writeHead(500).end()); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveFile(req, res).catch(() => res.writeHead(500).end());
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 512 });
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin || '';
  if (!req.url?.startsWith('/ws') || (ALLOWED.length && !ALLOWED.includes(origin)) || wss.clients.size >= CAPACITY) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const peer: Peer & { pingAt: number; alive: boolean; budget: number } = {
    send: (m) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); },
    pingAt: 0, alive: true, budget: 400,
    v: new URL(req.url || '/', 'http://x').searchParams.get('v') ?? undefined, // the game's fight version
  };
  const ping = () => { peer.pingAt = Date.now(); ws.ping(); };
  ws.on('pong', () => {
    const rtt = Date.now() - peer.pingAt;
    peer.rtt = peer.rtt === undefined ? rtt : Math.round(peer.rtt * 0.7 + rtt * 0.3);
    peer.alive = true;
    if (held) { clearTimeout(holdTimer); release(); }
  });
  // Until the first round trip is measured (or 600 ms pass), hold requests to pair up,
  // so the input delay for the fight is based on a real measurement.
  let held: ToServer[] | null = [];
  const release = () => { const q = held; held = null; q?.forEach((m) => lobby.message(peer, m)); };
  const holdTimer = setTimeout(release, 600);
  ws.on('message', (data) => {
    // About 2 messages per frame is plenty; anything far beyond that is dropped.
    if (--peer.budget < 0) return;
    let m: ToServer;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (held) held.push(m); else lobby.message(peer, m);
  });
  ws.on('close', () => lobby.close(peer));
  ws.on('error', () => lobby.close(peer));
  const refill = setInterval(() => { peer.budget = 400; }, 1000);
  const beat = setInterval(() => {
    if (!peer.alive) { ws.terminate(); return; }
    peer.alive = false; ping();
  }, 5000);
  ws.on('close', () => { clearInterval(refill); clearInterval(beat); });
  ping();
  setTimeout(ping, 300);
});

server.listen(PORT, () => console.log(`Papercut build ${BUILD} (fight ${FIGHT}) on port ${PORT}`));

// A deploy stops the server: unfinished ranked matches are called off (no one loses rating for it),
// and rating saves already under way get up to 3 seconds to finish.
const stop = () => {
  lobby.shutdown();
  wss.clients.forEach((c) => c.close(1001, 'restarting'));
  setTimeout(() => process.exit(0), 3000).unref();
  ranked.flush().then(() => server.close(() => process.exit(0)));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
