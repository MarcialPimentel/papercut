# Papercut desktop app (Steam build)

Papercut also runs as a desktop app for Windows and Linux (Steam Deck). It is the same game as the website, packed with Electron. The game's files are inside the app, so Practice and Endless work offline. Online fights go to the live rooms server at papercut.marz.gg, so desktop players and website players can fight each other.

## Get a build (no coding needed)

Every pull request builds the app on GitHub:

1. Open the pull request on GitHub and click the **Checks** tab.
2. Click **Desktop** on the left, then **Summary** at the top left.
3. Scroll to **Artifacts** at the bottom and download **Papercut-windows** (or **Papercut-linux** for Steam Deck).
4. GitHub wraps it in a zip. Unzip that to get `Papercut-0.1.0-win-x64.zip`, then unzip that one too, into a folder of its own (for example `Documents\Papercut`).

## Run it on Windows

1. Open the folder and double-click **Papercut.exe**.
2. The first time, Windows may say **"Windows protected your PC"**, because the app isn't signed with a paid certificate. Click **More info**, then **Run anyway**. Copies installed through Steam don't show this.
3. Papercut opens fullscreen. **F11** or **Alt+Enter** switches between fullscreen and a window.

## Run it on Steam Deck (before it is on Steam)

1. In Desktop Mode, download **Papercut-linux** and unpack it twice (as in step 4 above) into a folder, for example `~/Games/Papercut`.
2. Double-click `papercut` in that folder to try it in Desktop Mode.
3. To play it in Game Mode: in Steam (Desktop Mode), **Games → Add a Non-Steam Game to My Library → Browse**, pick the `papercut` file, then **Add Selected Programs**. It now shows in your library in Game Mode.

## Where settings are saved

Settings (window, resolution, frame rate, vsync, volume, guard style), your tournament name and your best Endless run are saved in one file:

- Windows: `%APPDATA%\Papercut\settings.json` (paste that into the File Explorer address bar)
- Linux / Steam Deck: `~/.config/Papercut/settings.json`

Delete the file to go back to the defaults. Steam Cloud will sync this file once the Steamworks issue (#31) is done.

## Online play and versions

The rooms server only pairs players whose games run the same fight rules (both computers must work out exactly the same fight). An app built before a rules change can't fight online until it is updated. It says "This copy of Papercut doesn't match the online version", and Practice and Endless still work. Changes that don't touch the rules (art, sound, menus, docs) don't lock anyone out. `https://papercut.marz.gg/api/health` shows the live rules version as `fight`.

## For Claude: building and testing

- `npm run desktop`: build the game and open it in Electron from the source folder.
- `npm run build:desktop:win` / `build:desktop:linux`: the Windows zip / Linux tar.gz in `release/`. `npm run build:desktop` makes both (the Linux build works best on Linux; the Desktop workflow builds each on its own system).
- `PAPERCUT_SERVER=http://localhost:8790` points the app at a local rooms server (run it with `npm start`). `PAPERCUT_DATA=<folder>` keeps a test run's settings apart from the real ones.
- `npx electron desktop/make-icon.cjs` redraws `desktop/icon.png` from `public/favicon.svg`.
- Files: `desktop/main.cjs` (window, serving the game, the settings file, F11), `desktop/preload.cjs` (what the page may ask the app for), `src/store.ts` (saving: localStorage on the web, the file in the app), `src/settings.ts` (display settings).
- On Linux the app starts with Chromium's sandbox off, because a Steam install can't give the sandbox helper the rights it needs. The window only ever shows the game's own files.
