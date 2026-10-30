# Papercut — Art direction proposal
_Draft, 2026-10-30, for Marz. Not approved yet: the GDD is unchanged until the decisions at the bottom are answered._

Playable mock-up: [art/papercut-mockup.html](art/papercut-mockup.html) (open it in a browser). It's a look test; timings and hit rules are placeholders.

## The short version
- **World:** the Notebook Dojo, a feudal-Japan pop-up stage built from school stationery: graph paper floors, marble-cover mountains, legal-pad bamboo.
- **Fighters:** paper samurai with flat, angular, straight-edged shapes and a white sticker border. Every piece is cut card on a pin.
- **The red rule:** the world is white, ink and paper colors. Red appears only where paper is cut: fighters are two-ply card with a red core.
- **Technology:** Three.js flat shapes. The game draws each border itself, and cuts are real: the doll is sliced along the blade's line with clipping planes.
- **Making the art:** code-made dolls for Milestone 1. From Milestone 2, flat pieces drawn in Blender; the game adds borders, core and cuts.

References Marz shared (style inspiration only, nothing copied): Kartana (white/red origami blade), the Samurai Jack poster (flat angular shapes, thin lines), Paper Mario (white sticker border), ruled and graph paper, a marble composition notebook, South Park's cut-paper look.

## Setting
**A. The Notebook Dojo (recommended).** A pop-up feudal Japan built from a kid's desk. The floor is a sheet of graph paper bent up into a backdrop; mountains are cut from a marble notebook cover, the sun from a legal pad, clouds from ruled paper, gates from black card. Each arena is a different paper. It uses everything Marz sent, gives every arena an identity at almost no art cost, and white fighters read instantly on grid or ruled paper.

**B. Washi pop-up book (lower risk, less ours).** Rice paper, ink-wash mountains, origami props. Prettier alone, but close to many existing papercraft games, it drops the stationery ideas, and soft ink-wash backdrops compete with white fighters.

| Today | New name | Why |
|---|---|---|
| Player fighter | **Kami** | 紙, "paper". White gi and hakama, indigo sash and grip. |
| Training dummy / first rival | **Sumi** | 墨, "ink". Black hakama, gold sash. |
| Grey-box lane | **Graph Paper Dojo** | First arena (Milestone 1). |
| Night arena (later) | **Marble Cover Night** | White fighters glow on a black marble floor. |
| Later arenas | **Ruled Courtyard**, **Legal Pad Grove** | Ruled paper with a white castle; yellow legal paper with bamboo. |

Code IDs will be short English (`kami`, `sumi`, `graph_dojo`), so display names can change freely.

**Tone rules**
- Samurai film, school-desk materials: stern, quiet characters; the humour lives in the materials.
- Straight lines only: everything is cut with a blade. Even the sun and moon are 16-sided polygons.
- Red is paper, not blood: cuts read as dramatic, never gory.
- Reference, not copy: no characters, faces, logos or signature shapes from the references; no real brand names (the marble cover has no label).
- Japan as seasoning: names, torii, katana, hakama. Any visible Japanese text gets checked by a native speaker before release.

## Palette
World colors (never used for small text):

| Name | Hex | Role |
|---|---|---|
| Paper white | `#FBFAF6` | Fighters' faces; the main color |
| Fold grey | `#DCD8CF` | Folds, far limbs, facets |
| Sumi ink | `#18171C` | Hairlines, hair, gates |
| Cut red | `#D7262E` | The paper core. Only where cut |
| Core shadow | `#8F1219` | Inside deep cuts |
| Blade steel | `#E9EEF2` | Blades |
| Graph blue | `#9CC0DC` | Grid and ruled lines |
| Legal yellow | `#F6E27F` | Sun, glints, tells |
| Marble black | `#141316` | Night floors, mountains |
| Kraft card | `#B98B5E` | Stage base, pop-up tabs |
| Indigo | `#2E3F8F` | Kami's accent |
| Gold | `#D9A21B` | Sumi's accent |

Each fighter gets one non-red accent, so red stays unique to cuts; the notebook's usual red margin line becomes blue.

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
- **Margin notes:** Caveat, sparingly, for hints written in the notebook margin.

Icons in `art/icons/` (katana, high, low, clean cut, dodge). Rules: flat paper shapes with straight edges; white sticker border with an ink hairline outside it and another at the piece edge; at most two tones per piece; side view; red only on a cut; on a light graph-paper tile so they read in both themes.

## How the doll is built
Each piece (about 15: legs, feet, arms, torso, head, hair, topknot, grip, blade, guard) is a flat polygon on a pin, drawn as six stacked layers: ink hairline, white sticker border, ink edge line, red core, face, details. Scenery gets only a thin ink hairline and never a sticker border, so fighters always stand out. Arms reach the grip with simple two-bone IK, so poses only need a grip position and a blade angle.

**Cuts:** the doll is split by a plane along the blade's line. The face layers are clipped a hair short of the line, so a thin strip of the red core shows. Cuts 1 and 2 slip the cut part a little along the line; cut 3 is a steep diagonal split where the top slides off and the rest falls back, in slow motion with a camera punch-in. Red flecks stay on the floor.

## Interaction map
| System | How it looks | Player does | Builds on |
|---|---|---|---|
| Move | Walk the graph-paper lane; hakama pleats swing | A / D | #3 |
| Stance | Blade high over the shoulder or low and forward | W / S | #5 |
| Slash | Wind-up (tell), then one thin razor line across the screen: ink for miss/block, red for a cut | J | #5, #8 |
| Block / parry | "Block" sticker, white chips, fighters pushed apart; parry adds a yellow glint and a sway | Guard at the right height | #5 |
| Dodge | Quick hop back with a lean | K | #5 |
| Tell | A legal-yellow star glints on the blade just before a guard switch | Read it, strike in the gap | #6 |
| Cuts 1–2 | Sliced along the blade line; red core shows; the part slips | Land a clean cut | #7 |
| Finishing cut | Diagonal split, slow motion, camera moves in, halves fall | Third clean cut | #7, #8 |
| Restart | A fresh doll folded in place | R / Start | #9 |
| Tuning panel | A legal-pad sheet with sliders and handwritten labels | Drag sliders | #9 |

## Technology
| Option | Verdict |
|---|---|
| **Three.js flat layered shapes + clipping-plane cuts (recommended)** | Already the stack. Exact borders, real cuts along the blade line. The mock-up runs on it. |
| Screen-space outline (post-processing) | One border around the whole body, losing the per-piece paper margins; extra pass; fiddly double border. |
| Real-time 3D mesh cutting | Not needed: on flat dolls a clipping plane is a true cut. |
| 2D engine (PixiJS / canvas) | Loses the 3D diorama, shadows and the rigging test-bed purpose. |
| Rapier for falling halves | Not needed in Milestone 1; scripted falls look right and save about 1.5 MB. Add when pieces must hit scenery. |

Budgets: under 2 MB to first duel, no image downloads (paper textures are generated); a doll is about 1,500 triangles, scene under 20,000 triangles and 400 draw calls even with Sumi cut in three; 60 fps on integrated laptop graphics with one 2048 shadow map.

## Making the art
- **Milestone 1:** Kami and Sumi from code shapes (as in the mock-up).
- **Milestone 2:** Kami redrawn in Blender: one flat mesh per piece, traced with straight edges, named from the piece list, parented to one bone per pin, exported as `.glb`. The game generates border, hairline and core from each outline. A full click-by-click guide comes with Milestone 2.
- **Later:** an illustrator draws character sheets in this style; we trace them in Blender.

Concept prompt:
> Original paper-doll samurai character, side view facing right, made of flat angular white card pieces joined at pins, clean straight razor-sharp edges, no curves, thick white sticker border with a thin black hairline outside it, black ink hair with a topknot, white gi, wide white hakama with light grey folds, indigo sash, katana with an indigo-wrapped grip, standing on blue graph paper, soft paper drop shadow, flat colors, no gradients, no text, no red anywhere.

Check the commercial-use terms of any image tool, and don't name other franchises' characters in prompts.

## Conflicts with the design docs (not edited yet)
| Where | Says today | Would say |
|---|---|---|
| GDD · Pitch | Art reference: the flat papercraft look of Paper Mario | Sticker-border paper dolls with flat, angular samurai shapes, on a pop-up stage of school stationery (the Notebook Dojo) |
| GDD · Pillar 1 | Tears, hanging flaps, loose pieces | Razor-clean cuts showing a red paper core; halves slip and fall. Red only where paper is cut |
| GDD · Pillar 4 | Handmade from paper and card, like a pop-up book | A pop-up stage made of stationery: graph, ruled, legal pad, marble covers, kraft card |
| GDD · Paper damage | Swapped torn texture, flap on a pin, Rapier halves | Real cut along the blade line (clipping), red core; cuts 1–2 slip, cut 3 splits; scripted falls |
| GDD · Platform and tech | Rapier for split pieces, debris, knockback | Rapier waits until pieces must collide with scenery |
| GDD · First playable | Grey-box lane and floor | Graph Paper Dojo floor and backdrop |
| GDD · Roadmap M2 | Rigged doll exported to glTF | Flat pieces on bones; the game builds borders, core and cuts |
| Issues #3, #4, #7 | Grey-box lane; card-shape doll; tear, loose piece, split | Graph Paper Dojo; Kami and Sumi with sticker border and red core; clipping cuts |

## Plan
1. Approve the look; GDD, Decision Log and issues #3, #4, #7 updated in the first build's PR.
2. Milestone 1 in this style (#2–#10).
3. Milestone 2: Kami in Blender plus the pipeline guide.
4. Milestone 3: Sumi as an AI rival and Marble Cover Night.
5. Later: Ruled Courtyard, Legal Pad Grove, more fighters and blades.

## Decisions for Marz
1. World: Notebook Dojo (A) or washi pop-up book (B)?
2. The red rule: red only where paper is cut (two-ply card with a red core)?
3. Cuts: razor-clean slips instead of torn edges?
4. Outline: white sticker border with ink hairline on fighters only?
5. Motion: smooth poses, or South Park-style stop-motion?
6. Names: Kami (player) and Sumi (rival)?
7. Rapier: leave it out of Milestone 1 and use scripted falls?

Risks: art is still the slowest part (the Blender step in Milestone 2 is the real test), and white-on-white can wash out, which is why fighters keep the ink hairline and a drop shadow.
