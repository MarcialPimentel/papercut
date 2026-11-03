# Papercut — Deploy

_Current as of the match stats build (2026-11-02)._

Papercut is live at **https://papercut.marz.gg**. It runs on the same small cloud server as Hormigas (the "hub"), as **one Docker container**: it serves the game, runs the rooms that pair players online, and keeps the match stats (https://papercut.marz.gg/stats) in Papercut's own database on the hub's shared Postgres. The hub itself (Caddy for HTTPS, the other projects) is described in the hub repo (MarcialPimentel/hub).

> **Private details are not in this repo.** The server's address, SSH keys and passwords live in Marz's private hosting notes, GitHub secrets and the server itself. Never commit them here.

## How it fits together

```
Browser ── https://papercut.marz.gg ──▶ DNS record "papercut" → the hub
                                          │
                                          ▼
                          Hub server (Docker Compose, /opt/hub)
                          ├─ caddy      HTTPS → papercut:8790 (and other projects)
                          ├─ papercut   ghcr.io/marcialpimentel/papercut:latest
                          │             serves the game, /ws pairs players, /stats, /api/health
                          ├─ db         the shared Postgres: Papercut's database "papercut"
                          └─ (hormigas, guildie-realtime, …)
```

During a fight the server passes each player's button presses to the other one; both browsers run the fight themselves and check every second that they still agree. The server also steps its own copy of the fight from the same presses (`server/referee.ts`), and when a match ends it saves the result, the counts and the presses to the database.

## How a change goes live

Merging to `main` deploys automatically:

1. **CI** (`.github/workflows/ci.yml`): typecheck, tests and build in one job; the Docker image build in another. On `main` the image is pushed to GitHub's container registry, tagged with the commit.
2. If CI passes, **Deploy** (`.github/workflows/deploy.yml`) tags that image `latest`, connects to the hub over SSH as the deploy user, keeps the running build as `previous`, starts the new one and waits up to 2 minutes for it to report healthy. If it never does, it switches back to `previous` and the run fails, so the old build keeps running.
3. Finally it checks that https://papercut.marz.gg/api/health reports the new build.

**Check what's live:** open https://papercut.marz.gg/api/health. `build` is the first 7 characters of the commit; the game also shows it in the bottom-right corner.

**Redeploy or roll back:** GitHub → **Actions** → **Deploy** → **Run workflow**. Leave the box empty to redeploy the latest `main`, or paste an older commit from `main` to go back to it.

## One-time setup (done 2026-11-01)

Papercut was added to the hub on 2026-11-01. This is what was done, in case the hub is ever rebuilt:

1. **DNS:** an A record `papercut` for marz.gg points at the hub (same IP as `hormigas`).
2. **Hub:** [`deploy/hub/add-to-hub.sh`](../deploy/hub/add-to-hub.sh) was run on the server as the deploy user. It adds the `papercut` service (256 MB, half a CPU, capped logs, like the other games) to `/opt/hub/docker-compose.yml` and a `papercut.marz.gg` block to `/opt/hub/Caddyfile`, checks both, and reloads Caddy without downtime for the other games. If a check fails it puts both files back. Safe to run twice. To run it again: copy it to the server, then `bash add-to-hub.sh` in `/opt/hub`.
3. **GitHub secrets:** `DROPLET_HOST` (the hub's IP) and `DROPLET_SSH_KEY` (the private half of the deploy key, the same one Hormigas uses) are set in the repo's Settings → Secrets and variables → Actions.
4. **First deploy:** Actions → Deploy → Run workflow. Build 2b5269e went live.

The Papercut service and Caddy block are recorded in the hub repo (MarcialPimentel/hub), the master copy of the server's files.

## Turn on the stats database (one time, after the stats build is merged)

Until this is done the game works, but stats are kept in memory and lost on every deploy: https://papercut.marz.gg/api/health shows `"stats":"memory"`. Afterwards it shows `"stats":"postgres"`.

The script [`deploy/hub/add-stats-db.sh`](../deploy/hub/add-stats-db.sh) does everything on the server. It creates the `papercut` database and user on the shared Postgres (with the hub's own `add-database.sh`), saves the password in `/opt/hub/.env`, and adds `DATABASE_URL` to the papercut service in `/opt/hub/docker-compose.yml`. Then it checks the file (and puts it back if the check fails) and restarts only Papercut, so the other games keep running. Safe to run twice.

1. Open **PowerShell** on your PC.
2. Go to the Papercut folder and get the latest `main` (the script must be the merged one):
   ```
   cd C:\Users\marci\Documents\GameDev\papercut
   git checkout main
   git pull
   ```
3. Run the script on the hub. Replace `<hub address>` with the hub's IP from your private hosting notes (the same address as the `DROPLET_HOST` secret):
   ```
   Get-Content -Raw deploy/hub/add-stats-db.sh | ssh -i "$HOME\.ssh\hormigas-deploy" deploy@<hub address> "cd /opt/hub && tr -d '\r' | bash -s"
   ```
4. It prints three steps. The last line should start with **"Done. Papercut is saving stats to its database"**.
5. Open https://papercut.marz.gg/api/health and check that it says `"stats":"postgres"`.
6. Tell Claude it's done, so the hub repo (MarcialPimentel/hub) gets the same `DATABASE_URL` line in its copy of `docker-compose.yml`.

If step 3 prints **ERROR**, nothing was left half-changed. Copy the output to Claude.

### Backups

Papercut's database is part of the hub's nightly backup (`/opt/hub/backup.sh`: every database, kept 7 days in `/opt/hub/backups`). Inputs older than 90 days are cleared automatically; the match summaries are kept. A match is about 1 KB of summary plus 5-20 KB of inputs.

## Everyday commands (on the server, in /opt/hub)

| Task | Command |
|---|---|
| Is it running? | `docker compose ps papercut` |
| Live server logs | `docker compose logs -f papercut` |
| Restart it (kicks players in a fight back to the menu) | `docker compose restart papercut` |
| Look at the stats database | `docker compose exec db psql -U postgres -d papercut` (then `SELECT count(*) FROM matches;`, and `\q` to leave) |
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
- **No accounts.** Rooms live in memory; a restart sends everyone back to the menu. Only the stats are stored.
- **On your own PC** the stats are kept in memory (no `DATABASE_URL`): play a match in two windows, then open http://localhost:5173/stats.
- **Capacity:** the container accepts up to 200 connections (`CAPACITY`). A fight costs the server almost nothing.
