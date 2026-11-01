// Papercut's server: serves the built game and runs the rooms that pair players online.
// One process, no database. Health check: GET /api/health.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { Lobby, type Peer } from './lobby';
import type { ToServer } from '../src/net/protocol';

const PORT = Number(process.env.PORT || 8790);
const BUILD = (process.env.BUILD_SHA || 'dev').slice(0, 7);
const CAPACITY = Number(process.env.CAPACITY || 200);
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const lobby = new Lobby();
const started = Date.now();

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
    res.end(JSON.stringify({ ok: true, build: BUILD, uptime: Math.round((Date.now() - started) / 1000), ...lobby.stats }));
    return;
  }
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

wss.on('connection', (ws: WebSocket) => {
  const peer: Peer & { pingAt: number; alive: boolean; budget: number } = {
    send: (m) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); },
    pingAt: 0, alive: true, budget: 400,
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

server.listen(PORT, () => console.log(`Papercut build ${BUILD} on port ${PORT}`));

const stop = () => { wss.clients.forEach((c) => c.close(1001, 'restarting')); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
