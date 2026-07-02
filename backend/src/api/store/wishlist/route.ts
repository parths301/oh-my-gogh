import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const AddItem = z.object({ product_id: z.string().min(1) })

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const wishlist = req.scope.resolve("wishlist") as any
  const items = await wishlist.listWishlistItems({
    customer_id: req.auth_context.actor_id,
  })
  res.json({ items: items.map((i: any) => i.product_id) })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = AddItem.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "product_id required" })
  }
  const wishlist = req.scope.resolve("wishlist") as any
  const customerId = req.auth_context.actor_id
  const existing = await wishlist.listWishlistItems({
    customer_id: customerId,
    product_id: parsed.data.product_id,
  })
  if (!existing.length) {
    await wishlist.createWishlistItems([
      { customer_id: customerId, product_id: parsed.data.product_id },
    ])
  }
  const items = await wishlist.listWishlistItems({ customer_id: customerId })
  res.status(201).json({ items: items.map((i: any) => i.product_id) })
}
