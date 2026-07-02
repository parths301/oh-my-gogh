import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const UpdateReview = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateReview.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "status must be pending|approved|rejected" })
  }
  const reviews = req.scope.resolve("review") as any
  const review = await reviews.updateReviews({
    id: req.params.id,
    status: parsed.data.status,
  })
  res.json({ review })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const reviews = req.scope.resolve("review") as any
  await reviews.deleteReviews([req.params.id])
  res.json({ id: req.params.id, deleted: true })
}
