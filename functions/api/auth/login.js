// POST /api/auth/login  { email, password }
import { methods, json, readJson, requireBinding, ApiError } from '../../_lib/http.js';
import { verifyPassword, dummyVerify, hashPassword, needsRehash, clampIterations, sha256Hex } from '../../_lib/crypto.js';
import { rateLimit, rateCount, rateReset, hashedIp } from '../../_lib/ratelimit.js';
import { createSession, privateArtist } from '../../_lib/auth.js';

const WINDOW = 900; // 15 minutes

export const onRequest = methods({
  POST: async ({ request, env }) => {
    const db = requireBinding(env, 'DB');
    await rateLimit(db, 'login:ip:' + (await hashedIp(request)), 20, WINDOW);

    const body = await readJson(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    const generic = new ApiError(401, 'invalid_credentials', 'That email and password do not match.');
    if (!email || !password) throw generic;

    // Per-account throttle on failures, so one account cannot be guessed at from many IPs.
    const emailKey = 'login:fail:' + (await sha256Hex('omg-email|' + email)).slice(0, 32);
    if ((await rateCount(db, emailKey, WINDOW)) >= 5) {
      const err = new ApiError(429, 'rate_limited', 'Too many failed attempts for this account. Please wait 15 minutes and try again.');
      err.headers = { 'Retry-After': String(WINDOW) };
      throw err;
    }

    const iterations = clampIterations(env.PBKDF2_ITERATIONS);
    const artist = await db.prepare('SELECT * FROM artists WHERE email = ?1').bind(email).first();
    let ok = false;
    if (artist) ok = await verifyPassword(password, artist.password_hash);
    else await dummyVerify(password, iterations); // keep timing similar for unknown emails
    if (!ok) {
      await rateLimit(db, emailKey, 1000, WINDOW); // count the failure
      throw generic;
    }

    await rateReset(db, emailKey, WINDOW);
    if (needsRehash(artist.password_hash, iterations)) {
      await db.prepare('UPDATE artists SET password_hash = ?1 WHERE id = ?2').bind(await hashPassword(password, iterations), artist.id).run();
    }
    const session = await createSession(request, env, artist.id);
    return json({ ok: true, artist: privateArtist(artist), csrf: session.csrf }, 200, { 'Set-Cookie': session.cookie });
  },
});
