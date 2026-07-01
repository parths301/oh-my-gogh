# Oh my Gogh! — project memory for Claude Code

Read this before touching the codebase. It's the source of truth for what's actually
built, what's live, and what's still pending — kept current as work lands.

## What this is

A lifestyle brand storefront (apparel, art supplies, accessories, books) + a studio
admin, built as a **static site + Vercel serverless functions** — no framework, no
build step, no self-hosted server.

```
Browser ──> Vercel (static HTML/CSS/JS + /api/*.js serverless functions)
              │
              ├─ /api/config                  → public config for the browser
              ├─ /api/razorpay/create-order    → server-priced order, calls Razorpay ─┐
              └─ /api/razorpay/verify          → HMAC verify, writes order            │
                                                                                       ▼
            Supabase (Postgres + RLS + Auth)  ◀── (admin CMS — NOT YET WIRED) ── Razorpay
```

## Stack decisions (why things look the way they do)

- **No Next.js / React / build tooling.** Vanilla HTML/CSS/JS SPAs (`index.html` +
  `js/site.js` for the storefront, `admin.html` + `js/admin.js` for the admin). This was
  a deliberate choice to keep deploys instant and dependency-free — don't introduce a
  bundler without discussing it first.
- **No Medusa.** Medusa needs an always-on Node server + Postgres + Redis, which Vercel
  can't host. Supabase (hosted Postgres + Auth + RLS) plays that role instead, reached
  only through Vercel serverless functions — nothing is self-hosted.
- **Razorpay**, not Stripe — the brand is India-first (INR pricing, Mumbai Supabase
  region).
- **The admin panel *is* the CMS.** No separate headless CMS (Sanity/Strapi rejected).

## Live infrastructure (do not re-create these — they exist)

| Thing | Value |
| --- | --- |
| Supabase project | `oh-my-gogh`, org **Sparx**, region Mumbai, ref `pauqbjrfnkacxweqnevj` |
| Supabase URL | `https://pauqbjrfnkacxweqnevj.supabase.co` |
| Vercel project | `parths301s-projects/oh-my-gogh`, linked to this GitHub repo (`parths301/oh-my-gogh`) |
| Production URL | **https://oh-my-gogh.vercel.app** — auto-deploys on every push to `main` |
| Public domain | `ohmygogh.com` — **still on GitHub Pages**, intentionally not pointed at Vercel yet |
| Admin login | `parthsh.ind@gmail.com` (Supabase Auth user, already created) |
| Razorpay | Test mode keys set in Vercel env vars (rotated 2026-06-30 — see below) |

Real secret values (Supabase service-role key, Razorpay key secret, admin temp password)
live **only** in Vercel env vars and the local gitignored `.secrets/` / `.env` files —
never in git history, never in chat going forward. `.env.example` documents the *names*.

## What's done and verified live

- [x] **Supabase schema + RLS** (`supabase/schema.sql`) — products, artists,
      journal_posts, collections, discounts, customers, orders, order_items, settings,
      admins. Public can read only *published* content; writes are admin-allowlist only.
      **Gotcha already hit and fixed:** `is_admin()` must be `SECURITY DEFINER` — without
      it, checking admin status reads the `admins` table, which re-triggers its own RLS
      policy (which calls `is_admin()` again) → infinite recursion (Postgres `54001`).
      Don't revert that without understanding why it's there.
- [x] **Seed content** (`supabase/seed.sql`) — real brand copy (not placeholder text),
      INR pricing, idempotent (safe to re-run after edits).
- [x] **Serverless API** (`api/`):
  - `config.js` — serves public Supabase/Razorpay/currency/shipping config to the
    browser; never exposes secrets.
  - `razorpay/create-order.js` — re-prices the cart from Supabase (ignores any price the
    client sends), applies discount codes, enforces Razorpay's 100-paise minimum, creates
    a real Razorpay order, distinguishes 401 (bad keys) from other failures.
  - `razorpay/verify.js` — HMAC-SHA256 signature verification
    (`order_id + "|" + payment_id`, timing-safe compare), then writes the order +
    line items to Supabase with the service-role key.
  - `_lib.js` — shared helpers (body parsing, a tiny Supabase REST client, shipping calc).
- [x] **Storefront** (`index.html`, `js/site.js`, `js/supabase.js`) — hydrates products /
      artists / journal / collections / discounts from Supabase on load; **falls back
      cleanly to bundled demo data** (`js/data.js`) if Supabase isn't reachable, so the
      site never breaks. Currency symbol and shipping thresholds are config-driven, not
      hardcoded.
- [x] **Razorpay Standard Checkout** — real flow: `create-order` → `checkout.js` modal →
      `verify`. Tested against the live deployment with actual Razorpay API calls:
      tamper attempts (client-sent fake price) are ignored, discount math is correct,
      forged signatures are rejected, auth-failure path returns 401. Runs in **demo mode**
      automatically (simulated order, no Razorpay call) if keys aren't configured —
      see `paymentsLive` in `js/site.js`.
- [x] Demo/placeholder copy removed from the storefront and admin (no more "Stripe demo",
      "Vendure/WooCommerce" filler text).
- [x] Vercel project created + linked to GitHub for auto-deploy; all env vars set and
      confirmed live via `/api/config`.
- [x] **Storefront brought to full parity with the Claude-design mockup** (`js/site.js`,
      `css/site.css`) — the mockup file the site was originally built from included pages
      and a mobile nav that hadn't actually been wired up yet:
  - Mobile burger-menu nav + the responsive header/hero CSS breakpoints (`.omg-header`,
    `.omg-nav`, `.omg-burger`, hero title/sub clamps below 760px/560px) — previously
    missing entirely, so the header just overflowed on small screens.
  - New pages: **Search** (`search`), **Account** (`account` — guest sign-in demo +
    Orders/Saved/Profile tabs, local-only since there's no customer-auth backend yet),
    per-artist **profile pages** (`artist`), and a **404** view for unknown routes.
  - **Checkout rebuilt as the mockup's 3-step wizard** (Contact → Shipping, incl.
    Studio Standard/Express options → Payment) — still calls the same real
    `create-order` / `verify` endpoints on the final step; nothing about the Razorpay
    integration changed.
  - The old merged contact+FAQ page was replaced with the mockup's split **info hub**
    (shipping & returns, size guide, FAQ, contact, privacy, terms, accessibility),
    reachable from the footer and account nav.
  - The wishlist (♡ Save) button on the product page now actually toggles and persists
    (`localStorage`, surfaced in Account → Saved) — it rendered before but did nothing.
  - `js/admin.js` / `css/admin.css` were already a faithful port of the admin mockup
    (dashboard, all seven drawers, responsive sidebar) — no changes were needed there.
  - Verified via a Node smoke test that boots `site.js` in a stubbed DOM and exercises
    every view/state transition (no headless browser was available to screenshot with
    in that session — do a real visual pass in a browser if you touch this again).

## What's NOT done yet — the actual next task

**The admin panel (`admin.html` / `js/admin.js`) still reads and writes only
`localStorage`** (via `js/data.js`). The Supabase backend, RLS policies, and admin login
all exist and are tested — but nothing in the admin UI calls Supabase yet. This is the
real "make the CMS work" task:

1. Add Supabase Auth login screen to `admin.html` (email/password against the existing
   admin user; `js/supabase.js` already has `getClient()`).
2. Replace `admin.js`'s direct `store.products.push(...)` / `DB.save(store)` calls with
   Supabase reads/writes (`client.from('products').insert(...)`, `.update(...)`,
   `.delete(...)`, etc.) for every section: products, orders, customers, discounts,
   collections, journal, artists, settings.
3. Keep the localStorage path as an offline/demo fallback, same pattern as the storefront
   (`DB.remote.loadStore()` already does this read-side for the storefront — mirror it
   for the admin, but add write-through).
4. Verify against the live Supabase project (ref `pauqbjrfnkacxweqnevj`) before
   considering this done — don't ship unverified auth/write code.

Secondary, lower-priority items:
- [ ] Point `ohmygogh.com` at Vercel (DNS change — confirm with the user first, this
      affects the live public domain).
- [ ] Move Razorpay from **test** keys to **live** keys when the user is ready to accept
      real payments (explicit user decision, not something to do unprompted).
- [ ] Product photography — admin currently renders painterly gradient placeholders per
      product (`OMG.cardBg`); real photos get uploaded via Supabase Storage once the
      admin write-through exists.

## File map

```
index.html, admin.html       — SPA shells, load the JS below
js/data.js                   — bundled demo catalog + localStorage helpers (fallback)
js/supabase.js               — Supabase client loader + DB-row -> UI-shape mappers
js/site.js                   — storefront SPA (all views, cart, checkout)
js/admin.js                  — admin SPA (NOT yet wired to Supabase — see above)
css/site.css, css/admin.css  — styles
api/_lib.js                  — shared serverless helpers
api/config.js                — public config endpoint
api/razorpay/create-order.js — server-priced Razorpay order creation
api/razorpay/verify.js       — signature verification + order persistence
supabase/schema.sql          — full schema + RLS (idempotent)
supabase/seed.sql            — real starting content (idempotent)
SETUP.md                     — human setup guide + live status table
WEBSITE_PLAN.md              — broader brand/site strategy doc
.env.example                 — documents required env var *names* only
```

## Running / deploying

No build step. Local static preview: `python3 -m http.server 4321` (or the project's
`npm run dev`). Pushing to `main` auto-deploys to Vercel. To change env vars or trigger a
manual deploy, the Vercel CLI works via `npx vercel <cmd> --token <token>` — a token was
used once interactively; don't assume one is available in a fresh session.

**Sandboxed Claude sessions can't `git push`** — outbound access to github.com gets a 403
from the sandbox's proxy. Commit locally as usual (the workspace folder is the user's real
checkout, so commits land there for real); if `git push` fails with a proxy/403 error,
that's this restriction, not a real problem — tell the user to run `git push origin main`
from their own Terminal instead of treating it as broken. Also, git commands here can leave
a stale `.git/index.lock` around because this sandbox's mounted filesystem blocks `rm`/unlink
by default — if `git add`/`commit` fails with "Unable to create .git/index.lock: File
exists", call `allow_cowork_file_delete` on that lock file first, then remove it and retry.

## Ground rules for this repo

- Don't add a build step / framework without checking with the user first.
- Don't put secrets in committed files, ever — Vercel env vars or local gitignored files
  only.
- Don't touch DNS / the `ohmygogh.com` domain without explicit confirmation.
- Don't switch Razorpay to live keys without explicit confirmation.
- The storefront must keep working even if Supabase is unreachable (demo-data fallback) —
  preserve that pattern in any change.
