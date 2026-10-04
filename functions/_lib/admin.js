// Admin gate: a single secret (ADMIN_TOKEN) sent as "Authorization: Bearer <token>".
// No cookie is used, so there is nothing for a cross-site request to ride on. Fails closed when unset.
import { ApiError, requireBinding } from './http.js';
import { safeEqual } from './crypto.js';
import { rateLimit, rateCount, hashedIp } from './ratelimit.js';

export async function requireAdmin({ request, env }) {
  if (!env.ADMIN_TOKEN || String(env.ADMIN_TOKEN).length < 16) {
    throw new ApiError(503, 'not_configured', 'Admin is not configured. Set the ADMIN_TOKEN secret (at least 16 characters).');
  }
  const db = requireBinding(env, 'DB');
  const key = 'admin-fail:' + (await hashedIp(request));
  if ((await rateCount(db, key, 900)) >= 10) {
    const err = new ApiError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes.');
    err.headers = { 'Retry-After': '900' };
    throw err;
  }
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !(await safeEqual(token, env.ADMIN_TOKEN))) {
    await rateLimit(db, key, 1000, 900); // count the failure
    throw new ApiError(401, 'unauthorized', 'Admin token is not valid.');
  }
}
