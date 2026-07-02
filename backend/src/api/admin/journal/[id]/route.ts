import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const post = await brand.retrieveJournalPost(req.params.id)
  res.json({ post })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const post = await brand.updateJournalPosts({
    id: req.params.id,
    ...(req.body as object),
  })
  res.json({ post })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  await brand.deleteJournalPosts([req.params.id])
  res.json({ id: req.params.id, deleted: true })
}
