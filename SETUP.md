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

## 1 · Supabase

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste and run [`supabase/schema.sql`](supabase/schema.sql) (tables + row-level security).
3. Paste and run [`supabase/seed.sql`](supabase/seed.sql) (real starting content).
4. Make yourself an admin so the admin panel can write:
   ```sql
   insert into public.admins (email) values ('parthsh.ind@gmail.com');
   ```
5. **Auth → Providers → Email**: enable it (the admin signs in with this email).
6. **Project Settings → API** — copy `Project URL`, the `anon` key, and the
   `service_role` key (keep the last one secret).

## 2 · Razorpay

1. Create a Razorpay account → **Settings → API Keys → Generate Test Key**.
2. Copy the **Key ID** (`rzp_test_…`) and **Key Secret**.

## 3 · Vercel env vars

In **Vercel → Project → Settings → Environment Variables**, add (see [`.env.example`](.env.example)):

| Name | Value | Exposed to browser? |
| --- | --- | --- |
| `SUPABASE_URL` | your project URL | yes (via `/api/config`) |
| `SUPABASE_ANON_KEY` | anon key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **no — secret** |
| `RAZORPAY_KEY_ID` | `rzp_test_…` | yes |
| `RAZORPAY_KEY_SECRET` | secret | **no — secret** |
| `STORE_CURRENCY` | `INR` | yes |
| `FREE_SHIPPING_OVER` | `2000` | — |
| `FLAT_SHIPPING` | `99` | — |

> Don't paste the two secret values into chat — set them here yourself. The site reads
> the public ones at runtime from `/api/config`, so no keys live in the repo.

## 4 · Deploy

Connect this GitHub repo to a Vercel project (or let me create it). Build settings:
**Framework: Other · Build command: none · Output dir: `.`** (already in [`vercel.json`](vercel.json)).
Every push to `main` deploys.

## 5 · Verify

- Storefront loads products from Supabase (edit a price in `products` → it shows up).
- `/admin.html` → sign in with your admin email → edits save to Supabase.
- Checkout opens Razorpay test checkout; use test card `4111 1111 1111 1111`, any future
  expiry/CVV. A paid order appears in `orders`.

## Status

- [x] Backend schema, RLS, real-copy seed
- [x] Serverless functions (config, Razorpay order + verify)
- [x] Storefront hydrates from Supabase (falls back to demo data offline)
- [ ] Admin auth + writes to Supabase  *(next, once your project is connected)*
- [ ] Razorpay checkout wired into the storefront cart  *(next)*
- [ ] Vercel project + custom domain
