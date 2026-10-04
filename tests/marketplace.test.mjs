// Integration tests for the marketplace. Run against a local `wrangler pages dev` (see DEPLOY_MARKETPLACE.md):
//   npm run market:dev        (terminal 1; ADMIN_TOKEN=test-admin-token-1234567890)
//   npm run market:test       (terminal 2)
// Each test uses its own CF-Connecting-IP so the per-IP rate limits do not interfere with each other.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:8788';
const ADMIN = process.env.ADMIN_TOKEN || 'test-admin-token-1234567890';
const RUN = Math.random().toString(36).slice(2, 8);
let ipCounter = 0;
const nextIp = () => `10.${Math.floor(Math.random() * 200)}.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

// 1x1 PNG
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

class Client {
  constructor() { this.ip = nextIp(); this.cookie = ''; this.csrf = ''; }
  async req(method, path, { json, form, headers = {}, origin = BASE, csrf = true, raw } = {}) {
    const h = { 'CF-Connecting-IP': this.ip, ...headers };
    if (origin) h.Origin = origin;
    if (this.cookie) h.Cookie = this.cookie;
    if (csrf && this.csrf && method !== 'GET') h['X-CSRF-Token'] = this.csrf;
    let body;
    if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    if (raw !== undefined) { body = raw; }
    const res = await fetch(BASE + path, { method, headers: h, body, redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) { const pair = sc.split(';')[0]; this.cookie = pair.endsWith('=') ? '' : pair; }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, text, data, setCookie: sc };
  }
  async signup(over = {}) {
    const email = over.email || `art-${RUN}-${ipCounter++}@example.com`;
    const r = await this.req('POST', '/api/auth/signup', {
      json: { email, password: 'correct horse battery 7', name: 'Test Artist', category: 'Ceramics', accept_terms: true, ...over },
    });
    if (r.data && r.data.csrf) this.csrf = r.data.csrf;
    return { ...r, email };
  }
}
const admin = (method, path, json) =>
  fetch(BASE + path, {
    method, headers: { Authorization: 'Bearer ' + ADMIN, Origin: BASE, 'Content-Type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: json ? JSON.stringify(json) : undefined,
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));
const get = async (path, headers = {}) => { const r = await fetch(BASE + path, { headers, redirect: 'manual' }); return { status: r.status, text: await r.text(), headers: r.headers }; };
const pngForm = (bytes = PNG, name = 'a.png', type = 'image/png') => { const f = new FormData(); f.append('file', new Blob([bytes], { type }), name); return f; };

test('static pages and security headers', async () => {
  for (const p of ['/', '/signup', '/login', '/dashboard', '/admin', '/privacy', '/terms']) assert.equal((await get(p)).status, 200, p);
  const shop = await get('/shop');
  assert.equal(shop.status, 200);
  assert.match(shop.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(shop.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(shop.headers.get('x-frame-options'), 'DENY');
  // no inline script or style in any page we ship
  for (const p of ['/signup', '/login', '/dashboard', '/admin', '/shop', '/artists']) {
    const t = (await get(p)).text;
    assert.doesNotMatch(t, /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/i, 'inline script on ' + p);
    assert.doesNotMatch(t, /\sstyle=/i, 'style attribute on ' + p);
  }
});

test('signup validation', async () => {
  const c = new Client();
  const bad = async (over, field) => {
    c.ip = nextIp(); // validation failures count towards the signup limit
    const r = await c.signup(over);
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.ok(r.data.fields[field], `expected error on ${field}: ${JSON.stringify(r.data)}`);
  };
  await bad({ email: 'not-an-email' }, 'email');
  await bad({ email: 'a@b' }, 'email');
  await bad({ email: 'a..b@example.com' }, 'email');
  await bad({ password: 'short' }, 'password');
  await bad({ password: 'password1234' }, 'password');
  await bad({ password: 'aaaaaaaaaaaa' }, 'password');
  await bad({ accept_terms: false }, 'accept_terms');
  await bad({ name: 'x' }, 'name');
  await bad({ handle: 'Bad Handle!' }, 'handle');
  await bad({ handle: 'admin' }, 'handle');
  await bad({ handle: 'a' }, 'handle');
  await bad({ category: '' }, 'category');
  await bad({ category: '<script>' }, 'category');
  const hp = await c.signup({ website: 'http://spam.example' });
  assert.equal(hp.status, 200); // honeypot pretends success
  assert.equal(hp.data.artist, undefined);
});

test('signup, cookie flags, duplicates, me, logout', async () => {
  const c = new Client();
  const handle = 'ceramics-' + RUN;
  const r = await c.signup({ handle, name: 'Mira <b>Vance</b>' });
  assert.equal(r.status, 201);
  assert.equal(r.data.artist.status, 'pending');
  assert.equal(r.data.artist.email_verified, false);
  assert.equal(r.data.artist.handle, handle);
  assert.equal(r.data.artist.password_hash, undefined);
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  assert.match(r.setCookie, /Path=\//);
  // Secure is only added over HTTPS (local dev is plain http)
  const dup = await new Client().signup({ email: r.email });
  assert.equal(dup.status, 409);
  const dupH = await new Client().signup({ handle });
  assert.equal(dupH.status, 409);
  assert.ok(dupH.data.fields.handle);
  // derived handle
  const d = await new Client().signup({ name: 'Auto Handle ' + RUN });
  assert.equal(d.status, 201);
  assert.match(d.data.artist.handle, /^auto-handle-/);
  // me
  const me = await c.req('GET', '/api/auth/me');
  assert.equal(me.data.artist.handle, handle);
  assert.equal((await new Client().req('GET', '/api/auth/me')).data.artist, null);
  // logout kills the session
  assert.equal((await c.req('POST', '/api/auth/logout', { json: {} })).status, 200);
  assert.equal((await new Client().req('GET', '/api/artist/products')).status, 401);
});

test('CSRF and origin protection', async () => {
  const c = new Client();
  await c.signup();
  // no Origin and no Sec-Fetch-Site
  assert.equal((await c.req('POST', '/api/artist/products', { json: {}, origin: null })).status, 403);
  // foreign Origin
  assert.equal((await c.req('POST', '/api/artist/products', { json: {}, origin: 'https://evil.example' })).status, 403);
  // right Origin but missing CSRF token
  const noTok = await c.req('PUT', '/api/artist/profile', { json: { name: 'Hacked' }, csrf: false });
  assert.equal(noTok.status, 403);
  assert.equal(noTok.data.error, 'csrf');
  // wrong CSRF token
  assert.equal((await c.req('PUT', '/api/artist/profile', { json: { name: 'Hacked' }, csrf: false, headers: { 'X-CSRF-Token': 'nope' } })).status, 403);
  // login also needs same origin and JSON content type
  assert.equal((await new Client().req('POST', '/api/auth/login', { json: {}, origin: 'https://evil.example' })).status, 403);
  const form = await new Client().req('POST', '/api/auth/login', { raw: 'email=a&password=b', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
});

test('login: generic errors, per-account and per-IP rate limits', async () => {
  const c = new Client();
  const s = await c.signup();
  const bad = await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'wrong password 123' } });
  const unknown = await new Client().req('POST', '/api/auth/login', { json: { email: 'nobody-' + RUN + '@example.com', password: 'wrong password 123' } });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.data.message, unknown.data.message);
  // per-account lockout after 5 failures, even from different IPs
  let last;
  for (let i = 0; i < 5; i++) last = await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'wrong password 123' } });
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
  const locked = await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'correct horse battery 7' } });
  assert.equal(locked.status, 429);
  // per-IP limit
  const ipc = new Client();
  let status;
  for (let i = 0; i < 22; i++) status = (await ipc.req('POST', '/api/auth/login', { json: { email: `x${i}-${RUN}@example.com`, password: 'wrong password 123' } })).status;
  assert.equal(status, 429);
  // good login works for a fresh account and sets a cookie
  const c2 = new Client();
  const s2 = await c2.signup();
  const l = await new Client().req('POST', '/api/auth/login', { json: { email: s2.email.toUpperCase(), password: 'correct horse battery 7' } });
  assert.equal(l.status, 200);
  assert.match(l.setCookie, /HttpOnly/);
});

test('signup rate limit per IP', async () => {
  const ip = nextIp();
  const results = [];
  for (let i = 0; i < 7; i++) { const c = new Client(); c.ip = ip; results.push((await c.signup()).status); }
  assert.deepEqual(results.slice(0, 5), [201, 201, 201, 201, 201]);
  assert.equal(results[5], 429);
});

test('profile validation and storage', async () => {
  const c = new Client();
  await c.signup();
  const bad = await c.req('PUT', '/api/artist/profile', { json: { name: 'Ok Name', category: 'prints', links: [{ label: 'x', url: 'javascript:alert(1)' }] } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.fields.links);
  const bad2 = await c.req('PUT', '/api/artist/profile', { json: { name: 'Ok Name', category: 'prints', links: [{ label: 'x', url: 'https://user:pw@example.com' }] } });
  assert.equal(bad2.status, 400);
  const ok = await c.req('PUT', '/api/artist/profile', {
    json: { name: 'Ok Name', bio: 'Line one\n\nLine two', location: 'Pune, India', category: 'Prints', tags: ['Linocut', 'linocut', 'botanical'], links: [{ label: 'Instagram', url: 'https://instagram.com/x' }] },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.artist.category, 'prints');
  assert.deepEqual(ok.data.artist.tags, ['linocut', 'botanical']);
  assert.equal(ok.data.artist.links[0].url, 'https://instagram.com/x');
  const tooMany = await c.req('PUT', '/api/artist/profile', { json: { name: 'Ok Name', category: 'prints', tags: Array.from({ length: 11 }, (_, i) => 't' + i) } });
  assert.equal(tooMany.status, 400);
});

test('full marketplace flow: listing, images, approval, public visibility, XSS, SQLi', async () => {
  const c = new Client();
  const handle = 'flow-' + RUN;
  const xssName = '"><img src=x onerror=alert(1)>';
  await c.signup({ handle, name: 'Flow Artist' });
  await c.req('PUT', '/api/artist/profile', { json: { name: 'Flow <script>alert(1)</script> Artist', bio: xssName, category: 'ceramics', location: "O'Brien & Co" } });

  // validation
  const v = async (over, field) => {
    const r = await c.req('POST', '/api/artist/products', { json: { title: 'Blue Vase', category: 'ceramics', price: '1200', currency: 'INR', stock: 3, ...over } });
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.ok(r.data.fields[field], field + ' ' + JSON.stringify(r.data));
  };
  await v({ title: 'x' }, 'title');
  await v({ price: 'free' }, 'price');
  await v({ price: '10.999' }, 'price');
  await v({ price: '-5' }, 'price');
  await v({ currency: 'XYZ' }, 'currency');
  await v({ stock: -1 }, 'stock');
  await v({ stock: 5, edition_size: 3 }, 'stock');
  await v({ status: 'sold' }, 'status');
  await v({ category: '' }, 'category');

  const title = `Blue Vase <script>alert('x')</script> ${RUN}`;
  const created = await c.req('POST', '/api/artist/products', {
    json: { title, description: 'Hand thrown.\n\n<img src=x onerror=alert(2)>', category: 'Ceramics', tags: ['Vase', 'blue'], price: '1,200.50', currency: 'inr', stock: 3, edition_size: 10, status: 'published' },
  });
  assert.equal(created.status, 201, created.text);
  const p = created.data.product;
  assert.equal(p.price_minor, 120050);
  assert.equal(p.currency, 'INR');
  assert.equal(p.approval, 'pending');
  assert.match(p.slug, new RegExp(p.id + '$'));

  // other artist cannot touch it
  const other = new Client();
  await other.signup();
  assert.equal((await other.req('PUT', `/api/artist/products/${p.id}`, { json: { title: 'Stolen title' } })).status, 404);
  assert.equal((await other.req('DELETE', `/api/artist/products/${p.id}`)).status, 404);
  assert.equal((await other.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm(), csrf: true })).status, 404);

  // image uploads: type sniffing, size, count
  const up = await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm() });
  assert.equal(up.status, 201, up.text);
  const imgUrl = up.data.images[0].url;
  const served = await fetch(BASE + imgUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  const fake = await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm(new TextEncoder().encode('<script>alert(1)</script>'), 'evil.png', 'image/png') });
  assert.equal(fake.status, 415);
  const svg = await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml') });
  assert.equal(svg.status, 415);
  const jpegAsPng = await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm(JPEG, 'x.png', 'image/png') });
  assert.equal(jpegAsPng.status, 201); // accepted, stored as the sniffed type
  assert.equal(jpegAsPng.data.images[1].url.endsWith('.jpg'), true);
  const big = new Uint8Array(5 * 1024 * 1024 + 10); big.set(PNG);
  assert.equal((await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm(big) })).status, 413);
  for (let i = 0; i < 4; i++) assert.equal((await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm() })).status, 201);
  assert.equal((await c.req('POST', `/api/artist/products/${p.id}/images`, { form: pngForm() })).status, 409); // 7th
  const list = await c.req('GET', `/api/artist/products/${p.id}`);
  assert.equal(list.data.product.images.length, 6);
  // make cover
  const lastId = list.data.product.images[5].id;
  const cov = await c.req('POST', `/api/artist/products/${p.id}/images/${lastId}`, { json: { action: 'cover' } });
  assert.equal(cov.data.images[0].id, lastId);

  // not public before approval
  assert.equal((await get(`/p/${p.id}`)).status, 404);
  assert.equal((await get(`/p/${p.slug}`)).status, 404);
  assert.equal((await get(`/artists/${handle}`)).status, 404);
  assert.doesNotMatch((await get('/shop?q=' + RUN)).text, new RegExp(p.id));
  // owner preview works, noindex
  const prev = await c.req('GET', `/p/${p.id}`);
  assert.equal(prev.status, 200);
  assert.match(prev.text, /Private preview/);
  assert.match(prev.text, /noindex/);

  // admin gate
  assert.equal((await fetch(BASE + '/api/admin/artists', { headers: { Origin: BASE } })).status, 401);
  const wrong = await fetch(BASE + '/api/admin/artists', { headers: { Authorization: 'Bearer wrong-token-wrong-token', 'CF-Connecting-IP': nextIp() } });
  assert.equal(wrong.status, 401);
  // artists cannot use the admin API with their own session
  assert.equal((await c.req('POST', `/api/admin/products/${p.id}`, { json: { action: 'approve' } })).status, 401);
  const q = await admin('GET', '/api/admin/artists?status=pending');
  assert.equal(q.status, 200);
  const me = (await c.req('GET', '/api/auth/me')).data.artist;
  assert.ok(q.data.artists.find((a) => a.id === me.id));
  const pq = await admin('GET', '/api/admin/products?approval=pending');
  assert.ok(pq.data.products.find((x) => x.id === p.id));

  // approve product only: artist still pending, so still not public
  assert.equal((await admin('POST', `/api/admin/products/${p.id}`, { action: 'approve' })).status, 200);
  assert.equal((await get(`/p/${p.id}`)).status, 404);
  // approve artist
  assert.equal((await admin('POST', `/api/admin/artists/${me.id}`, { action: 'approve' })).status, 200);
  const page = await get(`/p/${p.slug}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /Buy \(not yet enabled\)/);
  assert.match(page.text, /disabled/);
  assert.match(page.text, /Checkout is not available yet/);
  assert.match(page.text, /₹1,200\.50/);
  assert.match(page.text, /Limited edition of 10, 3 left/);
  // XSS: nothing raw
  for (const url of [`/p/${p.id}`, `/artists/${handle}`, `/shop?q=${RUN}`, `/shop?q=${encodeURIComponent('"><script>alert(1)</script>')}`]) {
    const t = (await get(url)).text;
    assert.doesNotMatch(t, /<script>alert/i, url);
    assert.doesNotMatch(t, /<img src=x onerror/i, url);
  }
  assert.match((await get(`/p/${p.id}`)).text, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
  const art = await get(`/artists/${handle}`);
  assert.equal(art.status, 200);
  assert.match(art.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(art.text, /O&#39;Brien &amp; Co/);

  // shop browse, search, filter, sort
  const shop = await get('/shop');
  assert.match(shop.text, new RegExp(p.id));
  assert.match((await get('/shop?category=ceramics')).text, new RegExp(p.id));
  assert.doesNotMatch((await get('/shop?category=jewellery')).text, new RegExp(p.id));
  assert.match((await get('/shop?q=' + RUN)).text, new RegExp(p.id));
  assert.match((await get('/shop?tag=vase')).text, new RegExp(p.id));
  assert.doesNotMatch((await get('/shop?q=zzzznomatch')).text, new RegExp(p.id));
  assert.match((await get('/shop?sort=price_desc&page=1')).text, new RegExp(p.id));
  // SQL injection attempts are inert
  for (const evil of ["' OR 1=1 --", "'; DROP TABLE products; --", '%', '_', '\\']) {
    const r = await get('/shop?q=' + encodeURIComponent(evil) + '&category=' + encodeURIComponent(evil) + '&tag=' + encodeURIComponent(evil));
    assert.equal(r.status, 200, evil);
    assert.doesNotMatch(r.text, new RegExp(p.id), 'leaked for ' + evil);
  }
  assert.match((await get('/shop?q=' + encodeURIComponent("' OR 1=1 --"))).text, /Nothing matches/);
  assert.equal((await get('/shop')).status, 200); // table still there
  assert.equal((await get(`/p/${encodeURIComponent("x' OR '1'='1")}`)).status, 404);
  // wildcard "%" must not match everything
  assert.doesNotMatch((await get('/shop?q=%25')).text, new RegExp(p.id));

  // editing public content sends it back to review; price edits do not
  const price = await c.req('PUT', `/api/artist/products/${p.id}`, { json: { price: '1300', stock: 2 } });
  assert.equal(price.status, 200);
  assert.equal(price.data.product.approval, 'approved');
  assert.equal(price.data.product.price_minor, 130000);
  const title2 = await c.req('PUT', `/api/artist/products/${p.id}`, { json: { title: 'Renamed vase ' + RUN } });
  assert.equal(title2.data.product.approval, 'pending');
  assert.equal((await get(`/p/${p.id}`)).status, 404);
  await admin('POST', `/api/admin/products/${p.id}`, { action: 'reject', note: 'Please add a clearer photo' });
  const rej = await c.req('GET', `/api/artist/products/${p.id}`);
  assert.equal(rej.data.product.approval, 'rejected');
  assert.equal(rej.data.product.approval_note, 'Please add a clearer photo');
  await admin('POST', `/api/admin/products/${p.id}`, { action: 'approve' });
  assert.equal((await get(`/p/${p.id}`)).status, 200);
  // draft is hidden even when approved
  await c.req('PUT', `/api/artist/products/${p.id}`, { json: { status: 'draft' } });
  assert.equal((await get(`/p/${p.id}`)).status, 404);
  await c.req('PUT', `/api/artist/products/${p.id}`, { json: { status: 'published' } });
  assert.equal((await get(`/p/${p.id}`)).status, 200);
  // suspending the artist hides everything
  await admin('POST', `/api/admin/artists/${me.id}`, { action: 'suspend', note: 'test' });
  assert.equal((await get(`/p/${p.id}`)).status, 404);
  assert.equal((await get(`/artists/${handle}`)).status, 404);
  await admin('POST', `/api/admin/artists/${me.id}`, { action: 'approve' });
  assert.equal((await get(`/artists/${handle}`)).status, 200);

  // delete removes images from R2
  const del = await c.req('DELETE', `/api/artist/products/${p.id}`);
  assert.equal(del.status, 200);
  assert.equal((await fetch(BASE + imgUrl)).status, 404);
  assert.equal((await get(`/p/${p.id}`)).status, 404);
});

test('image route only serves well-formed keys', async () => {
  for (const k of ['../etc/passwd', 'products/x/y.png', 'products/abc123/short.png', '%2e%2e/secret']) {
    assert.equal((await get('/img/' + k)).status, 404, k);
  }
});

test('avatar upload, password change, account deletion', async () => {
  const c = new Client();
  const s = await c.signup();
  const other = new Client();
  other.ip = c.ip;
  const l = await other.req('POST', '/api/auth/login', { json: { email: s.email, password: 'correct horse battery 7' } });
  other.csrf = l.data.csrf;
  assert.equal((await c.req('POST', '/api/artist/avatar', { form: pngForm(new TextEncoder().encode('GIF89a not really'), 'a.png') })).status, 415);
  const av = await c.req('POST', '/api/artist/avatar', { form: pngForm() });
  assert.equal(av.status, 200);
  assert.equal((await fetch(BASE + av.data.avatar_url)).status, 200);
  // wrong current password
  const w = await c.req('POST', '/api/auth/password', { json: { current_password: 'nope nope nope', new_password: 'another long passphrase 9' } });
  assert.equal(w.status, 400);
  const weak = await c.req('POST', '/api/auth/password', { json: { current_password: 'correct horse battery 7', new_password: 'short' } });
  assert.equal(weak.status, 400);
  const ok = await c.req('POST', '/api/auth/password', { json: { current_password: 'correct horse battery 7', new_password: 'another long passphrase 9' } });
  assert.equal(ok.status, 200);
  // the other session was invalidated
  assert.equal((await other.req('GET', '/api/artist/profile')).status, 401);
  // old password no longer works, new one does
  assert.equal((await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'correct horse battery 7' } })).status, 401);
  assert.equal((await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'another long passphrase 9' } })).status, 200);
  // delete account
  assert.equal((await c.req('DELETE', '/api/artist/account', { json: { password: 'wrong' } })).status, 400);
  assert.equal((await c.req('DELETE', '/api/artist/account', { json: { password: 'another long passphrase 9' } })).status, 200);
  assert.equal((await fetch(BASE + av.data.avatar_url)).status, 404);
  assert.equal((await new Client().req('POST', '/api/auth/login', { json: { email: s.email, password: 'another long passphrase 9' } })).status, 401);
});

test('existing waitlist endpoint still works', async () => {
  const r = await fetch(BASE + '/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'CF-Connecting-IP': nextIp() }, body: JSON.stringify({ email: `wl-${RUN}@example.com`, source: 'test' }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});
