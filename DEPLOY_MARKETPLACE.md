# Oh my Gogh! marketplace: deploy guide (Cloudflare only)

Branch: `marketplace` (branched from `waitlist-launch`). Nothing here touches the production waitlist or DNS. The production branch stays `waitlist-launch` until you decide to merge.

Stack: Cloudflare Pages (static files in `waitlist/`) + Pages Functions (`functions/`) + D1 (SQL) + R2 (images). No third-party backend.

## What the marketplace adds

| Path | Purpose |
| --- | --- |
| `/signup`, `/login`, `/dashboard` | Artist sign up (account + profile in one step), log in, manage profile and listings |
| `/shop`, `/p/<id-or-slug>`, `/artists`, `/artists/<handle>` | Public pages, server-rendered, only approved content |
| `/admin` | Approvals page, protected by the `ADMIN_TOKEN` secret |
| `/api/auth/*`, `/api/artist/*`, `/api/admin/*`, `/img/*` | JSON API and image delivery |
| `migrations/0001_init.sql`, `schema.sql` | D1 schema |
| `wrangler.toml` | Bindings: `DB` (D1), `IMAGES` (R2), `WAITLIST` (KV, existing) |

## What only you can do (I had no Cloudflare login on the box)

You need to create: 1 D1 database, 1 R2 bucket (plus optional preview copies), and 1 secret. About 10 minutes.

### 1. Create the D1 database

Dashboard: **Storage & databases > D1 SQL database > Create**, name `ohmygogh-marketplace`. Copy the **Database ID**.
CLI alternative (needs `npx wrangler@3 login` first):

```bash
npx wrangler@3 d1 create ohmygogh-marketplace
npx wrangler@3 d1 create ohmygogh-marketplace-preview   # optional, keeps preview data separate
```

### 2. Create the R2 bucket

Dashboard: **R2 object storage > Create bucket**, name `ohmygogh-images`, leave it **private** (no public access, no custom domain; images are served through `/img/...`). R2 needs a payment method on file, but the free tier (10 GB, 1M writes, 10M reads a month) is far above v1 needs.
CLI alternative:

```bash
npx wrangler@3 r2 bucket create ohmygogh-images
npx wrangler@3 r2 bucket create ohmygogh-images-preview   # optional
```

### 3. Fill in `wrangler.toml`

Replace every `REPLACE_WITH_...` value:

* `database_id` (and `preview_database_id`, which can be the same id if you made no preview database)
* KV `id` / `preview_id`: the same two WAITLIST namespaces you already created for the waitlist (see `README_DEPLOY.md` section 1). **Important:** a committed `wrangler.toml` replaces the dashboard bindings for this project, so the existing `WAITLIST` binding has to be listed here or `/api/subscribe` will stop working on deployments of this branch.
* bucket names if you chose different ones.

Commit that change on the `marketplace` branch (ids are not secrets).

> Warning: do not merge `wrangler.toml` into `waitlist-launch` until the ids are real and you are ready, because it switches the whole Pages project to config-as-code (dashboard bindings become read-only).

### 4. Apply the schema to the remote database

```bash
npx wrangler@3 d1 migrations apply ohmygogh-marketplace --remote
```

(or paste `schema.sql` into the D1 console). Run it once for the preview database too if you made one: `... --remote` uses `database_id`; for the preview database run `npx wrangler@3 d1 execute ohmygogh-marketplace-preview --remote --file=schema.sql`.

### 5. Set the admin secret

Pick a long random token (at least 16 characters; 32+ recommended). Generate one: `openssl rand -base64 32`.

Dashboard: Pages project **ohmygogh > Settings > Variables and Secrets > Add** (type **Secret**), name `ADMIN_TOKEN`, for **Production and Preview**.
CLI alternative:

```bash
npx wrangler@3 pages secret put ADMIN_TOKEN --project-name ohmygogh
```

Never commit it. Without it `/admin` answers 503 (fails closed), so the site cannot be moderated.

### 6. Deploy and open the preview

Pushing the `marketplace` branch makes Cloudflare Pages build a **preview deployment** (Pages project settings: output directory `waitlist`, no build command, root empty; same as the waitlist guide). The preview URL looks like `https://marketplace.ohmygogh.pages.dev` (branch alias) plus a per-commit URL. The first build fails or the API returns 503 until steps 1 to 5 are done; redeploy after setting bindings/secrets (**Deployments > Retry deployment**).

Smoke test on the preview URL:

1. `/shop` loads and says the shop is being stocked.
2. `/signup`: create a test artist. You land on `/dashboard` with status "waiting for approval".
3. Add a listing with an image, set status to Published.
4. `/admin`: paste the ADMIN_TOKEN, approve the artist, then approve the listing.
5. `/shop` now shows the listing; its page shows a disabled "Buy (not yet enabled)" button.

## Optional variables (in `wrangler.toml` [vars])

| Name | Default | Meaning |
| --- | --- | --- |
| `SITE_URL` | `https://ohmygogh.com` | Used for canonical and Open Graph URLs. Set to the preview origin if you want previews self-consistent. |
| `PBKDF2_ITERATIONS` | `100000` | Iterations for new password hashes (Cloudflare caps at 100000). Existing hashes store their own count and are upgraded on login. |

## Run it locally (no Cloudflare account needed)

```bash
npm run market:migrate      # creates the local D1 database in .wrangler/state
npm run market:dev          # http://localhost:8788, ADMIN_TOKEN=test-admin-token-1234567890
npm run market:test         # in a second terminal: unit + integration tests
```

The local run uses Miniflare, which simulates D1, R2 and KV on disk.

## Cost and limits to know

* Free plan Pages Functions: 100,000 requests a day; D1 free: 5M reads and 100k writes a day, 5 GB; fine for launch.
* **CPU time**: the Workers free plan allows 10 ms of CPU per request. PBKDF2 with 100,000 iterations can exceed that on signup and login and may return error 1102. If you see that, either switch the account to Workers Paid (USD 5 a month) or lower `PBKDF2_ITERATIONS` (for example 20000, weaker but acceptable short term; hashes are upgraded automatically at the next login after you raise it again). Test signup and login on the preview URL before inviting artists.

## Rolling back

Delete the preview deployment or the `marketplace` branch. D1 and R2 are only used by this branch, and the waitlist is unaffected. DNS is never touched.
