import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const [post] = await brand.listJournalPosts({
    handle: req.params.handle,
    status: "published",
  })
  if (!post) {
    return res.status(404).json({ message: "Post not found" })
  }
  res.json({ post })
}
