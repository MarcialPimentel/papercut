// Plays a whole practice match (Kami = the scripted duelist, Sumi = the practice bot) without drawing,
// and prints every fight event with its frame, to pick moments for screenshots and the trailer.
// node tools/store/scout.mjs [seed] [level]
import { launch, openGame, startServer, fastForward, state } from './lib.mjs';
const seed = +(process.argv[2] || 7), level = +(process.argv[3] || 3);
const { server, url } = await startServer();
const browser = await launch();
const page = await openGame(browser, url, { w: 480, h: 270, seed, level });
await fastForward(page, (s) => s.phase === 'over', 60 * 900);
const ev = await page.evaluate(() => window.__store.events);
const s = await state(page);
console.log(JSON.stringify({ seed, level, end: s, events: ev.filter((e) => !['swing', 'jump', 'dash', 'land'].includes(e.k)) }));
await browser.close(); await server.close();
