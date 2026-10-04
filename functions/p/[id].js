// GET /p/<id-or-slug>  -> public product page (published + approved + artist approved).
// The owner can also open their own unapproved listing as a private preview.
import { methods, html, requireBinding, ApiError } from '../_lib/http.js';
import { esc, page, paragraphs, formatPrice, titleCase, jsonLd } from '../_lib/html.js';
import { tagLinks } from '../_lib/render.js';
import { getImages, getTags } from '../_lib/products.js';
import { getSession } from '../_lib/auth.js';

export const onRequest = methods(
  {
    GET: async ({ params, env, request }) => {
      const db = requireBinding(env, 'DB');
      const key = String(params.id || '').toLowerCase();
      if (!/^[a-z0-9-]{3,90}$/.test(key)) throw new ApiError(404, 'not_found', 'We could not find that piece.');
      const p = await db
        .prepare(
          'SELECT p.*, a.name AS artist_name, a.handle AS artist_handle, a.status AS artist_status FROM products p JOIN artists a ON a.id = p.artist_id WHERE p.id = ?1 OR p.slug = ?1'
        )
        .bind(key)
        .first();
      if (!p) throw new ApiError(404, 'not_found', 'We could not find that piece.');
      const isPublic = p.status === 'published' && p.approval === 'approved' && p.artist_status === 'approved';
      let preview = false;
      if (!isPublic) {
        const session = await getSession(request, env);
        if (!session || session.artist.id !== p.artist_id) throw new ApiError(404, 'not_found', 'We could not find that piece.');
        preview = true;
      }
      const [images, tags] = await Promise.all([getImages(db, p.id), getTags(db, 'product_tags', 'product_id', p.id)]);
      const origin = env.SITE_URL || new URL(request.url).origin;

      const gallery = images.length
        ? `<div class="gallery"><img class="gallery-main" src="${esc(images[0].url)}" alt="${esc(p.title)}" width="900" height="900" fetchpriority="high">${
            images.length > 1
              ? `<ul class="thumbs">${images.slice(1).map((im, n) => `<li><a href="${esc(im.url)}" target="_blank" rel="noopener"><img src="${esc(im.url)}" alt="${esc(p.title)}, view ${n + 2}" width="200" height="200" loading="lazy"></a></li>`).join('')}</ul>`
              : ''
          }</div>`
        : '<div class="gallery"><span class="ph ph-big sw-gold" aria-hidden="true"></span></div>';

      const soldOut = p.stock === 0;
      const edition = p.edition_size
        ? `<p class="edition">Limited edition of ${p.edition_size}${soldOut ? '' : `, ${p.stock} left`}</p>`
        : soldOut ? '' : `<p class="edition">${p.stock} available</p>`;

      const previewBanner = preview
        ? `<p class="banner" role="status">Private preview. This listing is not public yet (${p.status === 'draft' ? 'it is a draft' : p.approval === 'pending' ? 'it is waiting for approval' : p.approval === 'rejected' ? 'it was not approved' : 'its artist profile is not approved'}).</p>`
        : '';

      const body = `<section class="product"><div class="wrap">
        ${previewBanner}
        <p class="crumbs"><a href="/shop">Shop</a> / <a href="/shop?category=${encodeURIComponent(p.category)}">${esc(titleCase(p.category))}</a></p>
        <div class="product-grid">
          ${gallery}
          <div class="product-info">
            <p class="eyebrow">${esc(titleCase(p.category))}</p>
            <h1>${esc(p.title)}</h1>
            <p class="by">by <a href="/artists/${esc(p.artist_handle)}">${esc(p.artist_name)}</a></p>
            <p class="price big">${esc(formatPrice(p.price_minor, p.currency))}</p>
            ${edition}
            <div class="buy">
              <button class="btn btn-buy" type="button" disabled aria-disabled="true">Buy (not yet enabled)</button>
              <p class="note">Checkout is not available yet. Payments are being set up and every order will be prepaid, shipped worldwide. Nothing on this page can be purchased today. <a href="/#join">Join the waitlist</a> to hear when it opens.</p>
            </div>
            ${p.description ? `<div class="desc"><h2>About this piece</h2>${paragraphs(p.description)}</div>` : ''}
            ${tagLinks(tags)}
          </div>
        </div>
      </div></section>`;

      const ld = jsonLd({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: p.description.slice(0, 300),
        category: p.category,
        brand: { '@type': 'Brand', name: p.artist_name },
        ...(images[0] ? { image: origin + images[0].url } : {}),
      });
      return html(
        page({
          title: `${p.title} by ${p.artist_name} | Oh my Gogh!`,
          description: (p.description || `${p.title} by ${p.artist_name}`).replace(/\s+/g, ' ').slice(0, 160),
          canonical: `${origin}/p/${p.slug}`,
          robots: preview ? 'noindex,nofollow' : 'index,follow',
          ogImage: images[0] ? origin + images[0].url : undefined,
          head: `<script type="application/ld+json">${ld}</script>`,
          body,
        }),
        200,
        { 'Cache-Control': preview ? 'private, no-store' : 'public, max-age=30' }
      );
    },
  },
  { html: true }
);
