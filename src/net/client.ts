// The connection to the rooms server. Reconnects by itself while the player is in the menus.

import type { ToClient, ToServer } from './protocol';

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
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
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
