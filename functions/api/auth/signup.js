// POST /api/auth/signup  { email, password, name, handle?, category, bio?, accept_terms, website (honeypot) }
// Creates the account AND the artist profile in one step. The artist starts as "pending".
import { methods, json, readJson, requireBinding, ApiError } from '../../_lib/http.js';
import { hashPassword, randomId, clampIterations } from '../../_lib/crypto.js';
import { rateLimit, hashedIp } from '../../_lib/ratelimit.js';
import { createSession, privateArtist } from '../../_lib/auth.js';
import { validateEmail, validatePassword, validateHandle, handleFromName, validateCategory, cleanText, TERMS_VERSION } from '../../_lib/validate.js';

export const onRequest = methods({
  POST: async ({ request, env }) => {
    const db = requireBinding(env, 'DB');
    await rateLimit(db, 'signup:ip:' + (await hashedIp(request)), 5, 3600, { message: 'Too many sign-ups from this connection. Please try again later.' });

    const body = await readJson(request);
    if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true }); // honeypot

    const fields = {};
    const email = validateEmail(body.email);
    if (!email.ok) fields.email = email.error;
    const name = cleanText(body.name, { min: 2, max: 60, label: 'Name' });
    if (!name.ok) fields.name = name.error;
    const category = validateCategory(body.category);
    if (!category.ok) fields.category = category.error;
    const bio = cleanText(body.bio, { min: 0, max: 1200, multiline: true, label: 'Bio' });
    if (!bio.ok) fields.bio = bio.error;

    let handle = null;
    let derivedHandle = false;
    if (typeof body.handle === 'string' && body.handle.trim() !== '') {
      const h = validateHandle(body.handle);
      h.ok ? (handle = h.value) : (fields.handle = h.error);
    } else if (name.ok) {
      handle = handleFromName(name.value);
      derivedHandle = true;
    }

    const pw = validatePassword(body.password, { email: email.ok ? email.value : '', handle: handle || '' });
    if (!pw.ok) fields.password = pw.error;
    if (body.accept_terms !== true) fields.accept_terms = 'Please accept the seller terms and privacy notice to continue.';

    if (Object.keys(fields).length) throw new ApiError(400, 'validation', 'Please fix the highlighted fields.', fields);

    const passwordHash = await hashPassword(pw.value, clampIterations(env.PBKDF2_ITERATIONS));
    const id = 'a_' + randomId(12);
    const now = new Date().toISOString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const tryHandle = derivedHandle && attempt > 0 ? (handle.slice(0, 25) + '-' + randomId(4)) : handle;
      try {
        await db
          .prepare(
            'INSERT INTO artists (id, email, password_hash, name, handle, bio, category, status, terms_version, terms_accepted_at, created_at, updated_at) ' +
              "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9, ?9, ?9)"
          )
          .bind(id, email.value, passwordHash, name.value, tryHandle, bio.value, category.value, TERMS_VERSION, now)
          .run();
        const artist = await db.prepare('SELECT * FROM artists WHERE id = ?1').bind(id).first();
        const session = await createSession(request, env, id);
        return json({ ok: true, artist: privateArtist(artist), csrf: session.csrf }, 201, { 'Set-Cookie': session.cookie });
      } catch (err) {
        const msg = String((err && err.message) || err);
        if (!/UNIQUE/i.test(msg)) throw err;
        if (/artists\.email/i.test(msg)) {
          throw new ApiError(409, 'email_taken', 'An account with that email already exists. Try logging in.', { email: 'An account with that email already exists.' });
        }
        if (/artists\.handle/i.test(msg)) {
          if (derivedHandle) continue;
          throw new ApiError(409, 'handle_taken', 'That handle is already taken.', { handle: 'That handle is already taken.' });
        }
        throw err;
      }
    }
    throw new ApiError(409, 'handle_taken', 'Please choose a handle.', { handle: 'Please choose a handle.' });
  },
});
