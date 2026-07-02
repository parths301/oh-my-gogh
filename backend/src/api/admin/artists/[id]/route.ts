import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const artist = await brand.retrieveArtist(req.params.id)
  res.json({ artist })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const artist = await brand.updateArtists({
    id: req.params.id,
    ...(req.body as object),
  })
  res.json({ artist })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  await brand.deleteArtists([req.params.id])
  res.json({ id: req.params.id, deleted: true })
}
