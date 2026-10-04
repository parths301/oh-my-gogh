// DELETE /api/artist/products/:id/images/:imageId
// POST   /api/artist/products/:id/images/:imageId   { action: "cover" }  -> move to the first position
import { methods, json, readJson, ApiError } from '../../../../../_lib/http.js';
import { requireArtist } from '../../../../../_lib/auth.js';
import { ownedProduct, getImages } from '../../../../../_lib/products.js';
import { deleteImages } from '../../../../../_lib/images.js';

async function load(ctx) {
  const { artist } = await requireArtist(ctx);
  const db = ctx.env.DB;
  const product = await ownedProduct(db, artist.id, ctx.params.id);
  if (!product) throw new ApiError(404, 'not_found', 'Listing not found.');
  const imageId = String(ctx.params.imageId || '');
  const image = /^i_[a-z0-9]{12}$/.test(imageId)
    ? await db.prepare('SELECT * FROM product_images WHERE id = ?1 AND product_id = ?2').bind(imageId, product.id).first()
    : null;
  if (!image) throw new ApiError(404, 'not_found', 'Image not found.');
  return { db, product, image };
}

export const onRequest = methods({
  DELETE: async (ctx) => {
    const { db, product, image } = await load(ctx);
    await db.prepare('DELETE FROM product_images WHERE id = ?1 AND product_id = ?2').bind(image.id, product.id).run();
    if (ctx.env.IMAGES) await deleteImages(ctx.env.IMAGES, [image.r2_key]);
    return json({ ok: true, images: await getImages(db, product.id) });
  },
  POST: async (ctx) => {
    const { db, product, image } = await load(ctx);
    const body = await readJson(ctx.request);
    if (body.action !== 'cover') throw new ApiError(400, 'validation', 'Unknown action.');
    await db
      .prepare('UPDATE product_images SET position = (SELECT MIN(position) - 1 FROM product_images WHERE product_id = ?1) WHERE id = ?2 AND product_id = ?1')
      .bind(product.id, image.id)
      .run();
    return json({ ok: true, images: await getImages(db, product.id) });
  },
});
