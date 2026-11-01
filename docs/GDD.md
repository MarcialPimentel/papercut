# Papercut — Game Design Document
_Status: design set, art direction v2 approved in principle (2026-11-01). Next: Milestone 1, "Feel test" (local PvP). Source of truth for what the game is._

## Pitch
Two folded-paper samurai duel across a 3D pop-up notebook. One clean cut splits the loser in two; the winner fights on, page by page, to turn the last page onto the rival's cover.

Art direction: [art-direction.md](art-direction.md) (the Notebook Dojo; playable mock-up in `art/papercut-mockup.html`). Style references, inspiration only (our own characters and world, nothing borrowed): Paper Mario (sticker outline), Samurai Jack (flat angular shapes), Kartana (folded white-and-red blade), South Park (cut paper), school stationery. Duel references: Nidhogg (simple, tense, readable), Bushido Blade (one clean cut decides it).

## Player fantasy
A calm, sharp duelist facing another person: read them, guess right, land the one clean cut, and watch their paper split. Then run, because they refold in your way. Easy to learn, with a high skill ceiling.

## Core loop (30 seconds / one match / one session / long term)
- **30 seconds:** step in and out of range, read whether the rival guards high or low, then slash at the open height, block, jump their low slash or hop back. One clean cut splits them in 3D and gives you the way.
- **One match:** whoever cut last has the way and runs for the page edge; the page turns and the fight goes on. Turn the last page onto the rival's cover to win. A comeback is always one cut away.
- **One session:** a few matches against a friend, on one PC (Milestone 1) or online (Milestone 2). Sumi doubles as a practice dummy when you're alone.
- **Long term:** new fighters, blades and notebook spreads, each a new Blender model and rig to test. Kept small on purpose: the game is also a test bed.

## Design pillars (every feature must serve one; in a conflict the lower number wins)
1. **Every cut shows:** every kill splits a fighter in 3D and shows the red inside. Red appears only where paper is cut. No health bars, no numbers.
2. **Feel first:** a slash must feel good (hitstop, shake, sound, slash line) before any new content is added.
3. **Read it at a glance:** one lane, side-on camera, clear tells, few buttons. Guard height is readable from the blade alone, and every fighter keeps its outline against any paper.
4. **Pop-up notebook:** everything is folded or cut from stationery (graph, ruled, legal pad, marble covers, kraft card), in a real 3D book whose pages turn.
5. **Test bed for art:** every fighter and blade goes through one documented Blender → game pipeline, so models, rigs and animations are easy to try.

## Look (summary; full detail in art-direction.md)
- **Fighters:** low-poly folded papercraft samurai with crisp flat facets. Each part is a hollow shell: white outside, red inside. Every part gets a white sticker outline with a thin ink edge (inverted hull). Kami (player 1): white with an indigo sash. Sumi (player 2 / dummy): black hakama, gold sash.
- **World:** an open notebook on a desk. Each spread is a different paper with its own pop-ups: Graph Paper Dojo (middle, start), Ruled Courtyard and Legal Pad Grove (one each way), marble covers at the ends (night).
- **Straight lines and flat facets only.** Red is paper, not blood. One non-red accent per fighter.

## The duel (rules)
- **The lane:** both fighters move along one path across the spread and always face each other (they turn around if one jumps over the other). The world, fighters and camera are fully 3D; the fight is on a line.
- **Guard:** a fighter holds the blade **high** or **low**. When not attacking, they guard at that height.
- **Slash:** cuts at your guard height. Wind-up (the tell), a short active moment, then recovery (the opening).
  - Slash meets a guard at the **same** height: **blocked** (paper chips, both pushed apart).
  - Defender switched to the matching height in the last moment: **parry**. The attacker staggers and is open.
  - Two slashes at the same height at the same moment: **clash**, both bounce back.
  - Anything else in reach: **clean cut**.
- **Jump:** a paper hop. Low slashes pass underneath; it also gets you over a blocker. High slashes still hit.
- **Dodge:** a quick hop backwards out of range.
- **One cut kills:** the loser splits along the blade's line, then refolds about 1.6 s later ahead of the winner, standing in their way.
- **Right of way:** whoever cut last has the way. Only they can run off the page edge toward the rival's cover; the page turns, everything refolds on the next spread, and the fight continues there.
- **Winning:** turn the last page onto the rival's cover. The notebook has five spreads: Kami's cover, Legal Pad Grove, Graph Paper Dojo (start), Ruled Courtyard, Sumi's cover.
- **Camera:** side-on with a slight angle to show volume, framing both fighters. On a kill it swings to a three-quarter view with slow motion; on a page turn it pulls up to show the whole book.
- **Controls (two players on one keyboard, or gamepads):**

  | Action | Player 1 (Kami) | Player 2 (Sumi) | Gamepad |
  |---|---|---|---|
  | Move | A / D | ← / → | Left stick |
  | Guard high / low | W / S | ↑ / ↓ | Stick up / down |
  | Slash | F | / | X / Square |
  | Jump | Space | Right Shift | A / Cross |
  | Dodge back | Q | . | B / Circle |
  | Restart match | R | R | Start |

- **Opponents:** another person (local in Milestone 1, online in Milestone 2). Sumi works as a practice dummy (switches guard on a timer, with a glint as the tell). No AI bot for now.

## Paper damage (approach)
- A cut is a plane through the whole fighter along the blade's path. The fighter is drawn twice, once on each side of the plane (clipping planes); the white layers stop a hair short of the plane, so a thin red line opens along the cut.
- The halves tumble apart: the top slides off along the cut, the bottom falls back. Their open ends show the red inside of the shell.
- Halves and red flecks stay on the page until it turns, so a long fight leaves the spread littered with red.
- Tumbling is scripted in Milestone 1; Rapier physics comes in when halves need to bounce off pop-ups.

## Platform and tech
- **Platform:** desktop, played in a desktop browser with keyboard or gamepads. Can be wrapped as a desktop app later if Steam ever makes sense.
- **Stack:** TypeScript, Vite, Three.js. Flat-shaded faceted shells, inverted-hull outlines and clipping-plane cuts (no custom shaders needed). Rapier deferred.
- **Built for online from day one:** the duel runs on a fixed 60-steps-per-second clock and is decided only by the players' inputs, in plain code with tests, separate from drawing. Effects (camera, flecks, tumbling halves) are cosmetic and never affect the result. Milestone 2 sends only inputs between two browsers (WebRTC) with rollback to hide lag, plus a small service to connect players by invite link.
- **Art pipeline:** Blender → glTF (`.glb`): low-poly parts, flat shading, one bone per part. The game adds the outline and the red inside to any model. Milestone 1 builds the fighters from code shapes.
- **Deploy:** GitHub Pages. Every merge to `main` goes live at a public link.

## Scope for the first playable (Milestone 1: "Feel test")
The one question it answers: **is a one-cut paper duel fun between two people?**
- **In:** the 3D notebook with three spreads and two covers; Kami and Sumi built from code shapes with outlines and red insides; two players on one PC (keyboard and gamepads); Sumi as a practice dummy; guard, slash, block, parry, clash, jump, dodge; one-cut kills with 3D split, refold and right of way; page turns and the cover win; hitstop, shake, slash line, paper sounds, kill camera with slow motion; R to restart; an on-screen tuning panel for the feel numbers.
- **Out:** online play, menus, AI bot, Blender art, more fighters or blades.
- **Done when:** Marz and a second player can play five matches and want a sixth, and the tuned feel numbers are saved as defaults.

## Roadmap (issue-level plan in [roadmap.md](roadmap.md))
1. **Milestone 1, Feel test (local PvP).** The first playable above.
2. **Milestone 2, Online duels.** Invite links, WebRTC, rollback.
3. **Milestone 3, Blender fighters.** Kami remade in Blender plus the click-by-click pipeline guide.
4. **Milestone 4, The full notebook.** More spreads and arenas, menus, more blades.

Later candidates (only once PvP is fun): an AI bot, more fighters, Rapier physics for halves.

## Risks and how we'll test them
- **Game feel is the whole game (Milestone 1):** a weak slash sinks it. Tuning panel and local PvP playtests from the first build.
- **Online play (Milestone 2):** the biggest technical job. Reduced up front by the input-driven fixed-step rules in Milestone 1.
- **Readability in 3D:** one lane, side-on camera, outlines on every part; check tells at the widest zoom and in the night spreads.
- **3D art cost (Milestone 3):** models are slower than flat pieces. Keep parts low-poly and let the game add outlines and the red inside.
- **Scope creep:** a "test bed" grows forever. Hold to two fighters and five spreads until PvP is fun.

## Open questions (for later milestones)
- Wind-up, active and recovery timings, the parry window and the refold delay. (Tuned in Milestone 1; record the final numbers here.)
- Does dodge have invincibility, or only distance?
- Smooth poses or stop-motion (the mock-up has both)?
- Names: Kami and Sumi are working names until Marz confirms.
- Sound style: real paper sounds, stylised, or both?

## Decision Log
| Date | Decision | Why |
|---|---|---|
| 2026-10-30 | Project started: desktop (browser), TypeScript + Three.js + Rapier, Blender for assets, public GitHub repo | Marz wanted something different from his RTS and resource games, in a Paper Mario-like style, simple enough to test 3D models, rigging and game feel. Three.js + Rapier at his request; same web tooling as his other games. |
| 2026-10-30 | Core fantasy: tense duels decided by a few clean cuts (not a combo fighter, not a melee brawl) | Every cut matters, so every tear is worth showing (pillar 1); smallest animation load; matches the Nidhogg / Bushido Blade reference. |
| 2026-10-30 | Movement: a duel lane seen from the side. Fighters always face each other and move left/right only; the diorama around them is fully 3D. Sidestep may be tried later | Flat fighters are always seen broadside, so the edge-on risk is solved by design (pillar 3). Tiny controls, simpler AI. |
| 2026-10-30 | Fighters are pinned paper dolls: flat card pieces (head, torso, arms, legs) joined at pins like a split-pin puppet | One piece = one bone, a clean rigging test (pillar 5). A cut can tear or knock loose a single piece, the cheapest route to visible damage (pillar 1). Our own look rather than a copy of Paper Mario's one-sheet characters. |
| 2026-10-30 | Win rule: three clean cuts, no health bar. Each cut leaves a visible tear; the third splits the fighter apart | The body is the health readout, so players never look away from the fight (pillars 1 and 3). |
| 2026-10-30 | Controls: move, high/low stance, slash, dodge back. Slash meets a blade at the same height = blocked; a last-moment block = parry (attacker staggers) | Gives a real read-and-guess duel with three buttons; one-button timing alone loops, directional slashes cost more animation and harder tells (pillar 3). |
| 2026-10-30 | Opponents: training dummy first, then AI fighters. Local 2-player on one PC is a likely later add, not in the first playable | Lets Marz test alone; 2P is cheap in a side lane but doubles input and test work before the slash is proven (pillar 2). |
| 2026-10-30 | Camera: side-on, slides and zooms to keep both fighters framed; punches in with brief slow-mo on the finishing cut | Keeps the read clear (pillar 3) while making the last cut a moment (pillars 1 and 2). |
| 2026-10-30 | Pillars sharpened, all five kept and ranked; in a conflict the lower number wins | Matches the decisions above and settles trade-offs ahead of time. |
| 2026-10-30 | First playable = a feel test against a training dummy (Milestone 1). No AI, menus, arenas or Blender art yet | Answers one question, "is cutting paper fun?", before anything else is built on it (pillar 2). |
| 2026-10-30 | First risk to test: does a cut feel good, tested together with the cheapest visible tear | A cut feels good partly because the paper tears, so feel and damage are judged in one build (pillars 1 and 2). |
| 2026-10-30 | Milestone 1 doll is built from flat card shapes in code; a rigged Blender doll replaces it in Milestone 2 | Feel numbers can be tuned fast without re-exporting; the pipeline gets its own milestone and doc (pillars 2 and 5). |
| 2026-10-30 | Deploy to GitHub Pages; every merge to main goes live | Free for a public repo; Marz can play every build from a link. |
| 2026-10-30 | Roadmap proposed: M1 Feel test, M2 Paper doll from Blender, M3 First duel vs AI | Each milestone tests one risk at a time; content waits until the duel is fun. |
| 2026-10-30 | Roadmap and Milestone 1 plan approved; milestone "M1 Feel test: cutting paper" and issues #2–#10 created on GitHub | Marz approved the plan at the end of the first design session. |
| 2026-10-30 | Art direction proposed: the Notebook Dojo (stationery pop-up feudal Japan), sticker outline, straight lines, red only where paper is cut | Uses every reference Marz shared; each arena gets its identity from its paper at almost no art cost; red stays the loudest thing on screen (pillars 1, 3 and 4). |
| 2026-11-01 | Art direction approved in principle ("I like the style and idea"): Notebook Dojo world, red rule, sticker outline on fighters only | Marz's review of the v1 mock-up. |
| 2026-11-01 | PvP at the core: people against each other. Replaces "AI fighters" as the opponent plan | Marz's call. A person is a deeper opponent than a bot, which suits the high-skill-ceiling goal. |
| 2026-11-01 | Goal: easy to learn, high skill ceiling | Marz's "depth with a high ceiling". Few buttons, many reads (pillar 3). |
| 2026-11-01 | Match: one clean cut kills; the loser refolds ahead of the winner; whoever cut last has the way; turn pages to reach the rival's cover and win. Replaces "three cuts, no health bar" | Marz chose the Nidhogg route. Every exchange ends in the best moment (a full split), and momentum and comebacks come from the page push, told through our own notebook framing. |
| 2026-11-01 | Jump added (clears low slashes, hops blockers). Not added: parry disarms, blade throwing, a third (mid) guard | Marz picked jump only. Adds a vertical guess without new rules to learn; the others stay as later ideas. |
| 2026-11-01 | Full 3D: real 3D world, fighters and camera; the duel stays on one lane, with a side-on camera that swings for kills and page turns. Replaces the flat side-view look | Marz asked to go all out on 3D while keeping the decisions above. A lane keeps high/low readable and online play simpler (pillar 3). |
| 2026-11-01 | Fighters are folded low-poly papercraft: hollow shells, white outside and red inside, with an inverted-hull white-and-ink outline. Replaces pinned flat paper dolls | Marz's pick. Real volume for the 3D camera, cuts show red for free, and a stronger rigging test (pillars 1 and 5). |
| 2026-11-01 | Arena: a 3D pop-up notebook on a desk; five spreads with the two covers as goals; pages really turn | Turns the page push into the arena itself (pillar 4). |
| 2026-11-01 | Online: the rules are built for it now (fixed 60 Hz steps, input-driven, tested, separate from drawing); online play lands in Milestone 2 | Marz's pick. Feel can't be tuned through lag before it exists, but retrofitting online onto loose rules would mean a rewrite. |
| 2026-11-01 | Computer opponents: Sumi as a practice dummy only; no AI bot for now | Marz's pick. Keeps the focus on PvP; a bot can come later. |
| 2026-11-01 | Cuts use clipping planes on two copies of the fighter; tumbling halves are scripted; Rapier deferred | Looks the same as real mesh cutting from the game's camera, works on skinned models, stays cheap, and saves about 1.5 MB in Milestone 1. |
| 2026-11-01 | Roadmap changed: M1 Feel test (local PvP), M2 Online duels, M3 Blender fighters, M4 The full notebook | Follows from PvP, online and 3D. The Milestone 1 issues on GitHub get updated to match once Marz confirms. |
