// Everything the game remembers (settings, volume, guard style, your name, the Endless best run).
// In a browser it lives in localStorage. In the desktop app it lives in one JSON file on disk
// (settings.json in the app's data folder), written by the app, so Steam Cloud can sync it later.

/** What the desktop app (desktop/preload.cjs) gives the page. Missing in a browser. */
export interface DesktopBridge {
  /** 'win32', 'linux' or 'darwin'. */
  platform: string;
  /** The rooms server, e.g. https://papercut.marz.gg. */
  server: string;
  /** The saved file's contents, read once at start. */
  load(): Record<string, string>;
  save(data: Record<string, string>): void;
  setFullscreen(on: boolean): void;
  isFullscreen(): boolean;
  /** Called when the window enters or leaves fullscreen (F11, Alt+Enter, the Settings screen). */
  onFullscreen(cb: (on: boolean) => void): void;
  quit(): void;
  /** Steam (desktop/steam.cjs). null when Steam isn't running. */
  steam?: SteamBridge | null;
}

export interface SteamBridge {
  /** Unlock an achievement by its id in src/achievements.ts. */
  unlock(id: string): void;
  /** Rich presence: a token from steam/rich_presence.vdf (e.g. '#Endless') and the values it shows. */
  presence(token: string, vars?: Record<string, string>): void;
}

export const desktop: DesktopBridge | null = (globalThis as { papercutDesktop?: DesktopBridge }).papercutDesktop ?? null;

let data: Record<string, string> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
function disk() {
  if (!data) { try { data = { ...desktop!.load() }; } catch { data = {}; } }
  return data;
}
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (data) try { desktop!.save(data); } catch { /* not saved this time */ }
}
if (desktop && typeof addEventListener === 'function') addEventListener('beforeunload', flush);

export const store = {
  get(key: string): string | null {
    if (desktop) return disk()[key] ?? null;
    try { return localStorage.getItem(key); } catch { return null; } // private window or blocked storage
  },
  set(key: string, value: string) {
    if (desktop) {
      disk()[key] = value;
      // Sliders send many changes a second; write the file once they settle.
      if (!timer) timer = setTimeout(flush, 300);
      return;
    }
    try { localStorage.setItem(key, value); } catch { /* not remembered */ }
  },
};
