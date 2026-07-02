import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Sends the order confirmation email when checkout completes.
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "items.*",
      "shipping_address.*",
    ],
    filters: { id: data.id },
  })
  if (!order?.email) return

  const lines = (order.items || [])
    .map((i: any) => {
      const qty = Number(i.quantity) || 1
      const unit = Number(i.unit_price) || 0
      return (
        `<tr><td style="padding:6px 12px 6px 0">${i.title} × ${qty}</td>` +
        `<td style="padding:6px 0;text-align:right">₹${Math.round(unit * qty)}</td></tr>`
      )
    })
    .join("")

  await notifications.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-placed",
    data: {
      subject: `Oh my Gogh! — order #${order.display_id} confirmed`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#15315C">
          <h1 style="font-size:26px">Oh my Gogh — it's on its way!</h1>
          <p>Hi ${order.shipping_address?.first_name || "there"}, thanks for your order.
          We're wrapping your pieces in acid-free tissue and a thank-you note.</p>
          <table style="width:100%;border-collapse:collapse;margin:18px 0">${lines}</table>
          <p style="font-size:18px"><strong>Total: ₹${Math.round(order.total)}</strong></p>
          <p>You'll get another email with tracking as soon as your order ships.</p>
          <p style="color:#888;font-size:12px">Order #${order.display_id} · Oh my Gogh! · Made with too much paint.</p>
        </div>`,
    },
  })
  logger.info(`[email] order confirmation queued for ${order.email} (#${order.display_id})`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
