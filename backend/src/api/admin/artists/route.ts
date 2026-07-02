import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const ArtistInput = z.object({
  name: z.string().min(1),
  handle: z.string().min(1),
  medium: z.string().optional().default(""),
  location: z.string().optional().default(""),
  tint: z.string().optional().default("20,42,84"),
  quote: z.string().optional().default(""),
  bio: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  portfolio: z.string().optional().default(""),
  image_url: z.string().nullable().optional(),
  featured: z.boolean().optional().default(false),
  status: z.enum(["active", "inactive"]).optional().default("active"),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const [artists, count] = await brand.listAndCountArtists(
    {},
    { order: { created_at: "ASC" } }
  )
  res.json({ artists, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ArtistInput.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid artist", issues: parsed.error.issues })
  }
  const brand = req.scope.resolve("brand") as any
  const [artist] = await brand.createArtists([parsed.data])
  res.status(201).json({ artist })
}
