import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const [artist] = await brand.listArtists({
    handle: req.params.handle,
    status: "active",
  })
  if (!artist) {
    return res.status(404).json({ message: "Artist not found" })
  }
  res.json({ artist })
}
