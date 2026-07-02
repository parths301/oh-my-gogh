import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

const PostInput = z.object({
  title: z.string().min(1),
  handle: z.string().min(1),
  category: z.string().optional().default(""),
  read_time: z.string().optional().default(""),
  author: z.string().optional().default("Atelier OMG"),
  published_date: z.string().optional().default(""),
  excerpt: z.string().optional().default(""),
  body: z.string().optional().default(""),
  tint: z.string().optional().default("20,42,84"),
  image_url: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brand = req.scope.resolve("brand") as any
  const [posts, count] = await brand.listAndCountJournalPosts(
    {},
    { order: { created_at: "DESC" } }
  )
  res.json({ posts, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = PostInput.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid post", issues: parsed.error.issues })
  }
  const brand = req.scope.resolve("brand") as any
  const [post] = await brand.createJournalPosts([parsed.data])
  res.status(201).json({ post })
}
