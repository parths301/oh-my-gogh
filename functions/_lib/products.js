// Shared product/artist data access. All SQL is parameterised (bind), never string-built from input.
import { safeJson } from './auth.js';

export async function getTags(db, table, idColumn, id) {
  const { results } = await db.prepare(`SELECT tag FROM ${table} WHERE ${idColumn} = ?1 ORDER BY tag`).bind(id).all();
  return results.map((r) => r.tag);
}

// table / idColumn above are only ever literals from this codebase, never user input.

export async function getImages(db, productId) {
  const { results } = await db
    .prepare('SELECT id, r2_key, content_type, bytes, position FROM product_images WHERE product_id = ?1 ORDER BY position, created_at')
    .bind(productId)
    .all();
  return results.map((r) => ({ id: r.id, url: '/img/' + r.r2_key, content_type: r.content_type, bytes: r.bytes }));
}

export function productStatements(db, productId, tags) {
  const stmts = [db.prepare('DELETE FROM product_tags WHERE product_id = ?1').bind(productId)];
  for (const t of tags) stmts.push(db.prepare('INSERT INTO product_tags (product_id, tag) VALUES (?1, ?2)').bind(productId, t));
  return stmts;
}

export function artistTagStatements(db, artistId, tags) {
  const stmts = [db.prepare('DELETE FROM artist_tags WHERE artist_id = ?1').bind(artistId)];
  for (const t of tags) stmts.push(db.prepare('INSERT INTO artist_tags (artist_id, tag) VALUES (?1, ?2)').bind(artistId, t));
  return stmts;
}

/** Product shape sent to the owning artist (and to the admin). */
export async function fullProduct(db, row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: await getTags(db, 'product_tags', 'product_id', row.id),
    price_minor: row.price_minor,
    currency: row.currency,
    stock: row.stock,
    edition_size: row.edition_size,
    status: row.status,
    approval: row.approval,
    approval_note: row.approval_note,
    images: await getImages(db, row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function ownedProduct(db, artistId, id) {
  if (typeof id !== 'string' || !/^[a-z0-9]{6,20}$/.test(id)) return null;
  return db.prepare('SELECT * FROM products WHERE id = ?1 AND artist_id = ?2').bind(id, artistId).first();
}

export { safeJson };
