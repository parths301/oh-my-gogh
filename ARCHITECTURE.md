# Architecture

Oh my Gogh! is a vanilla-JS storefront backed by a self-hosted
**Medusa v2** commerce engine. No frontend build step; one real backend.

```
Browser
  │  static HTML/CSS/JS  (index.html, js/site.js — no framework, no bundler)
  │
  ├──> Nginx (VPS host)
  │      ├─ /                      → /var/www/ohmygogh  (static storefront)
  │      └─ api.<domain>           → 127.0.0.1:9000     (reverse proxy)
  │
  └──> Medusa v2 backend (backend/, Node 20+/TypeScript, Docker on the VPS)
         ├─ Store API   /store/*   — products, carts, checkout, customers,
         │                           + custom: artists, journal, reviews, wishlist
         ├─ Admin API   /admin/*   — everything the dashboard uses
         ├─ Admin UI    /app       — Medusa Admin (replaces the old admin.html)
         │                           + custom pages: Artists, Journal, Reviews
         ├─ Postgres 16            — all commerce + content data
         ├─ Redis 7                — event bus, workflow engine, locking
         └─ Razorpay               — payment provider (@sgftech/payment-razorpay)
```

## Why Medusa

The store needed customer accounts, real inventory, promotions, order
management, emails, and an admin — all of which the old
Supabase-plus-hand-rolled-JS stack reimplemented poorly or not at all. Medusa
v2 is Node/TypeScript (matches the stack), self-hostable on the VPS,
and ships products/variants/carts/orders/customers/promotions/inventory/
payments as first-class modules with a production admin dashboard. It was
previously ruled out only because Vercel couldn't host an always-on server;
with a dedicated VPS that constraint is gone.

Alternatives considered: **Saleor** (Python/GraphQL — a stack mismatch, and
GraphQL would force a bigger storefront rewrite), **Vendure** (also Node/TS
and credible, but a smaller ecosystem and no maintained Razorpay provider —
Medusa has `@sgftech/payment-razorpay`).

## What lives where

| Piece | Path | Notes |
| --- | --- | --- |
| Storefront SPA | `index.html`, `js/site.js`, `css/site.css` | unchanged design; data layer swapped |
| Backend config | `js/config.js` | backend origin + publishable key + Razorpay key id (all public) |
| Store API client | `js/api.js` | catalog, carts, checkout, auth, reviews, wishlist |
| Demo fallback | `js/data.js` | bundled catalog; loads when the backend is unreachable so the site never hard-crashes |
| Medusa app | `backend/` | standard Medusa v2 project layout |
| Custom modules | `backend/src/modules/{brand,review,wishlist}` | artists+journal (CMS role), product reviews, per-customer wishlists |
| Custom APIs | `backend/src/api/{store,admin}/*` | REST routes over the custom modules |
| Admin pages | `backend/src/admin/routes/{artists,journal,reviews}` | CRUD drawers + review moderation in the dashboard |
| Emails | `backend/src/subscribers/*`, `backend/src/modules/smtp-notification` | order confirmation, shipment; SMTP provider (logs locally when unset) |
| Jobs | `backend/src/jobs/*` | hourly abandoned-cart recovery, daily low-inventory digest |
| Data migration | `backend/src/scripts/migrate-from-supabase.ts` | one-time, resumable Supabase → Medusa import |
| Deployment | `deploy/` | Docker Compose, Nginx, provision + deploy scripts |
| Old stack | `legacy/` | archived Supabase/Vercel era, see `legacy/README.md` |

## Key design decisions

- **Local-first cart, server-truth totals.** The SPA keeps its instant local
  cart for UI; a debounced sync mirrors it into a real Medusa cart whenever the
  backend is reachable. Totals, promo validation, the ₹2000 free-shipping rule
  (a shipping-option *price rule*, not client math) and payment all come from
  the server. Offline, the demo catalog + simulated checkout keep the site
  browsable.
- **Checkout flow**: sync cart → set email/address → pick shipping option
  (`standard`/`express` by type code) → payment session with
  `pp_razorpay_razorpay` (the session's data carries a real Razorpay order id)
  → Razorpay Checkout modal → `POST /store/carts/:id/complete`.
- **Legacy collections became a category tree.** Medusa collections are
  1-product-to-1-collection, but OMG products belonged to several. They're
  child categories under a "Collections" parent instead (many-to-many,
  supports draft via `is_active`).
- **Product metadata carries the art direction.** `tint`, `medium`, `artist`,
  `sold` live in `product.metadata` so the painterly card rendering works
  untouched.
- **Inventory semantics changed.** The legacy model tracked one number per
  product; Medusa tracks per variant. Each size variant was seeded with the
  product-level quantity.
- **Reviews are moderated.** Anyone can submit (signed-in customers are
  linked and deduped); only `approved` reviews are served. Moderation lives in
  the admin's Reviews page.
- **Search is client-side.** The catalog is small (tens of products) and fully
  hydrated at load, so instant local filtering beats a search service.
  Meilisearch was considered and deliberately skipped — revisit only when the
  catalog outgrows a single fetch (hundreds of products), e.g. via
  `@rokmohar/medusa-plugin-meilisearch`.
- **Two backend processes in production.** `MEDUSA_WORKER_MODE=server` (HTTP)
  and `=worker` (subscribers + scheduled jobs), coordinated through Redis
  (event bus, workflow engine, locking). Locally a single `npm run dev`
  process does both.

## Data flow for content

Artists and journal posts are Medusa custom-module rows (`brand` module) —
the admin dashboard is the CMS. A separate headless CMS (Strapi/Directus) was
rejected: two posts a month doesn't justify another always-on service, another
auth system, and another schema to keep in sync.
