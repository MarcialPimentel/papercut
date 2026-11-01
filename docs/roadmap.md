# Papercut — Roadmap
_Updated 2026-11-01 after art direction v2 (3D, PvP, page match). The design behind this plan is in [GDD.md](GDD.md) and [art-direction.md](art-direction.md)._

The Milestone 1 milestone and issues #2–#10 on GitHub were created on 2026-10-30 for the old plan (flat dolls vs a dummy). The table below is the updated plan; the GitHub issues get rewritten to match once Marz confirms.

## Milestone 1: Feel test (local PvP)
**Question it answers:** is a one-cut paper duel fun between two people?
**Done when:** Marz and a second player can play five matches and want a sixth, and the tuned feel numbers are saved as defaults.

| Issue | Title | What it delivers |
|---|---|---|
| #2 | Project setup and deploy | Vite + TypeScript + Three.js, `npm run dev / test / build`, unit tests, and a GitHub Pages deploy on every merge to `main`. |
| #3 | Notebook spread and side camera | The 3D open notebook on a desk (pages, stacks, covers), pop-ups for the Graph Paper Dojo, and the side-on camera that frames both fighters. |
| #4 | Kami and Sumi from code shapes | Folded low-poly fighters with flat-shaded facets, white-and-ink outlines, red insides, guard poses, walking, turning around. |
| #5 | Duel rules (fixed-step, tested) | Guard, slash (wind-up / active / recovery), block, parry, clash, jump, dodge, one-cut kill, on a fixed 60 Hz clock driven only by inputs, with unit tests. |
| #6 | Sumi as a practice dummy | Switches guard on a timer with a glint tell, so one person can test alone. |
| #7 | Kills: 3D split and refold | Clipping-plane split along the blade line with the red inside, halves as Rapier physics bodies (cosmetic), refold ahead of the winner. |
| #8 | Hit feel | Hitstop, shake, slash line, paper sounds, kill camera with slow motion. |
| #9 | Tuning panel and restart | On-screen sliders for timings, parry window, refold delay, hitstop, shake, slow motion; save as defaults; R / Start restarts. |
| #10 | Playtest guide | `docs/playtest.md`: how to open the build, both players' controls, what to try, what to report. |
| new | Two players on one PC | Split keyboard (A/D/W/S/F/Space/Q and arrows / . Right Shift) and up to two gamepads. |
| new | Right of way, page turns and the cover win | Five spreads (Legal Pad Grove and Ruled Courtyard pop-ups, two marble covers), the page-turn animation, and the win banner. |

Suggested build order: #2 → #3 → #4 → #5 → two players → #6 → #7 → #8 → page turns → #9 → #10.

## Milestone 2: Online duels
Two players on different PCs: invite links, a small service to connect them, WebRTC for inputs, rollback to hide lag. Issues to be written when Milestone 1 is done.

## Milestone 3: Blender fighters
Kami remade in Blender (low-poly parts, flat shading, one bone per part) and the click-by-click pipeline guide. Issues to be written when Milestone 2 is done.

## Milestone 4: The full notebook
More spreads and arenas, menus, more blades. Issues to be written later.
