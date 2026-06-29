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
| Schema + RLS | **Applied & verified** (admin reads/writes work, anon is blocked, drafts hidden — tested live) |
| Seed content | **Applied** — real copy, 8 products / 4 artists / 4 posts / 6 orders, INR pricing |
| Admin login | **Created** — `parthsh.ind@gmail.com` (temp password issued, change it after first sign-in) |
| Vercel project | **Live** — `parths301s-projects/oh-my-gogh`, connected to this GitHub repo (auto-deploys on push to `main`) |
| Production URL | **https://oh-my-gogh.vercel.app** |
| Env vars (Supabase + currency + shipping) | **Set** in Vercel (production/preview/development), confirmed live via `/api/config` |
| Razorpay keys | **Not set yet** — checkout runs in preview/demo mode until added |
| `ohmygogh.com` domain | Still on GitHub Pages — not switched to Vercel (your call) |

## 1 · Supabase (done — for reference / re-running if needed)

`supabase/schema.sql` and `supabase/seed.sql` were applied directly via the Supabase CLI
(`supabase db query --linked --file …`), and the admin email was inserted into
`public.admins`. Both files are idempotent — safe to re-run after editing.

## 2 · Razorpay — the one remaining step

1. Razorpay Dashboard → **Settings → API Keys → Generate Test Key**.
2. Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.
3. Hand them to me, or set them yourself:
   ```
   vercel env add RAZORPAY_KEY_ID production preview development
   vercel env add RAZORPAY_KEY_SECRET production preview development
   ```
4. Redeploy (`vercel deploy --prod`, or just push to `main`) — checkout goes live.

## 3 · Verify

- Storefront loads products from Supabase (edit a price in `products` → it shows up on
  https://oh-my-gogh.vercel.app after a refresh).
- `/admin.html` → sign in with the admin email above.
- Checkout: opens Razorpay test checkout once keys are set; test card `4111 1111 1111 1111`,
  any future expiry/CVV. A paid order appears in `orders`.

## Status

- [x] Supabase project created, schema + RLS applied and verified live
- [x] Seed content applied (real copy, INR pricing)
- [x] Vercel project created, linked to GitHub (auto-deploy on push)
- [x] Env vars set and confirmed live via `/api/config`
- [x] Storefront hydrates from Supabase on the live deployment (verified)
- [x] Razorpay checkout wired into the cart (server-priced, signature-verified) — runs in
      preview mode until keys are added
- [x] Demo/placeholder copy removed
- [ ] Admin auth + writes wired into `admin.html` itself *(admin user + RLS exist and are
      tested; the admin UI doesn't yet call Supabase for login/saves — next up)*
- [ ] Razorpay keys
- [ ] (optional) point ohmygogh.com at Vercel
