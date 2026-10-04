// HTTP helpers shared by every Pages Function: responses, security headers, error handling,
// same-origin checks and body parsing.

export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'";

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...extra },
  });
}

export function redirect(location, status = 303) {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

/** State-changing requests must come from our own pages. Browsers always send Origin on POST/PUT/DELETE. */
export function assertSameOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === url.host;
    } catch {
      ok = false;
    }
    if (!ok) throw new ApiError(403, 'forbidden', 'Request not allowed.');
    return;
  }
  const site = request.headers.get('Sec-Fetch-Site');
  if (site === 'same-origin') return;
  throw new ApiError(403, 'forbidden', 'Request not allowed.');
}

export async function readJson(request, maxBytes = 65536) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) throw new ApiError(415, 'unsupported_media_type', 'Send JSON.');
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) throw new ApiError(413, 'too_large', 'Request too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, 'too_large', 'Request too large.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad_json', 'Could not read the request.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError(400, 'bad_json', 'Could not read the request.');
  return data;
}

function withHeaders(res, extra) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) if (!headers.has(k)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * Build an onRequest handler from a method map, e.g. methods({ GET: fn, POST: fn }).
 *  - HEAD is served by GET.
 *  - Non-GET requests pass the same-origin check before the handler runs.
 *  - ApiError becomes a JSON error; anything else is logged and returned as a generic 500.
 *  - Security headers are added to every response.
 */
export function methods(map, { html: isHtml = false } = {}) {
  return async function onRequest(context) {
    const { request } = context;
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    try {
      const fn = map[method];
      if (!fn) {
        return withHeaders(json({ ok: false, error: 'method_not_allowed', message: 'Method not allowed.' }, 405, { Allow: Object.keys(map).join(', ') }));
      }
      if (method !== 'GET') assertSameOrigin(request);
      const res = await fn(context);
      return withHeaders(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (isHtml) return withHeaders(errorPage(err.status, err.message));
        return withHeaders(json({ ok: false, error: err.code, message: err.message, fields: err.fields }, err.status, err.headers || {}));
      }
      console.error('unhandled error', request.method, new URL(request.url).pathname, err && err.stack ? err.stack : err);
      if (isHtml) return withHeaders(errorPage(500, 'Something went wrong on our side. Please try again.'));
      return withHeaders(json({ ok: false, error: 'server', message: 'Something went wrong on our side. Please try again.' }, 500));
    }
  };
}

function errorPage(status, message) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return html(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oh my Gogh!</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/css/waitlist.css"></head><body><main class="lost"><div class="wrap"><h1>${status}</h1><p>${esc(message)}</p><a class="btn" href="/shop">Back to the shop</a></div></main></body></html>`,
    status
  );
}

export function requireBinding(env, name) {
  if (!env[name]) {
    console.error(`Binding ${name} is missing. See DEPLOY_MARKETPLACE.md.`);
    throw new ApiError(503, 'not_configured', 'The marketplace is not set up yet.');
  }
  return env[name];
}
