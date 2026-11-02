# Papercut — Blender → game guide (cut-out fighters)
_2026-11-02. For Blender 5.2. The fighters are flat paper puppets: you draw flat pieces in Blender, and the game adds the bold ink outline round the whole body, red slashes and the K.O. cut. Design rules: [art-direction.md](art-direction.md) ("Fighters: cut-out puppets")._

**Files**
- `art/fighters/puppet.blend`: the puppet you edit (Kami's colours).
- `public/models/puppet.glb`: what the game loads. You make it with **Export** (step 6).

## 1. Open it and look
1. In Blender: **File → Open**, go to your `papercut` folder, then `art → fighters → puppet.blend`.
2. Move the mouse over the 3D view and press **Numpad 1** (front view). Press **Numpad 5** if the view looks squashed (it switches to flat "orthographic" view).
3. Top right of the 3D view, click the second sphere icon (**Material Preview**) to see the colours.
4. In the **Outliner** (top right list), open the **Kami** collection. The empty called **Kami** holds the 11 pieces:

| Piece | What it is | Its pin (where it turns) |
|---|---|---|
| `torso` | Gi, collar, sash | The hip |
| `head` | Face, hair, topknot | The neck |
| `legF`, `legB` | Front and back hakama legs | The hip, a little in front of and behind the middle |
| `footF`, `footB` | Black feet | Where the foot sits on the floor |
| `armFU`, `armBU` | Upper arms with the wide sleeves | The shoulders |
| `armFL`, `armBL` | Forearms with fists | The elbows |
| `sword` | Katana: handle, guard, blade | The guard (tsuba) |

The back pieces (`legB`, `footB`, `armBU`, `armBL`) share their shape with the front ones: change `legF` and `legB` changes too. The game shades back pieces a little darker. Don't rename pieces: the game finds them by name.

## 2. Change a piece's shape
1. Click the piece in the Outliner (for example `head`).
2. With the mouse over the 3D view, press **Tab** (Edit Mode), then **1** (pick corners).
3. Click a corner, press **G**, move the mouse, click to drop it. Only move corners left/right and up/down in the front view, never towards or away from you.
4. **More corners:** click two neighbouring corners (Shift+click the second), right-click → **Subdivide**. **Fewer:** click a corner, **X → Dissolve Vertices**.
5. Press **Tab** again to leave Edit Mode.

Rules: straight edges only (no curves, bevels or Subdivision Surface), no holes in a piece, every piece stays flat.

## 3. Change a colour
1. Click a piece, then the **Material** tab in the Properties panel (the red-and-grey sphere at the bottom of the tab column, right side).
2. Pick the material in the list (they're named `pc_` + a role: `pc_gi`, `pc_hakama`, `pc_sash`, `pc_ink`, `pc_steel`...).
3. Change **Base Color**. Every piece using that material changes.

Sumi uses the same puppet and swaps four roles in code (`hakama`, `pleat`, `sash`, `grip`). Ask Claude if you want another look (an Endless bot colour, a tournament colour).

## 4. Add a printed detail (a mark, a pattern, a mon on the sleeve)
Details are flat shapes laid just in front of the paper.
1. Click the piece, **Tab** into Edit Mode, press **3** (pick faces), and click an existing detail on that piece (for example the sleeve hem).
2. **Shift+D** to copy it, move the mouse, click to drop it. Reshape it as in step 2.
3. Keep it just in front of the paper: press **N**, and in the **Item** tab check its **Y** is between −0.0005 and −0.005 (more negative = further in front, drawn over other details).
4. With the new shape still picked, in the Material tab pick the material for it and click **Assign**.

The paper itself must sit exactly at Y = 0; anything at Y = 0 is part of the body's outline.

**Drawing order of pieces:** the whole fighter is one thin sheet. Each piece's **Y** location (Object Mode, **N** panel) only says which piece is drawn on top: more negative is in front. Today, back to front: back arm, back leg, front leg, torso, head, sword, front arm (from +0.016 down to −0.014).

## 5. Move a pin or change proportions
The game reads where each pin is from the layout in this file: neck height, shoulders, elbows, hips, and leg length (from each leg's pin down to its foot's pin, minus 6 cm).
- **Move a whole piece:** in Object Mode click it, **G**, move, click.
- **Move a pin without moving the shape:** Shift+right-click where the pin should go (moves the 3D cursor), then **Object → Set Origin → Origin to 3D Cursor**.
- Keep each piece's **Rotation at 0** and **Scale at 1** (press **N**, **Item** tab). If you scaled a piece, fix it with **Ctrl+A → Scale**.
- The arms are laid out straight forward, holding the sword level. The fist's middle sits 31 cm from the elbow pin, and the hands hold the handle 7 cm and 22 cm behind the guard. Keep those, or tell Claude what you changed.

## 6. Export for the game
1. **File → Save** (Ctrl+S).
2. In the Outliner, right-click **Kami** → **Select Hierarchy**.
3. **File → Export → glTF 2.0 (.glb/.gltf)**.
4. On the right of the export window:
   - **Format:** glTF Binary (.glb)
   - **Include → Limit to: Selected Objects** ✓
   - **Transform → +Y Up** ✓
   - **Animation:** untick
5. Go to your `papercut` folder → `public` → `models`, name it `puppet.glb` (replace the old one), click **Export glTF 2.0**.
6. Tell Claude "I re-exported the puppet". Claude checks it, runs the game, takes screenshots and opens a PR for you to playtest.

## What the game does with it
- Reads each piece's outline and printed details, its pin and its colours.
- Draws the fighter as one thin sheet with one bold outline round the whole body (a heavy ink line and a thin white rim), ink lines where a limb crosses the body, and the sword outlined on its own.
- Poses the puppet from the fight (key poses are in code for now; making them in Blender is the next step).
- Cuts red slashes into the paper on hits, and on a K.O. cuts every piece in two for the paper-physics halves.
