# Setup — local dev & live status

Architecture: vanilla-JS storefront + self-hosted **Medusa v2** backend
(Postgres 16, Redis 7, Razorpay). See `ARCHITECTURE.md` for the why,
`deploy/README.md` for the VPS runbook. The old Supabase/Vercel stack is
archived under `legacy/`.

## Local development

Prereqs: Node ≥ 20, Postgres 16, Redis (macOS: `brew install postgresql@16 redis && brew services start postgresql@16 redis`).

```bash
# 1. database
createdb medusa_omg

# 2. backend — env is backend/.env (created from scratch below if missing)
cd backend
npm install
npx medusa db:migrate                        # schema (incl. custom modules)
npx medusa user -e you@example.com -p '…'    # admin login for /app
npx medusa exec ./src/scripts/migrate-from-supabase.ts   # import the real data
npm run dev                                  # API :9000 · Admin :9000/app

# 3. storefront (repo root)
python3 -m http.server 4321                  # → http://localhost:4321
```

`backend/.env` needs (see `.env.example` for the full annotated list):
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`,
`STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS` (include `http://localhost:4321`),
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.

`js/config.js` points the storefront at the backend (localhost automatically)
and carries the **publishable key** — printed by the migration script, also
visible in Admin → Settings → Publishable API Keys.

The data import reads the JSON exports in `.secrets/supabase-export/`
(gitignored — contains customer emails). It's resumable: re-run it after a
failure and completed stages are skipped.

## Live status (2026-07-02)

| Piece | State |
| --- | --- |
| Medusa backend | **Built & verified locally** — full catalog/checkout/auth/admin pass done against a local stack (see CLAUDE.md for exactly what was tested) |
| Legacy data | **Migrated** — 8 products/17 variants, 4 collections, 4 promotions, 6 customers, 8 orders, 4 artists, 4 journal posts, INR pricing. Supabase project untouched as archive |
| Razorpay | **Test keys** (`rzp_test_T7qz…`), wired through Medusa payment sessions. Live-key switch requires owner sign-off. The old doc discrepancy is resolved: test keys *were* set in Vercel (visible via the legacy `/api/config`), and the same keys are in `.env` |
| VPS | **Not yet provisioned — no credentials available.** `deploy/` is ready to run the moment SSH access exists |
| ohmygogh.com | Still on GitHub Pages, **intentionally** — DNS change requires owner sign-off |
| oh-my-gogh.vercel.app | Still serving the *legacy* build (repo `main` before this migration lands there). Retire it once the VPS is live |
| Emails | SMTP env unset — notifications log to the backend console (safe default) |

## Going live checklist

1. Get VPS SSH access → run `deploy/scripts/provision.sh`, then
   `deploy/scripts/deploy.sh` (full steps in `deploy/README.md`).
2. Import data (pg_dump restore or re-run the migration script on the box).
3. Point `js/config.js` at `https://api.<staging-domain>` + redeploy.
4. Real SMTP credentials → order emails go live.
5. Owner sign-off → point `ohmygogh.com` at the VPS.
6. Owner sign-off → swap Razorpay test keys for live keys in
   `deploy/.env.production`.
