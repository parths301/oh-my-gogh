// GET  /api/artist/products   -> own listings (any state)
// POST /api/artist/products   -> create a listing (starts as approval "pending")
import { methods, json, readJson, ApiError } from '../../../_lib/http.js';
import { requireArtist } from '../../../_lib/auth.js';
import { validateProductInput, slugify } from '../../../_lib/validate.js';
import { randomId } from '../../../_lib/crypto.js';
import { rateLimit } from '../../../_lib/ratelimit.js';
import { fullProduct, productStatements } from '../../../_lib/products.js';

const MAX_PRODUCTS_PER_ARTIST = 100;

export const onRequest = methods({
  GET: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const { results } = await ctx.env.DB.prepare('SELECT * FROM products WHERE artist_id = ?1 ORDER BY created_at DESC LIMIT 200').bind(artist.id).all();
    const products = [];
    for (const row of results) products.push(await fullProduct(ctx.env.DB, row));
    return json({ ok: true, products });
  },
  POST: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    await rateLimit(db, 'product-create:' + artist.id, 30, 3600, { message: 'You are creating listings too quickly. Please try again later.' });
    const v = validateProductInput(await readJson(ctx.request));
    if (!v.ok) throw new ApiError(400, 'validation', 'Please fix the highlighted fields.', v.errors);
    const p = v.value;
    const count = await db.prepare('SELECT COUNT(*) AS n FROM products WHERE artist_id = ?1').bind(artist.id).first();
    if (count.n >= MAX_PRODUCTS_PER_ARTIST) throw new ApiError(409, 'limit', `You can have up to ${MAX_PRODUCTS_PER_ARTIST} listings.`);

    const id = randomId(10);
    const slug = (slugify(p.title, 50) || 'artwork') + '-' + id;
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          'INSERT INTO products (id, slug, artist_id, title, description, category, price_minor, currency, stock, edition_size, status, approval, created_at, updated_at) ' +
            "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12, ?12)"
        )
        .bind(id, slug, artist.id, p.title, p.description, p.category, p.price_minor, p.currency, p.stock, p.edition_size, p.status, now),
      ...productStatements(db, id, p.tags),
    ]);
    const row = await db.prepare('SELECT * FROM products WHERE id = ?1').bind(id).first();
    return json({ ok: true, product: await fullProduct(db, row) }, 201);
  },
});
