// GET /api/admin/products?approval=pending|approved|rejected|all   (drafts are included so nothing hides from review)
import { methods, json, requireBinding } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/admin.js';
import { fullProduct } from '../../../_lib/products.js';

export const onRequest = methods({
  GET: async (ctx) => {
    await requireAdmin(ctx);
    const db = requireBinding(ctx.env, 'DB');
    const approval = new URL(ctx.request.url).searchParams.get('approval') || 'pending';
    const valid = ['pending', 'approved', 'rejected'].includes(approval);
    const { results } = await db
      .prepare(
        `SELECT p.*, a.name AS artist_name, a.handle AS artist_handle, a.status AS artist_status FROM products p JOIN artists a ON a.id = p.artist_id
         ${valid ? 'WHERE p.approval = ?1' : "WHERE ?1 = 'all'"} ORDER BY p.created_at DESC LIMIT 200`
      )
      .bind(valid ? approval : 'all')
      .all();
    const products = [];
    for (const r of results) {
      products.push({ ...(await fullProduct(db, r)), artist_name: r.artist_name, artist_handle: r.artist_handle, artist_status: r.artist_status });
    }
    return json({ ok: true, products });
  },
});
