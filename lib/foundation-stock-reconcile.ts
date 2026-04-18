import { InventorySyncStatus, PrismaClient } from "@prisma/client";

import {
  getPepperDependentTinyAccounts,
  getPepperPhysicalStockAccountKey,
  type PepperTinyAccountKey
} from "@/lib/pepper-tiny-account-data";
import { persistFoundationVariantInventory } from "@/lib/tiny-stock-events";
import { getTinyStockSnapshotByProductId } from "@/lib/tiny";

type ReconcileFoundationStockBySkuParams = {
  prisma: PrismaClient;
  sku: string;
  batchSize: number;
  pauseMs: number;
};

export type ReconcileFoundationStockBySkuResult = {
  authoritativeAccountKey: PepperTinyAccountKey;
  sku: string;
  reconciled: number;
  failed: number;
  rows: Array<{
    sku: string;
    tinyId: string;
    availableMultiCompanyStock: number | null;
    reservedStock: number | null;
    stockBalance: number | null;
    status: InventorySyncStatus;
  }>;
};

function chunkVariants<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

async function wait(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveVariantsBySku(prisma: PrismaClient, sku: string) {
  const exactVariant = await prisma.catalogVariant.findUnique({
    where: { sku },
    include: {
      tinyMappings: {
        where: {
          entityType: "variant"
        }
      }
    }
  });

  if (exactVariant) {
    return [exactVariant];
  }

  const parentProduct = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: sku
    },
    include: {
      variants: {
        where: {
          active: true
        },
        include: {
          tinyMappings: {
            where: {
              entityType: "variant"
            }
          }
        },
        orderBy: {
          sku: "asc"
        }
      }
    }
  });

  if (!parentProduct) {
    return [];
  }

  return parentProduct.variants;
}

export async function reconcileFoundationStockBySku({
  prisma,
  sku,
  batchSize,
  pauseMs
}: ReconcileFoundationStockBySkuParams): Promise<ReconcileFoundationStockBySkuResult> {
  const authoritativeAccountKey = getPepperPhysicalStockAccountKey();
  const dependentAccounts = getPepperDependentTinyAccounts()
    .filter((account) => account.active)
    .map((account) => account.key);
  const variants = await resolveVariantsBySku(prisma, sku);

  if (variants.length === 0) {
    throw new Error(`Nenhuma variante foundation encontrada para ${sku}.`);
  }

  const rows: ReconcileFoundationStockBySkuResult["rows"] = [];
  const batches = chunkVariants(variants, batchSize);

  for (const [batchIndex, batch] of batches.entries()) {
    for (const variant of batch) {
      const refreshProductId =
        variant.tinyMappings.find((mapping) => /^\d+$/.test(mapping.tinyId))?.tinyId ??
        (variant.tinyProductId && /^\d+$/.test(variant.tinyProductId) ? variant.tinyProductId : null);

      if (!refreshProductId) {
        rows.push({
          sku: variant.sku,
          tinyId: "-",
          availableMultiCompanyStock: null,
          reservedStock: null,
          stockBalance: null,
          status: InventorySyncStatus.ERROR
        });
        continue;
      }

      const snapshot = await getTinyStockSnapshotByProductId(refreshProductId, authoritativeAccountKey);
      const syncStatus =
        snapshot.availableMultiCompanyStock === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH;

      const dependentSnapshots = new Map<
        PepperTinyAccountKey,
        {
          tinyProductId: string;
          stockBalance: number | null;
          reservedStock: number | null;
          availableMultiCompanyStock: number | null;
        }
      >();

      for (const accountKey of dependentAccounts) {
        const dependentTinyId =
          variant.tinyMappings.find(
            (mapping) => mapping.accountKey === accountKey && /^\d+$/.test(mapping.tinyId)
          )?.tinyId ?? null;

        if (!dependentTinyId) {
          continue;
        }

        const dependentSnapshot = await getTinyStockSnapshotByProductId(dependentTinyId, accountKey);
        dependentSnapshots.set(accountKey, {
          tinyProductId: dependentTinyId,
          stockBalance: dependentSnapshot.stockBalance,
          reservedStock: dependentSnapshot.reservedStock,
          availableMultiCompanyStock: dependentSnapshot.availableMultiCompanyStock
        });
      }

      await persistFoundationVariantInventory({
        catalogVariantId: variant.id,
        quantity: snapshot.availableMultiCompanyStock,
        physicalStock: snapshot.stockBalance,
        reservedStock: snapshot.reservedStock,
        localAvailableStock: snapshot.availableMultiCompanyStock,
        syncStatus,
        syncedAt: new Date(),
        authoritativeAccountKey,
        reconciledTinyProductId: refreshProductId,
        rawPayload: JSON.stringify({
          source: "manual_reconcile_by_sku",
          sku: variant.sku,
          authoritativeAccountKey,
          snapshot,
          dependentSnapshots: Object.fromEntries(dependentSnapshots)
        }),
        additionalAccountStates: [...dependentSnapshots.entries()].map(([accountKey, dependentSnapshot]) => ({
          accountKey,
          tinyProductId: dependentSnapshot.tinyProductId,
          localPhysicalStock: dependentSnapshot.stockBalance,
          localAvailableStock: dependentSnapshot.availableMultiCompanyStock,
          reservedStock: dependentSnapshot.reservedStock
        }))
      });

      rows.push({
        sku: variant.sku,
        tinyId: refreshProductId,
        availableMultiCompanyStock: snapshot.availableMultiCompanyStock,
        reservedStock: snapshot.reservedStock,
        stockBalance: snapshot.stockBalance,
        status: syncStatus
      });
    }

    if (batchIndex < batches.length - 1) {
      await wait(pauseMs);
    }
  }

  return {
    authoritativeAccountKey,
    sku,
    reconciled: rows.filter((row) => row.status === InventorySyncStatus.FRESH).length,
    failed: rows.filter((row) => row.status !== InventorySyncStatus.FRESH).length,
    rows
  };
}
