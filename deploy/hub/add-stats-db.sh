#!/usr/bin/env bash
# One-time setup: gives Papercut its own database on the hub's shared Postgres, for the match stats.
# Run it on the server as the deploy user (docs/deploy.md, "Turn on the stats database"):
#
#   ssh -i ~/.ssh/hormigas-deploy deploy@<hub address> "cd /opt/hub && bash -s" < deploy/hub/add-stats-db.sh
#
# It creates the "papercut" database and user (the hub's add-database.sh), keeps the password in
# /opt/hub/.env, adds DATABASE_URL to the papercut service, checks the file and restarts only
# Papercut. Safe to run twice. If the check fails, the files are put back as they were.
# Afterwards, copy the docker-compose.yml change into the hub repo (MarcialPimentel/hub).
set -euo pipefail
cd "${HUB_DIR:-/opt/hub}"   # HUB_DIR is only for rehearsing on a copy

stamp=$(date -u +%Y%m%d-%H%M%S)
compose_backup="docker-compose.yml.before-papercut-db-$stamp"
cp docker-compose.yml "$compose_backup"
restore() { cat "$compose_backup" > docker-compose.yml; echo "Put docker-compose.yml back as it was (copy: $compose_backup)."; }

echo "==> 1/3 Database"
if grep -q '^PAPERCUT_DB_PASSWORD=' .env 2>/dev/null; then
  echo "Already set up (PAPERCUT_DB_PASSWORD is in .env)."
else
  out=$(./add-database.sh papercut)
  password=$(printf '%s\n' "$out" | sed -n 's/^ *PAPERCUT_DB_PASSWORD=//p')
  [ -n "$password" ] || { echo "ERROR: add-database.sh didn't print a password:"; echo "$out"; exit 1; }
  cp .env ".env.before-papercut-db-$stamp" 2>/dev/null || true
  printf '\nPAPERCUT_DB_PASSWORD=%s\n' "$password" >> .env
  chmod 600 .env
  echo "Created the papercut database; its password is in .env."
fi

echo "==> 2/3 docker-compose.yml"
if awk '/^  papercut:/{p=1;next} /^  [a-z]/{p=0} p && /DATABASE_URL/{f=1} END{exit !f}' docker-compose.yml; then
  echo "The papercut service already has DATABASE_URL."
else
  grep -q '^  papercut:' docker-compose.yml || { echo "ERROR: no papercut service. Run add-to-hub.sh first."; exit 1; }
  tmp=$(mktemp)
  awk '
    /^  papercut:/ { p=1 }
    /^  [a-z]/ && !/^  papercut:/ { p=0 }
    { print }
    p && /^    environment:/ && !done {
      print "      # Match stats (repo: papercut, deploy/hub/add-stats-db.sh). Papercut'\''s own database on the shared Postgres."
      print "      DATABASE_URL: postgres://papercut:${PAPERCUT_DB_PASSWORD}@db:5432/papercut"
      done=1
    }
  ' docker-compose.yml > "$tmp"
  cat "$tmp" > docker-compose.yml
  rm -f "$tmp"
  echo "Added DATABASE_URL to the papercut service."
fi
if ! docker compose config -q; then
  echo "ERROR: docker-compose.yml doesn't check out."
  restore
  exit 1
fi

echo "==> 3/3 Restarting Papercut (the other games keep running)"
docker compose up -d papercut
for i in $(seq 1 24); do
  health=$(docker compose exec -T papercut node -e "fetch('http://localhost:8790/api/health').then(r=>r.text()).then(t=>console.log(t)).catch(()=>{})" 2>/dev/null || true)
  case "$health" in *'"stats":"postgres"'*) echo "Done. Papercut is saving stats to its database: $health"; exit 0;; esac
  sleep 5
done
echo "Papercut restarted, but /api/health doesn't say \"stats\":\"postgres\" yet: $health"
echo "If the build before the stats build is live, that's expected: the next deploy picks the database up."
