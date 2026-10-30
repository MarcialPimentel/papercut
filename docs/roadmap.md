# Papercut — Roadmap
_Proposed 2026-10-30 in the first design session and approved by Marz the same day. Milestone 1 is on GitHub as "M1 Feel test: cutting paper" (issues #2–#10)._

The design behind this plan is in [GDD.md](GDD.md).

## Milestone 1: Feel test, cutting paper
**Question it answers:** is cutting paper fun on its own?
**Done when:** Marz can spend five minutes hitting the dummy and it feels good, and the tuned feel numbers are saved as the defaults.

| Issue | Title | What it delivers |
|---|---|---|
| #2 | Project setup and deploy | Vite + TypeScript + Three.js + Rapier, `npm run dev / test / build`, unit tests, and a GitHub Pages deploy on every merge to `main`. A blank page with a spinning card proves it works. |
| #3 | Duel lane and side camera | A grey-box stage floor and backdrop. Side-on camera that slides and zooms to keep both fighters framed. |
| #4 | Paper doll from code | A pinned paper doll built from flat card shapes (head, torso, arms, legs on pins). High and low stance poses, walk left/right, facing the foe. |
| #5 | Duel rules | Stance, slash (wind-up / active / recovery), dodge back, block and parry, as plain game logic with unit tests. Keyboard and gamepad input. |
| #6 | Training dummy | A dummy that holds a guard and switches high/low on a timer, with a clear tell before each switch. It can be blocked against and cut. |
| #7 | Paper damage v1 | Three damage stages: torn edge and flap, a piece hanging loose from its pin, then a split into two physics halves that fall and crumple. |
| #8 | Hit feel | Hitstop, camera shake, slash trail, paper sounds (cut, block, parry, tear), and the finishing punch-in with slow-mo. |
| #9 | Tuning panel and restart | On-screen sliders for slash timings, parry window, hitstop, shake and slow-mo; save as defaults; R / Start restarts. |
| #10 | Playtest guide | `docs/playtest.md`: how to open the build, what to try, what to report. |

Suggested build order: #2 → #3 → #4 → #5 → #6 → #7 → #8 → #9 → #10. Issues #7 and #8 can be one build, as the tear and the hit feel are judged together.

## Milestone 2: Paper doll from Blender
One rigged doll and one blade made in Blender and exported to glTF, replacing the code-made doll with the same feel numbers. Click-by-click pipeline doc in `docs/` so new fighters are easy to try. Issues to be written when Milestone 1 is done.

## Milestone 3: First duel
One AI fighter with clear tells, a first pop-up diorama arena, best-of-3, simple start and win screens. Issues to be written when Milestone 2 is done.
