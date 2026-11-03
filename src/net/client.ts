// The connection to the rooms server. Reconnects by itself while the player is in the menus.

import { desktop } from '../store';
import type { ToClient, ToServer } from './protocol';

/** The rooms server: this site in a browser, the live site from the desktop app. */
function serverUrl() {
  const base = new URL(desktop ? desktop.server : location.href);
  // The fight version lets the server pair only players running the same rules.
  return `${base.protocol === 'https:' ? 'wss' : 'ws'}://${base.host}/ws?v=${__FIGHT__}`;
}

export class Net {
  private ws: WebSocket | null = null;
  private retry = 0;
  private timer = 0;
  onMessage: (m: ToClient) => void = () => {};
  onStatus: (open: boolean) => void = () => {};

  get open() { return this.ws?.readyState === WebSocket.OPEN; }

  connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.timer);
    const ws = new WebSocket(serverUrl());
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.onStatus(true); };
    ws.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)); } catch { /* ignore bad data */ } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onStatus(false);
      this.retry = Math.min(this.retry + 1, 5);
      this.timer = window.setTimeout(() => this.connect(), 500 * 2 ** this.retry);
    };
  }

  send(m: ToServer) { if (this.open) this.ws!.send(JSON.stringify(m)); }
}
