// Runs inside the game page before it loads (a Playwright init script), for the store-art tools only.
// - A fake clock: the game's animation loop only moves when the tool calls __store.tick(seconds),
//   so every frame is captured exactly, however slow the software renderer is.
// - Optional offline audio: the game's sound is rendered into a buffer on the same fake clock.
// - A scripted Kami ("the duelist") to fight the practice bot, so footage is real play, not staged poses.
// Nothing here ships in the game.

(() => {
  const cfg = window.__STORE_CFG || {};
  // Saved settings for a fresh browser: skip the first-visit tutorial offer, plus any the tool asks for (e.g. volumes).
  try {
    localStorage.setItem('papercut.tutorial', 'done');
    for (const [k, v] of Object.entries(cfg.storage || {})) localStorage.setItem(k, v);
  } catch { /* storage blocked: the tool still works, only the menus may differ */ }
  // Seeded Math.random for the drawing (cut angles, camera shake, Endless bot looks), so a re-render matches.
  if (cfg.mathSeed) {
    let ms = cfg.mathSeed;
    Math.random = () => { ms = (ms * 1103515245 + 12345) % 2147483648; return ms / 2147483648; };
  }
  const clock = { t: 0, cbs: [], audio0: 0 };
  window.requestAnimationFrame = (cb) => { clock.cbs.push(cb); return clock.cbs.length; };

  // ---------- offline audio on the fake clock ----------
  let off = null;
  if (cfg.audioSecs) {
    off = new OfflineAudioContext(2, Math.ceil(48000 * cfg.audioSecs), 48000);
    const proxy = new Proxy(off, {
      get(t, k) {
        if (k === 'currentTime') return Math.max(0, clock.t - clock.audio0);
        if (k === 'state') return 'running';
        if (k === 'resume' || k === 'suspend' || k === 'close') return () => Promise.resolve();
        const v = Reflect.get(t, k);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    window.AudioContext = function () { return proxy; };
    window.webkitAudioContext = window.AudioContext;
  }

  // ---------- the duelist: a deterministic scripted player for seat 0 ----------
  // BTN bits, copied from src/sim/sim.ts.
  const B = { left: 1, right: 2, low: 4, light: 8, heavy: 16, feint: 32, jump: 64, dashL: 128, dashR: 256, rematch: 512 };
  let seed = cfg.seed || 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const me = { low: false, cool: 40, planFeint: false, held: 0, queue: [], hold: false };
  function duelist(s) {
    if (me.queue.length) return me.queue.shift() | me.held;
    if (me.hold) return 0;
    let b = 0;
    if (s.phase === 'over') return me.noRematch ? 0 : B.rematch;
    if (s.phase !== 'fight' || s.hitstop > 0) return me.low ? B.low : 0;
    const a = s.f[0], r = s.f[1];
    const dx = Math.abs(r.x - a.x), toward = r.x > a.x ? B.right : B.left, away = r.x > a.x ? B.left : B.right;
    // Guard: read the rival's swing and switch late, which turns some blocks into parries.
    if (r.state === 'wind' && r.t >= (r.atk === 'heavy' ? 11 : 3) && rnd() < 0.5) me.low = r.slash === 'low';
    // Punish a heavy wind-up with a counter cut, sometimes.
    if (a.state === 'guard' && r.state === 'wind' && r.atk === 'heavy' && r.t > 4 && dx < 1.9 && rnd() < 0.04) b |= B.light;
    me.cool--;
    if (!b && a.state === 'guard' && me.cool <= 0) {
      if (dx > 2.0) b |= toward;
      else {
        const roll = rnd();
        if (roll < 0.55) b |= B.light;
        else if (roll < 0.8) { b |= B.heavy; me.planFeint = rnd() < 0.3; }
        else if (roll < 0.9) { b |= B.jump; me.queue.push(0, 0, 0, 0, 0, 0, B.light); }
        else b |= away === B.left ? B.dashL : B.dashR;
        me.low = rnd() < 0.5;
        me.cool = 40 + Math.floor(rnd() * 60);
      }
    } else if (!b && a.state === 'guard' && dx > 2.3) b |= toward;
    else if (!b && a.state === 'guard' && dx < 1.2 && rnd() < 0.3) b |= away;
    if (me.planFeint && a.state === 'wind' && a.atk === 'heavy' && a.t > 8) { me.planFeint = false; b |= B.feint; }
    return b | (me.low ? B.low : 0);
  }

  const events = [];
  window.__store = {
    clock, events, B,
    /** Move the game on by `secs` (one animation frame); the game caps one frame at 0.05 s. */
    tick(secs) { clock.t += secs; const cbs = clock.cbs; clock.cbs = []; for (const cb of cbs) cb(1000 + clock.t * 1000); },
    /** Start recording sound from now. */
    audioStart() { clock.audio0 = clock.t; },
    /** Render the recorded sound and return it as base64 16-bit stereo WAV. */
    async audioWav(secs) {
      const buf = await off.startRendering();
      const n = Math.min(buf.length, Math.ceil(secs * buf.sampleRate)), ch = [buf.getChannelData(0), buf.getChannelData(1)];
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, x) => { for (let i = 0; i < x.length; i++) out.setUint8(o + i, x.charCodeAt(i)); };
      str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
      out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, buf.sampleRate, true);
      out.setUint32(28, buf.sampleRate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
      str(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
      let bin = ''; const u8 = new Uint8Array(out.buffer);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    /** Hand both seats to the tools: Kami to the duelist, Sumi to the practice bot at `level`. Logs every fight event. */
    takeOver(level = 3) {
      const pc = window.__pc, m = pc.mode;
      pc.controls.sample = () => duelist(pc.mode.s);
      if (m.dummy) {
        m.dummy.level = level;
        // The bot normally uses Math.random; a seeded one makes every run play the same fight.
        let bs = (cfg.seed || 7) * 7919 + 1;
        m.dummy.rand = () => { bs = (bs * 1103515245 + 12345) % 2147483648; return bs / 2147483648; };
      }
      const v = pc.view, onStep = v.onStep.bind(v);
      v.onStep = (s, ev) => { for (const e of ev) events.push({ f: s.frame, k: e.k, p: e.p, winner: e.winner, how: e.how, why: s.why, page: s.page, round: s.round, wins: s.f[0].wins }); onStep(s, ev); };
    },
    /**
     * Tool-assisted play (the highlights trailer): put the fight in `start` (a State, as JSON) and play both seats
     * from per-frame button lists `a` (Kami) and `b` (Sumi), indexed by the fight's frame number.
     * With `idle`, both seats only hold their frame-0 buttons (for warming the camera up before the real run).
     */
    script(start, a, b, idle = false) {
      const pc = window.__pc, m = pc.mode;
      const at = (list, f) => (idle ? list[0] & B.low : list[Math.min(f, list.length - 1)] ?? 0);
      pc.controls.sample = () => at(a, m.s.frame);
      m.dummy.think = (s) => at(b, s.frame);
      m.s = JSON.parse(start);
      pc.view.reset(m.s);
    },
    /** Dress both fighters by look code (see src/render/looks.ts: encodePick). */
    async dress(codes) {
      const L = await import('/src/render/looks.ts');
      window.__pc.view.setLooks([L.lookOf(L.decodePick(codes[0]), 'Kami'), L.lookOf(L.decodePick(codes[1], L.SUMI_PICK), 'Sumi')]);
    },
    /** Key art: both fighters stand still; `press` queues Kami's presses (BTN bits, one per frame). */
    hold() { me.queue.length = 0; me.held = 0; me.hold = true; const m = window.__pc.mode; if (m.dummy) m.dummy.think = () => 0; },
    press(...bits) { me.queue.push(...bits); },
    noRematch() { me.noRematch = true; },
    /** Skip drawing (fast-forward) or draw again. */
    drawing(on) {
      const v = window.__pc.view;
      if (!v.__draw) v.__draw = v.draw.bind(v);
      v.draw = on ? v.__draw : () => {};
    },
    /** Point the camera by hand ({fov, pos:[x,y,z], at:[x,y,z]}), or null to give it back to the game. */
    camera(c) {
      const v = window.__pc.view;
      if (!v.__cam) v.__cam = v.updateCamera;
      v.updateCamera = c ? function () { this.camera.fov = c.fov ?? 30; this.camera.updateProjectionMatrix(); this.camera.position.set(...c.pos); this.camera.lookAt(...c.at); } : v.__cam;
    },
    /** Hide the HUD (key art) or only the practice status line and build tag (screenshots). */
    hud(mode) {
      let st = document.getElementById('__storeHud');
      if (!st) { st = document.createElement('style'); st.id = '__storeHud'; document.head.appendChild(st); }
      st.textContent = mode === 'none' ? '.hud,.aim,.build,#status,#labels{display:none!important}'
        : '.build,#status,.aim,.opts{display:none!important}';
    },
    state() { const s = window.__pc.mode.s; return { frame: s.frame, phase: s.phase, page: s.page, round: s.round, f: s.f.map((f) => ({ x: f.x, state: f.state, atk: f.atk, t: f.t, alive: f.alive, hp: f.hp, wins: f.wins })) }; },
  };
})();
