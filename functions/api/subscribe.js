/**
 * POST /api/subscribe  (Cloudflare Pages Function)
 *
 * Stores a waitlist email in the KV namespace bound as WAITLIST.
 *   key   = email, lowercased
 *   value = JSON {"createdAt": ISO timestamp, "source": "hero", "consent": "waitlist-notice-2026-10-05"}
 *
 * Accepts JSON ({email, website, source}) or a normal form post.
 *  - JSON requests get JSON back.
 *  - Form posts (no JavaScript) get a 303 redirect to /#joined-ok | /#joined-exists | /#joined-error.
 *
 * Abuse controls (deliberately light):
 *  - honeypot field "website": if filled, we pretend success and store nothing
 *  - same-origin check on the Origin header
 *  - small body limit
 *  - per-IP counter in KV (keys start with "rl:"), 8 tries per 10 minutes.
 *    Email keys can never contain ":" (rejected by validation), so the two key spaces cannot collide.
 *  Note the KV free plan allows 1,000 writes a day; see README_DEPLOY.md.
 */

const MAX_BODY_BYTES = 2048;
const RATE_LIMIT = 8;          // attempts
const RATE_WINDOW_SECONDS = 600; // per 10 minutes
const CONSENT_VERSION = 'waitlist-notice-2026-10-05';
// local part: no whitespace, "@" or ":"; domain needs a dot and a 2+ char TLD
const EMAIL_RE = /^[^\s@:]{1,64}@[^\s@:]+\.[^\s@:]{2,}$/;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

const redirect = (url, hash) =>
  new Response(null, { status: 303, headers: { Location: new URL('/', url).origin + '/#' + hash, 'Cache-Control': 'no-store' } });

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // non-browser clients and some same-site form posts
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function readBody(request) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true };
  if (type.includes('application/json')) {
    try {
      const data = JSON.parse(text);
      return { data: data && typeof data === 'object' ? data : {}, isJson: true };
    } catch {
      return { data: {}, isJson: true, malformed: true };
    }
  }
  return { data: Object.fromEntries(new URLSearchParams(text)), isJson: false };
}

export async function onRequestPost({ request, env }) {
  let isJson = true;
  const fail = (error, status, message) =>
    isJson
      ? json({ ok: false, error, message }, status)
      : redirect(request.url, 'joined-error');
  const succeed = (status) =>
    isJson ? json({ ok: true, status }) : redirect(request.url, status === 'exists' ? 'joined-exists' : 'joined-ok');

  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden', message: 'Request not allowed.' }, 403);
  if (!env.WAITLIST) {
    console.error('KV binding WAITLIST is missing. See README_DEPLOY.md.');
    return json({ ok: false, error: 'server', message: 'Waitlist is not available right now.' }, 500);
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ ok: false, error: 'server', message: 'Could not read the request.' }, 400);
  }
  isJson = body.isJson !== false;
  if (body.tooLarge) return fail('invalid_email', 413, 'Request too large.');
  const data = body.data || {};

  // Honeypot: real people never see or fill this field. Pretend it worked.
  if (typeof data.website === 'string' && data.website.trim() !== '') return succeed('ok');

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email) || email.includes('..')) {
    return fail('invalid_email', 400, 'Please enter a valid email address.');
  }

  // Light per-IP rate limit (best effort: KV is not atomic, which is fine here).
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = 'rl:' + (await sha256Hex('omg-waitlist|' + ip)).slice(0, 32);
    const seen = parseInt((await env.WAITLIST.get(rlKey)) || '0', 10);
    if (seen >= RATE_LIMIT) {
      const res = fail('rate_limited', 429, 'Too many attempts. Please try again in a few minutes.');
      res.headers.set('Retry-After', String(RATE_WINDOW_SECONDS));
      return res;
    }
    await env.WAITLIST.put(rlKey, String(seen + 1), { expirationTtl: RATE_WINDOW_SECONDS });
  } catch (err) {
    // Never block a signup because the limiter failed.
    console.error('rate limit check failed', err && err.message);
  }

  try {
    const existing = await env.WAITLIST.get(email);
    if (existing !== null) return succeed('exists');

    const src = typeof data.source === 'string' && /^[a-z0-9_-]{1,32}$/i.test(data.source) ? data.source.toLowerCase() : 'web';
    await env.WAITLIST.put(
      email,
      JSON.stringify({ createdAt: new Date().toISOString(), source: src, consent: CONSENT_VERSION })
    );
    return succeed('ok');
  } catch (err) {
    console.error('waitlist write failed', err && err.message);
    return fail('server', 500, 'Something went wrong. Please try again.');
  }
}

// Anything other than POST
export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  return json({ ok: false, error: 'method_not_allowed', message: 'Use POST.' }, 405, { Allow: 'POST, OPTIONS' });
}
