import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Abandoned-cart recovery: every hour, find carts that have an email +
 * items, were last touched 1–48 hours ago, aren't completed, and haven't
 * been nudged yet — then send a reminder email (once per cart).
 */
export default async function abandonedCartJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule = container.resolve(Modules.CART)
  const notifications = container.resolve(Modules.NOTIFICATION)

  const now = Date.now()
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "updated_at",
      "completed_at",
      "metadata",
      "items.id",
      "items.title",
    ],
    filters: {
      updated_at: { $lt: oneHourAgo, $gt: twoDaysAgo },
    },
  })

  let sent = 0
  for (const cart of carts) {
    if (!cart.email || cart.completed_at) continue
    if (!cart.items?.length) continue
    if ((cart.metadata as any)?.abandoned_email_sent) continue

    const first = cart.items[0]?.title || "your pieces"
    await notifications.createNotifications({
      to: cart.email,
      channel: "email",
      template: "abandoned-cart",
      data: {
        subject: "Your bag at Oh my Gogh! is still waiting",
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#15315C">
            <h1 style="font-size:24px">Still thinking it over?</h1>
            <p>${first} is still in your studio bag. Small-batch pieces sell
            through quickly — come back before your size wanders off.</p>
            <p><a href="${process.env.STOREFRONT_URL || "https://ohmygogh.com"}"
              style="color:#C0561E">Return to your bag →</a></p>
            <p style="color:#888;font-size:12px">Oh my Gogh! · You're getting this because you started a checkout.</p>
          </div>`,
      },
    })
    await cartModule.updateCarts(cart.id, {
      metadata: { ...(cart.metadata as object), abandoned_email_sent: true },
    })
    sent++
  }
  if (sent) logger.info(`[abandoned-cart] sent ${sent} recovery email(s)`)
}

export const config = {
  name: "abandoned-cart-recovery",
  schedule: "0 * * * *", // hourly
}
