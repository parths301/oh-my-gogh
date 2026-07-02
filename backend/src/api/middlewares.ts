import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    // wishlist is per-customer — require a signed-in customer
    {
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // reviews: allow guests, but attach the customer when signed in
    {
      matcher: "/store/products/:id/reviews",
      method: "POST",
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
  ],
})
