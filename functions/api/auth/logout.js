// POST /api/auth/logout
import { methods, json } from '../../_lib/http.js';
import { requireArtist, destroySession, clearCookie } from '../../_lib/auth.js';

export const onRequest = methods({
  POST: async (ctx) => {
    const session = await requireArtist(ctx);
    await destroySession(ctx.env, session.tokenHash);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(ctx.request) });
  },
});
