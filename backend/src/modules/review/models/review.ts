import { model } from "@medusajs/framework/utils"

// Product reviews. Guests may submit (name + email required); everything
// lands as "pending" and only "approved" reviews are served to the store.
export const Review = model.define("review", {
  id: model.id({ prefix: "rev" }).primaryKey(),
  product_id: model.text().index(),
  customer_id: model.text().nullable(),
  display_name: model.text(),
  email: model.text().default(""),
  rating: model.number(), // 1..5, validated at the API layer
  title: model.text().default(""),
  body: model.text().default(""),
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
})
