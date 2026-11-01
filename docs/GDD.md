# Papercut — Game Design Document
_Status: design set as a 3D paper weapon fighting game (2026-11-01). Next: Milestone 1, "Feel test" (local PvP). Source of truth for what the game is._

## Pitch
A 3D weapon fighting game in folded paper. Two paper samurai trade light and heavy slashes inside a pop-up notebook; every hit cuts the paper red, and anyone caught mid-attack is cut in half on the spot.

Art direction: [art-direction.md](art-direction.md) (the Notebook Dojo; playable mock-up in `art/papercut-mockup.html`). Style references, inspiration only (our own characters and world, nothing borrowed): Paper Mario (sticker outline), Samurai Jack (flat angular shapes), Kartana (folded white-and-red blade), South Park (cut paper), school stationery. Game references: weapon fighting games such as Samurai Shodown (few, heavy, decisive hits), Bushido Blade (one clean cut can decide it). The counter cut, the guard stance and the paper damage are ours.

## Player fantasy
A sharp duelist in a real fighting game: poke fast, read the rival, and punish the moment they get greedy, with one counter cut that splits them in half. Easy to learn, with a high skill ceiling.

## Core loop (30 seconds / one match / one session / long term)
- **30 seconds:** dance in and out of range, poke with light slashes, switch guard high or low, and wait for the rival to commit to a heavy or miss. Hit them mid-attack and it's a counter cut: instant K.O.
- **One match:** best of 3 rounds of 60 seconds. Every hit slices the rival's paper health strip and leaves a red cut on their body; a K.O. splits them. Between rounds the notebook's page turns to the next spread.
- **One session:** a few matches against a friend, on one PC (Milestone 1) or online (Milestone 2). Sumi doubles as a practice dummy; a computer fighter comes later.
- **Long term:** new fighters with their own moves and specials, new blades and spreads, each a new Blender model and rig to test. Kept small on purpose: the game is also a test bed.

## Design pillars (every feature must serve one; in a conflict the lower number wins)
1. **Every cut shows:** every hit cuts the paper. Hits leave red cuts that wrap around the folded body, the health strip is paper that gets sliced shorter, and a K.O. splits the fighter in 3D. Red appears only where paper is cut. No damage numbers.
2. **Feel first:** a slash must feel good (hitstop, shake, sound, slash line) before any new content is added.
3. **Read it at a glance:** one lane, side-on camera, clear wind-ups, few buttons. Guard height is readable from the blade alone, and every fighter keeps its outline against any paper.
4. **Pop-up notebook:** everything is folded or cut from stationery (graph, ruled, legal pad, marble covers, kraft card), in a real 3D book whose pages turn between rounds.
5. **Test bed for art:** every fighter and blade goes through one documented Blender → game pipeline, so models, rigs and animations are easy to try.

## Look (summary; full detail in art-direction.md)
- **Fighters:** low-poly folded papercraft samurai with crisp flat facets. Each part is a hollow shell: white outside, red inside. Every part gets a white sticker outline with a thin ink edge (inverted hull). Kami (player 1): white with an indigo sash. Sumi (player 2 / dummy): black hakama, gold sash.
- **World:** an open notebook on a desk. Round 1 is fought on the Graph Paper Dojo spread, round 2 on the Ruled Courtyard, round 3 on the Legal Pad Grove; the match winner stands on the marble back cover.
- **HUD:** paper health strips that get sliced shorter, a paper countdown tag, round markers. Straight lines and flat facets only. Red is paper, not blood. One non-red accent per fighter.

## The fight (rules)
- **The lane:** both fighters move along one path across the spread and always face each other. The world, fighters and camera are fully 3D; the fight is on a line.
- **Guard stance:** hold the blade **high** or **low** (W/S). When not attacking, you guard at that height, even while walking.
- **Attacks** (both cut at your guard height):

  | Move | Speed | Damage | Notes |
  |---|---|---|---|
  | Light slash | Fast wind-up, short recovery | 10% of the strip | Safe to throw; the main poke |
  | Heavy slash | Slow wind-up, long recovery | 35% of the strip | Chips 3% through a block; while winding up you're open to a counter cut |

- **Block:** a slash that meets a guard at the same height is blocked (paper chips, both pushed apart).
- **Parry:** switch to the matching height in the last moment before impact; the attacker staggers and is open.
- **Clash:** two slashes of the same kind and height at the same moment bounce off each other.
- **Counter cut (touch of death):** hit a fighter during a heavy's wind-up, or during the recovery of any attack that missed, and it's an instant K.O. Two light slashes trading at once just do normal damage, so quick pokes never become a coin flip.
- **Hit stun:** a clean hit staggers the defender briefly (longer for heavies) and pushes them back.
- **Jump:** low slashes pass underneath; slashes in the air cut high.
- **Dash and backdash:** double-tap toward or away from the rival.
- **Rounds:** 60 seconds. A K.O. or the most strip left at time wins the round; a tie replays it. Best of 3. The page turns between rounds.
- **Camera:** side-on with a slight angle to show volume, framing both fighters. On a K.O. it swings to a three-quarter view with slow motion; on a page turn it pulls up to show the whole book.
- **Controls (two players on one keyboard, or gamepads):**

  | Action | Player 1 (Kami) | Player 2 (Sumi) | Gamepad |
  |---|---|---|---|
  | Move | A / D | ← / → | Left stick |
  | Guard high / low | W / S | ↑ / ↓ | Stick up / down |
  | Light slash | F | . | X / Square |
  | Heavy slash | G | / | Y / Triangle |
  | Jump | Space | Right Shift | A / Cross |
  | Dash / backdash | Double-tap D / A | Double-tap → / ← | R1 / B |
  | Restart match | R | R | Start |

- **Opponents:** another person (local in Milestone 1, online in Milestone 2). Sumi works as a practice dummy that switches guard (a glint is the tell) and swings back now and then. A computer fighter comes in a later milestone.
- **Roster:** Kami and Sumi share one move set in Milestone 1 (different looks), so the core feel is tuned once. Later each gets their own speed, reach and one or two specials done as direction + button (no motion inputs).

## Paper damage (approach)
- **Hits:** a clean hit leaves a red cut on the body part it struck (torso for high slashes, legs for low). The cut is a thin red band that follows the slash's angle and wraps around the folded paper (a copy of that part, clipped to a thin band). Heavy hits leave wider cuts across two parts.
- **Health strip:** a strip of paper in the HUD; each hit slices a piece off its end, which falls away.
- **K.O.:** a plane through the whole fighter along the blade's path. The fighter is drawn twice, once on each side of the plane (clipping planes); the white layers stop a hair short of the plane, so a thin red line opens, and the halves show the red inside of the shell as they fall. Earlier cuts stay on the halves.
- **Physics:** the halves are Rapier physics bodies from Milestone 1: they tumble, bounce off pop-ups and pile up on the page. Physics is cosmetic only: it never decides who wins, so online play only has to sync inputs. Halves and flecks clear when the page turns.

## Platform and tech
- **Platform:** desktop, played in a desktop browser with keyboard or gamepads. Can be wrapped as a desktop app later if Steam ever makes sense.
- **Stack:** TypeScript, Vite, Three.js. Flat-shaded faceted shells, inverted-hull outlines and clipping-plane cuts (no custom shaders needed). Rapier (`@dimforge/rapier3d-compat`) for the cut halves and flecks, loaded in the background so the first fight isn't delayed.
- **Fighting-game foundations:** the fight runs on a fixed 60-frames-per-second clock and is decided only by the players' inputs, in plain code with tests, separate from drawing. Every move is data (wind-up, active and recovery frames, reach, damage, hit stun). Hits are checked with simple hit areas per move. Inputs are buffered for a few frames so a press slightly early still counts. Effects (camera, flecks, physics halves) are cosmetic and never affect the result.
- **Online (Milestone 2):** send only inputs between two browsers (WebRTC), with rollback to hide lag (the standard for fighting games), plus a small service to connect players by invite link.
- **Art pipeline:** Blender → glTF (`.glb`): low-poly parts, flat shading, one bone per part. The game adds the outline, the red inside and the cut marks to any model. Milestone 1 builds the fighters from code shapes.
- **Deploy:** GitHub Pages. Every merge to `main` goes live at a public link.

## Scope for the first playable (Milestone 1: "Feel test")
The one question it answers: **is a paper weapon fight fun between two people?**
- **In:** the 3D notebook with three round spreads and the back cover; Kami and Sumi built from code shapes with outlines, red insides and cut marks; two players on one PC (keyboard and gamepads); Sumi as a practice dummy; guard stance, light and heavy slashes, block, parry, clash, counter cut, hit stun, jump, dash and backdash; paper health strips, 60-second timer, best of 3 rounds with page turns; K.O. split with Rapier halves; hitstop, shake, slash line, paper sounds, K.O. camera with slow motion; R to restart; an on-screen tuning panel for the feel numbers (frame timings, damage, parry window, counter window).
- **Out:** online play, menus, the computer fighter, specials, different move sets, Blender art, more fighters or blades.
- **Done when:** Marz and a second player can play five matches and want a sixth, and the tuned numbers are saved as defaults.

## Roadmap (issue-level plan in [roadmap.md](roadmap.md))
1. **Milestone 1, Feel test (local PvP).** The first playable above.
2. **Milestone 2, Online fights.** Invite links, WebRTC, rollback.
3. **Milestone 3, Blender fighters.** Kami remade in Blender plus the click-by-click pipeline guide.
4. **Milestone 4, Solo and character.** A computer fighter, Kami and Sumi made different (speed, reach), one or two specials each.
5. **Milestone 5, The full notebook.** Menus, more spreads and blades.

## Risks and how we'll test them
- **Game feel is the whole game (Milestone 1):** a weak slash sinks a fighting game. Tuning panel and local PvP playtests from the first build.
- **Counter cut balance:** a touch of death can feel cheap. Tune the windows in Milestone 1 so it only ever punishes a visible mistake (a slow wind-up or a miss).
- **Online play (Milestone 2):** the biggest technical job. Reduced up front by input-driven, fixed-frame rules in Milestone 1.
- **Fighting-game scope:** move sets, hit areas, a computer fighter and a roster grow fast. One shared move set in Milestone 1; differences, specials and the CPU wait for Milestone 4.
- **Readability in 3D:** one lane, side-on camera, outlines on every part; check wind-ups at the widest zoom and in the night spreads.
- **3D art cost (Milestone 3):** keep parts low-poly and let the game add outlines, the red inside and cut marks.

## Open questions (for later milestones)
- Exact frame timings, damage, chip, parry window and counter window. (Tuned in Milestone 1; record the final numbers here.)
- Does a backdash have invincible frames?
- Each fighter's specials and differences (Milestone 4).
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
| 2026-11-01 | Names confirmed: Kami (player 1) and Sumi (player 2 / dummy) | Marz's pick: paper and ink, the game's two materials. |
| 2026-11-01 | Motion: smooth poses (no stop-motion stepping) | Marz's pick. Wind-ups and parry timing read best in PvP when motion is fluid (pillar 3). |
| 2026-11-01 | Rapier physics for the cut halves from Milestone 1, cosmetic only. Replaces "scripted tumbling, Rapier deferred" | Marz's call (my pick was scripted). Halves that bounce off pop-ups and pile up sell every kill (pillar 1). Cost: about 1.5 MB more, loaded in the background. Physics never affects results, so online sync stays inputs-only. |
| 2026-11-01 | Papercut becomes a 3D weapon fighting game (in the spirit of Samurai Shodown, our own systems). Replaces the run-across-pages match | Marz: "much closer to a fighting game than a Nidhogg clone". The game already had few, heavy, decisive hits, readable wind-ups and a 2D lane. |
| 2026-11-01 | Damage: a paper health strip that gets sliced shorter, plus red cuts on the body; the K.O. splits the fighter. Pillar 1 updated: a health strip is allowed because it is paper being cut | Marz's pick. Genre-readable ("how close am I?") while every hit still shows on the paper. |
| 2026-11-01 | Matches: best of 3 rounds, 60 seconds each; the page turns between rounds (graph, ruled, legal pad); the winner stands on the back cover. Right of way and running off the page are dropped | Marz's picks. Keeps the notebook as the arena and the round transition. A timer stops endless turtling. |
| 2026-11-01 | Keep the W/S guard stance (not hold-back-to-block) | Marz's pick. Our own identity; the high/low read stays explicit. |
| 2026-11-01 | Touch of death: the counter cut. Hitting a fighter during a heavy's wind-up, or during the recovery of a missed attack, is an instant K.O. Light-vs-light trades do normal damage | Marz wanted touch of death plus high APM. Pokes stay cheap (high APM), greed is fatal. The light-trade exception is my refinement so trades are never a coin flip. |
| 2026-11-01 | Attacks: light and heavy slash, both at the guard height. Dodge replaced by dash and backdash (double-tap) | Marz's picks. Two buttons are enough with the guard stance and the counter cut; dashes give the fast footwork. |
| 2026-11-01 | Pace: fast feet, deadly commits | Marz's pick. Quick movement, lights and stance switches; slow, risky heavies. |
| 2026-11-01 | Solo play: Sumi as a practice dummy in Milestone 1 (switches guard, swings back sometimes); a computer fighter in a later milestone | Marz's pick. A CPU would need re-tuning every time the moves change. |
| 2026-11-01 | Roster: Kami and Sumi share one move set in Milestone 1; their own speed, reach and specials later | Marz's pick. Tune the core feel once before balancing differences. |
| 2026-11-01 | Specials: later, one or two per fighter, direction + button (no motion inputs) | Marz's pick. Easy to learn, works on keyboard. |
| 2026-11-01 | Roadmap: M1 Feel test, M2 Online fights, M3 Blender fighters, M4 Solo and character (CPU, differences, specials), M5 The full notebook | Follows from the fighting-game direction. |
