// Fixed-window rate limiting backed by D1 (atomic upsert, so concurrent requests are counted correctly).
import { ApiError, clientIp } from './http.js';
import { sha256Hex } from './crypto.js';

export async function hashedIp(request) {
  return (await sha256Hex('omg-ip|' + clientIp(request))).slice(0, 32);
}

/**
 * Count one hit against `key` and throw 429 when over `limit` within `windowSeconds`.
 * Use `peek` + `hit` separately for failure-only counters (see auth).
 */
export async function rateLimit(db, key, limit, windowSeconds, { message } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db
    .prepare(
      'INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) ' +
        'ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count'
    )
    .bind(key, windowStart)
    .first();
  // opportunistic cleanup of old windows (about 1 in 50 calls)
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 86400).run();
  }
  if (row && row.count > limit) {
    const err = new ApiError(429, 'rate_limited', message || 'Too many attempts. Please wait a few minutes and try again.');
    err.headers = { 'Retry-After': String(windowStart + windowSeconds - now) };
    throw err;
  }
}

/** Read the current count without incrementing. */
export async function rateCount(db, key, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db.prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2').bind(key, windowStart).first();
  return row ? row.count : 0;
}

export async function rateReset(db, key, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  await db.prepare('DELETE FROM rate_limits WHERE key = ?1 AND window_start = ?2').bind(key, windowStart).run();
}
