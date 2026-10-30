# Papercut — Roadmap
_Proposed 2026-10-30 in the first design session. Waiting for Marz's approval before the GitHub milestone and issues are created._

The design behind this plan is in [GDD.md](GDD.md).

## Milestone 1: Feel test, cutting paper
**Question it answers:** is cutting paper fun on its own?
**Done when:** Marz can spend five minutes hitting the dummy and it feels good, and the tuned feel numbers are saved as the defaults.

| # | Issue | What it delivers |
|---|---|---|
| 1 | Project setup and deploy | Vite + TypeScript + Three.js + Rapier, `npm run dev / test / build`, unit tests, and a GitHub Pages deploy on every merge to `main`. A blank page with a spinning card proves it works. |
| 2 | Duel lane and side camera | A grey-box stage floor and backdrop. Side-on camera that slides and zooms to keep both fighters framed. |
| 3 | Paper doll from code | A pinned paper doll built from flat card shapes (head, torso, arms, legs on pins). High and low stance poses, walk left/right, facing the foe. |
| 4 | Duel rules | Stance, slash (wind-up / active / recovery), dodge back, block and parry, as plain game logic with unit tests. Keyboard and gamepad input. |
| 5 | Training dummy | A dummy that holds a guard and switches high/low on a timer, with a clear tell before each switch. It can be blocked against and cut. |
| 6 | Paper damage v1 | Three damage stages: torn edge and flap, a piece hanging loose from its pin, then a split into two physics halves that fall and crumple. |
| 7 | Hit feel | Hitstop, camera shake, slash trail, paper sounds (cut, block, parry, tear), and the finishing punch-in with slow-mo. |
| 8 | Tuning panel and restart | On-screen sliders for slash timings, parry window, hitstop, shake and slow-mo; save as defaults; R / Start restarts. |
| 9 | Playtest guide | `docs/playtest.md`: how to open the build, what to try, what to report. |

Suggested build order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Issues 6 and 7 can be one build, as the tear and the hit feel are judged together.

## Milestone 2: Paper doll from Blender
One rigged doll and one blade made in Blender and exported to glTF, replacing the code-made doll with the same feel numbers. Click-by-click pipeline doc in `docs/` so new fighters are easy to try. Issues to be written when Milestone 1 is done.

## Milestone 3: First duel
One AI fighter with clear tells, a first pop-up diorama arena, best-of-3, simple start and win screens. Issues to be written when Milestone 2 is done.
