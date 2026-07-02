# Legacy: the Supabase + Vercel era (archived 2026-07-02)

Everything in this folder is the **previous** architecture, kept for reference
and rollback only. None of it is loaded by the live site anymore.

| What | Was | Replaced by |
| --- | --- | --- |
| `vercel-api/` | Vercel serverless functions (`/api/config`, `/api/razorpay/*`) | Medusa backend (`backend/`) — carts are priced server-side and Razorpay runs through Medusa payment sessions |
| `supabase/` | Postgres schema + RLS + seed for the Supabase project | Medusa's own Postgres schema; data migrated by `backend/src/scripts/migrate-from-supabase.ts` |
| `supabase.js` | Browser Supabase client + row mappers | `js/api.js` (Medusa Store API client) |
| `admin.html`, `admin.js`, `admin.css` | Hand-rolled studio admin SPA | **Medusa Admin** at `<backend>/app` (products, orders, customers, promotions, inventory) + custom pages for artists/journal/reviews |
| `vercel.json` | Vercel function config | `deploy/` (VPS: Docker Compose + Nginx) |

The Supabase project (`pauqbjrfnkacxweqnevj`, org Sparx) still exists and still
holds the original data as a read-only archive. Don't delete it until the
Medusa stack has been in production long enough to trust — then decommission it
deliberately.

The raw table exports used for the migration live in
`.secrets/supabase-export/` (gitignored — contains customer emails).
