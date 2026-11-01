# Papercut — Roadmap
_Updated 2026-11-01 for the fighting-game direction (art direction v3). The design behind this plan is in [GDD.md](GDD.md) and [art-direction.md](art-direction.md)._

The Milestone 1 milestone and issues #2–#10 on GitHub were created on 2026-10-30 for the first plan (flat dolls vs a dummy). The table below is the current plan; the GitHub issues get rewritten to match once Marz says go.

## Milestone 1: Feel test (local PvP)
**Question it answers:** is a paper weapon fight fun between two people?
**Done when:** Marz and a second player can play five matches and want a sixth, and the tuned numbers are saved as defaults.

| Issue | Title | What it delivers |
|---|---|---|
| #2 | Project setup and deploy | Vite + TypeScript + Three.js + Rapier, `npm run dev / test / build`, unit tests, and a GitHub Pages deploy on every merge to `main`. |
| #3 | Notebook spread and side camera | The 3D open notebook on a desk (pages, stacks, covers), the Graph Paper Dojo pop-ups, and the side-on camera that frames both fighters. |
| #4 | Kami and Sumi from code shapes | Folded low-poly fighters with flat-shaded facets, white-and-ink outlines, guard poses, walking, turning around. |
| #5 | Fight rules as data (fixed frames, tested) | Guard stance, light and heavy slashes, block, parry, clash, counter cut, hit stun, jump, dash and backdash, input buffer, on a fixed 60 Hz clock driven only by inputs, with unit tests. |
| #6 | Sumi as a practice dummy | Switches guard with a glint tell and swings back now and then, so one person can practise alone. |
| #7 | Hits, cuts and the K.O. split | Red cut bands on struck parts, the paper health strip, the K.O. split with the red inside, halves as Rapier physics bodies (cosmetic). |
| #8 | Hit feel | Hitstop, shake, slash lines, paper sounds, K.O. camera with slow motion. |
| #9 | Tuning panel and restart | On-screen sliders for every move's frames, damage, chip and stun, the parry and counter windows; save as defaults; R / Start restarts. |
| #10 | Playtest guide | `docs/playtest.md`: how to open the build, both players' controls, what to try, what to report. |
| new | Two players on one PC | Split keyboard (A/D/W/S/F/G/Space and arrows . / Right Shift) and up to two gamepads. |
| new | Rounds, timer and page turns | 60-second rounds, best of 3, round banners, the page-turn animation to the next spread, the back-cover win, the Ruled Courtyard and Legal Pad Grove pop-ups. |

Suggested build order: #2 → #3 → #4 → #5 → two players → #6 → #7 → #8 → rounds → #9 → #10.

## Milestone 2: Online fights
Two players on different PCs: invite links, a small service to connect them, WebRTC for inputs, rollback to hide lag. Issues to be written when Milestone 1 is done.

## Milestone 3: Blender fighters
Kami remade in Blender (low-poly parts, flat shading, one bone per part) and the click-by-click pipeline guide.

## Milestone 4: Solo and character
A computer fighter, Kami and Sumi made different (speed, reach), one or two specials each (direction + button).

## Milestone 5: The full notebook
Menus, more spreads and blades.
