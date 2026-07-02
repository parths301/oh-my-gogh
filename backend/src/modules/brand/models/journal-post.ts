import { model } from "@medusajs/framework/utils"

// Editorial content — the storefront "Journal".
// Migrated 1:1 from the old Supabase `journal_posts` table.
export const JournalPost = model.define("journal_post", {
  id: model.id({ prefix: "post" }).primaryKey(),
  title: model.text().searchable(),
  handle: model.text().unique(),
  category: model.text().default(""),
  read_time: model.text().default(""),
  author: model.text().default("Atelier OMG"),
  published_date: model.text().default(""),
  excerpt: model.text().default(""),
  body: model.text().default(""),
  tint: model.text().default("20,42,84"),
  image_url: model.text().nullable(),
  status: model.enum(["draft", "published"]).default("draft"),
})
