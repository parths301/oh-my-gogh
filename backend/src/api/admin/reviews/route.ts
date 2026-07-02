import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviews = req.scope.resolve("review") as any
  const status = req.query.status as string | undefined
  const [list, count] = await reviews.listAndCountReviews(
    status ? { status } : {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ reviews: list, count })
}
