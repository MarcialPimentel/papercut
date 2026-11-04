# Papercut — Blender → game guide (papercraft samurai)
_2026-11-02. For Blender 5.2. Built from Marz's "Japanese Swordfighter – Blender Model Guide" (low-poly 2D papercraft, rigid layered pieces, pivot animation). You make flat paper pieces in Blender; the game adds a thick ink line round every piece, a thin cream rim round the whole figure, red slashes and the K.O. cut. Design rules: [art-direction.md](art-direction.md) ("Fighters: papercraft samurai")._

**Files**
- `art/fighters/samurai.blend`: the fighter you edit (Kami's colours).
- `public/models/samurai.glb`: what the game loads. You make it with **Export** (step 6).

## The model, as in the guide
- **Size:** 4.00 tall, 2.80 wide (sleeve to sleeve), 0.40 deep, in Blender units. The game shrinks it to about 2.1 m.
- **Origin:** the character's centre at the feet (X = 0). Front view looks along +Y: the body faces you, the head is in profile toward the rival (+X).
- **Proportions:** head 0.90 (with topknot), torso 1.00, waist/belt 0.40, hakama 1.50, feet 0.20.
- **Every paper piece is its own flat object**, low-poly (4 to 12 triangles), flat colours, no smoothing. About 280 triangles in all.
- **Traced from a drawing (since 2026-11-04):** the body is built from Marz's front view, `art/fighters/reference/kami_front.webp`, by two scripts (see "Rebuild from a drawing" below). Every region the drawing's ink lines enclose is its own paper piece, so the game's ink line round each piece redraws the drawing's lines. Pieces that something sits on run on underneath it (the coat up under the sleeve, the hakama under the apron), like cut paper laid on cut paper.
- **Layer stack** (front view, back to front; the Y location is only drawing order, more negative is in front):

| Layer | Pieces | Y |
|---|---|---|
| 1 | Feet | +0.20 |
| 2 | Hakama: dark back panel, then the three strips | +0.17, +0.15 |
| 3 | Dark neck, apron, inner kimono pieces, obi (three parts) | +0.13 to +0.10 |
| 4 | Coat (outer robe, cream, with its tall collar and a thin indigo hem trim) | +0.06 |
| 5 | Sleeves (indigo, the cream wave cuff printed on) | +0.03 |
| 6 | Hair and topknot (the head's shape), then the gold tie | −0.04 |
| 7 | Face, then the eye and brow | −0.05 |
| Top | Sword, then hands | −0.14, −0.18 |

- **Rig** (empties, the pink pivots in the guide). Each paper piece hangs under the empty it turns with:

```
root (feet, X = 0)
  torso (waist)        hakama_back, hakama_mid, neck, apron, kimono (+ kimono_2..4), obi, obi_L/R, robe_L/R (the coat)
    head (neck)        face, kami_hair (Kami) or sumi_hair (Sumi)
    arm_L (shoulder)   kami_sleeve_L, or Sumi's sumi_sleeve_L
      hand_L           hand_L_paper (cream mitten)
    arm_R (shoulder)   kami_sleeve_R / sumi_sleeve_R
      hand_R           hand_R_paper
        sword (guard)  sword_paper (handle, gold wrap, black guard, blade)
  skirt_L (hip)        hakama_L, feet_L
  skirt_R (hip)        hakama_R, feet_R
```

- **Palette** (materials `pc_<id>`): `kimono` (cream, kimono and trim), `robe` (indigo, primary), `hakama` and `hakamaDark`, `accent` (gold: topknot tie, hilt wrap), plus `skin`, `hair`, `ink`, `steel`, `handle`. The cream outline round the figure is added by the game.

## 1. Open it and look
1. In Blender: **File → Open**, go to your `papercut` folder, then `art → fighters → samurai.blend`.
2. Mouse over the 3D view, press **Numpad 1** (front view), then **Numpad 5** if the view looks squashed (orthographic).
3. Top right of the 3D view, click the second sphere icon (**Material Preview**) to see the colours.
4. In the **Outliner**, open the **Samurai** collection and fold open `root` to see the rig above.

Don't rename the empties (`root`, `torso`, `head`, `arm_L`, `hand_L`, `arm_R`, `hand_R`, `sword`, `skirt_L`, `skirt_R`): the game finds them by name. Paper pieces can have any name.

## 2. Change a piece's shape
1. Click the piece in the Outliner (for example `sleeve_L`).
2. Mouse over the 3D view, **Tab** (Edit Mode), then **1** (pick corners).
3. Click a corner, **G**, move, click. Only move corners left/right and up/down in the front view.
4. **More corners:** Shift+click two neighbouring corners, right-click → **Subdivide**. **Fewer:** click a corner, **X → Dissolve Vertices**.
5. **Tab** again to leave Edit Mode.

Rules: straight edges only (no curves, bevels or Subdivision Surface), no holes, every piece flat. **Two shapes in one object must not touch at a single corner** (the game can't trace a pinch); leave a small gap or make them separate objects.

## 3. Change a colour
1. Click a piece, then the **Material** tab in the Properties panel (the red-and-grey sphere near the bottom of the tab column).
2. Pick the material (`pc_robe`, `pc_kimono`, `pc_hakama`...), change **Base Color**. Every piece using it changes.

Sumi uses the same model and swaps `robe` and `kimono` in code: a cream robe over an indigo kimono, indigo prints. Sumi's own pieces (long hair worn down, tied-back sleeves) are in step 7.

## 4. Add a print (a pattern, a crest)
Prints are flat shapes laid just in front of their paper piece, in the same object. The game draws them without an ink line.
1. Click the piece, **Tab**, press **3** (pick faces), click an existing print (for example a wave on a sleeve).
2. **Shift+D** to copy it, move, click. Reshape it as in step 2.
3. Keep it just in front of the paper: press **N**, **Item** tab: its **Y** is 0.004 to 0.03 lower (further in front) than the paper's.
4. In the Material tab pick its material and click **Assign**.

A panel you want outlined in ink (a lapel, a belt) should be its own object instead.

## 5. Move a pivot or change proportions
The game reads every pivot from this file (the empties' positions): waist, neck, shoulders, the hand pivots at the sleeve openings (so the arm length), the hips, and the sword's guard.
- **Move a part with its pivot:** click the empty, **G**, move, click; its pieces move with it.
- **Move only the pivot** (where a part turns) without moving its pieces: tell Claude, it's a few lines of script.
- Keep every **Rotation at 0** and **Scale at 1** (press **N**, **Item** tab). If you scaled something, **Ctrl+A → Scale**.
- The rest pose has the arms hanging and the hands pointing straight down; the sword's blade points along +X from its guard. Keep those.

## 6. Export for the game
1. **File → Save** (Ctrl+S).
2. In the Outliner, right-click **root** → **Select Hierarchy**.
3. **File → Export → glTF 2.0 (.glb/.gltf)**.
4. On the right: **Format** glTF Binary (.glb); **Include → Limit to: Selected Objects** ✓; **Transform → +Y Up** ✓; **Animation** unticked.
5. Go to your `papercut` folder → `public` → `models`, name it `samurai.glb` (replace the old one), **Export glTF 2.0**.
6. Tell Claude "I re-exported the samurai". Claude checks it, runs the game, takes screenshots and opens a PR for you to playtest.

The guide suggests a PNG sequence or texture atlas as the export; Papercut draws the fighters live in its 3D book instead, so it uses the `.glb`.

## 7. Kami's and Sumi's own pieces (#37: Sumi's long hair and tied-back sleeves)
Both fighters share one rig and one set of pieces. A paper piece whose name starts with **`kami_`** is worn by Kami only, and one starting with **`sumi_`** by Sumi only. Pieces with any other name are worn by both. Sumi's colour swap (cream robe, indigo kimono) still applies to Sumi's own pieces.

**Already in the file** (built by Claude from these steps on 2026-11-02, at Marz's request; the cord is a little thicker than in 7d: corners (0.64, 2.34), (0.915, 2.375), (0.935, 2.48), (0.605, 2.45), and the forearms a little wider). The steps stay here so you can see how each piece is made and change any corner. Marz's picks (the straw hat of the first draft was swapped for hair worn down at Marz's request):
- **Kami** keeps the topknot and the wide hanging sleeves.
- **Sumi** wears long hair down (no topknot), and sleeves tied back above the elbow with a cord, with bare forearms. **Changed 2026-11-04:** her sleeves now reach the wrist like Kami's (`build_from_trace.py` reshapes them; the cord stays at the elbow) and the forearms are gone, so steps 7d and 7e below are history.

**Stay inside the H box:** the game hits a box 0.9 m wide and 2.15 m tall. In Blender units that's X −0.86 to +0.86 and Z up to 4.10. Sumi's hair below stays inside it (the top of the head and X −0.47 at the back).

**Typing an exact corner:** in Edit Mode (**Tab**, then **1**), click one corner and press **N**. In the **Item** tab, click **Global**, then type the **X**, **Y** and **Z** under **Vertex**. Every corner below is given as (X, Z), with the Y to type.

Work in your usual `papercut` folder (`art/fighters/samurai.blend`), not in Claude's worktree. Save first (**Ctrl+S**).

### 7a. Tag Kami's pieces
1. In the Outliner, double-click **hair** and rename it `kami_hair`.
2. Rename **sleeve_L** to `kami_sleeve_L` and **sleeve_R** to `kami_sleeve_R`.

### 7b. Sumi's long hair, worn down
1. Click `kami_hair`. With the mouse over the 3D view, press **Shift+D**, then **right-click**: the copy stays in place.
2. Rename the copy `sumi_hair`.
3. **Tab**, then **1**. Hover the topknot, press **L** (it selects the whole topknot). Hover the gold tie and press **L** again. **X → Vertices**: the short hair stays.
4. Now let it fall down the back. **A** selects every corner; **X → Vertices** clears them, then type a new outline instead (all with **Y −0.1**; head-local numbers, so in **Item** click **Local**, not Global). Click a corner, **E** (extrude), type the next, and so on round the outline; at the end select the first and last corners and press **F** to close it, then **A** and **F** again to fill the face:

| corner | X | Z |
|---|---|---|
| fringe, front top | 0.311 | 0.782 |
| fringe, front | 0.345 | 0.644 |
| fringe, inner | 0.069 | 0.621 |
| temple | −0.023 | 0.437 |
| behind the jaw | −0.092 | 0.161 |
| nape | −0.12 | −0.10 |
| tip, front | −0.15 | −0.62 |
| tip | −0.22 | −0.70 |
| tip notch | −0.29 | −0.63 |
| tip | −0.36 | −0.72 |
| tip, back | −0.43 | −0.64 |
| back of the hair | −0.47 | −0.30 |
| back of the head | −0.42 | 0.23 |
| crown | −0.333 | 0.794 |

5. **Tab**. The hair falls from the crown to between the shoulder blades, with a cut-paper ragged tip.

### 7d. Sumi's tied-back sleeves (left first)
1. Click `kami_sleeve_L`, **Shift+D**, **right-click**, rename the copy `sumi_sleeve_L`.
2. **Tab**, then **3** (pick faces). Click the big robe face, then **Shift+click** the cream cuff band at its bottom.
3. **Ctrl+I** (selects every other print), then **X → Faces**: the waves and crest go.
4. Press **1** and move the robe's 6 corners. Keep each corner's **Y** as it is:

| corner (was) | X | Z |
|---|---|---|
| shoulder top, inner (0.40, 3.08) | 0.40 | 3.08 |
| shoulder top, outer (0.86, 3.06) | 0.82 | 3.04 |
| outer tip (1.46, 1.92) | 0.98 | 2.62 |
| bottom, outer (1.36, 1.78) | 0.92 | 2.34 |
| bottom, inner (0.64, 1.78) | 0.64 | 2.30 |
| armpit (0.52, 2.50) | 0.52 | 2.62 |

5. The cuff band becomes the cord. Move its 4 corners to (0.66, 2.36), (0.93, 2.40), (0.94, 2.46), (0.66, 2.42). Then, with those 4 still selected, open the Material tab and make a new material `pc_cord` with hex `C8102E` (any colour works: the game prints the cord in the fighter's contrast colour, never red, since red is for cuts). **Assign** it to the band only.
6. **Tab**.

### 7e. Sumi's bare forearms (left first)
1. Click `hand_L_paper`, **Shift+D**, **right-click**, rename the copy `sumi_forearm_L`.
2. Parent it to the arm, not the hand: keep it selected, **Ctrl+click** the empty **arm_L**, **Ctrl+P → Object (Keep Transform)**.
3. **Tab**, **1**, and type the 6 corners, all with **Y 0.06** (just behind the sleeve):

| corner | X | Z |
|---|---|---|
| elbow, inner | 0.76 | 2.40 |
| elbow, outer | 0.96 | 2.44 |
| outer | 1.00 | 2.10 |
| wrist, outer | 0.99 | 1.90 |
| wrist, inner | 0.85 | 1.90 |
| inner | 0.80 | 2.10 |

4. **Tab**. The forearm runs from under the cord to the mitten.

### 7f. The right arm
Repeat 7d and 7e for the right, starting from `kami_sleeve_R` and `hand_R_paper`. Name the pieces `sumi_sleeve_R` and `sumi_forearm_R`, parent the forearm to **arm_R**, and type every **X with a minus sign** (0.82 becomes −0.82). Z and Y stay the same.

### 7g. Look, export, tell Claude
1. To see Sumi alone in Blender, type `kami_` in the Outliner's search box, select what it finds, and press **H** (hide). To see Kami alone, do the same with `sumi_`. **Alt+H** shows everything again.
2. **Ctrl+S**, then export as in step 6.
3. Tell Claude "I made Sumi's pieces". Claude copies the file into the build, checks the H boxes, and sends a side-by-side screenshot for your sign-off.

**Short on time?** Say "Claude, make Sumi's pieces" and Claude builds them from these numbers over the Blender connection. You then tweak any corner you like.

## What the game does with it
- Reads every paper piece under each rig empty: its outline, prints, colours and layer. Pieces named `kami_...` or `sumi_...` are worn by that fighter only.
- Draws a thick ink line round every paper piece and a thin cream rim round the whole figure; the sword gets its own.
- Poses the rig with rigid rotations (key poses in code for now): the sleeves turn at the shoulders, the hands reach the sword's handle, the hakama halves swing at the hips, the torso leans, the head tilts. Poses snap like stop-motion.
- Cuts red slashes into the paper on hits, and on a K.O. cuts every piece in two for the paper-physics halves.

## Rebuild from a drawing
When the fighter should look like a new drawing, Claude can trace it instead of reshaping pieces by hand.
1. Make the drawing: **front view only**, orthographic (body facing you, head in profile toward the right), flat colours (cream, indigo, black, gold), thick black ink lines between every paper piece, plain white background, about 1000 x 1500 px or bigger. Save it as `art/fighters/reference/kami_front.webp` (or tell Claude its name).
2. Claude runs `art/fighters/trace_front.py` (it writes `reference/kami_front_trace.json`, the traced pieces in model units, 4.00 tall) and then `art/fighters/build_from_trace.py` on the model, which swaps the body pieces for the traced ones, refits the shoulders and neck, keeps the hands, sword and Sumi's own pieces (her long hair, and her sleeves, lengthened to the wrist), and exports `samurai.glb`.
3. The arms keep their length, so the poses and the sword's reach in the fight stay the same; check with the hitbox view (**H**).

The drawing's right side (toward the rival) becomes the `_L` pieces. Colour changes inside a piece without an ink line (the waves on the sleeve cuffs) become prints on it.
