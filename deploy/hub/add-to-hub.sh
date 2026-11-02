#!/usr/bin/env bash
# One-time setup: adds Papercut to the hub server (the one running Hormigas and the other games).
# Run it on the server as the deploy user (docs/deploy.md, step 2):
#
#   bash add-to-hub.sh
#
# It adds the papercut service to /opt/hub/docker-compose.yml and a papercut.marz.gg block to
# /opt/hub/Caddyfile, checks both, and reloads Caddy. Safe to run twice. If a check fails, both
# files are put back exactly as they were, so the other games are never left with a broken setup.
# Afterwards, copy the same two changes into the hub repo (MarcialPimentel/hub), the master copy of the server's files.
set -euo pipefail
cd "${HUB_DIR:-/opt/hub}"   # HUB_DIR is only for rehearsing on a copy

stamp=$(date -u +%Y%m%d-%H%M%S)
compose_backup="docker-compose.yml.before-papercut-$stamp"
caddy_backup="Caddyfile.before-papercut-$stamp"
cp docker-compose.yml "$compose_backup"
cp Caddyfile "$caddy_backup"
# `cat >` instead of `mv`: Caddy sees the Caddyfile through a file mount, which follows the
# original file, so it must be rewritten in place.
restore() {
  cat "$compose_backup" > docker-compose.yml
  cat "$caddy_backup" > Caddyfile
  echo "Put both files back as they were (copies: $compose_backup, $caddy_backup)."
}

echo "==> 1/3 docker-compose.yml"
if grep -q '^  papercut:' docker-compose.yml; then
  echo "Already has the papercut service."
else
  grep -q '^volumes:' docker-compose.yml || { echo "ERROR: no top-level 'volumes:' line to insert before."; restore; exit 1; }
  service=$(cat <<'SERVICE'
  # Papercut (repo: papercut, deploy/hub/add-to-hub.sh). Serves the page, the rooms WebSocket (/ws)
  # and /api/health on port 8790 inside Docker; Caddy is the only way in. Rooms live in memory, so a
  # restart (each deploy) sends players in a fight back to the menu; the grace period is short.
  papercut:
    image: ghcr.io/marcialpimentel/papercut:latest
    restart: unless-stopped
    environment:
      PORT: "8790"
      # Only Papercut's own page may open a game connection.
      ALLOWED_ORIGINS: https://papercut.marz.gg
      CAPACITY: "200"
    stop_grace_period: 5s
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8790/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging: *logging
    mem_limit: 256m
    cpus: 0.5

SERVICE
)
  tmp=$(mktemp)
  SERVICE_TEXT="$service" awk '/^volumes:/ && !done { print ENVIRON["SERVICE_TEXT"]; print ""; done=1 } { print }' docker-compose.yml > "$tmp"
  cat "$tmp" > docker-compose.yml
  rm -f "$tmp"
  echo "Added the papercut service."
fi
if ! docker compose config -q; then
  echo "ERROR: docker-compose.yml doesn't check out."
  restore
  exit 1
fi

echo "==> 2/3 Caddyfile"
if grep -q '^papercut\.marz\.gg' Caddyfile; then
  echo "Already has papercut.marz.gg."
else
  cat >> Caddyfile <<'CADDY'

# Papercut (repo: papercut). The game container serves the page, the rooms WebSocket and /api/health.
papercut.marz.gg {
	encode gzip
	reverse_proxy papercut:8790
}
CADDY
  echo "Added papercut.marz.gg."
fi
if ! docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile > /dev/null 2>&1; then
  echo "ERROR: Caddy says the Caddyfile is invalid:"
  docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -5 || true
  restore
  exit 1
fi

echo "==> 3/3 Reloading Caddy (no downtime for the other games)"
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo
echo "Done. papercut.marz.gg currently points at: $(getent hosts papercut.marz.gg | awk '{print $1}' || true)"
echo "The game itself starts on the first deploy (merge to main, or Actions -> Deploy -> Run workflow)."
