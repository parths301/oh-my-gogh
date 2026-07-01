# Going live: Supabase + Vercel + Razorpay

This turns the static demo into a real store. Architecture: **static site + Vercel
serverless functions** (`/api`), data in **Supabase** (Postgres + Auth), payments via
**Razorpay**. Nothing self-hosted; everything runs on Vercel + Supabase.

```
Browser ──> Vercel (static files + /api functions)
              │
              ├─ /api/config            → public keys for the browser
              ├─ /api/razorpay/create-order  → prices cart, makes RZP order  ─┐
              └─ /api/razorpay/verify        → checks signature, writes order │
                                                                              ▼
            Supabase (Postgres + RLS + Auth)  ◀── admin reads/writes ── Razorpay
```

## Live status

| Piece | State |
| --- | --- |
| Supabase project | **Live** — `oh-my-gogh`, org Sparx, Mumbai (`pauqbjrfnkacxweqnevj.supabase.co`) |
| Schema + RLS | **Applied & verified** (admin reads/writes work, anon is blocked, drafts hidden — tested live). A newer `supabase/schema.sql` adds a public `media` Storage bucket + admin-only write policies for product/artist/journal photos — **you need to re-run this file** against the live project (see §1). |
| Seed content | **Applied** — real copy, 8 products / 4 artists / 4 posts / 6 orders, INR pricing |
| Admin login | **Created** — `parthsh.ind@gmail.com` (temp password issued, change it after first sign-in) |
| Admin UI wired to Supabase | **Done** — `admin.html` now has a real Supabase Auth login screen and every drawer (products, orders, customers, discounts, collections, journal, artists, payments, settings) reads/writes the live database instead of localStorage. Falls back to the local demo catalog if Supabase isn't configured. **Not yet verified against the live project from this session** — the sandbox this was built in has no network access to Supabase/Vercel; do a real sign-in + save test before trusting it in production. |
| Vercel project | **Live** — `parths301s-projects/oh-my-gogh`, connected to this GitHub repo (auto-deploys on push to `main`) |
| Production URL | **https://oh-my-gogh.vercel.app** |
| Env vars (Supabase + currency + shipping) | **Set** in Vercel (production/preview/development), confirmed live via `/api/config` |
| Razorpay keys | **Status unclear — needs your confirmation.** This file previously said "not set yet"; `CLAUDE.md` separately says test keys were "rotated 2026-06-30." Both can't be right. Check `/api/config`'s `razorpayKeyId` field (or the Vercel dashboard env vars) and update whichever doc is wrong — I couldn't verify this myself (no network access in this session). |
| `ohmygogh.com` domain | Still on GitHub Pages — not switched to Vercel (your call) |

## 1 · Supabase (for reference / re-running if needed)

`supabase/schema.sql` and `supabase/seed.sql` were applied directly via the Supabase CLI
(`supabase db query --linked --file …`), and the admin email was inserted into
`public.admins`. Both files are idempotent — safe to re-run after editing.

**Action needed:** `schema.sql` was extended with a `media` Storage bucket (public read,
admin-only write) that product/artist/journal photo uploads in the admin depend on. Re-run
the whole file against the live project — it's safe, everything is `if not exists` /
`drop policy if exists` guarded.

## 2 · Razorpay

1. Razorpay Dashboard → **Settings → API Keys** → generate or confirm a **Test Key**.
2. Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.
3. Hand them to me, or set them yourself:
   ```
   vercel env add RAZORPAY_KEY_ID production preview development
   vercel env add RAZORPAY_KEY_SECRET production preview development
   ```
4. Redeploy (`vercel deploy --prod`, or just push to `main`) — checkout goes live.
5. Confirm the actual state and update this file + `CLAUDE.md` to agree (see the discrepancy
   noted in the table above).

## 3 · Verify

- Storefront loads products from Supabase (edit a price in `products` → it shows up on
  https://oh-my-gogh.vercel.app after a refresh).
- `/admin.html` → sign in with the admin email above → confirm each drawer saves to Supabase
  (check the row actually changed in the Supabase table editor) and that a product photo
  upload lands in the `media` Storage bucket.
- Checkout: opens Razorpay test checkout once keys are confirmed set; test card
  `4111 1111 1111 1111`, any future expiry/CVV. A paid order appears in `orders`, and in the
  admin's Orders view.

## Status

- [x] Supabase project created, schema + RLS applied and verified live
- [x] Seed content applied (real copy, INR pricing)
- [x] Vercel project created, linked to GitHub (auto-deploy on push)
- [x] Env vars set and confirmed live via `/api/config`
- [x] Storefront hydrates from Supabase on the live deployment (verified)
- [x] Razorpay checkout wired into the cart (server-priced, signature-verified)
- [x] Demo/placeholder copy removed
- [x] Admin auth + writes wired into `admin.html` (products, orders, customers, discounts,
      collections, journal, artists, payments, settings, photo uploads to Storage) —
      **built and code-reviewed, not yet verified against the live Supabase project**
- [ ] Re-run updated `supabase/schema.sql` (adds the `media` Storage bucket + policies)
- [ ] Verify the admin login + a save + a photo upload against the live project
- [ ] Confirm actual Razorpay key status and reconcile this file with `CLAUDE.md`
- [ ] (optional) point ohmygogh.com at Vercel
