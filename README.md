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
| [`js/data.js`](js/data.js) | Shared catalog + localStorage persistence (one source of truth) |
| [`js/site.js`](js/site.js) | Storefront SPA (home, shop, product, artists, journal, about, cart, checkout) |
| [`js/admin.js`](js/admin.js) | Admin SPA (dashboard, products, orders, customers, discounts, collections, journal, artists, payments, settings) |
| [`css/site.css`](css/site.css) · [`css/admin.css`](css/admin.css) | Styles |
| [`assets/`](assets) | Brand emblem, logo, grain texture |
| [`WEBSITE_PLAN.md`](WEBSITE_PLAN.md) | Strategic plan for the broader platform |

## Storefront

A single-page experience that covers the whole shopping journey:

- **Home** — animated hero, brushstroke motion, featured "Current Hang", category rooms, artist-in-residence, manifesto, newsletter signup
- **Shop** — category filtering, painterly product cards, quick-add to bag
- **Product** — gallery, size selector, details, maker credit, related pieces
- **Artists** — featured collaborator + the rest of the roster
- **Journal** — editorial grid with readable article pages
- **About** — brand story, values, full logo
- **Bag → Checkout → Confirmation** — quantity editing, promo codes (`STARRY` = 15% off), shipping logic (free over $75), a checkout form and order confirmation
- **Contact** — message form + FAQ accordion

## Studio Admin

A complete merchant back-office at [`/admin.html`](admin.html):

- **Dashboard** — revenue / orders / avg-order / conversion KPIs, 14-day revenue chart, top pieces, recent orders
- **Products** — table with status/inventory, full create / edit / delete drawer (title, description, price, inventory, category, variants, publish toggle)
- **Orders** — fulfillment pipeline with a status timeline, advance-stage button, tracking numbers, line items and totals
- **Customers** — list with lifetime value, customer drawer with order history and internal notes
- **Discounts** — percentage / fixed codes with usage limits and expiry
- **Collections** — group products into curated drops
- **Journal** — write and publish articles
- **Artists** — manage collaborator profiles
- **Payments** — toggle Stripe / PayPal / Razorpay / Manual providers and enter (test) keys
- **Settings** — store profile, shipping summary, reset-to-sample-data

### Live data flow

The admin and storefront share one catalog persisted to `localStorage`. **Edit a product (or publish a draft, add a discount, write a post) in the admin and it shows up on the storefront** — open both in two tabs to see changes sync. "Reset to sample data" in admin → Settings restores the seeded demo content.

> The admin is a front-end prototype: data lives in the browser, no real payments are processed. The payment and shipping panels are written to map onto an open-source commerce backend (Vendure / WooCommerce) when one is integrated.

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

Static site hosted on GitHub Pages at the [`ohmygogh.com`](https://ohmygogh.com) domain (see [`CNAME`](CNAME)). Pushing to `main` publishes.

---

**Built with creativity, coded with passion.** 🎨✨
