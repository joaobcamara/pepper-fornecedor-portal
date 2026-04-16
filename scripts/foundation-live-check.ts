import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type Args = {
  sku?: string
  account?: string
  limit: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 10 }

  for (const token of argv) {
    if (token.startsWith("--sku=")) {
      args.sku = token.slice("--sku=".length).trim() || undefined
      continue
    }

    if (token.startsWith("--account=")) {
      args.account = token.slice("--account=".length).trim() || undefined
      continue
    }

    if (token.startsWith("--limit=")) {
      const parsed = Number.parseInt(token.slice("--limit=".length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed
      }
    }
  }

  return args
}

function printSection(title: string) {
  console.log("")
  console.log(`=== ${title} ===`)
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "-"
}

function collectTinyIds(mappings: Array<{ tinyId: string; tinyParentId: string | null }>) {
  return [...new Set(mappings.flatMap((mapping) => [mapping.tinyId, mapping.tinyParentId].filter(Boolean) as string[]))]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  printSection("Entrada")
  console.log(
    JSON.stringify(
      {
        sku: args.sku ?? null,
        account: args.account ?? null,
        limit: args.limit,
      },
      null,
      2,
    ),
  )

  const variant = args.sku
    ? await prisma.catalogVariant.findUnique({
        where: { sku: args.sku },
        include: {
          inventory: true,
          catalogProduct: {
            include: {
              supplierLinks: {
                include: {
                  supplier: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
          tinyMappings: true,
        },
      })
    : null

  const product = !variant && args.sku
    ? await prisma.catalogProduct.findUnique({
        where: { skuParent: args.sku },
        include: {
          variants: {
            include: {
              inventory: true,
              tinyMappings: true,
            },
            orderBy: { sku: "asc" },
          },
          supplierLinks: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          tinyMappings: true,
        },
      })
    : null

  if (variant) {
    printSection("CatalogVariant")
    console.log(
      JSON.stringify(
        {
          id: variant.id,
          sku: variant.sku,
          product: {
            id: variant.catalogProduct.id,
            skuParent: variant.catalogProduct.skuParent,
            name: variant.catalogProduct.name,
          },
          size: {
            code: variant.sizeCode,
            label: variant.sizeLabel,
          },
          color: {
            code: variant.colorCode,
            label: variant.colorLabel,
          },
          inventory: {
            availableMultiCompanyStock: variant.inventory?.availableMultiCompanyStock ?? null,
            inventorySyncStatus: variant.inventory?.inventorySyncStatus ?? null,
            lastStockSyncAt: formatDate(variant.inventory?.lastStockSyncAt),
            source: variant.inventory?.source ?? null,
          },
          suppliers: variant.catalogProduct.supplierLinks.map((link) => ({
            id: link.supplier.id,
            name: link.supplier.name,
            slug: link.supplier.slug,
          })),
          tinyMappings: variant.tinyMappings.map((mapping) => ({
            accountKey: mapping.accountKey,
            entityType: mapping.entityType,
            sku: mapping.sku,
            tinyId: mapping.tinyId,
            tinyParentId: mapping.tinyParentId,
            lastSyncAt: formatDate(mapping.lastSyncAt),
          })),
        },
        null,
        2,
      ),
    )
  } else if (product) {
    printSection("CatalogProduct")
    console.log(
      JSON.stringify(
        {
          id: product.id,
          skuParent: product.skuParent,
          name: product.name,
          suppliers: product.supplierLinks.map((link) => ({
            id: link.supplier.id,
            name: link.supplier.name,
            slug: link.supplier.slug,
          })),
          tinyMappings: product.tinyMappings.map((mapping) => ({
            accountKey: mapping.accountKey,
            entityType: mapping.entityType,
            sku: mapping.sku,
            tinyId: mapping.tinyId,
            tinyParentId: mapping.tinyParentId,
            lastSyncAt: formatDate(mapping.lastSyncAt),
          })),
          variants: product.variants.map((item) => ({
            sku: item.sku,
            sizeLabel: item.sizeLabel,
            colorLabel: item.colorLabel,
            availableMultiCompanyStock: item.inventory?.availableMultiCompanyStock ?? null,
            inventorySyncStatus: item.inventory?.inventorySyncStatus ?? null,
            lastStockSyncAt: formatDate(item.inventory?.lastStockSyncAt),
            tinyMappings: item.tinyMappings.map((mapping) => ({
              accountKey: mapping.accountKey,
              tinyId: mapping.tinyId,
              tinyParentId: mapping.tinyParentId,
            })),
          })),
        },
        null,
        2,
      ),
    )
  } else if (args.sku) {
    printSection("Catalogo")
    console.log(`Nenhum CatalogVariant/CatalogProduct encontrado para ${args.sku}.`)
  }

  const relevantSku = variant?.sku ?? product?.skuParent ?? args.sku
  const relevantTinyIds = collectTinyIds([
    ...(variant?.tinyMappings ?? []),
    ...(product?.tinyMappings ?? []),
    ...((product?.variants ?? []).flatMap((item) => item.tinyMappings) ?? []),
  ])

  const webhookLogs = await prisma.tinyWebhookLog.findMany({
    where: {
      ...(args.account ? { accountKey: args.account } : {}),
      ...(relevantSku || relevantTinyIds.length > 0
        ? {
            OR: [
              ...(relevantSku ? [{ sku: relevantSku }] : []),
              ...(relevantTinyIds.length > 0 ? [{ tinyProductId: { in: relevantTinyIds } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: args.limit,
  })

  printSection("TinyWebhookLog")
  if (webhookLogs.length === 0) {
    console.log("Nenhum webhook encontrado para o filtro atual.")
  } else {
    console.table(
      webhookLogs.map((entry) => ({
        createdAt: formatDate(entry.createdAt),
        webhookType: entry.webhookType,
        accountKey: entry.accountKey ?? "-",
        eventType: entry.eventType ?? "-",
        sku: entry.sku ?? "-",
        tinyProductId: entry.tinyProductId ?? "-",
        status: entry.status,
        processingStage: entry.processingStage ?? "-",
        duplicateOfId: entry.duplicateOfId ?? "-",
        errorMessage: entry.errorMessage ?? "-",
      })),
    )
  }

  const syncRuns = await prisma.syncRun.findMany({
    where: {
      ...(args.account ? { accountKey: args.account } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: args.limit,
  })

  printSection("SyncRun")
  if (syncRuns.length === 0) {
    console.log("Nenhuma sincronizacao encontrada para o filtro atual.")
  } else {
    console.table(
      syncRuns.map((run) => ({
        startedAt: formatDate(run.startedAt),
        triggerType: run.triggerType,
        scope: run.scope ?? "-",
        accountKey: run.accountKey ?? "-",
        entityType: run.entityType ?? "-",
        entityId: run.entityId ?? "-",
        status: run.status,
        finishedAt: formatDate(run.finishedAt),
        errorMessage: run.errorMessage ?? "-",
      })),
    )
  }

  const salesItems = await prisma.salesOrderItem.findMany({
    where: {
      ...(args.sku
        ? {
            OR: [{ sku: args.sku }, { skuParent: args.sku }],
          }
        : {}),
      ...(args.account
        ? {
            salesOrder: {
              tinyOrderId: {
                startsWith: `${args.account}:`,
              },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: args.limit,
    include: {
      salesOrder: true,
    },
  })

  printSection("SalesOrder / SalesOrderItem")
  if (salesItems.length === 0) {
    console.log("Nenhum item de pedido encontrado para o filtro atual.")
  } else {
    console.table(
      salesItems.map((item) => ({
        orderDate: formatDate(item.salesOrder.orderDate),
        tinyOrderId: item.salesOrder.tinyOrderId,
        number: item.salesOrder.number ?? "-",
        status: item.salesOrder.status,
        statusLabel: item.salesOrder.statusLabel ?? "-",
        sku: item.sku ?? "-",
        skuParent: item.skuParent ?? "-",
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: item.totalPrice ?? 0,
      })),
    )
  }

  if (variant) {
    const variantMetrics = await prisma.variantSalesMetricDaily.findMany({
      where: { variantId: variant.id },
      orderBy: { date: "desc" },
      take: args.limit,
    })

    printSection("VariantSalesMetricDaily")
    if (variantMetrics.length === 0) {
      console.log("Nenhuma metrica diaria encontrada para a variante.")
    } else {
      console.table(
        variantMetrics.map((metric) => ({
          date: formatDate(metric.date),
          unitsSold: metric.unitsSold,
          grossRevenue: metric.grossRevenue,
          orderCount: metric.orderCount,
          lastOrderAt: formatDate(metric.lastOrderAt),
        })),
      )
    }
  } else if (product) {
    const productMetrics = await prisma.productSalesMetricDaily.findMany({
      where: { catalogProductId: product.id },
      orderBy: { date: "desc" },
      take: args.limit,
    })

    printSection("ProductSalesMetricDaily")
    if (productMetrics.length === 0) {
      console.log("Nenhuma metrica diaria encontrada para o produto pai.")
    } else {
      console.table(
        productMetrics.map((metric) => ({
          date: formatDate(metric.date),
          unitsSold: metric.unitsSold,
          grossRevenue: metric.grossRevenue,
          orderCount: metric.orderCount,
          lastOrderAt: formatDate(metric.lastOrderAt),
        })),
      )
    }
  }
}

main()
  .catch((error) => {
    console.error("foundation-live-check falhou.")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
