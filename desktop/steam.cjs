// Steamworks (#31) through steamworks.js: achievements, Steam Cloud, the overlay and rich presence.
// Everything here is optional. If Steam isn't running (or steamworks.js can't load), start() returns null
// and the game runs exactly as before.

/** Papercut's Steam app ID. 480 is Valve's public test app (Spacewar) until Papercut's own app exists:
 *  swap in the real number here, and that is the only change needed. */
const APP_ID = 480;
const TEST_APP = APP_ID === 480;

/** While testing on Spacewar, a few of our achievements unlock one of Spacewar's instead, so the
 *  pop-up can be seen. The rest do nothing until the real app has them. */
const SPACEWAR = {
  TUTORIAL_DONE: 'ACH_WIN_ONE_GAME',
  PARRY: 'ACH_TRAVEL_FAR_ACCUM',
  ONLINE_WIN: 'ACH_WIN_100_GAMES',
  ENDLESS_10: 'ACH_TRAVEL_FAR_SINGLE',
};

/** Connect to Steam. Returns null when the game runs without it. PAPERCUT_STEAM=0 turns it off. */
function start() {
  if (process.env.PAPERCUT_STEAM === '0') return null;
  let sw, client;
  try {
    sw = require('steamworks.js');
    client = sw.init(APP_ID);
  } catch (err) {
    console.log('Running without Steam:', err && err.message ? err.message : err);
    return null;
  }
  // The overlay (Shift+Tab) needs Chromium to draw in a way Steam can paint over. Must run before the app is ready.
  try { sw.electronEnableSteamOverlay(); } catch (err) { console.log('No Steam overlay:', err); }
  // PAPERCUT_STEAM_RESET=1 on the test app clears its achievements, so the pop-ups can be seen again.
  if (TEST_APP && process.env.PAPERCUT_STEAM_RESET === '1') {
    try { client.stats.resetAll(true); client.stats.store(); } catch { /* not this time */ }
  }

  const done = new Set();
  let shown = '';
  return {
    appId: APP_ID,
    /** Unlock one achievement (by its id in src/achievements.ts). Repeats are ignored. */
    unlock(id) {
      if (typeof id !== 'string' || done.has(id)) return;
      done.add(id);
      const name = TEST_APP ? SPACEWAR[id] : id;
      if (!name) return;
      try { client.achievement.activate(name); } catch (err) { console.log('Achievement not set:', id, err); }
    },
    /** What friends see in their Steam friends list, e.g. token '#Endless' with { level: '12' }. */
    presence(token, vars) {
      const key = JSON.stringify([token, vars]);
      if (key === shown) return;
      shown = key;
      try {
        for (const [k, v] of Object.entries(vars || {})) client.localplayer.setRichPresence(String(k), String(v));
        client.localplayer.setRichPresence('steam_display', token ? String(token) : null);
      } catch { /* friends just don't see it */ }
    },
    /** Steam Cloud, when the player and the app both have it on. */
    cloud: {
      enabled() { try { return client.cloud.isEnabledForAccount() && client.cloud.isEnabledForApp(); } catch { return false; } },
      read(name) { try { return client.cloud.fileExists(name) ? client.cloud.readFile(name) : null; } catch { return null; } },
      write(name, text) { try { return client.cloud.writeFile(name, text); } catch { return false; } },
    },
  };
}

module.exports = { APP_ID, start };
