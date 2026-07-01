# Oh my Gogh! 🎨

A lifestyle brand for artistic minds — wearable art, art supplies, accessories and studio goods, made in collaboration with working artists.

**Live:** [ohmygogh.com](https://ohmygogh.com)

> The catalogue is an evolving creative-lifestyle range: art supplies (paints, brushes, sketchbooks, tools), apparel, accessories, books, and prints & stationery to come.

---

## What's in here

This repository is the **full Oh my Gogh! website** — a storefront plus a studio admin — built as a fast, dependency-free static site (vanilla HTML/CSS/JS, no build step). It's a faithful implementation of the brand's Claude Design source, ported to production-ready standalone code.

| File | Purpose |
| --- | --- |
| [`index.html`](index.html) | Public storefront shell |
| [`admin.html`](admin.html) | Studio admin shell (`/admin.html`) |
| [`js/data.js`](js/data.js) | Bundled demo catalog + localStorage helpers (offline/demo fallback only) |
| [`js/supabase.js`](js/supabase.js) | Supabase client, Auth, row mappers, and CRUD/Storage helpers shared by both SPAs |
| [`js/site.js`](js/site.js) | Storefront SPA (home, shop, product, artists, journal, search, account, about, cart, checkout) |
| [`js/admin.js`](js/admin.js) | Admin SPA — Supabase Auth login + live CRUD for products, orders, customers, discounts, collections, journal, artists, payments, settings |
| [`css/site.css`](css/site.css) · [`css/admin.css`](css/admin.css) | Styles |
| [`assets/`](assets) | Brand emblem, logo, grain texture |
| [`api/`](api) | Vercel serverless functions — public config, Razorpay order creation + verification |
| [`supabase/schema.sql`](supabase/schema.sql), [`supabase/seed.sql`](supabase/seed.sql) | Postgres schema + RLS policies, and starting content |
| [`SETUP.md`](SETUP.md) | Live infrastructure status + how to go from clone to fully wired |
| [`WEBSITE_PLAN.md`](WEBSITE_PLAN.md) | Strategic plan for the broader platform |

## Storefront

A single-page experience that covers the whole shopping journey:

- **Home** — animated hero, brushstroke motion, featured "Current Hang", category rooms, artist-in-residence, manifesto, newsletter signup
- **Shop / Search** — category filtering, painterly product cards, quick-add to bag, dedicated search view
- **Product** — gallery, size selector, details, maker credit, wishlist save, related pieces
- **Artists** — featured collaborator + the rest of the roster, per-artist profile pages
- **Journal** — editorial grid with readable article pages
- **Account** — guest sign-in demo with Orders / Saved / Profile tabs (local-only; there's no customer-auth backend yet)
- **About** — brand story, values, full logo
- **Bag → 3-step Checkout (Contact → Shipping → Payment) → Confirmation** — quantity editing, promo codes (`STARRY` = 15% off), shipping logic, real Razorpay Standard Checkout
- **Info hub** — shipping & returns, size guide, FAQ, contact, privacy, terms, accessibility
- **404** for unknown routes

Products, artists, journal posts, collections and discounts hydrate from Supabase on load; if Supabase is unreachable the site falls back cleanly to the bundled demo catalog (`js/data.js`) so it never breaks.

## Studio Admin

A complete merchant back-office at [`/admin.html`](admin.html), gated by a Supabase Auth login (only emails in the `admins` table can sign in and write):

- **Dashboard** — revenue / orders / avg-order / conversion KPIs, 14-day revenue chart, top pieces, recent orders
- **Products** — table with status/inventory, full create / edit / delete drawer (title, description, price, inventory, category, variants, photo upload, publish toggle)
- **Orders** — fulfillment pipeline with a status timeline, advance-stage button, tracking numbers, line items and totals
- **Customers** — list with lifetime value, customer drawer with order history and internal notes
- **Discounts** — percentage / fixed codes with usage limits and expiry
- **Collections** — group products into curated drops
- **Journal** — write and publish articles, with cover photo upload
- **Artists** — manage collaborator profiles, with portrait upload
- **Payments** — toggle Stripe / PayPal / Razorpay / Manual providers and enter keys
- **Settings** — store profile, shipping summary, connection status

### Live data flow

The admin and storefront both read and write the same Supabase Postgres database, gated by Row Level Security: the public can only read *published* catalog/content, and only signed-in admins (checked via an `is_admin()` allowlist) can write. **Edit a product (or publish a draft, add a discount, write a post) in the admin and it shows up on the storefront immediately.** Product, artist, and journal photos upload straight to a public Supabase Storage bucket (`media`) — only admins can write to it, anyone can read/hot-link the resulting URL.

If Supabase isn't configured (e.g. running the admin against a plain static server with no `/api/config`), the admin falls back to the same local demo catalog + "Reset to sample data" flow the storefront uses, so the UI is still fully explorable offline.

## Brand system

- **Colors** — ink navy `#15315C`, sand/cream `#F3EDDD`, chrome gold `#E0A93A`, teal `#2E8A87`, rust `#C0561E`
- **Type** — Yellowtail (logo script), Playfair Display (headlines), Space Grotesk (body), Space Mono (labels)
- **Texture** — grain overlay, painterly gradient "canvases", organic blob shapes

## Running locally

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 4321
# storefront → http://localhost:4321/index.html
# admin      → http://localhost:4321/admin.html
```

## Deployment

Static site + Vercel serverless functions, deployed at **https://oh-my-gogh.vercel.app** — pushing to `main` auto-deploys. Data lives in Supabase (Postgres + Auth + Storage); payments run through Razorpay. See [`SETUP.md`](SETUP.md) for the full live-infrastructure status.

The public [`ohmygogh.com`](https://ohmygogh.com) domain (see [`CNAME`](CNAME)) is still on GitHub Pages and hasn't been pointed at Vercel yet — that's a deliberate, not-yet-made decision, not an oversight.

---

**Built with creativity, coded with passion.** 🎨✨
