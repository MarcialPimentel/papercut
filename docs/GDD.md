# Papercut — Game Design Document
_Status: design set as a mouse-driven 3D paper weapon fighting game (2026-11-01). Next: Milestone 1, "Feel test" (mouse vs the practice dummy). Source of truth for what the game is._

## Pitch
A 3D weapon fighting game in folded paper. Two paper samurai trade light and heavy slashes inside a pop-up notebook, fought with the mouse: every hit cuts the paper red, and anyone caught mid-attack is cut in half on the spot.

Art direction: [art-direction.md](art-direction.md) (the Notebook Dojo; playable mock-up in `art/papercut-mockup.html`). Style references, inspiration only (our own characters and world, nothing borrowed): Paper Mario (sticker outline), Samurai Jack (flat angular shapes), Kartana (folded white-and-red blade), South Park (cut paper), school stationery. Game references: weapon fighting games such as Samurai Shodown (few, heavy, decisive hits), Bushido Blade (one clean cut can decide it), and PC melee games such as Chivalry (mouse-driven swordplay, feints, ripostes). The counter cut, the cursor guard and the paper damage are ours.

## Player fantasy
A sharp duelist in a real fighting game: poke fast, read the rival, and punish the moment they get greedy, with one counter cut that splits them in half. Easy to learn, with a high skill ceiling.

## Core loop (30 seconds / one match / one session / long term)
- **30 seconds:** dance in and out of range, poke with light slashes, move the cursor to guard high or low, feint a heavy to bait them, and wait for the rival to commit or miss. Hit them mid-attack and it's a counter cut: instant K.O.
- **One match:** best of 5 rounds of 60 seconds. Every hit slices the rival's paper health strip and leaves a red cut on their body; a K.O. splits them. Between rounds the notebook's page turns to the next spread.
- **One session:** a few online matches against friends (since the first build), or an Endless run against bots that get harder every 5. Sumi doubles as a practice dummy; a full computer fighter comes later.
- **Long term:** new fighters with their own moves and specials, new blades and spreads, each a new Blender model and rig to test. Kept small on purpose: the game is also a test bed.

## Design pillars (every feature must serve one; in a conflict the lower number wins)
1. **Every cut shows:** every hit cuts the paper. Hits leave red cuts that wrap around the folded body, the health strip is paper that gets sliced shorter, and a K.O. splits the fighter in 3D. Red appears only where paper is cut. No damage numbers.
2. **Feel first:** a slash must feel good (hitstop, shake, sound, slash line) before any new content is added.
3. **Read it at a glance:** one lane, side-on camera, clear wind-ups, the mouse plus a few keys. Guard height is readable from the blade alone, and every fighter keeps its outline against any paper.
4. **Pop-up notebook:** everything is folded or cut from stationery (graph, ruled, legal pad, marble covers, kraft card), in a real 3D book whose pages turn between rounds.
5. **Test bed for art:** every fighter and blade goes through one documented Blender → game pipeline, so models, rigs and animations are easy to try.

## Look (summary; full detail in art-direction.md)
- **Fighters:** low-poly folded papercraft samurai with crisp flat facets. Each part is a hollow shell: white outside, red inside. Every part gets a white sticker outline with a thin ink edge (inverted hull). Kami (player 1): white with an indigo sash. Sumi (player 2 / dummy): black hakama, gold sash.
- **World:** an open notebook on a desk. Round 1 is fought on the Graph Paper Dojo spread, round 2 on the Ruled Courtyard, round 3 on the Legal Pad Grove; the match winner stands on the marble back cover.
- **HUD:** paper health strips that get sliced shorter, a paper countdown tag, round markers. Straight lines and flat facets only. Red is paper, not blood. One non-red accent per fighter.

## Sound (summary; full detail in [sound.md](sound.md))
- **Mix:** free CC0 recordings for the big moments (blade clash, cuts, K.O., page turn), code-made sounds for the rest. Every sound has a code-made fallback.
- **Sword and paper at once:** a clash rings like steel with a paper snap on top; hits are paper slices and tears, not blood or flesh. A clash, a block and a parry each sound different, so the ear reads the exchange too (pillar 3).
- **Round flow:** kabuki clappers for "Round N", a taiko hit for "Cut!", ticks in the last 10 seconds, stings for round and match results.
- **Music:** made in code (taiko, high drum, koto-like plucks on a Japanese scale), calm on menus, busier when a round is close to deciding, silent from a K.O. to the next round.

## The fight (rules)
- **The lane:** both fighters move along one path across the spread and always face each other. The world, fighters and camera are fully 3D; the fight is on a line.
- **Guard stance:** the cursor sets it. Above your fighter's waist on screen you guard **high**, below it **low**; the blade follows. When not attacking, you guard at that height, even while walking.
- **Attacks** (both cut at your guard height; left click light, right click heavy):

  | Move | Speed | Damage | Notes |
  |---|---|---|---|
  | Light slash | Fast wind-up, short recovery | 10% of the strip | Safe to throw; the main poke |
  | Heavy slash | Slow wind-up, long recovery | 35% of the strip | Chips 3% through a block; while winding up you're open to a counter cut |

- **Block:** a slash that meets a guard at the same height is blocked (paper chips, both pushed apart).
- **Parry:** flick the cursor to the matching height in the last moment before impact; the attacker staggers and is open.
- **Riposte:** after a parry, your next slash (within about 0.6 s) is a riposte: light-slash speed, heavy damage, a lunge with extra reach, and it can't be parried.
- **Feint:** cancel a heavy during most of its wind-up (left click or Q) and snap back to guard. Fakes a heavy to bait the rival's counter cut, then punish their miss.
- **Clash:** two slashes of the same kind and height at the same moment bounce off each other.
- **Counter cut (touch of death):** hit a fighter during a heavy's wind-up, or during the recovery of any attack that missed, and it's an instant K.O. Two light slashes trading at once just do normal damage, so quick pokes never become a coin flip.
- **Hit stun:** a clean hit staggers the defender briefly (longer for heavies) and pushes them back.
- **Jump:** low slashes pass underneath; slashes in the air cut high, and nobody can block mid-air, so a high slash knocks a jumper down. Landing after an air slash leaves you stuck for 10 frames (no blocking), so a blocked jump-in can be punished.
- **Dash and backdash:** double-tap toward or away from the rival.
- **Rounds:** 60 seconds. A K.O. or the most strip left at time wins the round; a tie replays it. Best of 5 (first to 3 rounds). The page turns between rounds; rounds 4 and 5 reuse the graph and ruled spreads.
- **Custom rooms:** whoever creates an invite room picks the rules, and both players play by them: rounds (best of 1, 3, 5, 7 or endless), health (50, 80, 100 or 150) and the round timer (30, 60 or 90 seconds, or none). Quick match always uses the defaults (best of 5, 80, 60 s).
- **Tournament:** a room for 3 to 8 players with a knockout bracket (lose once and you're out; empty spots in a 4- or 8-player bracket are byes). The creator picks the rules (as for a custom room, but no endless rounds) and starts it when everyone is in. One fight at a time: everyone else watches it live, and everyone sees the bracket between fights. A player who leaves loses their current or next fight. Players type their name in the lobby.
- **Endless mode (solo):** one round per bot, one bot after another. Your strip carries over from bot to bot and refills by half every 5 bots; each bot starts with a full strip. Every 5 bots the bots level up: they read your wind-ups and block them (late enough to parry at high levels), counter-cut your misses, knock you out of the air, punish your landings and attack more often. One lost round ends the run. Score: bots cut; the best run is remembered in the browser and shown on the title screen.
- **Camera:** side-on with a slight angle to show volume, framing both fighters. On a K.O. it swings to a three-quarter view with slow motion; on a page turn it pulls up to show the whole book.
- **Controls (the mouse fights, the keyboard moves):**

  | Action | Input |
  |---|---|
  | Guard high / low | Cursor above / below your fighter's waist |
  | Light slash | Left click |
  | Heavy slash | Right click |
  | Feint (during a heavy's wind-up) | Left click or Q |
  | Move | A / D |
  | Dash / backdash | Double-tap D / A |
  | Jump | Space or W |
  | Restart match | R |

  Touch screens get on-screen buttons (shown only when there's no mouse). Gamepads are out of scope for now.

- **Opponents:** another person, online only (since the first build). No two players on one PC. Sumi works as a practice dummy that switches guard (a glint is the tell), swings back now and then and sometimes feints a heavy. A computer fighter comes in Milestone 4.
- **Roster:** Kami and Sumi share one move set in Milestone 1 (different looks), so the core feel is tuned once. Later each gets their own speed, reach and one or two specials done as direction + button (no motion inputs).

## Paper damage (approach)
- **Hits:** a clean hit leaves a red cut on the body part it struck (torso for high slashes, legs for low). The cut is a thin red band that follows the slash's angle and wraps around the folded paper (a copy of that part, clipped to a thin band). Heavy hits leave wider cuts across two parts.
- **Health strip:** a strip of paper in the HUD; each hit slices a piece off its end, which falls away. A full strip is 80 health: a light cut takes 10 (an eighth), a heavy or riposte 35, a blocked heavy chips 3.
- **K.O.:** a plane through the whole fighter along the blade's path. The fighter is drawn twice, once on each side of the plane (clipping planes); the white layers stop a hair short of the plane, so a thin red line opens, and the halves show the red inside of the shell as they fall. Earlier cuts stay on the halves.
- **Physics:** the halves are Rapier physics bodies from Milestone 1: they tumble, bounce off pop-ups and pile up on the page. Physics is cosmetic only: it never decides who wins, so online play only has to sync inputs. Halves and flecks clear when the page turns.

## Platform and tech
- **Platform:** desktop, played in a desktop browser with the mouse and keyboard. Can be wrapped as a desktop app later if Steam ever makes sense.
- **Stack:** TypeScript, Vite, Three.js. Flat-shaded faceted shells, inverted-hull outlines and clipping-plane cuts (no custom shaders needed). Rapier (`@dimforge/rapier3d-compat`) for the cut halves and flecks, loaded in the background so the first fight isn't delayed.
- **Mouse lock:** during a fight the browser holds the mouse (Pointer Lock) so it can't drift out of the window; the game draws its own crosshair. Esc frees it (the browser's rule), and it is released when the match ends so Rematch and Leave can be clicked.
- **Mouse input:** each frame the cursor is compared with the fighter's waist on screen; only the resulting guard height and the clicks enter the rules, so the inputs stay tiny and identical for online play.
- **Fighting-game foundations:** the fight runs on a fixed 60-frames-per-second clock and is decided only by the players' inputs, in plain code with tests, separate from drawing. Every move is data (wind-up, active and recovery frames, reach, damage, hit stun). Hits are checked with simple hit areas per move. Inputs are buffered for a few frames so a press slightly early still counts. Effects (camera, flecks, physics halves) are cosmetic and never affect the result.
- **Online (since the first build):** only inputs travel. A small rooms server pairs players (invite link, room code or quick match) and passes each frame's buttons to the other player; both browsers run the same fight and compare a fingerprint every second. Input delay of 2–8 frames, picked from each player's measured ping; the fight waits if the rival's input is late. Later: rollback to hide lag, and direct browser-to-browser links (WebRTC) to cut the server hop.
- **Art pipeline:** Blender → glTF (`.glb`): low-poly parts, flat shading, one bone per part. The game adds the outline, the red inside and the cut marks to any model. Milestone 1 builds the fighters from code shapes.
- **Deploy:** one Docker container on the hub server shared with Hormigas, at https://papercut.marz.gg (serves the game and the rooms; no database). Every merge to `main` deploys automatically, with a health check and automatic rollback. Details: [deploy.md](deploy.md).

## Scope for the first playable (Milestone 1: "Feel test")
The one question it answers: **does mouse-driven paper swordplay feel good?** Since the first build it can also be played person against person online (input delay; rollback comes in Milestone 2).
- **In:** the 3D notebook with three round spreads and the back cover; Kami and Sumi built from code shapes with outlines, red insides and cut marks; mouse controls (cursor guard, clicks) with keyboard movement; Sumi as a practice dummy that switches guard, swings and feints; guard stance, light and heavy slashes, block, parry, riposte, feint, clash, counter cut, hit stun, jump, dash and backdash; paper health strips, 60-second timer, best of 5 rounds with page turns; K.O. split with Rapier halves; hitstop, shake, slash line, paper sounds, K.O. camera with slow motion; R to restart; an on-screen tuning panel for the feel numbers (frame timings, damage, parry window, counter window).
- **Also in (first build):** online fights by invite link, room code or quick match; rematch. Since then: custom room rules, Endless mode and tournaments (2026-11-01).
- **Out:** rollback, two players on one PC, gamepads, menus beyond the start screen, the computer fighter, specials, different move sets, Blender art, more fighters or blades.
- **Done when:** Marz can play ten minutes against the dummy with the mouse and the guard, slashes, feints, parries and counter cuts all feel good, and the tuned numbers are saved as defaults.

## Roadmap (issue-level plan in [roadmap.md](roadmap.md))
1. **Milestone 1, Feel test (mouse vs dummy).** The first playable above.
2. **Milestone 2, Online fights.** Online play already works with input delay (first build); this milestone adds rollback, direct browser-to-browser links and online polish (reconnects, ping display).
3. **Milestone 3, Blender fighters.** Kami remade in Blender plus the click-by-click pipeline guide.
4. **Milestone 4, Solo and character.** A computer fighter, Kami and Sumi made different (speed, reach), one or two specials each.
5. **Milestone 5, The full notebook.** Menus, more spreads and blades.

## Risks and how we'll test them
- **Game feel is the whole game (Milestone 1):** a weak slash sinks a fighting game. Tuning panel and dummy playtests from the first build.
- **PvP is untested until Milestone 2:** with no local two-player, person-vs-person fun can only be judged once online works. Keep Milestone 2 right after Milestone 1, and keep the dummy smart enough (feints, swings back) to stand in until then.
- **Mouse guard precision:** guarding by cursor height could feel twitchy. The waist line, a small dead zone and a visible guard cue are tuned in Milestone 1.
- **Counter cut balance:** a touch of death can feel cheap. Tune the windows in Milestone 1 so it only ever punishes a visible mistake (a slow wind-up or a miss).
- **Online play (Milestone 2):** the biggest technical job. Reduced up front by input-driven, fixed-frame rules in Milestone 1.
- **Fighting-game scope:** move sets, hit areas, a computer fighter and a roster grow fast. One shared move set in Milestone 1; differences, specials and the CPU wait for Milestone 4.
- **Readability in 3D:** one lane, side-on camera, outlines on every part; check wind-ups at the widest zoom and in the night spreads.
- **3D art cost (Milestone 3):** keep parts low-poly and let the game add outlines, the red inside and cut marks.

## Open questions (for later milestones)
- Exact frame timings, damage, chip, parry window and counter window. (Tuned in Milestone 1; record the final numbers here.)
- Does a backdash have invincible frames?
- Each fighter's specials and differences (Milestone 4).

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
| 2026-11-01 | Controls: the mouse fights, the keyboard moves. Cursor height sets the guard (above the waist high, below low); left click light, right click heavy; A/D move, Space or W jump, double-tap to dash. Replaces W/S guard and F/G slashes | Marz: few people will play a fighting game on keyboard alone; PC players know mouse swordplay from games like Chivalry. The cursor guard keeps the high/low read we already had. |
| 2026-11-01 | Borrowed from Chivalry-style melee: feint (cancel a heavy's wind-up) and riposte (after a parry, a fast heavy-damage slash that can't be parried). Not borrowed: swing drag and accel, stamina | Marz's picks. Feints feed the counter-cut mind game; ripostes make a parry worth the risk. Drag and stamina would muddy timing and add a meter. |
| 2026-11-01 | No two players on one PC, and no gamepads for now. PvP is online only (Milestone 2). Milestone 1 becomes a mouse feel test against the practice dummy | Marz: local two-player is out of scope. One mouse per PC makes it awkward anyway. |
| 2026-11-01 | Riposte gets a lunge with extra reach | Found in the mock-up: the parry pushes the attacker back just out of normal reach, so a riposte could whiff. |
| 2026-11-01 | The first build is an online duel: project setup, hosting, the fight as tested code, the mock-up's look, and invite-link PvP, ahead of the feel-tuning issues (#7–#9 polish comes after) | Marz: "something playable with people online". Learns whether PvP is fun sooner; the deterministic fight core was needed for online anyway. |
| 2026-11-01 | Hosting: the hub server shared with Hormigas, at papercut.marz.gg, one Docker container with auto-deploy, health check and rollback. Replaces GitHub Pages | Marz's pick, following the Hormigas hosting docs. Online play needs a server anyway; one container serves both the game and the rooms. |
| 2026-11-01 | Netcode, first version: input delay (lockstep). Each player's buttons are scheduled 2–8 frames ahead depending on measured ping; the fight waits for late inputs. Rollback later on the same core | Marz's pick. Simple and reliable; the fight already runs only on inputs, so rollback can be added without rewriting it. |
| 2026-11-01 | Matchmaking: invite link (with a 4-letter room code) plus quick match | Marz's pick (link + quick match). The room code is my addition so a link isn't required. |
| 2026-11-01 | Inputs go through the rooms server over a WebSocket for now, not browser-to-browser (WebRTC) | My call: works through every home router with no extra relay service; costs one server hop of latency. WebRTC comes with rollback. |
| 2026-11-01 | Online seats: whoever creates the room (or waited first) is Kami on the left, the other is Sumi on the right; a rematch needs both players to say yes | My call: simple and fair; the camera is the same for both. |
| 2026-11-01 | The K.O. halves keep the mock-up's scripted tumble in the first build; Rapier physics moves to the hit-feel work (#7) | My call: cosmetic only, and keeps the first online build small. |
| 2026-11-01 | Matches are best of 5 (first to 3 rounds); the health strip drops from 100 to 80, so each cut takes a bigger slice (2 heavies and a light win a round) | Marz's picks after the first online playtest: cuts should feel more impactful, and a longer match makes up for the shorter rounds. |
| 2026-11-01 | A "How to play" button on the title screen opens the controls card; the controls text no longer sits under every menu screen | Marz's request for new players. Keeps the title screen clean and gives the controls a page of their own. |
| 2026-11-01 | Counter cut is taught with words, not an in-fight marker: the round banner says why it was an instant K.O. ("hit while winding up a heavy" / "hit right after missing a slash"), and How to play explains the two open moments | Marz's pick after the first online playtest, where the instant kill felt unexplained. A marker over open fighters was offered and declined for now; revisit if players still miss it. |
| 2026-11-01 | Jump: 10 frames stuck on landing after an air slash. How to play teaches the answer (guard high, or slash high to knock jumpers down) | Playtest: the jump-in felt oppressive. It was always blockable high, but players didn't know, and a blocked jump-in cost nothing. Marz's pick over also shortening the jump. |
| 2026-11-01 | The mouse is locked to the game during a fight, with a drawn crosshair; Esc frees it, the match end releases it | Marz's request: the cursor slipping out of the window mid-fight drops guards and clicks. |
| 2026-11-01 | Custom rooms: the room creator picks rounds (best of 1/3/5/7 or endless), health (50/80/100/150) and the timer (30/60/90 s or none); the server checks the choice and sends it to both players. Quick match keeps the defaults | Marz's request and picks. The rules live in each match's data, so both browsers still compute the same fight. Quick match stays standard so strangers always know what they're getting. |
| 2026-11-01 | Endless mode: one round per bot, strip carries over, half a strip back every 5 bots, bots level up every 5, one loss ends the run, best run kept in the browser. Pulls part of "the computer fighter" forward from Milestone 4 | Marz's request and picks (partial heal over full heal; local best over an online leaderboard). Gives solo players a goal. Note: this is new content ahead of the hit-feel work (#7–#9), which pillar 2 ("feel first") would put first; Marz chose to add it now. |
| 2026-11-01 | Sound pass: a mix of free CC0 recordings (Kenney) for the big moments and code-made sounds for the rest, every sound with a code-made fallback. Answers the open "sound style" question | Marz's pick (my recommendation). Recorded clashes and tears feel best (pillar 2); code keeps the download small and the game never silent. |
| 2026-11-01 | Clash gets its own sound (a bright double blade ring with a paper snap), separate from block and parry | Marz's request: blades meeting should sound like it. Different sounds for clash, block and parry help read the exchange (pillar 3). |
| 2026-11-01 | Music: a reactive drum loop made in code (taiko, koto-like plucks); busier in tense moments, silent after a K.O. | Marz's pick. Reacts to the fight, no music files, fresh melodies so it doesn't loop stale. |
| 2026-11-01 | Round start: kabuki wooden clappers for "Round N", a taiko hit for "Cut!"; no announcer voice | Marz's pick. Fits the stage feel; a voice needs recordings and computer voices sound bad. |
| 2026-11-01 | A heavy's wind-up makes a quiet rising creak | My addition: the counter-cut opening can be heard as well as seen (pillar 3). Kept quiet so it informs without making heavies trivial to react to; easy to turn down if it does. |
| 2026-11-01 | Separate Music and Effects volume sliders replace the Sound on/off button | Standard for any game with music. |
| 2026-11-01 | Cut sounds: the knife-slice recording plus a soft code-made paper tear; the squeaky interface "scratch" recordings are dropped. The counter cut's sword-draw shing stays | Marz's playtest of #19: cuts squeaked, the counter cut sounded great (pillar 2). |
| 2026-11-01 | Tournaments: 3 to 8 players, single-elimination bracket with byes, one fight at a time with everyone else watching live, the creator's rules for every fight (no endless rounds), names typed in the lobby. The two fighters report the winner and the server only accepts it when both agree (otherwise the fight is replayed); a player who leaves forfeits | Marz's request and picks. Watching costs almost nothing because only inputs travel: watchers run the same fight from both players' inputs. Knockout keeps an 8-player evening to 7 fights. |
