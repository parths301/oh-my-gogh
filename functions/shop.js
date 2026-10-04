// GET /shop?q=&category=&tag=&sort=&page=   (server-rendered, works without JavaScript)
import { methods, html, requireBinding } from './_lib/http.js';
import { esc, page, titleCase } from './_lib/html.js';
import { productCard, likePattern, PUBLIC_PRODUCT_WHERE, PAGE_SIZE } from './_lib/render.js';

const SORTS = {
  new: ['Newest', 'p.created_at DESC'],
  price_asc: ['Price: low to high', 'p.price_minor ASC, p.created_at DESC'],
  price_desc: ['Price: high to low', 'p.price_minor DESC, p.created_at DESC'],
};

export const onRequest = methods(
  {
    GET: async ({ request, env }) => {
      const db = requireBinding(env, 'DB');
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const category = (url.searchParams.get('category') || '').toLowerCase().trim().slice(0, 40);
      const tag = (url.searchParams.get('tag') || '').toLowerCase().trim().slice(0, 30);
      const sort = SORTS[url.searchParams.get('sort')] ? url.searchParams.get('sort') : 'new';
      const pageNo = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1), 500);

      const where = [PUBLIC_PRODUCT_WHERE];
      const binds = [];
      if (q) {
        binds.push(likePattern(q));
        const n = binds.length;
        where.push(
          `(p.title LIKE ?${n} ESCAPE '\\' OR p.description LIKE ?${n} ESCAPE '\\' OR p.category LIKE ?${n} ESCAPE '\\' OR a.name LIKE ?${n} ESCAPE '\\' ` +
            `OR EXISTS (SELECT 1 FROM product_tags t WHERE t.product_id = p.id AND t.tag LIKE ?${n} ESCAPE '\\'))`
        );
      }
      if (category) {
        binds.push(category);
        where.push(`p.category = ?${binds.length}`);
      }
      if (tag) {
        binds.push(tag);
        where.push(`EXISTS (SELECT 1 FROM product_tags t WHERE t.product_id = p.id AND t.tag = ?${binds.length})`);
      }
      const whereSql = where.join(' AND ');

      const total = (await db.prepare(`SELECT COUNT(*) AS n FROM products p JOIN artists a ON a.id = p.artist_id WHERE ${whereSql}`).bind(...binds).first()).n;
      const { results } = await db
        .prepare(
          `SELECT p.id, p.slug, p.title, p.price_minor, p.currency, p.stock, a.name AS artist_name, a.handle AS artist_handle,
                  (SELECT r2_key FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.created_at LIMIT 1) AS cover
           FROM products p JOIN artists a ON a.id = p.artist_id
           WHERE ${whereSql} ORDER BY ${SORTS[sort][1]} LIMIT ${PAGE_SIZE} OFFSET ${(pageNo - 1) * PAGE_SIZE}`
        )
        .bind(...binds)
        .all();

      const cats = await db
        .prepare(`SELECT p.category AS c, COUNT(*) AS n FROM products p JOIN artists a ON a.id = p.artist_id WHERE ${PUBLIC_PRODUCT_WHERE} GROUP BY p.category ORDER BY n DESC, p.category LIMIT 40`)
        .all();

      const link = (over) => {
        const params = new URLSearchParams();
        const vals = { q, category, tag, sort: sort === 'new' ? '' : sort, page: '', ...over };
        for (const [k, v] of Object.entries(vals)) if (v) params.set(k, v);
        const s = params.toString();
        return '/shop' + (s ? '?' + s : '');
      };

      const chips =
        `<li><a class="chip${category ? '' : ' on'}" href="${esc(link({ category: '' }))}">All</a></li>` +
        cats.results.map((r) => `<li><a class="chip${r.c === category ? ' on' : ''}" href="${esc(link({ category: r.c }))}">${esc(titleCase(r.c))} <span class="count">${r.n}</span></a></li>`).join('');

      const pages = Math.ceil(total / PAGE_SIZE);
      const pager = pages > 1
        ? `<nav class="pager" aria-label="Pages">${pageNo > 1 ? `<a href="${esc(link({ page: String(pageNo - 1) }))}" rel="prev">Previous</a>` : '<span></span>'}<span>Page ${pageNo} of ${pages}</span>${pageNo < pages ? `<a href="${esc(link({ page: String(pageNo + 1) }))}" rel="next">Next</a>` : '<span></span>'}</nav>`
        : '';

      const empty = total === 0
        ? `<div class="empty"><p>${q || category || tag ? 'Nothing matches that yet.' : 'The shop is being stocked. Our first artists are being welcomed in.'}</p>${q || category || tag ? '<p><a href="/shop">Clear filters</a></p>' : '<p><a href="/signup">Are you an artist? Apply to sell here.</a></p>'}</div>`
        : '';

      const sortOptions = Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${esc(v[0])}</option>`).join('');
      const heading = category ? titleCase(category) : tag ? `Tagged "${tag}"` : 'The shop';

      const body = `<section class="pagehead"><div class="wrap">
        <p class="eyebrow">Originals, prints and made things</p>
        <h1>${esc(heading)}</h1>
        <form class="filters" action="/shop" method="get" role="search">
          <label class="sr-only" for="q">Search the shop</label>
          <input class="field" id="q" name="q" type="search" value="${esc(q)}" maxlength="80" placeholder="Search art, artists, materials">
          ${category ? `<input type="hidden" name="category" value="${esc(category)}">` : ''}
          ${tag ? `<input type="hidden" name="tag" value="${esc(tag)}">` : ''}
          <label class="sr-only" for="sort">Sort by</label>
          <select class="field" id="sort" name="sort">${sortOptions}</select>
          <button class="btn btn-gold" type="submit">Search</button>
        </form>
        <ul class="chips" aria-label="Categories">${chips}</ul>
        <p class="note">Checkout is not open yet. You can browse and save your favourites for launch day. <a href="/#join">Join the waitlist</a>.</p>
      </div></section>
      <section class="grid-section"><div class="wrap">
        <p class="resultcount" role="status">${total} ${total === 1 ? 'piece' : 'pieces'}</p>
        ${results.length ? `<ul class="pgrid">${results.map(productCard).join('')}</ul>` : empty}
        ${pager}
      </div></section>`;

      const canonical = (env.SITE_URL || url.origin) + '/shop';
      return html(
        page({
          title: `${heading} | Oh my Gogh!`,
          description: 'Browse original art, prints, ceramics, jewellery, apparel and digital work from independent artists on Oh my Gogh!',
          canonical,
          robots: q || tag || pageNo > 1 ? 'noindex,follow' : 'index,follow',
          body,
        }),
        200,
        { 'Cache-Control': 'public, max-age=30' }
      );
    },
  },
  { html: true }
);
