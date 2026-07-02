import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const artists = await brand.listArtists(
    { status: "active" },
    { order: { featured: "DESC", created_at: "ASC" } }
  )
  res.json({ artists })
}
