# Papercut — Game Design Document
_Status: idea stage. Started 2026-10-30. Source of truth for what the game is._

## Pitch
You are a paper swordfighter who duels other papercraft warriors in a pop-up diorama arena, where every hit really cuts, tears and crumples your opponent.

Art reference: the flat, papercraft look of Paper Mario (inspiration for the style only: our own characters and world, no borrowed characters or settings).

## Player fantasy
_Prompt for the design session:_ what should the player feel? Draft: a nimble duelist landing the one clean cut that decides the fight, and seeing it slice through their opponent's paper.

## Core loop (30 seconds / one session / long term)
- **30 seconds:** circle, read the opponent's tell, then slash, parry or dodge, and land a cut that visibly tears their paper.
- **One session:** best-of-3 duels against AI fighters, each with its own blade and moves.
- **Long term:** new fighters, blades and arenas, each one a new Blender model and rig to test. (Keep this small: the game is also a test bed.)

## Design pillars (draft: every feature must serve one)
1. **Every cut shows** (draft): damage is the paper itself (tears, hanging flaps, creases, crumpling), not just a number.
2. **Feel first** (draft): every hit has weight (hitstop, shake, sound, slash trail) before we add any new content.
3. **Read it in 10 seconds** (draft): few buttons, clear tells, a fighter is never hard to read or hit because it turned edge-on.
4. **Pop-up diorama** (draft): everything looks handmade from paper and card, like a pop-up book stage.
5. **A test bed for art** (draft): every fighter and blade goes through one documented Blender → game pipeline, so models, rigs and animations are easy to try.

## Platform and tech
- **Platform:** desktop, played in a desktop browser with keyboard and mouse or gamepad. Can be wrapped as a desktop app later if Steam ever makes sense.
- **Stack:** TypeScript, Vite, Three.js (rendering, skinned models, animation), Rapier (physics: hit detection, knockback, ragdoll-ish crumples).
- **Art pipeline:** Blender → glTF (`.glb`) with rigs and animations, loaded by Three.js.
- **Deploy:** to be decided in the first build (the repo is public, so GitHub Pages is free and simple).

## Scope for a first playable
_Prompt for the design session._ Draft to react to:
- One arena, one player fighter vs one AI fighter (or a training dummy first).
- Move, slash, block/parry, dodge.
- One rigged fighter model (rough is fine) and one blade.
- The simplest version of visible paper damage.
- Hitstop, camera shake and a slash trail.
- A knockout ends the duel; restart with one key.

## Risks and how we'll test them
- **Readability of flat fighters in 3D:** paper characters turning edge-on can vanish or be hard to hit. Test camera and facing rules with grey boxes before any real art.
- **Game feel is the whole game:** a weak slash sinks it. First playable is a feel test: one fighter, one dummy, tune hits until hitting the dummy is fun on its own.
- **Scope creep:** a "test bed" grows forever. Hold to one arena and two fighters until the duel is fun.
- **Paper damage tech:** real cutting of meshes is hard. Test cheap tricks first (swapping pre-made torn pieces, decals, flaps on bones) before anything procedural.

## Open questions
- Free 3D movement in an arena, or a 2.5D side-on plane (more Paper Mario, easier to read)?
- Are fighters flat paper cutouts (Paper Mario) or folded 3D papercraft (origami-like)? Or a mix?
- How does a duel end: health bar, paper damage only, or a number of clean cuts?
- How do attacks work: one slash button, directional slashes, or charge cuts?
- Single-player vs AI only, or local 2-player on one PC too?
- What does the camera do?

## Decision Log
| Date | Decision | Why |
|---|---|---|
| 2026-10-30 | Project started: desktop (browser), TypeScript + Three.js + Rapier, Blender for assets, public GitHub repo | Marz wanted something different from his RTS and resource games, in a Paper Mario-like style, simple enough to test 3D models, rigging and game feel. Three.js + Rapier at his request; same web tooling as his other games. |
