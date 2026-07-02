import { MedusaService } from "@medusajs/framework/utils"
import { Review } from "./models/review"

class ReviewModuleService extends MedusaService({ Review }) {
  // Average rating + count of approved reviews, per product.
  async getProductRatings(productIds: string[]) {
    const reviews = await this.listReviews(
      { product_id: productIds, status: "approved" },
      { select: ["product_id", "rating"], take: null }
    )
    const byProduct: Record<string, { count: number; average: number }> = {}
    for (const r of reviews) {
      const agg = (byProduct[r.product_id] ||= { count: 0, average: 0 })
      agg.average += r.rating
      agg.count += 1
    }
    for (const id of Object.keys(byProduct)) {
      byProduct[id].average =
        Math.round((byProduct[id].average / byProduct[id].count) * 10) / 10
    }
    return byProduct
  }
}

export default ReviewModuleService
