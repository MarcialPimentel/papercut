# Papercut — notes for AI working sessions

Papercut is a simple 3D sword-duel game in a papercraft style, where hits cut and tear paper fighters. It is also Marz's test bed for 3D models, rigging and game feel (TypeScript + Three.js + Rapier, desktop browser, Blender for assets).

## Before building anything

- **`docs/GDD.md` is the source of truth.** Read the relevant sections before any design or code decision, and check every change against its **design pillars**. If a change conflicts with the GDD, raise it rather than silently diverging. Record each design decision in the GDD's Decision Log in the same PR.

## How Marz works

- Marz (the owner) designs and playtests; he does not write code. Claude writes all code, tests and docs.
- Act as a veteran game developer and designer: give honest critique, push back when an idea weakens a pillar, recommend an option, and let Marz make the final call.

## Workflow

- Outline → branch → build → test → PR with plain-language playtest steps → Marz says "merge #N" → merge only that PR.
- Never push to `main` directly.
- Any manual step for Marz (e.g. exporting from Blender, GitHub settings) gets click-by-click instructions in `docs/`.

## Commands

- `npm install`, then `npm run dev` (game on http://localhost:5173 plus the rooms server on 8790), `npm test`, `npm run typecheck`, `npm run build`, `npm start` (serves `dist/` and the rooms on 8790).
- The fight lives in `src/sim/` and must stay deterministic: only + - * / and comparisons, no `Math.random`, no trig, no wall-clock time. Online play depends on both browsers computing the same fight from the same inputs (`tests/sim.test.ts` and `tests/online.test.ts` check it).
- The rooms server re-plays every online fight from the inputs it relays (`server/referee.ts`) and records the stats shown at `/stats`: in Papercut's database on the hub's Postgres when `DATABASE_URL` is set, otherwise in memory.
- Live at https://papercut.marz.gg (hub server shared with Hormigas). Merges to `main` deploy automatically; see `docs/deploy.md`. `/api/health` reports the live build.
