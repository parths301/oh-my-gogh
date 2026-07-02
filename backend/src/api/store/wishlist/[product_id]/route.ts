import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const wishlist = req.scope.resolve("wishlist") as any
  const customerId = req.auth_context.actor_id
  const existing = await wishlist.listWishlistItems({
    customer_id: customerId,
    product_id: req.params.product_id,
  })
  if (existing.length) {
    await wishlist.deleteWishlistItems(existing.map((i: any) => i.id))
  }
  const items = await wishlist.listWishlistItems({ customer_id: customerId })
  res.json({ items: items.map((i: any) => i.product_id) })
}
