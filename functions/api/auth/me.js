// GET /api/auth/me -> { artist: null } or { artist, csrf }
import { methods, json } from '../../_lib/http.js';
import { getSession, privateArtist } from '../../_lib/auth.js';

export const onRequest = methods({
  GET: async ({ request, env }) => {
    const session = await getSession(request, env);
    if (!session) return json({ ok: true, artist: null });
    return json({ ok: true, artist: privateArtist(session.artist), csrf: session.csrf });
  },
});
