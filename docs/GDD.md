# Papercut — Game Design Document
_Status: design set (first design session, 2026-10-30). Next: Milestone 1, "Feel test: cutting paper". Source of truth for what the game is._

## Pitch
You are a paper swordfighter who duels other papercraft warriors in a pop-up diorama arena, where every hit really cuts, tears and crumples your opponent.

Art reference: the flat, papercraft look of Paper Mario (inspiration for the style only: our own characters and world, no borrowed characters or settings). Duel references: Nidhogg (simple, tense, readable), Bushido Blade (a few clean cuts decide it).

## Player fantasy
A calm, sharp duelist who reads the opponent, guesses right, and lands the clean cut, then watches it slice through their paper. Duels are short and tense: a few clean cuts decide them, and every cut leaves its mark.

## Core loop (30 seconds / one session / long term)
- **30 seconds:** step in and out of range, read whether the foe guards high or low, then slash at the open height, block, or hop back. A clean cut visibly tears their paper; three cuts and they split apart.
- **One session:** a short run of duels against AI fighters, each with its own blade, rhythm and tells (from Milestone 3).
- **Long term:** new fighters, blades and arenas, each one a new Blender model and rig to test. Kept small on purpose: the game is also a test bed.

## Design pillars (every feature must serve one; in a conflict the lower number wins)
1. **Every cut shows:** damage is the paper itself (tears, hanging flaps, loose pieces). No health bars, no numbers.
2. **Feel first:** a slash must feel good against a dummy (hitstop, shake, sound, slash trail) before any new content is added.
3. **Read it at a glance:** side-on duel lane, fighters always broadside, clear tells, few buttons.
4. **Pop-up diorama:** everything looks handmade from paper and card, like a pop-up book stage.
5. **Test bed for art:** every fighter and blade goes through one documented Blender → game pipeline, so models, rigs and animations are easy to try.

## The duel (rules)
- **The lane:** both fighters stand on one line and always face each other. They move left and right only. The camera looks from the side, so fighters are always seen flat-on. The arena around them is a fully 3D pop-up diorama.
- **Fighters:** pinned paper dolls. Flat card pieces (head, torso, upper/lower arms, legs) joined at pins like a split-pin puppet. Each piece is one bone in the rig.
- **Stance:** a fighter holds their blade **high** or **low** (up/down). When not attacking, they guard at that height.
- **Slash:** cuts at your current stance height. Wind-up (the tell), a short active moment, then recovery (the opening).
  - Slash meets a guard at the **same** height: **blocked** (sparks of paper dust, both pushed back a little).
  - Slash meets a guard at the **other** height, or a fighter mid-wind-up or recovery: **clean cut**.
  - Defender switches to the matching height in the last moment before impact: **parry**. The attacker staggers and is open.
- **Dodge:** a quick hop backwards out of range, with a short recovery.
- **Winning:** no health bar. Each clean cut leaves a visible tear on the fighter. The third cut splits them apart and ends the duel.
- **Camera:** side-on, slides and zooms to keep both fighters framed. On the finishing cut it punches in with a brief slow-mo so you see the paper split.
- **Controls:**

  | Action | Keyboard | Gamepad |
  |---|---|---|
  | Move | A / D | Left stick |
  | Stance high / low | W / S | Left stick up / down |
  | Slash | J | X / Square |
  | Dodge back | K | A / Cross |
  | Restart (first playable) | R | Start |

- **Opponents:** a training dummy first, then AI fighters. Local 2-player on one PC is a likely later add.

## Paper damage (approach)
Cheap tricks first, nothing procedural until they fall short:
1. **Cut 1:** a torn edge appears where the blade hit (a swapped texture or a pre-made torn piece) and a small flap hangs on a pin.
2. **Cut 2:** a bigger tear; a piece (an arm or part of the torso) hangs loose from its pin and swings.
3. **Cut 3 (finish):** the doll splits along the cut. The halves become physics pieces (Rapier) that fall and crumple on the floor.

## Platform and tech
- **Platform:** desktop, played in a desktop browser with keyboard and mouse or gamepad. Can be wrapped as a desktop app later if Steam ever makes sense.
- **Stack:** TypeScript, Vite, Three.js (rendering, skinned models, animation), Rapier (physics: split pieces, debris, knockback). Hit rules (stance, block, parry, cut) are plain game logic with unit tests, not physics.
- **Art pipeline:** Blender → glTF (`.glb`) with rigs and animations, loaded by Three.js. Milestone 1 builds the doll from flat card shapes in code; Milestone 2 swaps in a rigged Blender doll and documents the pipeline.
- **Deploy:** GitHub Pages. Every merge to `main` goes live at a public link.

## Scope for the first playable (Milestone 1: "Feel test: cutting paper")
The one question it answers: **is cutting paper fun on its own?**
- **In:** a grey-box lane and floor; your paper doll (code-made card pieces); a training dummy that holds a guard and switches high/low on a timer with a visible tell; move, stance, slash, block, parry, dodge; hitstop, camera shake, slash trail, paper sounds; three visible damage stages ending in a split, with the finishing punch-in; R to restart; an on-screen tuning panel for the feel numbers (timings, hitstop, shake).
- **Out:** AI fighters, menus, real arenas, Blender art, 2-player, rounds and best-of-3.
- **Done when:** Marz can spend five minutes hitting the dummy and it feels good, and the tuned feel numbers are saved as the defaults.

## Roadmap (proposed; issue-level plan in [roadmap.md](roadmap.md))
1. **Milestone 1, Feel test: cutting paper.** The first playable above.
2. **Milestone 2, Paper doll from Blender.** One rigged doll and one blade made in Blender, exported to glTF, replacing the code doll. Click-by-click pipeline doc in `docs/`.
3. **Milestone 3, First duel.** One AI fighter with clear tells, a first pop-up diorama arena, best-of-3, simple start and win screens.

Later candidates (only once the duel is fun): more fighters and blades, local 2-player, sidestep, more arenas.

## Risks and how we'll test them
- **Game feel is the whole game (tested first, Milestone 1):** a weak slash sinks it. The first playable is a feel test against a dummy, with a tuning panel so feel can be adjusted live.
- **Paper damage tech (tested in Milestone 1):** real mesh cutting is hard. Use the cheap tricks above (swapped torn pieces, flaps on pins, physics halves) and only go further if they don't read.
- **Readability of flat fighters in 3D:** solved by design with the side-on lane; still check that tells read clearly at the camera's widest zoom.
- **Blender → game pipeline (Milestone 2):** rigs, skinning and export settings can eat time. Prove it with one doll and document it before making more.
- **Scope creep:** a "test bed" grows forever. Hold to one arena and two fighters until the duel is fun.

## Open questions (for later milestones)
- How long are wind-up, active and recovery for a slash? (Tuned in Milestone 1; record the final numbers here.)
- Does dodge have invincibility, or only distance?
- What makes each AI fighter different: speed, reach, blade type, tells? (Milestone 3)
- Best-of-3 rounds, or a single duel per match? (Milestone 3)
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
