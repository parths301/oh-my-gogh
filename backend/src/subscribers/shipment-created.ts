import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Sends the "your order shipped" email, with tracking numbers when present.
export default async function shipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const {
    data: [fulfillment],
  } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "labels.tracking_number", "order.display_id", "order.email"],
    filters: { id: data.id },
  })
  const order = (fulfillment as any)?.order
  if (!order?.email) return

  const tracking = (fulfillment.labels || [])
    .map((l: any) => l.tracking_number)
    .filter(Boolean)
    .join(", ")

  await notifications.createNotifications({
    to: order.email,
    channel: "email",
    template: "shipment-created",
    data: {
      subject: `Oh my Gogh! — order #${order.display_id} has shipped`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#15315C">
          <h1 style="font-size:26px">Your order is on the move 🎨</h1>
          <p>Order #${order.display_id} just left the studio.</p>
          ${tracking ? `<p><strong>Tracking:</strong> ${tracking}</p>` : ""}
          <p style="color:#888;font-size:12px">Oh my Gogh! · Made with too much paint.</p>
        </div>`,
    },
  })
  logger.info(`[email] shipment email queued for ${order.email} (#${order.display_id})`)
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
