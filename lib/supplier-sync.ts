import { InventorySyncStatus } from "@prisma/client";
import { syncCatalogVariantInventory } from "@/lib/catalog-sync";
import { prisma } from "@/lib/prisma";
import { getStockBand, resolveStockThresholds } from "@/lib/stock";
import { getTinyStockByProductId, isTinyConfigured } from "@/lib/tiny";

const SYNC_THROTTLE_MS = 1000 * 60 * 3;

export async function syncSupplierInventory(params: {
  supplierId: string;
  requestedByUserId?: string;
  triggerType: "login" | "manual";
  force?: boolean;
}) {
  if (!isTinyConfigured()) {
    return {
      status: "skipped",
      reason: "Tiny não configurado."
    };
  }

  const latestRun = await prisma.syncRun.findFirst({
    where: {
      requestedByUserId: params.requestedByUserId ?? undefined
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  if (!params.force && latestRun && Date.now() - latestRun.startedAt.getTime() < SYNC_THROTTLE_MS) {
    return {
      status: "skipped",
      reason: "Sincronização recente."
    };
  }

  const variants = await prisma.product.findMany({
    where: {
      kind: "VARIANT",
      active: true,
      archivedAt: null,
      assignments: {
        some: {
          supplierId: params.supplierId,
          active: true
        }
      }
    },
    include: {
      parent: true,
      inventorySnapshots: {
        orderBy: {
          syncedAt: "desc"
        },
        take: 1
      }
    }
  });

  const run = await prisma.syncRun.create({
    data: {
      triggerType: params.triggerType,
      status: "processing",
      requestedByUserId: params.requestedByUserId
    }
  });

  let updated = 0;
  let stale = 0;

  try {
    for (const variant of variants) {
      if (!variant.tinyProductId) {
        await prisma.product.update({
          where: { id: variant.id },
          data: {
            syncStatus: InventorySyncStatus.ERROR
          }
        });
        stale += 1;
        continue;
      }

      try {
        const quantity = await getTinyStockByProductId(variant.tinyProductId);
        const thresholds = resolveStockThresholds({
          productCritical: variant.criticalStockThreshold,
          productLow: variant.lowStockThreshold,
          parentCritical: variant.parent?.criticalStockThreshold,
          parentLow: variant.parent?.lowStockThreshold
        });

        await prisma.inventorySnapshot.create({
          data: {
            productId: variant.id,
            quantity,
            status: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
            stockBand: getStockBand(quantity, thresholds)
          }
        });

        await prisma.product.update({
          where: { id: variant.id },
          data: {
            fallbackInventory: quantity ?? variant.fallbackInventory,
            lastSyncedAt: new Date(),
            syncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH
          }
        });

        await syncCatalogVariantInventory(prisma, {
          sourceProductId: variant.id,
          availableMultiCompanyStock: quantity,
          stockStatus: getStockBand(quantity, thresholds),
          inventorySyncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
          syncedAt: new Date()
        });

        updated += 1;
      } catch {
        const fallbackQuantity = variant.inventorySnapshots[0]?.quantity ?? variant.fallbackInventory ?? null;
        const thresholds = resolveStockThresholds({
          productCritical: variant.criticalStockThreshold,
          productLow: variant.lowStockThreshold,
          parentCritical: variant.parent?.criticalStockThreshold,
          parentLow: variant.parent?.lowStockThreshold
        });

        await prisma.inventorySnapshot.create({
          data: {
            productId: variant.id,
            quantity: fallbackQuantity,
            status: InventorySyncStatus.ERROR,
            stockBand: getStockBand(fallbackQuantity, thresholds)
          }
        });

        await prisma.product.update({
          where: { id: variant.id },
          data: {
            syncStatus: InventorySyncStatus.STALE
          }
        });

        await syncCatalogVariantInventory(prisma, {
          sourceProductId: variant.id,
          availableMultiCompanyStock: fallbackQuantity,
          stockStatus: getStockBand(fallbackQuantity, thresholds),
          inventorySyncStatus: InventorySyncStatus.ERROR,
          syncedAt: new Date()
        });

        stale += 1;
      }
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: stale > 0 ? "partial" : "completed",
        finishedAt: new Date()
      }
    });

    return {
      status: stale > 0 ? "partial" : "completed",
      updated,
      stale
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Falha na sincronização."
      }
    });

    return {
      status: "failed",
      updated,
      stale: variants.length
    };
  }
}
