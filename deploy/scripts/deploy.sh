#!/usr/bin/env bash
# Deploy / redeploy Oh my Gogh! on the VPS.
# Run from the repo root (e.g. /opt/ohmygogh):  bash deploy/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -f deploy/.env.production ]; then
  echo "deploy/.env.production missing — copy the .example and fill it in" >&2
  exit 1
fi

echo "== pulling latest =="
git pull --ff-only

echo "== building + starting containers =="
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.production up -d --build

echo "== waiting for the API =="
for i in $(seq 1 60); do
  curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1 && break
  sleep 2
done

echo "== running database migrations =="
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.production \
  exec -T medusa npx medusa db:migrate

echo "== publishing the storefront =="
rsync -a --delete index.html assets css js /var/www/ohmygogh/

echo "== done =="
curl -fsS http://127.0.0.1:9000/health && echo " — backend healthy"
cat <<'EOF'

Post-deploy checklist (first deploy only):
  * create the admin user:
      docker compose -f deploy/docker-compose.yml --env-file deploy/.env.production \
        exec medusa npx medusa user -e you@example.com -p '<password>'
  * import the legacy data (copy .secrets/supabase-export to the VPS first):
      docker compose ... exec -e OMG_EXPORT_DIR=/tmp/supabase-export medusa \
        npx medusa exec ./src/scripts/migrate-from-supabase.ts
    …or simpler: pg_dump the local database and restore it into the postgres container.
  * update js/config.js medusaUrl + publishableKey for the deployed backend, redeploy storefront.
EOF
