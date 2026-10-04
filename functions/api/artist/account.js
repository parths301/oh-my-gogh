// DELETE /api/artist/account  { password }  -> deletes the profile, listings, images and sessions.
import { methods, json, readJson, requireBinding, ApiError } from '../../_lib/http.js';
import { requireArtist, clearCookie } from '../../_lib/auth.js';
import { verifyPassword } from '../../_lib/crypto.js';
import { deleteImages } from '../../_lib/images.js';
import { rateLimit } from '../../_lib/ratelimit.js';

export const onRequest = methods({
  DELETE: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    const bucket = requireBinding(ctx.env, 'IMAGES');
    await rateLimit(db, 'acct-del:' + artist.id, 5, 3600);
    const body = await readJson(ctx.request);
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    if (!(await verifyPassword(password, artist.password_hash))) {
      throw new ApiError(400, 'validation', 'Your password is not right.', { password: 'Your password is not right.' });
    }
    const { results } = await db
      .prepare('SELECT i.r2_key AS k FROM product_images i JOIN products p ON p.id = i.product_id WHERE p.artist_id = ?1')
      .bind(artist.id)
      .all();
    // Explicit deletes (children first) so we do not depend on the foreign-key pragma being active.
    await db.batch([
      db.prepare('DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE artist_id = ?1)').bind(artist.id),
      db.prepare('DELETE FROM product_tags WHERE product_id IN (SELECT id FROM products WHERE artist_id = ?1)').bind(artist.id),
      db.prepare('DELETE FROM products WHERE artist_id = ?1').bind(artist.id),
      db.prepare('DELETE FROM artist_tags WHERE artist_id = ?1').bind(artist.id),
      db.prepare('DELETE FROM sessions WHERE artist_id = ?1').bind(artist.id),
      db.prepare('DELETE FROM artists WHERE id = ?1').bind(artist.id),
    ]);
    await deleteImages(bucket, [...results.map((r) => r.k), artist.avatar_key]);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(ctx.request) });
  },
});
