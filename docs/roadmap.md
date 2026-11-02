# Papercut — Roadmap
_Updated 2026-11-01 for the first build (an online duel). Before that: the mouse-driven fighting game (art direction v4). The design behind this plan is in [GDD.md](GDD.md) and [art-direction.md](art-direction.md)._

On GitHub this is the milestone "M1 Feel test: mouse vs dummy" with issues #2–#12 (rewritten to this plan on 2026-11-01).

**First build (2026-11-01), Marz's call:** an online duel came first. It delivers #2, #3, #4, #5, #6, #10, #11 and #12, most of #7 and #8 (Rapier halves and tuning left), plus online fights by invite link, room code or quick match with input delay. Still to do in Milestone 1: #7 Rapier halves, #8 tuning the hit feel, #9 tuning panel.

## Milestone 1: Feel test (mouse vs dummy)
**Question it answers:** does mouse-driven paper swordplay feel good?
**Done when:** Marz can play ten minutes against the dummy with the mouse and the guard, slashes, feints, parries and counter cuts all feel good, and the tuned numbers are saved as defaults.

| Issue | Title | What it delivers |
|---|---|---|
| #2 | Project setup and deploy | Vite + TypeScript + Three.js + Rapier, `npm run dev / test / build`, unit tests, and a deploy to the hub server (papercut.marz.gg) on every merge to `main`. |
| #3 | Notebook spread and side camera | The 3D open notebook on a desk (pages, stacks, covers), the Graph Paper Dojo pop-ups, and the side-on camera that frames both fighters. |
| #4 | Kami and Sumi from code shapes | Folded low-poly fighters with flat-shaded facets, white-and-ink outlines, guard poses, walking, turning around. |
| #5 | Fight rules as data (fixed frames, tested) | Guard stance, light and heavy slashes, block, parry, riposte, feint, clash, counter cut, hit stun, jump, dash and backdash, input buffer, on a fixed 60 Hz clock driven only by inputs, with unit tests. |
| #6 | Sumi as a practice dummy | Switches guard with a glint tell, swings back now and then and sometimes feints a heavy, so one person can practise everything alone. |
| #7 | Hits, cuts and the K.O. split | Red cut bands on struck parts, the paper health strip, the K.O. split with the red inside, halves as Rapier physics bodies (cosmetic). |
| #8 | Hit feel | Hitstop, shake, slash lines, paper sounds, K.O. camera with slow motion. |
| #9 | Tuning panel and restart | On-screen sliders for every move's frames, damage, chip and stun, the parry, riposte, feint and counter windows, the cursor waist line; save as defaults; R restarts. |
| #10 | Playtest guide | `docs/playtest.md`: how to open the build, the mouse controls, what to try, what to report. |
| #11 | Mouse controls | Cursor guard (waist line, small dead zone, a visible guard cue), left and right click, feint, keyboard movement, on-screen buttons on touch screens only. |
| #12 | Rounds, timer and page turns | 60-second rounds, best of 5 (was 3), round banners, the page-turn animation to the next spread, the back-cover win, the Ruled Courtyard and Legal Pad Grove pop-ups. |

Suggested build order: #2 → #3 → #4 → #5 → #11 → #6 → #7 → #8 → #12 → #9 → #10.

## Milestone 2: Online fights
Online play already works with input delay (first build). This milestone makes it feel local: rollback to hide lag, direct browser-to-browser links (WebRTC) to cut the server hop, reconnects and a ping display. Issues to be written when Milestone 1 is done.

## Milestone 3: Blender fighters
Kami remade in Blender (low-poly parts, flat shading, one bone per part) and the click-by-click pipeline guide.

## Milestone 4: Solo and character
A computer fighter (Endless mode already has levelled bots, 2026-11-01), Kami and Sumi made different (speed, reach), one or two specials each (direction + button).

## Milestone 5: The full notebook
Menus, more spreads and blades.
