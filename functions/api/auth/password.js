// POST /api/auth/password  { current_password, new_password }
import { methods, json, readJson, ApiError } from '../../_lib/http.js';
import { requireArtist, destroyOtherSessions } from '../../_lib/auth.js';
import { verifyPassword, hashPassword, clampIterations } from '../../_lib/crypto.js';
import { validatePassword } from '../../_lib/validate.js';
import { rateLimit } from '../../_lib/ratelimit.js';

export const onRequest = methods({
  POST: async (ctx) => {
    const { request, env } = ctx;
    const session = await requireArtist(ctx);
    await rateLimit(env.DB, 'pw:' + session.artist.id, 10, 3600);
    const body = await readJson(request);
    const current = typeof body.current_password === 'string' ? body.current_password.slice(0, 200) : '';
    if (!(await verifyPassword(current, session.artist.password_hash))) {
      throw new ApiError(400, 'validation', 'Your current password is not right.', { current_password: 'Your current password is not right.' });
    }
    const pw = validatePassword(body.new_password, { email: session.artist.email, handle: session.artist.handle });
    if (!pw.ok) throw new ApiError(400, 'validation', pw.error, { new_password: pw.error });
    const hash = await hashPassword(pw.value, clampIterations(env.PBKDF2_ITERATIONS));
    await env.DB.prepare('UPDATE artists SET password_hash = ?1, updated_at = ?2 WHERE id = ?3').bind(hash, new Date().toISOString(), session.artist.id).run();
    await destroyOtherSessions(env, session.artist.id, session.tokenHash);
    return json({ ok: true });
  },
});
