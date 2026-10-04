// GET /artists  -> approved artists
import { methods, html, requireBinding } from '../_lib/http.js';
import { esc, page, titleCase } from '../_lib/html.js';
import { artistCard } from '../_lib/render.js';

export const onRequest = methods(
  {
    GET: async ({ request, env }) => {
      const db = requireBinding(env, 'DB');
      const url = new URL(request.url);
      const category = (url.searchParams.get('category') || '').toLowerCase().trim().slice(0, 40);
      const { results } = category
        ? await db.prepare("SELECT id, name, handle, category, location, avatar_key FROM artists WHERE status = 'approved' AND category = ?1 ORDER BY name LIMIT 200").bind(category).all()
        : await db.prepare("SELECT id, name, handle, category, location, avatar_key FROM artists WHERE status = 'approved' ORDER BY name LIMIT 200").all();
      const body = `<section class="pagehead"><div class="wrap">
        <p class="eyebrow">The people behind the work</p>
        <h1>${category ? esc(titleCase(category)) + ' artists' : 'Artists'}</h1>
        ${category ? '<p><a href="/artists">All artists</a></p>' : ''}
      </div></section>
      <section class="grid-section"><div class="wrap">
        ${results.length ? `<ul class="agrid">${results.map(artistCard).join('')}</ul>` : '<div class="empty"><p>No artists here yet.</p><p><a href="/signup">Are you an artist? Apply to sell here.</a></p></div>'}
      </div></section>`;
      return html(
        page({ title: 'Artists | Oh my Gogh!', description: 'Meet the independent artists selling on Oh my Gogh!', canonical: (env.SITE_URL || url.origin) + '/artists', body }),
        200,
        { 'Cache-Control': 'public, max-age=30' }
      );
    },
  },
  { html: true }
);
