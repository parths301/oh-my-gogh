// GET /api/admin/artists?status=pending|approved|rejected|suspended|all
import { methods, json, requireBinding } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/admin.js';
import { getTags, safeJson } from '../../../_lib/products.js';

export const onRequest = methods({
  GET: async (ctx) => {
    await requireAdmin(ctx);
    const db = requireBinding(ctx.env, 'DB');
    const status = new URL(ctx.request.url).searchParams.get('status') || 'pending';
    const where = ['pending', 'approved', 'rejected', 'suspended'].includes(status) ? 'WHERE status = ?1' : "WHERE ?1 = 'all'";
    const { results } = await db
      .prepare(
        `SELECT id, email, email_verified, name, handle, bio, location, category, links, avatar_key, status, status_note, created_at,
                (SELECT COUNT(*) FROM products p WHERE p.artist_id = artists.id) AS product_count
         FROM artists ${where} ORDER BY created_at DESC LIMIT 200`
      )
      .bind(['pending', 'approved', 'rejected', 'suspended'].includes(status) ? status : 'all')
      .all();
    const artists = [];
    for (const a of results) {
      artists.push({ ...a, links: safeJson(a.links, []), avatar_url: a.avatar_key ? '/img/' + a.avatar_key : null, avatar_key: undefined, tags: await getTags(db, 'artist_tags', 'artist_id', a.id) });
    }
    return json({ ok: true, artists });
  },
});
