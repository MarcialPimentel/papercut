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

To be set up in the first build (Vite + TypeScript: `npm install`, `npm run dev`, `npm test`, `npm run build`).
