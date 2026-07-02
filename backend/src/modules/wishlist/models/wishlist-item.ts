import { model } from "@medusajs/framework/utils"

// One saved product per row, per customer. The storefront keeps a
// localStorage copy for guests and syncs it here after sign-in.
export const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wli" }).primaryKey(),
    customer_id: model.text().index(),
    product_id: model.text(),
  })
  .indexes([{ on: ["customer_id", "product_id"], unique: true }])
