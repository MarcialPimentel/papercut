# Papercut on Steam: achievements, cloud, overlay and rich presence

The desktop app talks to Steam through `steamworks.js`. With Steam closed (or on the website) the game runs exactly the same; Steam only adds things.

Until Valve finishes verifying the Papercut app, the game uses **Valve's public test app, 480 (Spacewar)**. On it you can test that Steam connects, the overlay opens, one achievement pops up and Steam Cloud syncs. Papercut's own achievement names and friends-list text show up only once the real app is set up (part 2).

## Part 1: test it now with the test app (480)

1. Open Steam and sign in.
2. Get the newest build: on the pull request, **Checks** tab → **CI** → **Summary** → **Artifacts** → **Papercut-windows** (see [desktop.md](desktop.md) for unzipping).
3. Double-click **Papercut.exe**. Steam shows you as playing **Spacewar**: that's the test app, expected.
4. **Overlay:** press **Shift+Tab**. Steam's overlay opens over the game. Press Shift+Tab again to close it.
5. **Achievement:** finish the tutorial (or skip through it with Tab). A Steam pop-up shows Spacewar's "Winner" achievement in the corner. While on the test app, four of ours borrow Spacewar's:
   - finish the tutorial → **Winner**
   - parry a slash → **Interstellar**
   - win an online match → **Champion**
   - cut down 10 rivals in one Endless run → **Orbiter**
   The other nine do nothing until part 2.
6. **See them again:** close Papercut. To start over with the test achievements cleared, Claude can launch it with `PAPERCUT_STEAM_RESET=1` (test app only).
7. **Cloud:** on a second PC (or the Steam Deck) signed in to the same Steam account, run the build. Your name, best Endless run, fighter look, controls, guard style, volume and ranked rating carry over. Window size, resolution, frame cap and vsync stay per PC. Steam uploads the file when you close the game, so close it on the first PC before opening it on the second.

## Part 2: once Papercut's own Steam app exists

You'll do this on the Steamworks partner site, **partner.steamgames.com**. Each step ends with publishing (step 2.6), because Steam changes only go live once published.

### 2.1 Tell Claude the app ID

1. Sign in at **partner.steamgames.com**.
2. Top menu **Apps & Packages** → **All Applications**. Papercut's number is in the **App ID** column (for example `3456780`).
3. Tell Claude: "Papercut's Steam app ID is 3456780". Claude changes the one line in `desktop/steam.cjs` (`const APP_ID = 480;`) in a small PR. Nothing else changes.

### 2.2 Achievements

1. Open Papercut's app page (click its name) → **Edit Steamworks Settings**.
2. Tab **Stats & Achievements** → **Achievements**.
3. For each row below click **New Achievement** and fill in:
   - **API Name:** exactly as written (capitals and underscores matter: the game uses these).
   - **Display Name** and **Description:** as written (you can reword these any time; the API Name must stay).
   - **Set By:** Client.
   - **Hidden:** leave unticked.
   - **Achieved icon** and **Unachieved icon:** 256 x 256 JPG each. Until there's art, ask Claude for placeholder icons (`/new-art-asset icons`).
   - Click **Save**.

| API Name | Display Name | Description |
|---|---|---|
| `TUTORIAL_DONE` | First Fold | Finish the tutorial. |
| `PARRY` | Turned Edge | Parry a slash. |
| `RIPOSTE` | Answer in Ink | Land a riposte after a parry. |
| `COUNTER_CUT` | Counter Cut | Win a round with a counter cut. |
| `ONLINE_WIN` | Signed and Sealed | Win an online match. |
| `TOURNEY_WIN` | Top of the Stack | Win a tournament. |
| `DIV_NEWSPRINT` | Newsprint | Reach the Newsprint division in Ranked. |
| `DIV_CARDSTOCK` | Cardstock | Reach the Cardstock division in Ranked. |
| `DIV_WASHI` | Washi | Reach the Washi division in Ranked. |
| `DIV_GOLD_LEAF` | Gold Leaf | Reach the Gold Leaf division in Ranked. |
| `ENDLESS_10` | Ten Sheets | Cut down 10 rivals in one Endless run. |
| `ENDLESS_25` | Quarter Ream | Cut down 25 rivals in one Endless run. |
| `ENDLESS_50` | Half Ream | Cut down 50 rivals in one Endless run. |

The list lives in `src/achievements.ts`; if a name changes there, change it here too.

### 2.3 Steam Cloud

1. Same **Edit Steamworks Settings** page → tab **Application** → **Steam Cloud**.
2. **Byte quota per user:** `1000000` (1 MB; the file is under 2 KB).
3. **Number of files allowed per user:** `10`.
4. Leave **Auto-Cloud** empty: the game saves its own cloud file (`progress.json`) through Steam.
5. Tick **Enable cloud support for developers only** for now, so only your account uses it while you test; untick it before launch.
6. Click **Save**.

### 2.4 Rich presence (what friends see)

1. Same page → tab **Community** → **Rich Presence**.
2. Under **English**, upload the file `steam/rich_presence.vdf` from the repo (GitHub: open the file → **Download raw file**).
3. Click **Upload**. Friends then see lines like "Endless: level 4" or "Ranked: Washi" under your name.

### 2.5 Overlay

Nothing to set up: the overlay is on for every Steam game. Players open it with **Shift+Tab** (Steam button on the Deck). It draws over the game and never pauses an online fight; practice and Endless keep running too, so press **Esc** first if you want to stop.

### 2.6 Publish

1. Top of the Steamworks settings page: **Publish** tab → **Prepare for Publishing** → type `STEAMWORKS` → **Really Publish**.
2. Launch Papercut from Steam (or the zip with Steam open). Check: Steam shows you playing **Papercut**, finishing the tutorial pops **First Fold**, and friends see what you're doing.

## For Claude

- `desktop/steam.cjs`: connecting to Steam (`APP_ID`), achievements (with the Spacewar test mapping), rich presence, cloud reads and writes. `start()` returns null without Steam.
- `desktop/cloud.cjs`: which saved keys Steam Cloud carries (`CLOUD_KEYS`) and the merge at start. A test fails if a new `papercut.*` key isn't put in either `CLOUD_KEYS` or the test's local-only list.
- `src/achievements.ts`: the list and the checks (fight events in the tutorial, practice, Endless and online fights; Ranked divisions; tournament wins). Tuned practice never unlocks.
- `steam/rich_presence.vdf`: the friends-list text; tokens are set in `showPresence()` in `src/main.ts`.
- `PAPERCUT_STEAM=0` runs the app without Steam even when it's open. `PAPERCUT_STEAM_RESET=1` clears achievements on the test app.
- The packaged app carries only its own system's Steam library (`steam_api64.dll` on Windows, `libsteam_api.so` on Linux), unpacked from the app archive so it can load.
