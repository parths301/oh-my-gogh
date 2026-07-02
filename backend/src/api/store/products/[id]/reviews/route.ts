import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const CreateReview = z.object({
  display_name: z.string().min(1).max(80),
  email: z.string().email().optional().default(""),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(140).optional().default(""),
  body: z.string().max(4000).optional().default(""),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const reviews = req.scope.resolve("review") as any
  const productId = req.params.id
  const [list, ratings] = await Promise.all([
    reviews.listReviews(
      { product_id: productId, status: "approved" },
      { order: { created_at: "DESC" }, take: 50 }
    ),
    reviews.getProductRatings([productId]),
  ])
  res.json({
    reviews: list.map((r: any) => ({
      id: r.id,
      display_name: r.display_name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      created_at: r.created_at,
    })),
    rating: ratings[productId] || { count: 0, average: 0 },
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = CreateReview.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid review", issues: parsed.error.issues })
  }
  const reviews = req.scope.resolve("review") as any
  const customerId = req.auth_context?.actor_id || null

  // one review per product per signed-in customer
  if (customerId) {
    const existing = await reviews.listReviews({
      product_id: req.params.id,
      customer_id: customerId,
    })
    if (existing.length) {
      return res.status(409).json({ message: "You already reviewed this piece" })
    }
  }

  const [review] = await reviews.createReviews([
    {
      product_id: req.params.id,
      customer_id: customerId,
      ...parsed.data,
      status: "pending",
    },
  ])
  res.status(201).json({
    review: { id: review.id, status: review.status },
    message: "Thanks — your review is awaiting moderation.",
  })
}
