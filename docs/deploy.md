# Papercut — Deploy

_Current as of the first online build (2026-11-01)._

Papercut will be live at **https://papercut.marz.gg**. It runs on the same small cloud server as Hormigas (the "hub"), as **one Docker container** with no database: it serves the game and runs the rooms that pair players online. The hub itself (Caddy for HTTPS, the other projects) is described in the Hormigas repo's `docs/DEPLOY.md`.

> **Private details are not in this repo.** The server's address, SSH keys and passwords live in Marz's private hosting notes, GitHub secrets and the server itself. Never commit them here.

## How it fits together

```
Browser ── https://papercut.marz.gg ──▶ DNS record "papercut" → the hub
                                          │
                                          ▼
                          Hub server (Docker Compose, /opt/hub)
                          ├─ caddy      HTTPS → papercut:8790 (and other projects)
                          ├─ papercut   ghcr.io/marcialpimentel/papercut:latest
                          │             serves the game, /ws pairs players, /api/health
                          └─ (hormigas, guildie-realtime, db …)
```

During a fight the server only passes each player's button presses to the other one; both browsers run the fight themselves and check every second that they still agree.

## How a change goes live

Merging to `main` deploys automatically:

1. **CI** (`.github/workflows/ci.yml`): typecheck, tests and build in one job; the Docker image build in another. On `main` the image is pushed to GitHub's container registry, tagged with the commit.
2. If CI passes, **Deploy** (`.github/workflows/deploy.yml`) tags that image `latest`, connects to the hub over SSH as the deploy user, keeps the running build as `previous`, starts the new one and waits up to 2 minutes for it to report healthy. If it never does, it switches back to `previous` and the run fails, so the old build keeps running.
3. Finally it checks that https://papercut.marz.gg/api/health reports the new build.

**Check what's live:** open https://papercut.marz.gg/api/health. `build` is the first 7 characters of the commit; the game also shows it in the bottom-right corner.

**Redeploy or roll back:** GitHub → **Actions** → **Deploy** → **Run workflow**. Leave the box empty to redeploy the latest `main`, or paste an older commit from `main` to go back to it.

Until the one-time setup below is done, Deploy skips with a yellow warning instead of failing.

## One-time setup (Marz)

Do these once, in order. Steps 1 and 2 can be done any time; step 4 needs the PR merged first.

### 1. Point papercut.marz.gg at the hub

1. Open the website where you manage marz.gg's DNS (the same place you added `hormigas.marz.gg`; your private hosting notes say which).
2. Find the existing **A** record named `hormigas` and copy its value (an IP address).
3. Click **Add record**:
   - **Type:** A
   - **Name / Host:** `papercut`
   - **Value / Points to:** the IP you copied
   - **TTL:** leave the default
4. Save. It can take a few minutes to start working.

### 2. Add Papercut to the hub

You need to be logged in to the hub server as your admin user (the same way you set up Hormigas; the command is in your private hosting notes). Then:

1. Go to the hub folder: `cd /opt/hub`
2. Open the containers file: `nano docker-compose.yml`
3. Scroll to the end of the `services:` list (just above the line `volumes:`), and paste the block from this repo's [`deploy/hub/papercut-service.yml`](../deploy/hub/papercut-service.yml), starting at the line `  papercut:` (keep the two spaces in front). Save with **Ctrl+O**, **Enter**, then exit with **Ctrl+X**.
4. Open the web settings: `nano Caddyfile`
5. Paste the block from [`deploy/hub/Caddyfile-block`](../deploy/hub/Caddyfile-block) at the end (the part from `papercut.marz.gg {` to the closing `}`). Save and exit the same way.
6. Tell Caddy to read its settings again: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`
7. Don't start Papercut by hand: its first build doesn't exist yet. Step 4 starts it.

Then copy the same two blocks into the Hormigas repo's `deploy/hub/` reference copy (Claude can do this in a Hormigas session).

### 3. Give GitHub the key to the hub

Papercut uses the same deploy key as Hormigas.

1. Open https://github.com/MarcialPimentel/papercut/settings/secrets/actions
2. Click **New repository secret**:
   - **Name:** `DROPLET_HOST`
   - **Secret:** the hub's IP address (the same value as in step 1)
   - Click **Add secret**.
3. Click **New repository secret** again:
   - **Name:** `DROPLET_SSH_KEY`
   - **Secret:** the whole contents of the file `C:\Users\marci\.ssh\hormigas-deploy` (open it in Notepad, **Ctrl+A**, **Ctrl+C**, paste here). It starts with `-----BEGIN` and ends with `-----END … KEY-----`.
   - Click **Add secret**.

Or, in a terminal on your PC, this does step 3.3 in one go:

```bash
gh secret set DROPLET_SSH_KEY -R MarcialPimentel/papercut < ~/.ssh/hormigas-deploy
```

### 4. First deploy

After the PR is merged and its CI run has finished:

1. Open https://github.com/MarcialPimentel/papercut/actions/workflows/deploy.yml
2. Click **Run workflow** → leave the box empty → **Run workflow**.
3. When it turns green, open https://papercut.marz.gg. From now on every merge deploys by itself.

## Everyday commands (on the server, in /opt/hub)

| Task | Command |
|---|---|
| Is it running? | `docker compose ps papercut` |
| Live server logs | `docker compose logs -f papercut` |
| Restart it (kicks players in a fight back to the menu) | `docker compose restart papercut` |
| Go back to the build before the current one | `docker tag ghcr.io/marcialpimentel/papercut:previous ghcr.io/marcialpimentel/papercut:latest && docker compose up -d papercut` |

## Running it on your own PC

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. To try an online fight alone, open the game in two browser windows side by side (not two tabs: a hidden tab pauses and the fight waits for it).

## Notes for later

- **One server, one region.** Inputs travel player → hub → player, so players far from the hub (it is in one region) get a longer input delay (up to 8 frames). Direct browser-to-browser links (WebRTC) and rollback are the planned fix.
- **No accounts, no storage.** Rooms live in memory; a restart sends everyone back to the menu.
- **Capacity:** the container accepts up to 200 connections (`CAPACITY`). A fight costs the server almost nothing.
