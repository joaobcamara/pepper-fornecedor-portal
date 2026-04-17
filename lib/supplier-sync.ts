import { InventorySyncStatus } from "@prisma/client";
import { listFoundationCatalogProducts } from "@/lib/foundation-catalog";
import { prisma } from "@/lib/prisma";
import { getTinyStockByProductId, isTinyConfigured } from "@/lib/tiny";
import { persistFoundationVariantInventory } from "@/lib/tiny-stock-events";

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

  const foundationProducts = await listFoundationCatalogProducts({
    supplierId: params.supplierId,
    onlyActive: true,
    onlyPortalVisible: true
  });

  const variants = foundationProducts.flatMap((product) => product.variants);

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
        stale += 1;
        continue;
      }

      try {
        const quantity = await getTinyStockByProductId(variant.tinyProductId);
        await persistFoundationVariantInventory({
          catalogVariantId: variant.id,
          quantity,
          syncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
          syncedAt: new Date()
        });

        updated += 1;
      } catch {
        const fallbackQuantity = variant.quantity ?? null;

        await persistFoundationVariantInventory({
          catalogVariantId: variant.id,
          quantity: fallbackQuantity,
          syncStatus: InventorySyncStatus.ERROR,
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
