// Steam Cloud (#31): which saved values follow you between PCs, and how they are merged at start.
// Display settings (window, resolution, frame cap, vsync) stay on each machine, because a Steam Deck and a
// desktop want different ones. So do the tuning panel's numbers and which leaderboard tab was open.

/** The file Steam Cloud keeps for Papercut. */
const CLOUD_FILE = 'progress.json';

/** Saved keys that travel with your Steam account. */
const CLOUD_KEYS = [
  'papercut.name', // tournament name
  'papercut.id', // your ranked identity, so your rating follows you
  'papercut.endlessBest',
  'papercut.look', // your fighter's colours, outfit and sword
  'papercut.bindings',
  'papercut.guard',
  'papercut.volume',
  'papercut.tutorial',
];

/** Only the values Steam Cloud carries. */
function pick(data) {
  const out = {};
  for (const k of CLOUD_KEYS) if (typeof data[k] === 'string') out[k] = data[k];
  return out;
}

/** This PC's saved values with the cloud's copy laid over them. The cloud wins (it holds the latest
 *  values from whichever PC played last), except that the best Endless run is the higher of the two
 *  and a finished tutorial stays finished. */
function merge(local, cloud) {
  const out = { ...local };
  if (!cloud || typeof cloud !== 'object') return out;
  for (const k of CLOUD_KEYS) {
    const v = cloud[k];
    if (typeof v !== 'string') continue;
    if (k === 'papercut.endlessBest') out[k] = String(Math.max(Number(v) || 0, Number(local[k]) || 0));
    else if (k === 'papercut.tutorial' && local[k] === 'done') out[k] = 'done';
    else out[k] = v;
  }
  return out;
}

module.exports = { CLOUD_FILE, CLOUD_KEYS, pick, merge };
