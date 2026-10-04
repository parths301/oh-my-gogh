// GET    /api/artist/products/:id
// PUT    /api/artist/products/:id    partial update. Editing the public content (title, description,
//                                    category, tags) of an approved or rejected listing sends it back to "pending".
// DELETE /api/artist/products/:id    removes the listing and its images
import { methods, json, readJson, ApiError } from '../../../../_lib/http.js';
import { requireArtist } from '../../../../_lib/auth.js';
import { validateProductInput } from '../../../../_lib/validate.js';
import { fullProduct, ownedProduct, productStatements, getTags } from '../../../../_lib/products.js';
import { deleteImages } from '../../../../_lib/images.js';

export const onRequest = methods({
  GET: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const row = await ownedProduct(ctx.env.DB, artist.id, ctx.params.id);
    if (!row) throw new ApiError(404, 'not_found', 'Listing not found.');
    return json({ ok: true, product: await fullProduct(ctx.env.DB, row) });
  },
  PUT: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    const row = await ownedProduct(db, artist.id, ctx.params.id);
    if (!row) throw new ApiError(404, 'not_found', 'Listing not found.');
    const body = await readJson(ctx.request);
    // Validate against the merged result so cross-field rules (stock vs edition) and price/currency hold.
    const merged = {
      title: body.title ?? row.title,
      description: body.description ?? row.description,
      category: body.category ?? row.category,
      tags: body.tags ?? (await getTags(db, 'product_tags', 'product_id', row.id)),
      currency: body.currency ?? row.currency,
      price: body.price ?? (row.price_minor / 100).toFixed(2),
      stock: body.stock ?? row.stock,
      edition_size: body.edition_size === undefined ? row.edition_size : body.edition_size,
      status: body.status ?? row.status,
    };
    const v = validateProductInput(merged);
    if (!v.ok) throw new ApiError(400, 'validation', 'Please fix the highlighted fields.', v.errors);
    const p = v.value;
    const oldTags = await getTags(db, 'product_tags', 'product_id', row.id);
    const contentChanged =
      p.title !== row.title || p.description !== row.description || p.category !== row.category || p.tags.slice().sort().join('|') !== oldTags.join('|');
    let approval = row.approval;
    let note = row.approval_note;
    if (contentChanged && row.approval !== 'pending') {
      approval = 'pending';
      note = '';
    }
    await db.batch([
      db
        .prepare(
          'UPDATE products SET title = ?1, description = ?2, category = ?3, price_minor = ?4, currency = ?5, stock = ?6, edition_size = ?7, status = ?8, approval = ?9, approval_note = ?10, updated_at = ?11 WHERE id = ?12 AND artist_id = ?13'
        )
        .bind(p.title, p.description, p.category, p.price_minor, p.currency, p.stock, p.edition_size, p.status, approval, note, new Date().toISOString(), row.id, artist.id),
      ...productStatements(db, row.id, p.tags),
    ]);
    const fresh = await db.prepare('SELECT * FROM products WHERE id = ?1').bind(row.id).first();
    return json({ ok: true, product: await fullProduct(db, fresh) });
  },
  DELETE: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    const row = await ownedProduct(db, artist.id, ctx.params.id);
    if (!row) throw new ApiError(404, 'not_found', 'Listing not found.');
    const { results } = await db.prepare('SELECT r2_key FROM product_images WHERE product_id = ?1').bind(row.id).all();
    await db.batch([
      db.prepare('DELETE FROM product_images WHERE product_id = ?1').bind(row.id),
      db.prepare('DELETE FROM product_tags WHERE product_id = ?1').bind(row.id),
      db.prepare('DELETE FROM products WHERE id = ?1 AND artist_id = ?2').bind(row.id, artist.id),
    ]);
    if (ctx.env.IMAGES) await deleteImages(ctx.env.IMAGES, results.map((r) => r.r2_key));
    return json({ ok: true });
  },
});
