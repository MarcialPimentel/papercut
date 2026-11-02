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
- **Layer stack** (front view, back to front; the Y location is only drawing order, more negative is in front):

| Layer | Pieces | Y |
|---|---|---|
| 1 | Feet | +0.20 |
| 2 | Hakama (back panel, left and right halves) | +0.15 to +0.17 |
| 3 | Outer robe (left and right), then the cream lapels | +0.10, +0.075 |
| 4 | Sleeves (left and right) | +0.05 |
| 5 | Inner kimono, collar, obi | 0.00 to −0.02 |
| 6 | Face | −0.05 |
| 7 | Hair and topknot | −0.10 |
| Top | Sword, then hands | −0.14, −0.18 |

- **Rig** (empties, the pink pivots in the guide). Each paper piece hangs under the empty it turns with:

```
root (feet, X = 0)
  torso (waist)        hakama_back, robe_L/R, lapel_L/R, kimono, collar, obi
    head (neck)        face, hair (with the topknot and its gold tie)
    arm_L (shoulder)   sleeve_L
      hand_L           hand_L_paper (cream mitten)
    arm_R (shoulder)   sleeve_R
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

Sumi uses the same model and swaps `robe` and `kimono` in code: a cream robe over an indigo kimono, indigo prints.

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

## What the game does with it
- Reads every paper piece under each rig empty: its outline, prints, colours and layer.
- Draws a thick ink line round every paper piece and a thin cream rim round the whole figure; the sword gets its own.
- Poses the rig with rigid rotations (key poses in code for now): the sleeves turn at the shoulders, the hands reach the sword's handle, the hakama halves swing at the hips, the torso leans, the head tilts. Poses snap like stop-motion.
- Cuts red slashes into the paper on hits, and on a K.O. cuts every piece in two for the paper-physics halves.
