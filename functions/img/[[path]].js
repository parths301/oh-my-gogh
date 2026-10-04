// GET /img/<r2 key>  serves product images and avatars from R2.
// Keys contain 100 bits of randomness, so drafts and unapproved images are not guessable.
// Content-Type comes from the type sniffed at upload time; nosniff is always sent.
import { methods, requireBinding, ApiError } from '../_lib/http.js';

const KEY_RE = /^(products|avatars)\/[a-z0-9_]{6,20}\/[a-z0-9]{20}\.(jpg|png|webp)$/;

export const onRequest = methods({
  GET: async ({ params, env, request }) => {
    const bucket = requireBinding(env, 'IMAGES');
    const parts = Array.isArray(params.path) ? params.path : [params.path];
    const key = parts.join('/');
    if (!KEY_RE.test(key)) throw new ApiError(404, 'not_found', 'Not found.');
    const obj = await bucket.get(key);
    if (!obj) throw new ApiError(404, 'not_found', 'Not found.');
    const type = (obj.httpMetadata && obj.httpMetadata.contentType) || '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new ApiError(404, 'not_found', 'Not found.');
    const headers = new Headers({
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: obj.httpEtag,
    });
    if (request.headers.get('If-None-Match') === obj.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(obj.body, { headers });
  },
});
