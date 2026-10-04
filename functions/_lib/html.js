// Server-side rendering helpers. Everything dynamic goes through esc(), and the CSP
// (script-src 'self', no inline script/style) is a second line of defence.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]);

/** Escape text and keep paragraph breaks. */
export function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** Only ever allows http(s) URLs into href attributes. */
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '#';
  } catch {
    return '#';
  }
}

export function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function formatPrice(minor, currency) {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function titleCase(s) {
  return String(s || '').replace(/(^|[\s/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Full page shell matching the waitlist site (same CSS, fonts, header and footer). */
export function page({ title, description, canonical, body, robots = 'index,follow', ogImage, head = '' }) {
  const t = esc(title);
  const d = esc(description || 'Oh my Gogh! is an art lifestyle brand and a home for independent artists.');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t}</title>
  <meta name="description" content="${d}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <meta name="robots" content="${esc(robots)}">
  <meta name="theme-color" content="#15315C">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Oh my Gogh!">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/playfair.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/space-grotesk.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/waitlist.css">
  <link rel="stylesheet" href="/css/marketplace.css">
  ${head}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  ${siteHeader()}
  <main id="main">
${body}
  </main>
  ${siteFooter()}
</body>
</html>`;
}

export function siteHeader() {
  return `<header class="top">
    <div class="wrap">
      <a class="brand" href="/" aria-label="Oh my Gogh! home">
        <img src="/assets/omg-emblem-240.webp" width="40" height="40" alt="">
        <span>Oh my Gogh!</span>
      </a>
      <nav class="mainnav" aria-label="Main">
        <a href="/shop">Shop</a>
        <a href="/artists">Artists</a>
        <a href="/signup">Sell with us</a>
        <a class="top-link" href="/login">Artist log in</a>
      </nav>
    </div>
  </header>`;
}

export function siteFooter() {
  return `<footer class="foot">
    <div class="wrap">
      <p>&copy; 2026 Oh my Gogh!</p>
      <nav aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/terms#sellers">Seller terms</a>
      </nav>
    </div>
  </footer>`;
}
