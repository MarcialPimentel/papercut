# Papercut — Art direction (v4: mouse-driven paper fighting game)
_v4, 2026-11-01. v1 (2026-10-30) was a flat side-view look; v2 made it 3D with a run-across-the-pages match; v3 made it a weapon fighting game; v4 moves the fighting to the mouse and adds feint and riposte. Decisions are logged in the [GDD](GDD.md)._

Playable mock-up: [art/papercut-mockup.html](art/papercut-mockup.html) (open it in a desktop browser). Kami with the mouse against Sumi as a practice dummy (two players on one PC is out of scope; PvP is online). It's a look test: timings and damage are placeholders that Milestone 1 tunes.

## The short version
- **World:** the Notebook Dojo. A pop-up feudal Japan made of stationery, as a real 3D book open on a desk. Each round is fought on a different spread.
- **Fighters:** papercraft samurai, like cardboard puppets assembled from overlapping cut construction paper (since 2026-11-02, from Marz's art direction and Blender model guide). Flat, angular, layered pieces with a thick ink line round every piece and a thin cream rim round the figure; the body faces the camera, the head is in profile toward the rival. Animation is rigid stop-motion: pieces turn on pivots and snap between held key poses.
- **The red rule:** paper is red inside. Red only appears where paper is cut: slash marks, the K.O. split's cut edge, the health strip's cut edge.
- **The fight:** the cursor sets your guard (above the waist high, below low), left click light, right click heavy, feint, parry into riposte, jump, dash. Catch the rival mid-heavy or after a miss and it's a counter cut: instant K.O.
- **Technology:** Three.js, no new stack. Moves as data on a fixed 60-frame clock, ready for rollback online. Rapier for the falling halves.
- **Making the art:** the samurai is modelled in Blender to Marz's model guide (`art/fighters/samurai.blend`; guide in [blender-pipeline.md](blender-pipeline.md)). The game adds the ink lines, the cream rim, the red inside and the cut marks.

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

## Fighters: papercraft samurai
_Since 2026-11-02, from Marz's art-direction brief ("Stylized 2D Papercraft"), his character sheet and his "Japanese Swordfighter – Blender Model Guide". Earlier previews on the way there: animation styles https://claude.ai/artifact/XhTD4K59tCYokVW3139tst (he picked pose snaps), outline swatches https://claude.ai/artifact/JPJvyT9A9TX2djjnJQJoHc (bold ink), the mock-up tests https://claude.ai/artifact/1yDXZixrykY63xYeAsQuBd._

**The brief, in short.** Flat, geometric construction-paper cutouts (inspired by Paper Mario, South Park, Mr. Game & Watch, Samurai Jack and Kartana's silhouette). Characters are paper puppets built from overlapping pieces of coloured card: simple angular shapes, bold slightly exaggerated silhouettes, big triangular and trapezoidal kimono and hakama panels, minimal faces. Thick consistent dark outlines, a limited muted high-contrast palette, solid fills, subtle paper grain, optional thin off-white borders. Depth from overlap, not volume. Animation like stop-motion puppetry: pieces rotate on fixed pivots, discrete poses with few in-betweens, instant snaps, exaggerated anticipation; no deformation or cloth simulation. *"If it cannot be recreated by cutting colored paper into shapes, stacking those shapes, and rotating them around simple joints, it does not belong in this art style."*

**The model** (exact numbers in [blender-pipeline.md](blender-pipeline.md)): 4.00 units tall, 2.80 wide, 0.40 deep; head 0.90, torso 1.00, belt 0.40, hakama 1.50, feet 0.20. Seven layers, back to front: feet, hakama, outer robe, sleeves, collar and inner kimono, face, hair and topknot. The body faces the camera; the head is in profile toward the rival. A rig of pivots: root > torso > head, the sleeves on the shoulders with the mitten hands at their openings, the sword on the right hand, the hakama halves on the hips. About 280 triangles.

**The look:** a cream inner kimono with a crossed collar, a cream obi with a knot and tails, an indigo outer robe with wide cream lapels and cream waves at the hem, big flared sleeves with a blossom crest and cream waves, two-tone indigo hakama, black feet, a big profile head (cream face, wedge nose, slash eye) under a black hair block with a tall topknot and gold tie, and a long katana with a gold-wrapped hilt and black guard.

**Kami and Sumi:** the same robes inverted, and different outlines (#37, Marz's picks 2026-11-02). Kami wears indigo over cream, with the topknot and wide hanging sleeves. Sumi wears cream over indigo (indigo prints), a wide straw hat over short hair, and sleeves tied back above the elbow with a red cord, with bare forearms. One rig and piece list: pieces named `kami_...` / `sumi_...` in the Blender file are worn by that fighter only ([blender-pipeline.md](blender-pipeline.md), step 7). Hakama and gold stay the same.

**In the game:** a thick ink line round every paper piece (seen wherever it overlaps paper behind it), a thin cream rim round the whole figure, the sword outlined on its own. Hits cut a red slash through every piece the blade crosses. The K.O. cuts every piece along the blade; each half keeps its outline, shows a thin red edge, and falls as paper physics. A fighter facing left is drawn mirrored. Poses snap like stop-motion (one in-between at most); turning around, the cut-out flips through edge-on.

**Readability:** the blade angle shows the guard (high points up at the rival's head, low points down), the robe colours show who's who, and the outline holds the figure against any paper.

Deviation from the brief, on purpose: the red sun in Marz's character sheet stays yellow in the game, because red is only for cuts.

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
> Original paper cut-out samurai puppet, flat pieces of coloured card joined at the joints like a split-pin puppet, body facing the viewer with the head in profile, wide kimono sleeves, flared pleated hakama, black paper hair with a topknot, stern face with a heavy brow, indigo sash, katana with an indigo-wrapped grip, one bold black outline with a thin white rim around the whole figure, the sword outlined separately, kendo stance with arms extended, standing on blue graph paper in an open notebook, flat colors, straight edges only, no text, no red anywhere.

Check the commercial-use terms of any image tool, and don't name other franchises' characters in prompts.

## Decided 2026-11-01 (updated 2026-11-02)
- A 3D weapon fighting game: paper health strip plus red body cuts, best of 5 rounds of 60 seconds with page turns between, the cursor guard stance (above or below the waist), light and heavy slashes, fast feet and deadly commits, the counter cut as the touch of death.
- Kami (player 1) and Sumi (player 2 / dummy); Rapier physics for the cut halves (cosmetic).
- 2026-11-02: fighters are papercraft samurai modelled in Blender to Marz's model guide, moving in stop-motion pose snaps; Endless keeps the last 5 bots' halves on the page.
- Mouse controls: cursor guard, left click light, right click heavy, keyboard movement; feint and riposte; no two players on one PC, no gamepads for now.
- A practice dummy in Milestone 1 and a computer fighter later; one shared move set in Milestone 1; simple specials later.
- Since the first build (2026-11-02): Endless mode, custom room rules and tournaments use the same two looks (Kami and Sumi) with player names on the HUD; their rules are in the GDD. Whether bots and tournament players get looks of their own is an open art question.
