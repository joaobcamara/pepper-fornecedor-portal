import { InventorySyncStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { handleTinyStockWebhook, persistFoundationVariantInventory } from "@/lib/tiny-stock-events";

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const baselineProduct = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: "01-2504"
    },
    include: {
      variants: {
        include: {
          inventory: true
        },
        orderBy: {
          sku: "asc"
        },
        take: 1
      }
    }
  });

  const variant = baselineProduct?.variants[0];

  if (!baselineProduct || !variant) {
    throw new Error("Nao ha variante foundation suficiente para validar o webhook de estoque.");
  }

  const originalQuantity = variant.inventory?.availableMultiCompanyStock ?? null;
  const originalSyncStatus = variant.inventory?.inventorySyncStatus ?? InventorySyncStatus.STALE;
  const startedAt = new Date();
  const nextQuantity = (originalQuantity ?? 0) + 1;

  try {
    const result = await handleTinyStockWebhook({
      tipo: "smoke_stock",
      dados: {
        sku: variant.sku,
        saldo: nextQuantity
      }
    });

    if (!result.ok) {
      throw new Error("Webhook de estoque nao retornou sucesso.");
    }

    const updatedInventory = await prisma.catalogInventory.findUnique({
      where: {
        catalogVariantId: variant.id
      }
    });

    if (!updatedInventory || updatedInventory.availableMultiCompanyStock !== nextQuantity) {
      throw new Error("CatalogInventory nao refletiu a quantidade enviada pelo webhook.");
    }

    const webhookLog = await prisma.tinyWebhookLog.findFirst({
      where: {
        webhookType: "stock",
        eventType: "smoke_stock",
        sku: variant.sku,
        createdAt: {
          gte: startedAt
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!webhookLog || webhookLog.status !== "processed") {
      throw new Error("TinyWebhookLog nao registrou o processamento do webhook de estoque.");
    }

    log("[OK] Webhook de estoque atualizou CatalogInventory na fundacao.");
    log("[OK] TinyWebhookLog registrou o processamento do webhook de estoque.");
    log("=== Smoke de webhook de estoque concluido ===");
  } finally {
    await persistFoundationVariantInventory({
      catalogVariantId: variant.id,
      quantity: originalQuantity,
      syncStatus: originalSyncStatus,
      syncedAt: new Date()
    }).catch(() => null);

    await prisma.tinyWebhookLog.deleteMany({
      where: {
        webhookType: "stock",
        eventType: "smoke_stock",
        sku: variant.sku,
        createdAt: {
          gte: startedAt
        }
      }
    }).catch(() => null);
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[FAIL] Smoke de estoque interrompido: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
