import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const posts = await brand.listJournalPosts(
    { status: "published" },
    { order: { created_at: "DESC" } }
  )
  res.json({ posts })
}
