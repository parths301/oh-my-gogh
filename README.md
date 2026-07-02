# Oh my Gogh! 🎨

A lifestyle brand for artistic minds — wearable art, art supplies, accessories
and studio goods, made in collaboration with working artists.

**Live:** [ohmygogh.com](https://ohmygogh.com)

---

## What's in here

A **vanilla-JS storefront** (no framework, no build step) backed by a
self-hosted **[Medusa v2](https://medusajs.com)** commerce engine
(Postgres + Redis + Razorpay), deployable to a VPS with Docker. Full
rationale and diagrams in [`ARCHITECTURE.md`](ARCHITECTURE.md).

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html), [`js/site.js`](js/site.js), [`css/site.css`](css/site.css) | Storefront SPA |
| [`js/config.js`](js/config.js) | Backend origin + publishable key (public) |
| [`js/api.js`](js/api.js) | Medusa Store API client — catalog, carts, checkout, auth, reviews, wishlist |
| [`js/data.js`](js/data.js) | Bundled demo catalog — offline fallback so the site never hard-crashes |
| [`backend/`](backend) | Medusa v2 app: custom modules (artists/journal, reviews, wishlist), Razorpay, emails, jobs, admin pages |
| [`deploy/`](deploy) | VPS stack — Docker Compose, Nginx, provisioning + deploy scripts |
| [`legacy/`](legacy) | Archived Supabase/Vercel implementation ([why](legacy/README.md)) |
| [`SETUP.md`](SETUP.md) | Local dev + live-infrastructure status |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | What runs where and why |

## Storefront

One fast page covering the whole journey: home, shop with category filters,
product pages with **reviews & ratings**, per-artist profiles, journal,
search, **real customer accounts** (register/sign-in, live order history with
tracking, synced wishlist), bag → 3-step checkout → **Razorpay** payment →
confirmation, plus the info hub (shipping, size guide, FAQ, contact, legal)
and a 404. If the backend is briefly unreachable the site degrades to the
bundled demo catalog instead of breaking.

## Studio admin

**Medusa Admin** at `<backend>/app` — products, variants, inventory, orders
and fulfillments, customers, promotions, campaigns — plus custom pages for
**Artists**, **Journal**, and **Reviews** moderation. The admin *is* the CMS.

## Commerce features

- Server-priced carts; promo codes validated by the promotions engine
  (`STARRY`, `WELCOME10`, `SUNFLOWER` migrated from the old store)
- Free shipping over ₹2000 as a real shipping-option price rule; Standard
  (₹99) and Express (₹299) options
- Razorpay Standard Checkout through Medusa payment sessions (test keys —
  switching to live keys requires explicit sign-off)
- Order confirmation + shipment emails (SMTP; logs locally when unset)
- Hourly abandoned-cart recovery emails, daily low-inventory alerts
- Product reviews with moderation; per-customer wishlists that sync
  local ♡ saves after sign-in

## Running locally

```bash
# backend (needs Postgres 16 + Redis running; see SETUP.md)
cd backend && npm install && npm run dev     # API on :9000, admin on :9000/app

# storefront
python3 -m http.server 4321                  # or: npm run dev
# → http://localhost:4321
```

## Deploying

`deploy/README.md` has the full VPS runbook: one provisioning script
(Docker, Nginx, certbot, UFW 22/80/443, SSH keys-only, fail2ban) and one
deploy script (build → migrate → publish). The public `ohmygogh.com` DNS and
the Razorpay live-key switch are **both gated on explicit owner sign-off**.

---

**Built with creativity, coded with passion.** 🎨✨
