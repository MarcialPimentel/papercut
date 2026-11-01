# Papercut — Art direction (v4: mouse-driven paper fighting game)
_v4, 2026-11-01. v1 (2026-10-30) was a flat side-view look; v2 made it 3D with a run-across-the-pages match; v3 made it a weapon fighting game; v4 moves the fighting to the mouse and adds feint and riposte. Decisions are logged in the [GDD](GDD.md)._

Playable mock-up: [art/papercut-mockup.html](art/papercut-mockup.html) (open it in a desktop browser). Kami with the mouse against Sumi as a practice dummy (two players on one PC is out of scope; PvP is online). It's a look test: timings and damage are placeholders that Milestone 1 tunes.

## The short version
- **World:** the Notebook Dojo. A pop-up feudal Japan made of stationery, as a real 3D book open on a desk. Each round is fought on a different spread.
- **Fighters:** folded low-poly papercraft samurai with crisp facets, a white sticker outline and an ink edge around every part.
- **The red rule:** every fighter is a hollow paper shell, white outside and red inside. Red only appears where paper is cut: hits, the K.O. split, the health strip's cut edge.
- **The fight:** the cursor sets your guard (above the waist high, below low), left click light, right click heavy, feint, parry into riposte, jump, dash. Catch the rival mid-heavy or after a miss and it's a counter cut: instant K.O.
- **Technology:** Three.js, no new stack. Moves as data on a fixed 60-frame clock, ready for rollback online. Rapier for the falling halves.
- **Making the art:** code-made fighters for Milestone 1, then low-poly models rigged in Blender. The game adds outlines, the red inside and cut marks to any model.

References Marz shared (inspiration only, nothing copied): Samurai Shodown (heavy-hit weapon fighting), Chivalry (mouse swordplay, feints, ripostes), Kartana (white/red folded blade), the Samurai Jack poster (flat angular shapes, thin lines), Paper Mario (white sticker border), ruled and graph paper, a marble composition notebook, South Park's cut-paper look. The counter cut, the guard stance and the paper damage are ours.

## How a fight works
| Move | Speed | Effect | Risk |
|---|---|---|---|
| Light slash (left click) | Fast wind-up, short recovery | 10% of the strip, a thin red cut | Safe if blocked; a miss leaves a short opening |
| Heavy slash (right click) | Slow wind-up, long recovery | 35% of the strip, a wide cut across two parts; chips 3% through a block | While it winds up, any hit is a counter cut |
| Feint (left click or Q mid wind-up) | Cancels a heavy, back to guard fast | Baits a counter-cut attempt | Only before the swing is nearly out |
| Guard (cursor height) | Instant, works while walking | Blocks slashes at that height | Wrong height: you're cut |
| Parry, then riposte | Flick the cursor to the right height at the last moment | Attacker staggers; your next slash is a riposte (light speed, heavy damage, a lunge, can't be parried) | Too early is a block, too late is a hit |
| Jump (Space or W) | A paper hop | Low slashes pass under; air slashes cut high | High slashes still hit |
| Dash / backdash (double-tap) | Quick | Get in, get out | Committed for a moment |
| Counter cut | Any hit at the right moment | Instant K.O. and split | Only on a heavy's wind-up or after a miss; two lights trading just do normal damage |

**Rounds:** 60 seconds; a K.O. or the most strip left at time wins; a tie replays. Best of 3. Between rounds everything folds flat and the page turns: round 1 Graph Paper Dojo, round 2 Ruled Courtyard, round 3 Legal Pad Grove. The match winner stands alone on the marble back cover.

**Depth:** spacing at the tip of your light slash, reading the guard, feinting a heavy to bait their counter cut, parrying a predictable swing into a riposte, jumping a low, and the clock pressing on whoever is behind. Every round can turn on one greedy swing.

## HUD
- **Health strip:** a strip of graph paper per fighter; each hit slices a piece off its inner end, which falls away. The cut end is a red edge. No numbers.
- **Clock:** a paper tag counting down from 60.
- **Round markers:** two paper diamonds per fighter, filled red for each round won.
- **Banners:** red paper banners for "Round 1", "Cut!", round winner and match winner.
- **Stickers:** "Block", "Clash", "Parry", "Feint", "Riposte", "Cut", "Counter cut".
- **Touch buttons** appear only on screens without a mouse. The cursor is a crosshair over the stage.
- Menus and HUD stay flat paper; only the world is 3D.

## Fighters in 3D
Each body part is a low-poly folded shape (diamond-section torso and limbs, a faceted head, flared hakama legs), flat-shaded so every fold shows as a lighter and a darker facet. From the same model the game builds:

| Layer | What it is |
|---|---|
| Ink edge | A slightly bigger copy drawn inside out in ink: the thin outer hairline |
| Sticker | A bigger copy drawn inside out in white: the sticker border, so every part looks cut out |
| Paper shell | The model itself, flat-shaded white (or the fighter's accent color) |
| Hit cuts | The struck part redrawn in red, slightly bigger, clipped to a thin band along the slash, so the cut wraps around the folds |
| Red inside | The shell's inside faces plus a slightly smaller core, in cut red; only built for a fighter that has been split |

The K.O. is a plane through the whole fighter along the blade's path. The fighter is drawn twice, once on each side of the plane, with the white layers stopping a hair short of it, so a thin red line opens; as the halves fall you see into the red inside. Earlier hit cuts stay on the halves, and halves stay on the page until it turns.

Readability first: a side-on camera with a slight angle to show volume, an outline on every part against any paper, and guard height readable from the blade alone.

## Setting and names
| Thing | Name | Notes |
|---|---|---|
| Player 1 | **Kami** | 紙, "paper". White gi and hakama, indigo sash and grip |
| Player 2 / practice dummy | **Sumi** | 墨, "ink". Black hakama, gold sash |
| Round 1 | **Graph Paper Dojo** | Folded marble mountains, black torii, legal-yellow sun |
| Round 2 | **Ruled Courtyard** | A white castle, ink sun |
| Round 3 | **Legal Pad Grove** | Bamboo rolled from yellow pad paper |
| Match win | **The back cover** | Marble at night: paper moon, lanterns |

Code IDs will be short English (`kami`, `sumi`, `graph_dojo`), so display names can change freely.

**Tone rules**
- Samurai film, school-desk materials: stern, quiet characters; the charm lives in the materials.
- Straight lines and flat facets only: no smooth curves, even on the sun and moon.
- Red is paper, not blood: cuts read as dramatic, never gory.
- Reference, not copy: no characters, faces, logos, signature moves or systems from the references; no real brand names (the marble covers have no label).
- Japan as seasoning: names, torii, katana, hakama. Any visible Japanese text gets checked by a native speaker before release.

## Palette (unchanged)
| Name | Hex | Role |
|---|---|---|
| Paper white | `#FBFAF6` | Fighter shells; the main color |
| Fold grey | `#DCD8CF` | Far limbs, shaded facets |
| Sumi ink | `#18171C` | Edges, hair, gates |
| Cut red | `#D7262E` | The inside of the paper. Only where cut |
| Core shadow | `#8F1219` | Deep inside the cut |
| Blade steel | `#E9EEF2` | Blades |
| Graph blue | `#9CC0DC` | Grid and ruled lines |
| Legal yellow | `#F6E27F` | Sun, glints, tells, parries |
| Marble black | `#141316` | Covers, night |
| Kraft card | `#B98B5E` | The desk |
| Indigo | `#2E3F8F` | Kami's accent |
| Gold | `#D9A21B` | Sumi's accent |

Menu tokens (all text passes WCAG AA; lowest pair 5.6:1):

| Token | Day (desk paper) | Night (marble cover) |
|---|---|---|
| Background | `#F5F4EF` | `#121115` |
| Card | `#FFFFFF` | `#1C1B20` |
| Text | `#18171C` (16.2:1) | `#F3F1EA` (16.6:1) |
| Muted text | `#57555E` (6.7:1) | `#A8A5AE` (7.8:1) |
| Red text / links | `#B0141C` (6.4:1) | `#FF6F6F` (6.9:1) |
| Blue labels | `#2A5F8F` (6.1:1) | `#8DBAE3` (9.2:1) |

## Type and icons
- **Display:** Big Shoulders Stencil Display (stencil letters are cut from paper).
- **Body:** Atkinson Hyperlegible.
- **Margin notes:** Caveat, sparingly.

Icons in `art/icons/` (katana, high, low, jump, clean cut, dodge): flat paper shapes, straight edges, white sticker border with an ink hairline, two tones at most, side view, red only on a cut, on a light graph-paper tile.

## Technology
| Option | Verdict |
|---|---|
| **Faceted shells + inverted-hull outline + clipping-plane cuts (recommended)** | What the mock-up runs on. Works on any model, including skinned Blender ones. |
| Decals or painted textures for hit marks | Float off folded facets or stretch; the clipped band follows the paper exactly. |
| Real mesh cutting (3D boolean) | Slow, fragile on skinned meshes and hard to keep in sync online. Clipping looks the same from the game's camera. |
| Rapier physics for halves | **Chosen by Marz.** Cosmetic only: halves bounce off pop-ups and pile up, never part of the rules. (The mock-up still uses scripted tumbling.) |

**Fighting-game foundations:** a fixed 60-steps-per-second clock decided only by inputs, in tested code separate from drawing; every move as data (wind-up, active and recovery frames, reach, damage, chip, stun); hit areas per move; a short input buffer (the mock-up keeps a press for 0.1 s); online by sending only inputs (input delay since the first build; rollback and WebRTC in Milestone 2).

**Budgets:** about 2 MB to the first fight, Rapier (about 1.5 MB) loading in the background; a fighter is about 15 parts, roughly 1,500 triangles with outlines; scene under 30,000 triangles and 500 draw calls with halves on the page; 60 fps on integrated laptop graphics with one 2048 shadow map.

## Making the art
- **Milestone 1:** Kami and Sumi from code shapes (as in the mock-up).
- **Milestone 3:** Kami remade in Blender: low-poly parts from 4- and 6-sided cylinders, big facets (no subdivision or bevels), flat shading, one plain color per part, one bone per part, exported as `.glb`. A full click-by-click guide comes with that milestone.
- **Later:** new fighters and blades follow the same part list, so each one is a modeling job, not a coding job.

Concept prompt:
> Original low-poly papercraft samurai character, folded white paper with crisp flat facets like origami, three-quarter view, diamond-shaped torso and limbs, wide flared hakama trousers, black paper hair with a topknot, indigo sash, katana with an indigo-wrapped grip, thick white sticker outline with a thin black edge around each piece, standing on blue graph paper in an open notebook, soft drop shadow, flat colors, no text, no red anywhere.

Check the commercial-use terms of any image tool, and don't name other franchises' characters in prompts.

## Decided 2026-11-01
- A 3D weapon fighting game: paper health strip plus red body cuts, best of 3 rounds of 60 seconds with page turns between, the W/S guard stance, light and heavy slashes, fast feet and deadly commits, the counter cut as the touch of death.
- Kami (player 1) and Sumi (player 2 / dummy); smooth motion; Rapier physics for the cut halves (cosmetic).
- Mouse controls: cursor guard, left click light, right click heavy, keyboard movement; feint and riposte; no two players on one PC, no gamepads for now.
- A practice dummy in Milestone 1 and a computer fighter later; one shared move set in Milestone 1; simple specials later.
