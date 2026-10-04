// Sessions: random 256-bit token in an HttpOnly cookie; only its SHA-256 is stored in D1.
// CSRF: every session carries a csrf_token that state-changing requests must echo in X-CSRF-Token,
// on top of the same-origin check in http.js and SameSite=Lax on the cookie.
import { ApiError, requireBinding } from './http.js';
import { randomToken, sha256Hex, safeEqual } from './crypto.js';

const SESSION_DAYS = 14;
const COOKIE_SECURE = '__Host-omg_session'; // used over HTTPS: Secure, Path=/, no Domain
const COOKIE_PLAIN = 'omg_session'; // plain HTTP, local development only

const isHttps = (request) => new URL(request.url).protocol === 'https:';
const cookieName = (request) => (isHttps(request) ? COOKIE_SECURE : COOKIE_PLAIN);

function readCookie(request) {
  const header = request.headers.get('Cookie') || '';
  const name = cookieName(request);
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

function buildCookie(request, value, maxAgeSeconds) {
  const attrs = [`${cookieName(request)}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (isHttps(request)) attrs.push('Secure');
  return attrs.join('; ');
}

export async function createSession(request, env, artistId) {
  const db = requireBinding(env, 'DB');
  const token = randomToken();
  const csrf = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await db
    .prepare('INSERT INTO sessions (token_hash, artist_id, csrf_token, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(await sha256Hex(token), artistId, csrf, now.toISOString(), expires.toISOString())
    .run();
  // housekeeping: drop expired sessions now and then
  if (Math.random() < 0.05) await db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now.toISOString()).run();
  return { cookie: buildCookie(request, token, SESSION_DAYS * 86400), csrf };
}

export function clearCookie(request) {
  return buildCookie(request, '', 0);
}

/** Returns { artist, csrf, tokenHash } or null. */
export async function getSession(request, env) {
  const token = readCookie(request);
  if (!token || token.length > 100) return null;
  const db = requireBinding(env, 'DB');
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      'SELECT s.csrf_token AS csrf, s.expires_at AS expires_at, a.* FROM sessions s JOIN artists a ON a.id = s.artist_id WHERE s.token_hash = ?1'
    )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
    return null;
  }
  const { csrf, expires_at, ...artist } = row;
  return { artist, csrf, tokenHash };
}

/** Require a logged-in artist. For non-GET requests also require the CSRF header. */
export async function requireArtist(context) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session) throw new ApiError(401, 'unauthorized', 'Please log in.');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const sent = request.headers.get('X-CSRF-Token') || '';
    if (!sent || !(await safeEqual(sent, session.csrf))) {
      throw new ApiError(403, 'csrf', 'Your session token is missing or out of date. Please reload the page.');
    }
  }
  return session;
}

export async function destroySession(env, tokenHash) {
  await requireBinding(env, 'DB').prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
}

export async function destroyOtherSessions(env, artistId, keepTokenHash) {
  await requireBinding(env, 'DB')
    .prepare('DELETE FROM sessions WHERE artist_id = ?1 AND token_hash != ?2')
    .bind(artistId, keepTokenHash)
    .run();
}

/** The artist fields that are safe to send to their own browser (never the password hash). */
export function privateArtist(a) {
  return {
    id: a.id,
    email: a.email,
    email_verified: !!a.email_verified,
    name: a.name,
    handle: a.handle,
    bio: a.bio,
    location: a.location,
    category: a.category,
    links: safeJson(a.links, []),
    avatar_url: a.avatar_key ? '/img/' + a.avatar_key : null,
    status: a.status,
    status_note: a.status_note,
  };
}

export function safeJson(text, fallback) {
  try {
    const v = JSON.parse(text);
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}
