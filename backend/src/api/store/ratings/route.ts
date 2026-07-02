import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Batch rating summaries for product cards: /store/ratings?product_ids=a,b,c
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviews = req.scope.resolve("review") as any
  const ids = String(req.query.product_ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)
  if (!ids.length) return res.json({ ratings: {} })
  const ratings = await reviews.getProductRatings(ids)
  res.json({ ratings })
}
