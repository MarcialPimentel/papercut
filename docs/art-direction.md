# Papercut — Art direction (v4: mouse-driven paper fighting game)
_v4, 2026-11-01. v1 (2026-10-30) was a flat side-view look; v2 made it 3D with a run-across-the-pages match; v3 made it a weapon fighting game; v4 moves the fighting to the mouse and adds feint and riposte. Decisions are logged in the [GDD](GDD.md)._

Playable mock-up: [art/papercut-mockup.html](art/papercut-mockup.html) (open it in a desktop browser). Kami with the mouse against Sumi as a practice dummy (two players on one PC is out of scope; PvP is online). It's a look test: timings and damage are placeholders that Milestone 1 tunes.

## The short version
- **World:** the Notebook Dojo. A pop-up feudal Japan made of stationery, as a real 3D book open on a desk. Each round is fought on a different spread.
- **Fighters:** flat cut-out paper puppets pinned at the joints, standing in the 3D book (since 2026-11-02). Every piece has a white sticker border and an ink edge. They move like cut-out animation: held key poses that snap from one to the next, while the body glides.
- **The red rule:** paper is red inside. Red only appears where paper is cut: slash marks, the K.O. split's cut edge, the health strip's cut edge.
- **The fight:** the cursor sets your guard (above the waist high, below low), left click light, right click heavy, feint, parry into riposte, jump, dash. Catch the rival mid-heavy or after a miss and it's a counter cut: instant K.O.
- **Technology:** Three.js, no new stack. Moves as data on a fixed 60-frame clock, ready for rollback online. Rapier for the falling halves.
- **Making the art:** fighters are drawn as flat pieces in Blender (`art/fighters/puppet.blend`, guide in [blender-pipeline.md](blender-pipeline.md)). The game adds the card's thickness, the border, the red inside and the cut marks.

References Marz shared (inspiration only, nothing copied): Samurai Shodown (heavy-hit weapon fighting), Chivalry (mouse swordplay, feints, ripostes), Kartana (white/red folded blade), the Samurai Jack poster (flat angular shapes, thin lines), Paper Mario (white sticker border), ruled and graph paper, a marble composition notebook, South Park's cut-paper look. The counter cut, the guard stance and the paper damage are ours.

## How a fight works
| Move | Speed | Effect | Risk |
|---|---|---|---|
| Light slash (left click) | Fast wind-up, short recovery | 10 of 80 health (an eighth of the strip), a thin red cut | Safe if blocked; a miss leaves a short opening |
| Heavy slash (right click) | Slow wind-up, long recovery | 35 of 80 health (almost half the strip), a wide cut across two parts; chips 3 through a block | While it winds up, any hit is a counter cut |
| Feint (left click or Q mid wind-up) | Cancels a heavy, back to guard fast | Baits a counter-cut attempt | Only before the swing is nearly out |
| Guard (cursor height) | Instant, works while walking | Blocks slashes at that height | Wrong height: you're cut |
| Parry, then riposte | Flick the cursor to the right height at the last moment | Attacker staggers; your next slash is a riposte (light speed, heavy damage, a lunge, can't be parried) | Too early is a block, too late is a hit |
| Jump (Space or W) | A paper hop | Low slashes pass under; air slashes cut high | High slashes still hit (nobody can block mid-air); landing after an air slash leaves you stuck for a moment |
| Dash / backdash (double-tap) | Quick | Get in, get out | Committed for a moment |
| Counter cut | Any hit at the right moment | Instant K.O. and split | Only on a heavy's wind-up or after a miss; two lights trading just do normal damage |

**Rounds:** 60 seconds; a K.O. or the most strip left at time wins; a tie replays. Best of 5 by default (a custom room or tournament can pick best of 1, 3, 5 or 7, endless rounds, other health and timers; the GDD has the details). Between rounds everything folds flat and the page turns: Graph Paper Dojo, Ruled Courtyard, Legal Pad Grove, then round again. The match winner stands alone on the marble back cover. Endless mode stays on one page: each new bot steps in beside you.

**Depth:** spacing at the tip of your light slash, reading the guard, feinting a heavy to bait their counter cut, parrying a predictable swing into a riposte, jumping a low, and the clock pressing on whoever is behind. Every round can turn on one greedy swing.

## HUD
- **Health strip:** a strip of graph paper per fighter; each hit slices a piece off its inner end, which falls away. The cut end is a red edge. No numbers.
- **Clock:** a paper tag counting down the round (60 seconds by default; ∞ when a room has no timer).
- **Round markers:** one paper diamond per round needed to win (three by default), filled red for each round won. With endless rounds, and in Endless mode, a small paper counter replaces them ("Bots cut", the bot's level).
- **Banners:** red paper banners for "Round 1", "Cut!", round winner and match winner.
- **Stickers:** "Block", "Clash", "Parry", "Feint", "Riposte", "Cut", "Counter cut".
- **Touch buttons** appear only on screens without a mouse. The cursor is a crosshair over the stage; during a fight the mouse is locked to the game and the game draws its own ink-and-red crosshair.
- Menus and HUD stay flat paper; only the world is 3D.

## Fighters: cut-out puppets
_Since 2026-11-02. Marz asked for "2D-esque" fighters that move like Paper Mario or Inferno Cop's cut-outs; this replaces the folded low-poly shells. Preview of the three animation styles he chose from: https://claude.ai/artifact/XhTD4K59tCYokVW3139tst_

Each fighter is a puppet of 11 flat card pieces, each turning on one pin: torso, head (with hair and topknot), front and back hakama legs, two feet, upper arms with wide kimono sleeves, forearms with fists, and the katana. They stand in the lane facing each other, drawn in profile; a fighter facing left is drawn mirrored, so every fighter shows the same side. Back limbs are the same pieces, shaded a little darker.

**The sash is the name tag:** it's the quickest way to tell Kami (indigo) from Sumi (gold), so it is never covered. The hakama legs sit behind the torso, and the sash is a wide band with a two-tailed knot hanging at the back of the hip (Marz's playtest of the first cut-out build: the hakama hid the belt). From each flat piece the game builds:

| Layer | What it is |
|---|---|
| Ink edge | The piece's outline grown by 4.7 cm, in ink: the thin outer hairline |
| Sticker | The outline grown by 3 cm, in white: the sticker border, so every piece looks cut out |
| Card | The piece itself, 2.2 cm thick, in its paper colour |
| Print | Details on the card (hair, face, collar, sash, pleats, grip), on both sides |
| Slash marks | A red six-sided slash where a hit crossed the paper, cut through every piece it passes (torso, sleeves, arms) |

**Motion (pose snaps):** each moment of a move has one key pose (guard, wind-up, strike, follow-through, stun, landing, dash, walk steps, jump). The puppet holds it and snaps to the next with a single in-between, like cut-out animation; the body still glides across the page, so spacing reads. A held wind-up is easier to read than a smooth one, which keeps pillar 3. **Turning around**, the card flips through edge-on in two held steps.

**The K.O.:** every piece is cut along the blade's line into two halves. The white stops 3 cm short of the line, so a thin red edge shows. The top half flies off along the blade; the legs keel over. Both are paper physics bodies (Rapier, cosmetic only): they tumble, bounce off the pop-ups and lie flat on the page until it turns. Earlier slash marks stay on the halves. In Endless, the halves of the last 5 cut bots stay on the page; older ones fold flat into it.

**Flatness is the point:** from the K.O. camera's three-quarter view the fighters show they're cards. The white border and ink edge carry them against any paper.

Readability first: a side-on camera with a slight angle, an outline on every piece against any paper, and guard height readable from the blade alone.

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
| Paper white | `#FBFAF6` | Fighter cards; the main color |
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
| **Flat card pieces, cut in 2D (in the game since 2026-11-02)** | Each piece's outline is read from the Blender model; borders, slash marks and the K.O. split are 2D shapes worked out in the piece's own plane, then given thickness. Exact, cheap, and the halves get exact physics shapes. |
| Faceted shells + inverted-hull outline + clipping-plane cuts | The first build's folded 3D fighters (and the mock-up). Replaced by the cut-outs. |
| Decals or painted textures for hit marks | Stretch or float; a slash cut into the card follows the paper exactly. |
| Rapier physics for halves | **Chosen by Marz, in the game since 2026-11-02.** Cosmetic only: halves bounce off pop-ups and pile up, never part of the rules. Loads in the background; until it has, halves use a scripted fall. |

**Fighting-game foundations:** a fixed 60-steps-per-second clock decided only by inputs, in tested code separate from drawing; every move as data (wind-up, active and recovery frames, reach, damage, chip, stun); hit areas per move; a short input buffer (the mock-up keeps a press for 0.1 s); online by sending only inputs (input delay since the first build; rollback and WebRTC in Milestone 2).

**Budgets:** about 2 MB to the first fight, Rapier (about 2 MB, 760 KB compressed) loading in the background; a fighter is 11 pieces drawn in 22 draw calls, a half in 2; scene under 30,000 triangles and 500 draw calls with halves on the page; 60 fps on integrated laptop graphics with one 2048 shadow map. The puppet file is 16 KB.

## Making the art
- **Now:** the puppet is drawn in Blender as flat pieces: `art/fighters/puppet.blend`, exported to `public/models/puppet.glb`. Straight edges only, one flat colour per shape (a Blender material named `pc_<role>`), printed details laid just in front of the paper, each piece's origin on its pin. Kami is painted in Blender; Sumi recolours a few roles (hakama, pleats, sash, grip) in code. Click-by-click guide: [blender-pipeline.md](blender-pipeline.md).
- **Next:** key poses as Blender poses (they're in code today), then new fighters and blades on the same piece list, so each one is a drawing job, not a coding job.

Concept prompt:
> Original paper cut-out samurai puppet, flat pieces of white card joined at the joints like a split-pin puppet, side view facing right, wide kimono sleeves, flared pleated hakama, black paper hair with a topknot, stern face with a heavy brow, indigo sash, katana with an indigo-wrapped grip, thick white sticker border with a thin black edge around each piece, standing on blue graph paper in an open notebook, flat colors, straight edges only, no text, no red anywhere.

Check the commercial-use terms of any image tool, and don't name other franchises' characters in prompts.

## Decided 2026-11-01 (updated 2026-11-02)
- A 3D weapon fighting game: paper health strip plus red body cuts, best of 5 rounds of 60 seconds with page turns between, the cursor guard stance (above or below the waist), light and heavy slashes, fast feet and deadly commits, the counter cut as the touch of death.
- Kami (player 1) and Sumi (player 2 / dummy); Rapier physics for the cut halves (cosmetic).
- 2026-11-02: fighters are flat cut-out puppets made in Blender, moving in pose snaps; Endless keeps the last 5 bots' halves on the page.
- Mouse controls: cursor guard, left click light, right click heavy, keyboard movement; feint and riposte; no two players on one PC, no gamepads for now.
- A practice dummy in Milestone 1 and a computer fighter later; one shared move set in Milestone 1; simple specials later.
- Since the first build (2026-11-02): Endless mode, custom room rules and tournaments use the same two looks (Kami and Sumi) with player names on the HUD; their rules are in the GDD. Whether bots and tournament players get looks of their own is an open art question.
