import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

const THRESHOLD = Number(process.env.LOW_INVENTORY_THRESHOLD || 5)

/**
 * Daily low-stock digest: emails the studio when any variant's available
 * quantity falls to the threshold or below (including sold out).
 */
export default async function lowInventoryAlertJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const { data: levels } = await query.graph({
    entity: "inventory_level",
    fields: [
      "available_quantity",
      "stocked_quantity",
      "inventory_item.sku",
    ],
  })

  const low = levels.filter(
    (l: any) => Number(l.available_quantity ?? l.stocked_quantity) <= THRESHOLD
  )
  if (!low.length) return

  const to = process.env.STORE_ALERT_EMAIL || "parth@ohmygogh.com"
  const rows = low
    .map(
      (l: any) =>
        `<tr><td style="padding:4px 12px 4px 0">${l.inventory_item?.sku || "?"}</td>` +
        `<td style="text-align:right">${l.available_quantity ?? l.stocked_quantity}</td></tr>`
    )
    .join("")

  await notifications.createNotifications({
    to,
    channel: "email",
    template: "low-inventory",
    data: {
      subject: `Oh my Gogh! — ${low.length} piece(s) low on stock`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#15315C">
          <h1 style="font-size:22px">Low stock in the studio</h1>
          <table style="border-collapse:collapse">${rows}</table>
          <p style="color:#888;font-size:12px">Threshold: ≤ ${THRESHOLD}. Restock or unpublish from the admin.</p>
        </div>`,
    },
  })
  logger.info(`[low-inventory] alert sent (${low.length} variant(s) ≤ ${THRESHOLD})`)
}

export const config = {
  name: "low-inventory-alert",
  schedule: "0 6 * * *", // daily 06:00
}
