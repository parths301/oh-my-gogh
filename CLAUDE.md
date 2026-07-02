# Oh my Gogh! — project memory for Claude Code

Read this before touching the codebase. It's the source of truth for what's
actually built, what's live, and what's still pending — kept current as work
lands.

## What this is

A lifestyle brand storefront (apparel, art supplies, accessories, books) built
as a **vanilla-JS static storefront + self-hosted Medusa v2 commerce backend**.
The full picture with diagrams and rationale is in `ARCHITECTURE.md` — read it.
Short version:

```
Browser → static storefront (index.html + js/site.js, no build step)
        → Medusa v2 backend (backend/, :9000) — Store API, Admin API,
          Medusa Admin at /app, Postgres 16 + Redis 7, Razorpay payments
VPS     → deploy/ has the whole stack: Docker Compose (postgres, redis,
          medusa server + worker), host Nginx + certbot, hardening scripts
```

**The 2026-07 replatform**: the previous Supabase + Vercel-functions stack is
fully archived under `legacy/` (see `legacy/README.md` for the mapping). The
"no self-hosted backend" constraint was lifted when a dedicated VPS became
available; Medusa was chosen over Saleor/Vendure (stack fit + maintained
Razorpay provider — details in ARCHITECTURE.md).

## Stack decisions (why things look the way they do)

- **Storefront stays vanilla** — no framework/bundler. `js/api.js` is the only
  data layer (Medusa Store API); `js/config.js` holds the backend origin +
  publishable key + Razorpay key id (all public by design).
- **The storefront must never hard-crash when the backend is down** — it falls
  back to the bundled demo catalog (`js/data.js`) and a simulated checkout.
  Preserve this in any change (`apiMode`/`paymentsLive` flags in site.js).
- **Medusa Admin is the CMS.** Artists/journal/reviews/wishlist are custom
  Medusa modules (`backend/src/modules/`) with store + admin API routes and
  custom admin pages (`backend/src/admin/routes/`). No separate headless CMS.
- **Cart model**: local cart for instant UI, debounced sync into a real Medusa
  cart; all totals/discounts/shipping are server truth when reachable.
  Free-shipping-over-₹2000 is a shipping-option *price rule* in Medusa, not
  client math.
- **Search is client-side on the hydrated catalog** — deliberate; Meilisearch
  rejected at this catalog size (revisit at hundreds of products).
- **Historic orders** were imported via the order module directly — they have
  no payment records; legacy stage/tracking live in `order.metadata`.
- **Legacy "collections" are child categories** under a "Collections" parent
  (Medusa collections are 1:1, products belonged to several).

## Live infrastructure

| Thing | Value |
| --- | --- |
| VPS | **Not provisioned yet — no SSH credentials have ever been provided.** `deploy/` is ready; ask the user for access |
| Local dev backend | `backend/` against brew Postgres 16 (`medusa_omg` db) + brew Redis |
| Medusa admin login | `parthsh.ind@gmail.com`, password in `.secrets/medusa-admin.local` |
| Storefront publishable key | in `js/config.js` (public) |
| Razorpay | **TEST keys** (`rzp_test_T7qz…`) in `backend/.env` + `.secrets/`. The old CLAUDE.md/SETUP.md discrepancy is resolved: keys WERE set in Vercel (confirmed live via legacy `/api/config` 2026-07-02) |
| Supabase (legacy) | `oh-my-gogh` org Sparx, ref `pauqbjrfnkacxweqnevj` — **read-only archive**, data fully migrated to Medusa. Don't write to it; don't delete it without the user |
| Vercel (legacy) | `oh-my-gogh.vercel.app` still serves the pre-migration build; retire after VPS go-live |
| ohmygogh.com | GitHub Pages, intentionally not moved — **DNS change needs explicit user sign-off** |

Secrets live only in gitignored `.secrets/`, `backend/.env`, `.env`, and (on
the VPS) `deploy/.env.production`. Never in git, never in chat.

## What's done and verified

- [x] Medusa 2.17 backend: custom modules (brand/review/wishlist), Razorpay
      provider (`@sgftech/payment-razorpay`, `pp_razorpay_razorpay` enabled on
      the region), SMTP notification provider, order/shipment email
      subscribers, abandoned-cart + low-inventory jobs, Redis event
      bus/workflow engine/locking when `REDIS_URL` is set.
- [x] Full data migration from Supabase (8 products/17 variants, 4
      collections→categories, 4 promotions, 6 customers, 8 orders/11 items,
      4 artists, 4 journal posts) via `backend/src/scripts/migrate-from-supabase.ts`
      — resumable, verified by row counts + spot checks. Exports cached in
      `.secrets/supabase-export/`.
- [x] Storefront rewired to Medusa (js/api.js), including real customer
      auth, live order history, reviews UI, synced wishlist, server-validated
      promos, Razorpay payment-session checkout. Demo fallback intact.
- [x] Custom Medusa Admin pages: Artists, Journal, Reviews moderation.
- [x] Legacy stack archived under `legacy/`; docs rewritten
      (README/ARCHITECTURE/SETUP/deploy/README).
- [x] **E2E verified locally** — see SETUP.md "Live status" and the final
      session summary in git history for exactly what was exercised.

## What's NOT done yet

- [ ] **VPS deployment** — blocked on credentials. Everything is scripted in
      `deploy/`; a first deploy is: provision.sh → clone → .env.production →
      deploy.sh → nginx conf → certbot (runbook in deploy/README.md).
- [ ] Real SMTP credentials (emails currently log to console).
- [ ] Razorpay webhook registration (needs the public backend URL first);
      `RAZORPAY_WEBHOOK_SECRET` is a placeholder until then. Payment capture
      currently relies on the checkout handler completing the cart.
- [ ] Point ohmygogh.com at the VPS — **user sign-off required**.
- [ ] Razorpay live keys — **user sign-off required**.
- [ ] Product photos are still gradient placeholders (image_url is wired
      end-to-end; Medusa Admin → product media uploads work once deployed with
      a file provider — local file provider works out of the box).

## Running / deploying

- Backend: `cd backend && npm run dev` (needs brew postgres@16 running; boot
  takes ~15–60s). **Leave `REDIS_URL` unset locally** — with it set, boot
  hangs on this machine (see SETUP.md "Known issues"; redis modules are
  production-only and must be smoke-tested at first VPS deploy). Note:
  `medusa develop` spawns a child `medusa start` process — to restart it,
  `pkill -f "@medusajs/cli"`, or an orphaned child keeps port 9000 serving
  stale routes.
- Storefront: `python3 -m http.server 4321` at repo root.
- Reset + reseed local DB: `dropdb medusa_omg && createdb medusa_omg && npx
  medusa db:migrate && npx medusa user -e … -p … && npx medusa exec
  ./src/scripts/migrate-from-supabase.ts`.
- VPS: `deploy/README.md` is the runbook. Push to `main` does NOT auto-deploy
  the new stack anywhere yet (Vercel still auto-deploys the legacy build —
  harmless, ignores backend/).

**Sandboxed Claude sessions may not be able to `git push`** (proxy 403) —
commit locally and tell the user to push. A stale `.git/index.lock` can
appear; if `rm` is blocked, use the `allow_cowork_file_delete` hook first.

## Ground rules for this repo

- Don't point ohmygogh.com anywhere without explicit confirmation.
- Don't switch Razorpay to live keys without explicit confirmation.
- Keep the storefront's demo-data fallback working in any change.
- No secrets in committed files, ever.
- Don't bolt a bundler/framework onto the storefront without discussing it.
- The Supabase project is an archive — read-only, no writes, no deletion.
