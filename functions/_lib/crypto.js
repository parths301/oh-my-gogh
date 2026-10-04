// WebCrypto helpers: random ids, hashing, PBKDF2 password hashes, constant-time compare.
// Works in Cloudflare Workers/Pages Functions and in Node 20 (tests).

const enc = new TextEncoder();
const B32 = 'abcdefghjkmnpqrstvwxyz23456789'; // 30 chars, no look-alikes (no i, l, o, u, 0, 1)

export function b64uEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Random string from the unambiguous alphabet (rejection sampling, no modulo bias). */
export function randomId(length = 10) {
  let out = '';
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < 240 && out.length < length) out += B32[b % B32.length]; // 240 = 8 * 30
    }
  }
  return out;
}

/** 256-bit random token, URL-safe. */
export function randomToken() {
  return b64uEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (hashes both sides first so lengths do not leak). */
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const MAX_ITERATIONS = 100000; // hard cap enforced by the Workers runtime
const DEFAULT_ITERATIONS = 100000;

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function clampIterations(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 10000) return DEFAULT_ITERATIONS;
  return Math.min(n, MAX_ITERATIONS);
}

/** Salted PBKDF2-HMAC-SHA256. Format: pbkdf2$sha256$<iterations>$<salt>$<hash> (base64url). */
export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const iters = clampIterations(iterations);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iters);
  return `pbkdf2$sha256$${iters}$${b64uEncode(salt)}$${b64uEncode(hash)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iters = parseInt(parts[2], 10);
  if (!Number.isFinite(iters) || iters < 1 || iters > MAX_ITERATIONS) return false;
  let salt;
  let expected;
  try {
    salt = b64uDecode(parts[3]);
    expected = b64uDecode(parts[4]);
  } catch {
    return false;
  }
  const actual = await pbkdf2(password, salt, iters);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** True when a stored hash was made with fewer iterations than we now use (rehash on login). */
export function needsRehash(stored, iterations) {
  const parts = String(stored || '').split('$');
  return parts.length !== 5 || parseInt(parts[2], 10) < clampIterations(iterations);
}

// A valid-looking hash of a random password, used to equalise timing when the email is unknown.
let dummy;
export async function dummyVerify(password, iterations) {
  if (!dummy) dummy = await hashPassword(randomToken(), iterations);
  await verifyPassword(password, dummy);
}
