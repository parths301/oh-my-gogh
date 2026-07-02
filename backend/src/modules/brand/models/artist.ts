import { model } from "@medusajs/framework/utils"

// Collaborating artists — the "Artists" section of the storefront.
// Migrated 1:1 from the old Supabase `artists` table.
export const Artist = model.define("artist", {
  id: model.id({ prefix: "artist" }).primaryKey(),
  name: model.text().searchable(),
  handle: model.text().unique(),
  medium: model.text().default(""),
  location: model.text().default(""),
  tint: model.text().default("20,42,84"),
  quote: model.text().default(""),
  bio: model.text().default(""),
  instagram: model.text().default(""),
  portfolio: model.text().default(""),
  image_url: model.text().nullable(),
  featured: model.boolean().default(false),
  status: model.enum(["active", "inactive"]).default("active"),
})
