# Deploying Oh my Gogh! to the VPS

Everything the box needs lives in this folder. Target: Ubuntu 22.04/24.04,
2 GB+ RAM, root or sudo access.

```
[Internet]
   │ 443 (Let's Encrypt via certbot)
[host Nginx] ── serves /var/www/ohmygogh (static storefront)
   │ proxies api.<domain> → 127.0.0.1:9000
[Docker Compose]
   ├─ medusa         (API + Admin dashboard, MEDUSA_WORKER_MODE=server)
   ├─ medusa-worker  (subscribers + scheduled jobs, no HTTP)
   ├─ postgres:16    (volume pgdata — not exposed)
   └─ redis:7        (event bus / workflow engine / locking — not exposed)
```

## First deploy

```bash
# on the VPS, as root
bash deploy/scripts/provision.sh          # docker, nginx, certbot, ufw(22/80/443), ssh keys-only, fail2ban
git clone <repo> /opt/ohmygogh && cd /opt/ohmygogh
cp deploy/.env.production.example deploy/.env.production && $EDITOR deploy/.env.production
bash deploy/scripts/deploy.sh             # build, start, migrate, publish storefront
# create admin + import data → the script prints the exact commands
cp deploy/nginx/ohmygogh.conf /etc/nginx/sites-available/ohmygogh
ln -s /etc/nginx/sites-available/ohmygogh /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d <domain> -d api.<domain>
```

Then point `js/config.js` at `https://api.<domain>` with the publishable key
printed by the migration script, and re-run `deploy.sh`.

## Redeploys

`bash deploy/scripts/deploy.sh` — pulls, rebuilds, migrates, republishes the
storefront. Zero manual steps.

## Rules that still apply

- **ohmygogh.com stays on GitHub Pages** until the user explicitly signs off
  on the DNS change. Use a staging domain (e.g. `omg.<your-domain>`) until then.
- **Razorpay stays on TEST keys** until the user explicitly signs off.

## Data import

The Medusa database is authoritative. To seed the VPS with the migrated data,
either restore a `pg_dump` of the local `medusa_omg` database into the
postgres container, or copy `.secrets/supabase-export/` up and run the
migration script (commands printed by `deploy.sh`).

## First-boot smoke test (important)

The Redis-backed modules (event bus / workflow engine / locking) could not be
verified on the dev machine (boot hang — details in SETUP.md "Known issues").
They run here on the standard node:22 + redis:7 Linux combination, which is
Medusa's reference setup, but **verify `curl localhost:9000/health` succeeds
within ~2 minutes of the first `deploy.sh`**. If it never comes up, comment
the `process.env.REDIS_URL` block in `backend/medusa-config.ts`, set
`MEDUSA_WORKER_MODE=shared` on the `medusa` service, stop `medusa-worker`,
and redeploy single-process while investigating.

## Ops notes

- Logs: `docker compose -f deploy/docker-compose.yml logs -f medusa`
- DB backup: `docker compose ... exec postgres pg_dump -U medusa medusa_omg > backup.sql`
  (worth putting in cron with offsite copy)
- Emails: with `SMTP_HOST` unset the worker logs emails instead of sending —
  safe default until real SMTP credentials are added.
