// GET /artists/<handle>  -> public artist profile (approved artists only)
import { methods, html, requireBinding, ApiError } from '../_lib/http.js';
import { esc, page, paragraphs, safeHref, titleCase, initials, jsonLd } from '../_lib/html.js';
import { productCard } from '../_lib/render.js';
import { getTags, safeJson } from '../_lib/products.js';

export const onRequest = methods(
  {
    GET: async ({ params, env, request }) => {
      const db = requireBinding(env, 'DB');
      const handle = String(params.handle || '').toLowerCase();
      if (!/^[a-z0-9-]{3,30}$/.test(handle)) throw new ApiError(404, 'not_found', 'We could not find that artist.');
      const a = await db.prepare("SELECT * FROM artists WHERE handle = ?1 AND status = 'approved'").bind(handle).first();
      if (!a) throw new ApiError(404, 'not_found', 'We could not find that artist.');
      const tags = await getTags(db, 'artist_tags', 'artist_id', a.id);
      const links = safeJson(a.links, []).filter((l) => l && typeof l.label === 'string' && typeof l.url === 'string');
      const { results } = await db
        .prepare(
          `SELECT p.id, p.slug, p.title, p.price_minor, p.currency, p.stock, ?2 AS artist_name, ?3 AS artist_handle,
                  (SELECT r2_key FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.created_at LIMIT 1) AS cover
           FROM products p WHERE p.artist_id = ?1 AND p.status = 'published' AND p.approval = 'approved' ORDER BY p.created_at DESC LIMIT 100`
        )
        .bind(a.id, a.name, a.handle)
        .all();

      const avatar = a.avatar_key
        ? `<img class="avatar" src="/img/${esc(a.avatar_key)}" alt="Portrait of ${esc(a.name)}" width="160" height="160">`
        : `<span class="avatar ph ph-round" aria-hidden="true">${esc(initials(a.name))}</span>`;
      const linkList = links.length
        ? `<ul class="linklist" aria-label="Links">${links.map((l) => `<li><a href="${esc(safeHref(l.url))}" target="_blank" rel="noopener noreferrer nofollow ugc">${esc(l.label)}</a></li>`).join('')}</ul>`
        : '';
      const tagList = tags.length ? `<ul class="tags" aria-label="Tags">${tags.map((t) => `<li><a href="/shop?tag=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>` : '';

      const body = `<section class="artist-head"><div class="wrap artist-grid">
          <div>${avatar}</div>
          <div>
            <p class="eyebrow">${esc([a.category ? titleCase(a.category) : 'Artist', a.location].filter(Boolean).join(' \u00b7 '))}</p>
            <h1>${esc(a.name)}</h1>
            <p class="handle">@${esc(a.handle)}</p>
            ${a.bio ? `<div class="bio">${paragraphs(a.bio)}</div>` : ''}
            ${tagList}
            ${linkList}
          </div>
        </div></section>
        <section class="grid-section"><div class="wrap">
          <h2>Work by ${esc(a.name)}</h2>
          ${results.length ? `<ul class="pgrid">${results.map(productCard).join('')}</ul>` : '<div class="empty"><p>No pieces on show yet. Check back soon.</p></div>'}
        </div></section>`;

      const origin = env.SITE_URL || new URL(request.url).origin;
      const ld = jsonLd({ '@context': 'https://schema.org', '@type': 'Person', name: a.name, url: `${origin}/artists/${a.handle}`, ...(a.bio ? { description: a.bio.slice(0, 300) } : {}) });
      return html(
        page({
          title: `${a.name} | Oh my Gogh!`,
          description: (a.bio || `${a.name} is an artist on Oh my Gogh!`).replace(/\s+/g, ' ').slice(0, 160),
          canonical: `${origin}/artists/${a.handle}`,
          ogImage: a.avatar_key ? `${origin}/img/${a.avatar_key}` : undefined,
          head: `<script type="application/ld+json">${ld}</script>`,
          body,
        }),
        200,
        { 'Cache-Control': 'public, max-age=30' }
      );
    },
  },
  { html: true }
);
