// POST   /api/artist/avatar   multipart/form-data, field "file" (JPEG/PNG/WebP, max 2 MB)
// DELETE /api/artist/avatar
import { methods, json, requireBinding } from '../../_lib/http.js';
import { requireArtist } from '../../_lib/auth.js';
import { readUpload, newImageKey, putImage, deleteImages, MAX_AVATAR_BYTES } from '../../_lib/images.js';
import { rateLimit } from '../../_lib/ratelimit.js';

export const onRequest = methods({
  POST: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    const bucket = requireBinding(ctx.env, 'IMAGES');
    await rateLimit(db, 'upload:' + artist.id, 40, 3600, { message: 'Too many uploads. Please try again later.' });
    const { bytes, contentType } = await readUpload(ctx.request, MAX_AVATAR_BYTES);
    const key = newImageKey('avatars', artist.id, contentType);
    await putImage(bucket, key, bytes, contentType);
    await db.prepare('UPDATE artists SET avatar_key = ?1, updated_at = ?2 WHERE id = ?3').bind(key, new Date().toISOString(), artist.id).run();
    await deleteImages(bucket, [artist.avatar_key]);
    return json({ ok: true, avatar_url: '/img/' + key });
  },
  DELETE: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const bucket = requireBinding(ctx.env, 'IMAGES');
    await ctx.env.DB.prepare('UPDATE artists SET avatar_key = NULL, updated_at = ?1 WHERE id = ?2').bind(new Date().toISOString(), artist.id).run();
    await deleteImages(bucket, [artist.avatar_key]);
    return json({ ok: true, avatar_url: null });
  },
});
