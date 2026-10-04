// Public page fragments (cards, filters) rendered on the server. Every dynamic value goes through esc().
import { esc, formatPrice, titleCase, initials } from './html.js';

export const PUBLIC_PRODUCT_WHERE = "p.status = 'published' AND p.approval = 'approved' AND a.status = 'approved'";
export const PAGE_SIZE = 24;

const SWATCHES = ['sw-gold', 'sw-teal', 'sw-clay', 'sw-navy'];
const swatch = (seed) => SWATCHES[[...String(seed)].reduce((n, c) => n + c.charCodeAt(0), 0) % SWATCHES.length];

export function productCard(p) {
  const media = p.cover
    ? `<img src="/img/${esc(p.cover)}" alt="${esc(p.title)}" width="600" height="600" loading="lazy">`
    : `<span class="ph ${swatch(p.id)}" aria-hidden="true"></span>`;
  const sold = p.stock === 0 ? '<span class="badge badge-sold">Sold out</span>' : '';
  return `<li class="pcard">
    <a class="pcard-link" href="/p/${esc(p.slug)}">
      <span class="pcard-media">${media}${sold}</span>
      <span class="pcard-title">${esc(p.title)}</span>
    </a>
    <span class="pcard-meta"><a href="/artists/${esc(p.artist_handle)}">${esc(p.artist_name)}</a><span class="price">${esc(formatPrice(p.price_minor, p.currency))}</span></span>
  </li>`;
}

export function artistCard(a) {
  const media = a.avatar_key
    ? `<img src="/img/${esc(a.avatar_key)}" alt="" width="96" height="96" loading="lazy">`
    : `<span class="ph ph-round ${swatch(a.id)}" aria-hidden="true">${esc(initials(a.name))}</span>`;
  return `<li class="acard">
    <a href="/artists/${esc(a.handle)}">
      <span class="acard-media">${media}</span>
      <span class="acard-name">${esc(a.name)}</span>
      <span class="acard-meta">${esc([a.category ? titleCase(a.category) : '', a.location].filter(Boolean).join(' \u00b7 '))}</span>
    </a>
  </li>`;
}

export function tagLinks(tags) {
  if (!tags.length) return '';
  return `<ul class="tags" aria-label="Tags">${tags.map((t) => `<li><a href="/shop?tag=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>`;
}

/** Escape a user search string for use inside a LIKE pattern with ESCAPE '\'. */
export function likePattern(q) {
  return '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}
