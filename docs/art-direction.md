# Papercut — Art direction (v2: 3D)
_v2, 2026-11-01. v1 (2026-10-30) was a flat side-view look; Marz liked the style and asked to go all out on 3D while keeping PvP, the page match and jump. Decisions are logged in the [GDD](GDD.md)._

Playable mock-up: [art/papercut-mockup.html](art/papercut-mockup.html) (open it in a desktop browser). Two players on one keyboard, or Kami against Sumi as a dummy. It's a look test: timings and rules are placeholders that Milestone 1 tunes.

## The short version
- **World:** the Notebook Dojo. A pop-up feudal Japan built from stationery, now a real 3D book open on a desk. Each spread is a different paper: graph, ruled, legal pad, marble cover.
- **Fighters:** folded low-poly papercraft samurai with crisp facets, a white sticker outline and an ink edge around every part.
- **The red rule:** every fighter is a hollow paper shell, white outside and red inside. A cut opens the shell, so red only appears where paper is cut.
- **The match:** one clean cut kills; the winner gets the way and runs for the page edge; turn the last page onto the rival's cover to win.
- **Technology:** Three.js, no new stack. Faceted shells, an inverted-hull outline, clipping-plane cuts, and a fixed-step game loop ready for online play.
- **Making the art:** code-made fighters for Milestone 1, then low-poly models rigged in Blender. The game adds the outline and the red inside to any model.

References Marz shared (style inspiration only, nothing copied): Kartana (white/red folded blade), the Samurai Jack poster (flat angular shapes, thin lines), Paper Mario (white sticker border), ruled and graph paper, a marble composition notebook, South Park's cut-paper look.

## Fighters in 3D
Each body part is a low-poly folded shape (diamond-section torso and limbs, a faceted head, flared hakama legs), flat-shaded so every fold shows as a lighter and a darker facet. From the same model the game builds:

| Layer | What it is |
|---|---|
| Ink edge | A slightly bigger copy drawn inside out in ink: the thin outer hairline |
| Sticker | A bigger copy drawn inside out in white: the sticker border, so every part looks cut out |
| Paper shell | The model itself, flat-shaded white (or the fighter's accent color) |
| Red inside | The shell's inside faces plus a slightly smaller core, in cut red; invisible until a cut opens the shell (only built on cut fighters) |

A cut is a plane through the whole fighter along the blade's path. The fighter is drawn twice, once on each side of the plane, with the white layers stopping a hair short of it, so a thin red line opens along the cut. As the halves tumble apart you see into the red inside. Halves stay on the page until it turns, so a long fight litters the spread with red.

Readability first: a side-on camera with a slight angle to show volume, an outline on every part against any paper, and guard height readable from the blade alone.

## The match: across the notebook
| Kami's cover | Legal Pad Grove | Graph Paper Dojo | Ruled Courtyard | Sumi's cover |
|---|---|---|---|---|
| Sumi wins here | Bamboo | Start | Castle | Kami wins here |

- **One clean cut kills.** The loser splits, then refolds a moment later ahead of the winner, standing in the way.
- **Whoever cut last has the way.** Only they can run off the page edge toward the rival's cover; the page turns and the fight goes on.
- **Block** (same height), **parry** (switch to that height at the last moment: the attacker staggers), **clash** (same-height slashes at the same moment bounce).
- **Jump** clears a low slash or hops a blocker. **Dodge** hops back.
- Depth: few buttons, many reads (high or low, strike or wait, jump the low slash, bait a parry, or just run when you have the way). The page push is a classic duel structure, told through our notebook: pages turn, covers close, the red stays on the paper.

## Setting and names
| Thing | Name | Notes |
|---|---|---|
| Player 1 | **Kami** | 紙, "paper". White gi and hakama, indigo sash and grip |
| Player 2 / practice dummy | **Sumi** | 墨, "ink". Black hakama, gold sash |
| Middle spread (start) | **Graph Paper Dojo** | Folded marble mountains, black torii, legal-yellow sun |
| Toward Sumi | **Ruled Courtyard** | A white castle, ink sun |
| Toward Kami | **Legal Pad Grove** | Bamboo rolled from yellow pad paper |
| The goals | **Kami's cover** / **Sumi's cover** | Marble covers at night: paper moon, lanterns |

Code IDs will be short English (`kami`, `sumi`, `graph_dojo`), so display names can change freely.

**Tone rules**
- Samurai film, school-desk materials: stern, quiet characters; the charm lives in the materials.
- Straight lines and flat facets only: no smooth curves, even on the sun and moon.
- Red is paper, not blood: cuts read as dramatic, never gory.
- Reference, not copy: no characters, faces, logos or signature shapes from the references; no real brand names (the marble covers have no label).
- Japan as seasoning: names, torii, katana, hakama. Any visible Japanese text gets checked by a native speaker before release.

## Palette (unchanged from v1)
| Name | Hex | Role |
|---|---|---|
| Paper white | `#FBFAF6` | Fighter shells; the main color |
| Fold grey | `#DCD8CF` | Far limbs, shaded facets |
| Sumi ink | `#18171C` | Edges, hair, gates |
| Cut red | `#D7262E` | The inside of the paper. Only where cut |
| Core shadow | `#8F1219` | Deep inside the cut |
| Blade steel | `#E9EEF2` | Blades |
| Graph blue | `#9CC0DC` | Grid and ruled lines |
| Legal yellow | `#F6E27F` | Sun, glints, tells |
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

Icons in `art/icons/` (katana, high, low, jump, clean cut, dodge): flat paper shapes, straight edges, white sticker border with an ink hairline, two tones at most, side view, red only on a cut, on a light graph-paper tile. Menus and icons stay flat paper; only the world is 3D.

## Interaction map
| System | How it looks | Player does | M1 issue |
|---|---|---|---|
| Move | Walk the lane; hakama legs swing | A / D | #3 |
| Guard | Blade high over the shoulder or low and forward | W / S | #5 |
| Slash | Wind-up, then one thin razor line: ink for a miss or block, red for a cut | F | #5, #8 |
| Block / parry / clash | "Block" sticker and paper chips; parry adds a yellow glint and a stagger; clash bounces both | Guard at the right height | #5 |
| Jump | A paper hop; low slashes pass underneath | Space | #5 |
| Dodge | Quick hop back | Q | #5 |
| Tell (dummy) | A legal-yellow star glints on Sumi's blade before a guard switch | Read it, strike in the gap | #6 |
| Kill | 3D split along the blade line, red inside, slow motion, camera swings to three-quarter view | Land a clean cut | #7, #8 |
| Refold | The loser folds up out of the page ahead of the winner | (automatic) | #7 |
| Page turn | Everything folds flat, the page swings over the spine, the next spread's pop-ups rise | Reach the edge with the way | new |
| Win | The last page turns onto the rival's marble cover at night | Reach the cover | new |

## Technology
| Option | Verdict |
|---|---|
| **Faceted shells + inverted-hull outline + clipping-plane cuts (recommended)** | What the mock-up runs on. Works on any model, including skinned Blender ones. A cut is two clipped copies; the red inside comes free from the shell's inner faces. |
| Screen-space outline (post-processing) | One outline around everything loses the per-part "cut out" look; extra full-screen pass; fiddly white-plus-ink double edge. |
| Real mesh cutting (3D boolean) | True cut faces, but slow, fragile on skinned meshes and hard to keep in sync online. Clipping looks the same from the game's camera. |
| Toon shader with smooth models | Reads as cartoon, not paper. Folded facets are the identity. |
| Rapier physics for halves | **Chosen by Marz for Milestone 1.** Halves are cosmetic physics bodies that bounce off pop-ups and pile up; never part of the rules. |

**Built for online from day one:** fixed 60-steps-per-second rules decided only by inputs, in tested code separate from drawing; cosmetic effects never affect results. Milestone 2 sends only inputs between two browsers (WebRTC) with rollback, plus a small service to connect players by invite link.

Budgets: under 2 MB to the first duel (generated paper textures); a fighter is about 15 parts, roughly 1,500 triangles with outlines; scene under 30,000 triangles and 500 draw calls with halves on the page; 60 fps on integrated laptop graphics with one 2048 shadow map.

## Making the art
- **Milestone 1:** Kami and Sumi from code shapes (as in the mock-up).
- **Milestone 3:** Kami remade in Blender: low-poly parts from 4- and 6-sided cylinders, big facets (no subdivision or bevels), flat shading, one plain color per part, one bone per part, exported as `.glb`. A full click-by-click guide comes with that milestone.
- **Later:** new fighters and blades follow the same part list, so each one is a modeling job, not a coding job.

Concept prompt:
> Original low-poly papercraft samurai character, folded white paper with crisp flat facets like origami, three-quarter view, diamond-shaped torso and limbs, wide flared hakama trousers, black paper hair with a topknot, indigo sash, katana with an indigo-wrapped grip, thick white sticker outline with a thin black edge around each piece, standing on blue graph paper in an open notebook, soft drop shadow, flat colors, no text, no red anywhere.

Check the commercial-use terms of any image tool, and don't name other franchises' characters in prompts.

## Decided 2026-11-01
- Names: Kami (player 1) and Sumi (player 2 / dummy).
- Motion: smooth poses.
- Rapier physics for the cut halves from Milestone 1 (cosmetic only).

Risks: online play is the biggest technical job (Milestone 2), and 3D models are slower to make than flat pieces; keeping parts low-poly and letting the game add outlines and the red inside keeps that manageable.
