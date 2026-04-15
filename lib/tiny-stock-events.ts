import { InventorySyncStatus } from "@prisma/client";
import { z } from "zod";

import { syncCatalogVariantInventory } from "@/lib/catalog-sync";
import { prisma } from "@/lib/prisma";
import { getStockBand, resolveStockThresholds } from "@/lib/stock";
import { getTinyStockByProductId, isTinyConfigured } from "@/lib/tiny";

const tinyWebhookEnvelopeSchema = z.object({
  tipo: z.string().optional(),
  dados: z
    .object({
      tipoEstoque: z.string().optional(),
      saldo: z.union([z.string(), z.number()]).optional(),
      idProduto: z.union([z.string(), z.number()]).optional(),
      sku: z.string().optional(),
      skuMapeamento: z.string().optional(),
      skuMapeamentoPai: z.string().optional()
    })
    .optional()
});

function normalizeTinySku(value?: string | null) {
  return value?.trim().toUpperCase() ?? null;
}

function toNullableNumber(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getWebhookSecretFromRequest(request: Request) {
  const url = new URL(request.url);
  return (
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-tiny-webhook-secret") ??
    url.searchParams.get("secret")
  );
}

export function isTinyWebhookAuthorized(request: Request) {
  const configuredSecret = process.env.TINY_WEBHOOK_SECRET?.trim();

  if (!configuredSecret) {
    return true;
  }

  return getWebhookSecretFromRequest(request) === configuredSecret;
}

async function logWebhookEvent(params: {
  webhookType: string;
  eventType?: string | null;
  sku?: string | null;
  tinyProductId?: string | null;
  status: string;
  payload: unknown;
  errorMessage?: string | null;
  processedAt?: Date | null;
}) {
  return prisma.tinyWebhookLog.create({
    data: {
      webhookType: params.webhookType,
      eventType: params.eventType ?? null,
      sku: params.sku ?? null,
      tinyProductId: params.tinyProductId ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      payload: JSON.stringify(params.payload),
      processedAt: params.processedAt ?? null
    }
  });
}

async function persistVariantInventory(params: {
  productId: string;
  quantity: number | null;
  syncStatus: InventorySyncStatus;
  syncedAt: Date;
}) {
  const variant = await prisma.product.findUnique({
    where: { id: params.productId },
    include: {
      parent: true,
      inventorySnapshots: {
        orderBy: { syncedAt: "desc" },
        take: 1
      }
    }
  });

  if (!variant) {
    throw new Error("Variacao nao encontrada para atualizar estoque.");
  }

  const thresholds = resolveStockThresholds({
    productCritical: variant.criticalStockThreshold,
    productLow: variant.lowStockThreshold,
    parentCritical: variant.parent?.criticalStockThreshold,
    parentLow: variant.parent?.lowStockThreshold
  });

  const stockBand = getStockBand(params.quantity, thresholds);

  await prisma.inventorySnapshot.create({
    data: {
      productId: variant.id,
      quantity: params.quantity,
      status: params.syncStatus,
      stockBand
    }
  });

  await prisma.product.update({
    where: { id: variant.id },
    data: {
      fallbackInventory: params.quantity ?? variant.fallbackInventory,
      lastSyncedAt: params.syncedAt,
      syncStatus:
        params.syncStatus === InventorySyncStatus.FRESH
          ? InventorySyncStatus.FRESH
          : InventorySyncStatus.STALE
    }
  });

  await syncCatalogVariantInventory(prisma, {
    sourceProductId: variant.id,
    availableMultiCompanyStock: params.quantity,
    stockStatus: stockBand,
    inventorySyncStatus: params.syncStatus,
    syncedAt: params.syncedAt
  });

  return {
    sku: variant.sku,
    stockBand
  };
}

async function resolveVariantByWebhookIdentifiers(input: {
  sku?: string | null;
  tinyProductId?: string | null;
}) {
  if (input.sku) {
    const bySku = await prisma.product.findUnique({
      where: { sku: input.sku }
    });

    if (bySku) {
      return bySku;
    }
  }

  if (input.tinyProductId) {
    return prisma.product.findFirst({
      where: { tinyProductId: input.tinyProductId }
    });
  }

  return null;
}

export async function handleTinyStockWebhook(rawPayload: unknown) {
  const parsed = tinyWebhookEnvelopeSchema.safeParse(rawPayload);

  if (!parsed.success) {
    await logWebhookEvent({
      webhookType: "stock",
      status: "invalid_payload",
      payload: rawPayload,
      errorMessage: "Payload de webhook invalido."
    });

    throw new Error("Payload de webhook invalido.");
  }

  const eventType = parsed.data.tipo?.trim() ?? "estoque";
  const sku =
    normalizeTinySku(parsed.data.dados?.sku) ??
    normalizeTinySku(parsed.data.dados?.skuMapeamento);
  const parentSku = normalizeTinySku(parsed.data.dados?.skuMapeamentoPai);
  const tinyProductId = parsed.data.dados?.idProduto
    ? String(parsed.data.dados.idProduto)
    : null;
  const quantity = toNullableNumber(parsed.data.dados?.saldo);

  const variant = await resolveVariantByWebhookIdentifiers({
    sku,
    tinyProductId
  });

  if (!variant) {
    await logWebhookEvent({
      webhookType: "stock",
      eventType,
      sku,
      tinyProductId,
      status: "variant_not_found",
      payload: rawPayload,
      errorMessage: "Nenhuma variacao encontrada para os identificadores do webhook."
    });

    return {
      ok: true,
      ignored: true,
      reason: "variant_not_found"
    };
  }

  const processedAt = new Date();
  const persisted = await persistVariantInventory({
    productId: variant.id,
    quantity,
    syncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
    syncedAt: processedAt
  });

  await logWebhookEvent({
    webhookType: "stock",
    eventType,
    sku: persisted.sku,
    tinyProductId,
    status: "processed",
    payload: rawPayload,
    processedAt
  });

  return {
    ok: true,
    sku: persisted.sku,
    parentSku,
    availableMultiCompanyStock: quantity,
    stockBand: persisted.stockBand
  };
}

export async function reconcileVariantInventory(params: {
  force?: boolean;
  staleMinutes?: number;
  limit?: number;
}) {
  if (!isTinyConfigured()) {
    return {
      status: "skipped",
      reason: "Tiny nao configurado."
    };
  }

  const staleMinutes = params.staleMinutes ?? 30;
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);

  const variants = await prisma.product.findMany({
    where: {
      kind: "VARIANT",
      active: true,
      archivedAt: null,
      tinyProductId: { not: null },
      OR: params.force
        ? undefined
        : [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: staleThreshold } },
            { syncStatus: InventorySyncStatus.ERROR },
            { syncStatus: InventorySyncStatus.STALE }
          ]
    },
    include: {
      parent: true,
      inventorySnapshots: {
        orderBy: { syncedAt: "desc" },
        take: 1
      }
    },
    orderBy: { lastSyncedAt: "asc" },
    take: params.limit ?? 100
  });

  const run = await prisma.syncRun.create({
    data: {
      triggerType: "reconcile",
      status: "processing"
    }
  });

  let updated = 0;
  let stale = 0;

  try {
    for (const variant of variants) {
      if (!variant.tinyProductId) {
        continue;
      }

      try {
        const quantity = await getTinyStockByProductId(variant.tinyProductId);
        await persistVariantInventory({
          productId: variant.id,
          quantity,
          syncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
          syncedAt: new Date()
        });
        updated += 1;
      } catch (error) {
        const fallbackQuantity = variant.inventorySnapshots[0]?.quantity ?? variant.fallbackInventory ?? null;
        await persistVariantInventory({
          productId: variant.id,
          quantity: fallbackQuantity,
          syncStatus: InventorySyncStatus.ERROR,
          syncedAt: new Date()
        });

        await logWebhookEvent({
          webhookType: "reconcile",
          eventType: "inventory",
          sku: variant.sku,
          tinyProductId: variant.tinyProductId,
          status: "error",
          payload: { source: "reconcile", sku: variant.sku },
          errorMessage: error instanceof Error ? error.message : "Falha na reconciliacao."
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
      stale,
      checked: variants.length
    };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Falha na reconciliacao."
      }
    });

    return {
      status: "failed",
      updated,
      stale: variants.length,
      checked: variants.length
    };
  }
}
