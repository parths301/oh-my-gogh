# Oh my Gogh! waitlist: deploy guide (Cloudflare Pages, free plan)

Branch: `waitlist-launch`. Nothing here deploys itself. Do not merge to `main` or touch DNS until you have followed the checklist below.

## What is in the box

| Path | What it is |
| --- | --- |
| `waitlist/` | The static site (the Pages **output directory**): `index.html`, `privacy.html`, `terms.html`, `404.html`, `robots.txt`, `sitemap.xml`, `_headers`, favicons, `css/`, `js/`, self-hosted `fonts/`, `assets/` |
| `functions/api/subscribe.js` | Pages Function for `POST /api/subscribe` (validation, honeypot, light rate limit, KV write) |
| `wrangler.toml.example` | Optional config-as-code snippet (see the warning inside it) |

The old storefront demo (`index.html`, `js/`, `css/site.css`, `backend/` ...) at the repo root is untouched and is **not** published, because the output directory is `waitlist/`.

## 0. Inputs only Parth can supply (must be done before going live)

| Placeholder | Where it appears | What to put |
| --- | --- | --- |
| `{{CONTACT_EMAIL}}` | `waitlist/privacy.html`, `waitlist/terms.html` | The public contact address (for example an address on ohmygogh.com that your Namecheap forwarding already handles). Used for withdrawal and privacy requests. |
| `{{LEGAL_NAME}}` | `waitlist/privacy.html`, `waitlist/terms.html` | Legal name of the data controller / fiduciary (your name or your company). |
| `{{INSTAGRAM_URL}}`, `{{PINTEREST_URL}}`, `{{YOUTUBE_URL}}` | `waitlist/index.html`, inside a `<ul class="social" hidden>` | Optional. Replace with real URLs and delete the `hidden` attribute. Delete any network you do not have. Leave as is and the block stays invisible. |

Replace all of them in one go (from the repo root; swap in the real values):

```bash
sed -i 's|{{CONTACT_EMAIL}}|hello@ohmygogh.com|g; s|{{LEGAL_NAME}}|Your Legal Name|g' waitlist/*.html
grep -rn '{{' waitlist   # should list only the optional social placeholders
```

Defaults I chose that you should confirm or change: privacy retention is "until withdrawal or 24 months after signup", children threshold 18, governing law of India in the terms. This is not legal advice; have a lawyer glance at both pages if you can.

## 1. Create the KV namespace

Dashboard route:

1. Cloudflare dashboard, **Storage & databases** (or **Workers & Pages**), **KV**, **Create a namespace**.
2. Name it `ohmygogh-waitlist`. Create a second one named `ohmygogh-waitlist-preview` if you want preview deployments to write to a separate store (recommended).

CLI route (needs Node 22+ for wrangler 4, or use `npx wrangler@3` on Node 20):

```bash
npx wrangler kv namespace create ohmygogh-waitlist
npx wrangler kv namespace create ohmygogh-waitlist-preview
```

## 2. Connect the GitHub repo to Cloudflare Pages

1. Dashboard, **Workers & Pages**, **Create**, **Pages**, **Connect to Git**, authorize GitHub, pick `parths301/oh-my-gogh`.
2. Project name: `ohmygogh` (gives you `ohmygogh.pages.dev`).
3. **Production branch**: `waitlist-launch` (so you never need to touch `main`). Later, when you are happy, you may switch it to `main` after merging; the output directory keeps the old storefront out of the way either way.
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `waitlist`
   - Root directory: *(leave empty, so `functions/` at the repo root is picked up)*
5. **Save and Deploy**. The first deploy goes to `https://ohmygogh.pages.dev` only. Nothing is public on ohmygogh.com yet.

## 3. Bind KV as `WAITLIST`

Project, **Settings**, **Bindings** (or **Functions** then **KV namespace bindings**), **Add**, **KV namespace**:

- Variable name: `WAITLIST` (exact, uppercase)
- Production: `ohmygogh-waitlist`
- Preview: `ohmygogh-waitlist-preview`

Then **redeploy** (Deployments, latest, **Retry deployment**), because bindings apply to new deployments only.

Do not rename `wrangler.toml.example` to `wrangler.toml` unless you want config-as-code: a committed `wrangler.toml` makes the dashboard bindings read-only.

## 4. Test on the pages.dev URL before the domain (see checklist below)

## 5. Add the custom domain `ohmygogh.com`, with `www` redirect

**Read this first.** Your DNS zone already contains records that must not change:

- `immich.ohmygogh.com` CNAME to the Cloudflare tunnel
- `n8n.ohmygogh.com` CNAME to the Cloudflare tunnel
- the MX and SPF (TXT) records for Namecheap email forwarding

You will only ever add or edit the **apex (`ohmygogh.com`)** and **`www`** records. Before starting, open DNS, **Records**, and screenshot or copy the current apex and `www` records (they currently point at GitHub Pages) so you can roll back.

1. Pages project, **Custom domains**, **Set up a custom domain**, enter `ohmygogh.com`.
2. Cloudflare will propose a DNS change for the apex only (a proxied CNAME to `ohmygogh.pages.dev`). If an existing apex A/AAAA/CNAME to GitHub Pages is in the way, Cloudflare will ask you to remove or replace that one record. Accept **only** that. Do not edit anything else.
3. Repeat with `www.ohmygogh.com` (this adds a proxied `www` CNAME to `ohmygogh.pages.dev`).
4. Make `www` redirect to the apex: **Rules**, **Redirect Rules**, **Create rule**:
   - If: *Hostname equals* `www.ohmygogh.com`
   - Then: *Dynamic* redirect, expression `concat("https://ohmygogh.com", http.request.uri.path)`, status **301**, preserve query string on.
5. Wait for the certificate to show **Active** (usually a few minutes), then open https://ohmygogh.com and https://www.ohmygogh.com.
6. Leave **SSL/TLS** on **Full** or **Full (strict)**; the tunnel hostnames are unaffected.
7. Do not delete GitHub Pages config until the new site is confirmed. The CNAME file on `main` was already deleted, so there is nothing to change in the repo.

After go-live, confirm `immich.` and `n8n.` still load and that a test email to your forwarding address still arrives.

## 6. Reading your signups

Dashboard, KV, `ohmygogh-waitlist`, **View**: each key is an email (lowercase), value like `{"createdAt":"2026-10-05T10:00:00.000Z","source":"hero","consent":"waitlist-notice-2026-10-05"}`. Keys beginning `rl:` are short-lived rate-limit counters (they expire by themselves); ignore them. Export with:

```bash
npx wrangler kv key list --namespace-id <ID> --remote
```

To remove someone (withdrawal request): `npx wrangler kv key delete "person@example.com" --namespace-id <ID> --remote`.

KV free plan limits to be aware of: 1,000 writes/day (each attempt writes a rate-limit counter plus the signup itself, so roughly 400+ signups a day), 100,000 reads/day, and 1 GB storage. More than enough for a waitlist. If a bot burst ever exhausts writes, add a Cloudflare **WAF rate limiting rule** for `/api/subscribe`.

## Local testing

The npm script uses `wrangler@3` so it runs on Node 20. With Node 22+ you may use `npx wrangler@4` instead.

```bash
npm run waitlist:dev
# same as: npx wrangler@3 pages dev waitlist --kv WAITLIST --compatibility-date=2024-09-23
# open http://localhost:8788
```

Local KV is simulated and persisted in `.wrangler/` (git-ignored). Locally every request appears to come from one IP, so the rate limit trips after 8 tries in 10 minutes; delete `.wrangler/state` to reset.

Static-only preview (no form): `npx serve waitlist`. Clean URLs like `/privacy` need the wrangler server or Cloudflare.

## Test checklist

Local (`npm run waitlist:dev`) and again on `ohmygogh.pages.dev`:

- [ ] Home page loads with no console errors; fonts and emblem show; no request leaves the site's own origin.
- [ ] Hero form: valid email shows "You're on the list..." in green, field clears, button returns to "Join the waitlist".
- [ ] Same email again (also with different capitals, for example `Test@Example.com` then `test@example.com`): shows "You're already on the list", and KV still has a single key in lowercase.
- [ ] `nope`, an empty field and `a@b` show the red "does not look right" message; keyboard focus returns to the field.
- [ ] Footer form (second form) works the same and stores `"source":"footer"`.
- [ ] Honeypot: `curl -X POST localhost:8788/api/subscribe -H 'Content-Type: application/json' -d '{"email":"bot@x.com","website":"hi"}'` returns success but `bot@x.com` is **not** in KV.
- [ ] Rate limit: 9+ quick submissions from one IP return 429 and the "Too many tries" message.
- [ ] Wrong method: `GET /api/subscribe` returns 405. A request with a foreign `Origin` header returns 403.
- [ ] Server down or offline: the message "We could not reach the server" appears and the button is usable again.
- [ ] Missing binding (before step 3): form shows "Something went wrong on our side" (and Function logs say the binding is missing).
- [ ] JavaScript disabled: the form posts normally and you land back on `/#join` with a confirmation line.
- [ ] `/privacy`, `/terms` open; `/anything-else` shows the branded 404 with status 404.
- [ ] `/robots.txt` and `/sitemap.xml` load and list only `https://ohmygogh.com/...` URLs.
- [ ] Share the link in a chat app and check the preview image and description (OG tags).
- [ ] 360px wide phone: no sideways scroll; tap targets are comfortable.
- [ ] Lighthouse (mobile) 95+ on all four categories.
- [ ] No `{{...}}` text visible anywhere except in the hidden social block (`grep -rn '{{' waitlist`).
- [ ] After go-live: `immich.ohmygogh.com` and `n8n.ohmygogh.com` still work; mail forwarding still works.

## Notes

- Security headers and a strict Content Security Policy are set in `waitlist/_headers`. If you ever add an external script or style, update the CSP there.
- Fonts (Playfair Display, Space Grotesk, Space Mono) are self-hosted Latin subsets from Google Fonts (SIL OFL). Brand colours, grain texture and emblem come from the existing storefront.
- To stop collecting signups quickly: remove the KV binding, or unpublish the project. The form then shows an error message.
