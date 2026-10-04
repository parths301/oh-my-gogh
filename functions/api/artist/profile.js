// GET  /api/artist/profile  -> own profile
// PUT  /api/artist/profile  { name, bio, location, category, tags[], links[{label,url}] }
// The handle is permanent in v1 (it is part of public URLs).
import { methods, json, readJson, ApiError } from '../../_lib/http.js';
import { requireArtist, privateArtist } from '../../_lib/auth.js';
import { validateProfileInput } from '../../_lib/validate.js';
import { getTags, artistTagStatements } from '../../_lib/products.js';

export const onRequest = methods({
  GET: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    return json({ ok: true, artist: { ...privateArtist(artist), tags: await getTags(ctx.env.DB, 'artist_tags', 'artist_id', artist.id) } });
  },
  PUT: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const body = await readJson(ctx.request);
    const v = validateProfileInput(body);
    if (!v.ok) throw new ApiError(400, 'validation', 'Please fix the highlighted fields.', v.errors);
    const p = v.value;
    const db = ctx.env.DB;
    await db.batch([
      db
        .prepare('UPDATE artists SET name = ?1, bio = ?2, location = ?3, category = ?4, links = ?5, updated_at = ?6 WHERE id = ?7')
        .bind(p.name, p.bio, p.location, p.category, JSON.stringify(p.links), new Date().toISOString(), artist.id),
      ...artistTagStatements(db, artist.id, p.tags),
    ]);
    const fresh = await db.prepare('SELECT * FROM artists WHERE id = ?1').bind(artist.id).first();
    return json({ ok: true, artist: { ...privateArtist(fresh), tags: p.tags } });
  },
});
