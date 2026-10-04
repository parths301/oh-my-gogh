// POST /api/artist/products/:id/images   multipart/form-data, field "file". Max 6 images, 5 MB each, JPEG/PNG/WebP.
import { methods, json, requireBinding, ApiError } from '../../../../../_lib/http.js';
import { requireArtist } from '../../../../../_lib/auth.js';
import { ownedProduct, getImages } from '../../../../../_lib/products.js';
import { readUpload, newImageKey, putImage, deleteImages, MAX_PRODUCT_IMAGE_BYTES } from '../../../../../_lib/images.js';
import { rateLimit } from '../../../../../_lib/ratelimit.js';
import { randomId } from '../../../../../_lib/crypto.js';
import { MAX_IMAGES } from '../../../../../_lib/validate.js';

export const onRequest = methods({
  POST: async (ctx) => {
    const { artist } = await requireArtist(ctx);
    const db = ctx.env.DB;
    const bucket = requireBinding(ctx.env, 'IMAGES');
    const product = await ownedProduct(db, artist.id, ctx.params.id);
    if (!product) throw new ApiError(404, 'not_found', 'Listing not found.');
    await rateLimit(db, 'upload:' + artist.id, 40, 3600, { message: 'Too many uploads. Please try again later.' });

    const existing = await db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?1').bind(product.id).first();
    if (existing.n >= MAX_IMAGES) throw new ApiError(409, 'limit', `A listing can have up to ${MAX_IMAGES} images.`);

    const { bytes, contentType } = await readUpload(ctx.request, MAX_PRODUCT_IMAGE_BYTES);
    const key = newImageKey('products', product.id, contentType);
    await putImage(bucket, key, bytes, contentType);

    const now = new Date().toISOString();
    // Conditional insert keeps the 6-image cap correct even with parallel uploads.
    const res = await db
      .prepare(
        'INSERT INTO product_images (id, product_id, r2_key, content_type, bytes, position, created_at) ' +
          'SELECT ?1, ?2, ?3, ?4, ?5, COALESCE((SELECT MAX(position) + 1 FROM product_images WHERE product_id = ?2), 0), ?6 ' +
          'WHERE (SELECT COUNT(*) FROM product_images WHERE product_id = ?2) < ?7'
      )
      .bind('i_' + randomId(12), product.id, key, contentType, bytes.length, now, MAX_IMAGES)
      .run();
    if (!res.meta || res.meta.changes !== 1) {
      await deleteImages(bucket, [key]);
      throw new ApiError(409, 'limit', `A listing can have up to ${MAX_IMAGES} images.`);
    }
    // New public content: an approved or rejected listing goes back to the review queue.
    if (product.approval !== 'pending') {
      await db.prepare("UPDATE products SET approval = 'pending', approval_note = '', updated_at = ?1 WHERE id = ?2").bind(now, product.id).run();
    }
    return json({ ok: true, images: await getImages(db, product.id) }, 201);
  },
});
