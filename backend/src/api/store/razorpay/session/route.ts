import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "zod"

const Input = z.object({ cart_id: z.string().min(1) })

/**
 * Creates (or refreshes) a Razorpay payment session for a cart.
 *
 * The stock /store/payment-collections/:id/payment-sessions route doesn't
 * accept a provider `context`, but @sgftech/payment-razorpay needs the cart
 * as `context.extra` to build the Razorpay order. This route loads the cart
 * server-side (client input is just the id — nothing about it is trusted)
 * and runs the same core workflow with the context attached.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = Input.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "cart_id required" })
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "currency_code",
      "total",
      "completed_at",
      "metadata",
      "billing_address.*",
      "shipping_address.*",
      "customer.*",
      "items.*",
      "payment_collection.id",
    ],
    filters: { id: parsed.data.cart_id },
  })
  if (!cart || cart.completed_at) {
    return res.status(400).json({ message: "cart not found or already completed" })
  }

  let paymentCollectionId = (cart as any).payment_collection?.id
  if (!paymentCollectionId) {
    const { result } = await createPaymentCollectionForCartWorkflow(req.scope).run({
      input: { cart_id: cart.id },
    })
    paymentCollectionId = result.id
  }

  // Razorpay needs a contact number to create its customer/order
  const phone =
    (cart as any).billing_address?.phone ||
    (cart as any).shipping_address?.phone ||
    (cart as any).customer?.phone
  if (!phone) {
    return res
      .status(400)
      .json({ message: "A phone number is required for Razorpay checkout" })
  }

  try {
    await createPaymentSessionsWorkflow(req.scope).run({
      input: {
        payment_collection_id: paymentCollectionId,
        provider_id: "pp_razorpay_razorpay",
        customer_id: (cart as any).customer?.id,
        data: {},
        context: { extra: cart } as any,
      },
    })
  } catch (e: any) {
    return res.status(502).json({
      message: "Could not start the Razorpay payment: " + (e?.message || "unknown"),
    })
  }

  const {
    data: [collection],
  } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "payment_sessions.id", "payment_sessions.provider_id", "payment_sessions.data"],
    filters: { id: paymentCollectionId },
  })
  const session = (collection.payment_sessions || []).find(
    (s: any) => s.provider_id === "pp_razorpay_razorpay"
  )
  res.json({ payment_collection_id: paymentCollectionId, session })
}
