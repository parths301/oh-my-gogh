/**
 * One-time migration: Supabase (legacy) → Medusa.
 *
 * Reads the JSON table exports produced from the old Supabase project
 * (products, artists, journal_posts, collections, discounts, customers,
 * orders, order_items, settings) and recreates everything natively in
 * Medusa: store, region, shipping, categories, products+variants+inventory,
 * promotions, customers, historical orders, and the brand-content module
 * rows (artists + journal).
 *
 * Run:  npx medusa exec ./src/scripts/migrate-from-supabase.ts
 * Env:  OMG_EXPORT_DIR — dir with the *.json exports
 *       (default ../.secrets/supabase-export, relative to backend/)
 *
 * Resumable: every stage first checks whether its rows already exist and
 * skips creation if so, so a failed run can simply be re-executed.
 */
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createCustomersWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"

const COUNTRIES = ["in", "se", "us", "jp", "mx", "ie", "gb", "de", "fr", "es", "it", "dk"]
const FREE_SHIPPING_OVER = 2000 // ₹ — matches the old /api/config
const FLAT_SHIPPING = 99
const EXPRESS_SHIPPING = 299
const SALES_CHANNEL_NAME = "Oh my Gogh Storefront"
const STOCK_LOCATION_NAME = "Oh my Gogh Studio"

const handleFor = (name: string) =>
  String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics: É -> E
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export default async function migrateFromSupabase({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const exportDir =
    process.env.OMG_EXPORT_DIR ||
    path.resolve(process.cwd(), "../.secrets/supabase-export")
  const read = (t: string) =>
    JSON.parse(fs.readFileSync(path.join(exportDir, `${t}.json`), "utf8"))

  const sb = {
    products: read("products"),
    artists: read("artists"),
    journal: read("journal_posts"),
    collections: read("collections"),
    discounts: read("discounts"),
    customers: read("customers"),
    orders: read("orders"),
    orderItems: read("order_items"),
    settings: read("settings")[0] || {},
  }

  // --- sales channel / publishable key / store ---------------------------
  let { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: SALES_CHANNEL_NAME },
  })
  let salesChannel: any = channels[0]
  if (!salesChannel) {
    logger.info("Creating sales channel…")
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          { name: SALES_CHANNEL_NAME, description: "ohmygogh.com storefront" },
        ],
      },
    })
    salesChannel = result[0]
  }

  // NB: filter by title — Medusa seeds its own "Default Publishable API Key"
  // on a fresh database, which is linked to the default sales channel, not ours.
  let { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title", "type"],
    filters: { type: "publishable", title: "Storefront" },
  })
  let publishableKey: any = keys[0]
  if (!publishableKey) {
    logger.info("Creating publishable API key…")
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Storefront", type: "publishable", created_by: "" }],
      },
    })
    publishableKey = result[0]
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    })
  }

  const { data: stores } = await query.graph({ entity: "store", fields: ["id"] })
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: stores[0].id },
      update: {
        name: sb.settings.store || "Oh my Gogh!",
        supported_currencies: [{ currency_code: "inr", is_default: true }],
        default_sales_channel_id: salesChannel.id,
        metadata: {
          support_email: sb.settings.email || "parth@ohmygogh.com",
          free_shipping_over: FREE_SHIPPING_OVER,
          flat_shipping: FLAT_SHIPPING,
          express_shipping: EXPRESS_SHIPPING,
        },
      },
    },
  })

  // --- region + tax regions ----------------------------------------------
  let { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
    filters: { name: "India & Worldwide" },
  })
  let region: any = regions[0]
  if (!region) {
    logger.info("Creating region…")
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India & Worldwide",
            currency_code: "inr",
            countries: COUNTRIES,
            payment_providers: ["pp_razorpay_razorpay", "pp_system_default"],
          },
        ],
      },
    })
    region = result[0]
  }

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
  })
  if (taxRegions.length === 0) {
    logger.info("Creating tax regions…")
    await createTaxRegionsWorkflow(container).run({
      input: COUNTRIES.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    })
  }

  // --- stock location + fulfillment + shipping options --------------------
  let { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: STOCK_LOCATION_NAME },
  })
  let stockLocation: any = locations[0]
  if (!stockLocation) {
    logger.info("Creating stock location…")
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            address: { city: "Mumbai", country_code: "IN", address_1: "" },
          },
        ],
      },
    })
    stockLocation = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
  }

  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  let [fulfillmentSet] = await fulfillmentModule.listFulfillmentSets({
    name: "Studio delivery",
  })
  if (!fulfillmentSet) {
    logger.info("Creating fulfillment set…")
    fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
      name: "Studio delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Worldwide",
          geo_zones: COUNTRIES.map((c) => ({
            country_code: c,
            type: "country" as const,
          })),
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  } else if (!fulfillmentSet.service_zones?.length) {
    fulfillmentSet = (
      await fulfillmentModule.listFulfillmentSets(
        { name: "Studio delivery" },
        { relations: ["service_zones"] }
      )
    )[0]
  }

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
  })
  if (shippingOptions.length === 0) {
    logger.info("Creating shipping options…")
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Studio Standard",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "5–7 business days, wrapped in acid-free tissue.",
            code: "standard",
          },
          prices: [
            { currency_code: "inr", amount: FLAT_SHIPPING },
            // free over the threshold — conditional price rule
            {
              currency_code: "inr",
              amount: 0,
              rules: [
                { attribute: "item_total", operator: "gte", value: FREE_SHIPPING_OVER },
              ],
            },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
        {
          name: "Express",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          type: {
            label: "Express",
            description: "2–3 business days.",
            code: "express",
          },
          shipping_profile_id: shippingProfile.id,
          prices: [{ currency_code: "inr", amount: EXPRESS_SHIPPING }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  }

  // --- categories (shop cats + legacy collections as a category tree) ----
  const { data: existingCats } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "metadata"],
  })
  const shopCats = ["Apparel", "Art Supplies", "Accessories", "Books"]
  const catIdByName: Record<string, string> = {}
  const colCatByLegacyId: Record<string, string> = {}

  if (existingCats.length === 0) {
    logger.info("Creating categories…")
    const { result: catResult } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: shopCats.map((name, i) => ({
          name,
          handle: handleFor(name),
          is_active: true,
          rank: i,
        })),
      },
    })
    catResult.forEach((c: any) => (catIdByName[c.name] = c.id))

    const { result: colParentResult } = await createProductCategoriesWorkflow(
      container
    ).run({
      input: {
        product_categories: [
          { name: "Collections", handle: "collections", is_active: true },
        ],
      },
    })
    const { result: colCats } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: sb.collections.map((c: any, i: number) => ({
          name: c.name,
          handle: `collection-${handleFor(c.name)}`,
          description: c.description || "",
          is_active: c.status === "published",
          parent_category_id: colParentResult[0].id,
          rank: c.position ?? i,
          metadata: { legacy_id: c.id },
        })),
      },
    })
    colCats.forEach((c: any) => (colCatByLegacyId[c.metadata.legacy_id] = c.id))
  } else {
    for (const c of existingCats) {
      if (shopCats.includes(c.name)) catIdByName[c.name] = c.id
      const legacy = (c.metadata as any)?.legacy_id
      if (legacy) colCatByLegacyId[legacy] = c.id
    }
  }

  // legacy product id -> list of collection-category ids
  const productExtraCats: Record<string, string[]> = {}
  for (const col of sb.collections) {
    for (const pid of col.product_ids || []) {
      ;(productExtraCats[pid] ||= []).push(colCatByLegacyId[col.id])
    }
  }

  // --- products ------------------------------------------------------------
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  })
  const productByLegacyId: Record<string, any> = {}

  if (existingProducts.length === 0) {
    logger.info(`Creating ${sb.products.length} products…`)
    const productsInput = sb.products
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      .map((p: any) => {
        const sizes: string[] = p.sizes && p.sizes.length ? p.sizes : ["One"]
        return {
          title: p.name,
          handle: handleFor(p.name),
          description: p.blurb || "",
          status:
            p.status === "published" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
          shipping_profile_id: shippingProfile.id,
          category_ids: [
            catIdByName[p.cat],
            ...(productExtraCats[p.id] || []),
          ].filter(Boolean),
          images: p.image_url ? [{ url: p.image_url }] : [],
          options: [{ title: "Size", values: sizes }],
          variants: sizes.map((s: string) => ({
            title: s,
            sku: `${handleFor(p.name).toUpperCase().replace(/-/g, "_")}_${s.toUpperCase()}`,
            options: { Size: s },
            prices: [{ amount: p.price, currency_code: "inr" }],
            manage_inventory: true,
          })),
          sales_channels: [{ id: salesChannel.id }],
          metadata: {
            legacy_id: p.id,
            tint: p.tint,
            medium: p.medium,
            artist: p.artist,
            sold: p.sold,
            position: p.position,
          },
        }
      })
    const { result: createdProducts } = await createProductsWorkflow(container).run({
      input: { products: productsInput },
    })
    createdProducts.forEach(
      (p: any) => (productByLegacyId[(p.metadata as any).legacy_id] = p)
    )
  } else {
    existingProducts.forEach((p: any) => {
      const legacy = (p.metadata as any)?.legacy_id
      if (legacy) productByLegacyId[legacy] = p
    })
  }

  // Inventory: the legacy model tracked one stock number per product, so
  // each size variant starts with that same number (documented semantic change).
  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["id"],
  })
  if (existingLevels.length === 0) {
    logger.info("Setting inventory levels…")
    const { data: variantsWithInventory } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "product.metadata", "inventory_items.inventory_item_id"],
    })
    const levels: any[] = []
    for (const v of variantsWithInventory) {
      const legacyId = (v.product?.metadata as any)?.legacy_id
      const legacy = sb.products.find((p: any) => p.id === legacyId)
      const qty = legacy ? legacy.inventory : 0
      for (const ii of v.inventory_items || []) {
        if (!ii) continue
        levels.push({
          location_id: stockLocation.id,
          inventory_item_id: ii.inventory_item_id,
          stocked_quantity: qty,
        })
      }
    }
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levels },
    })
  }

  // --- promotions (legacy discounts) --------------------------------------
  const { data: existingPromos } = await query.graph({
    entity: "promotion",
    fields: ["id"],
  })
  if (existingPromos.length === 0) {
    logger.info("Creating promotions…")
    const promotionsInput = sb.discounts.map((d: any) => ({
      code: d.code,
      type: ("standard" as const),
      status: d.active ? ("active" as const) : ("draft" as const),
      is_automatic: false,
      application_method: {
        type: d.type === "pct" ? ("percentage" as const) : ("fixed" as const),
        target_type: ("order" as const),
        allocation: ("across" as const),
        value: d.value,
        currency_code: "inr",
      },
      campaign:
        d.limit || d.expires
          ? {
              name: `${d.code} campaign`,
              campaign_identifier: `omg-${d.code.toLowerCase()}`,
              ends_at: d.expires ? new Date(`${d.expires}T23:59:59Z`) : undefined,
              budget: d.limit
                ? { type: ("usage" as const), limit: d.limit, used: d.used || 0 }
                : undefined,
            }
          : undefined,
      metadata: { legacy_id: d.id, legacy_used: d.used },
    }))
    await createPromotionsWorkflow(container).run({
      input: { promotionsData: promotionsInput },
    })
  }

  // --- customers -----------------------------------------------------------
  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
  })
  const customerByEmail: Record<string, any> = {}
  if (existingCustomers.length === 0) {
    logger.info(`Creating ${sb.customers.length} customers…`)
    const { result: createdCustomers } = await createCustomersWorkflow(container).run({
      input: {
        customersData: sb.customers.map((c: any) => {
          const [first, ...rest] = String(c.name || "").split(" ")
          return {
            email: c.email,
            first_name: first || "",
            last_name: rest.join(" "),
            metadata: {
              legacy_id: c.id,
              location: c.location,
              customer_since: c.since,
              note: c.note || "",
              status: c.status,
            },
          }
        }),
      },
    })
    createdCustomers.forEach((c: any) => (customerByEmail[c.email] = c))
  } else {
    existingCustomers.forEach((c: any) => (customerByEmail[c.email] = c))
  }

  // --- historical orders ----------------------------------------------------
  // Imported via the order module directly (no cart/payment attached) so the
  // history is visible in the admin; stage/tracking preserved in metadata.
  const { data: existingOrders } = await query.graph({
    entity: "order",
    fields: ["id"],
  })
  if (existingOrders.length === 0) {
    logger.info(`Importing ${sb.orders.length} historical orders…`)
    const orderModule = container.resolve(Modules.ORDER)
    const itemsByOrder: Record<string, any[]> = {}
    for (const it of sb.orderItems) {
      ;(itemsByOrder[it.order_id] ||= []).push(it)
    }

    for (const o of sb.orders) {
      const items = (itemsByOrder[o.id] || []).map((it: any) => ({
        title: it.name + (it.size && it.size !== "One" ? ` (Size ${it.size})` : ""),
        quantity: it.qty,
        unit_price: it.price,
        metadata: {
          legacy_product_id: it.product_id,
          size: it.size,
          product_id: productByLegacyId[it.product_id]?.id,
        },
      }))
      const [first, ...rest] = String(o.customer || "").split(" ")
      await orderModule.createOrders({
        region_id: region.id,
        email: o.email,
        currency_code: "inr",
        customer_id: customerByEmail[o.email]?.id,
        sales_channel_id: salesChannel.id,
        status: (o.stage >= 4 ? "completed" : "pending") as any,
        items,
        shipping_methods: [{ name: "Studio Standard", amount: o.shipping ?? 0 }],
        billing_address: {
          first_name: first,
          last_name: rest.join(" "),
          address_1: o.address || "",
        },
        shipping_address: {
          first_name: first,
          last_name: rest.join(" "),
          address_1: o.address || "",
        },
        metadata: {
          legacy_id: o.id,
          legacy_stage: o.stage,
          tracking: o.tracking || "",
          method: o.method,
          legacy_date: o.date,
          rzp_order_id: o.rzp_order_id,
          rzp_payment_id: o.rzp_payment_id,
        },
      } as any)
    }
  }

  // --- brand content: artists + journal -------------------------------------
  const brand = container.resolve("brand") as any
  const existingArtists = await brand.listArtists({}, { select: ["id"] })
  if (existingArtists.length === 0) {
    logger.info("Creating artists + journal posts…")
    await brand.createArtists(
      sb.artists
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((a: any) => ({
          name: a.name,
          handle: handleFor(a.name),
          medium: a.medium || "",
          location: a.location || "",
          tint: a.tint || "20,42,84",
          quote: a.quote || "",
          bio: a.bio_text || "",
          instagram: a.instagram || "",
          portfolio: a.portfolio || "",
          image_url: a.image_url,
          featured: !!a.featured,
          status: a.status === "active" ? "active" : "inactive",
        }))
    )
    await brand.createJournalPosts(
      sb.journal.map((p: any) => ({
        title: p.title,
        handle: handleFor(p.title),
        category: p.cat || "",
        read_time: p.read_time || "",
        author: p.author || "Atelier OMG",
        published_date: p.date || "",
        excerpt: p.excerpt || "",
        body: p.body_text || "",
        tint: p.tint || "20,42,84",
        image_url: p.image_url,
        status: p.status === "published" ? "published" : "draft",
      }))
    )
  }

  logger.info("──────────────────────────────────────────────")
  logger.info("Migration complete.")
  logger.info(`Publishable API key (storefront): ${publishableKey.token}`)
  logger.info("──────────────────────────────────────────────")
}
