import { InventorySyncStatus } from "@prisma/client";
import { z } from "zod";

import {
  beginFoundationWebhookProcessing,
  createFoundationSyncRun,
  finalizeFoundationSyncRun,
  finalizeFoundationWebhookProcessing
} from "@/lib/foundation-event-orchestrator";
import { tryHydrateFoundationCatalogBySku } from "@/lib/foundation-catalog-hydration";
import {
  getPepperPhysicalStockAccountKey,
  getPepperTinyAccountLabel,
  isPepperMatrixAccount
} from "@/lib/pepper-tiny-account-data";
import { prisma } from "@/lib/prisma";
import { getStockBand, resolveStockThresholds } from "@/lib/stock";
import { getTinyStockByProductId, isTinyConfigured, searchTinyProductsBySku, type TinyAccountKey, toStringValue } from "@/lib/tiny";
import { getTrustedFoundationInventoryQuantity } from "@/lib/foundation-inventory";

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
    .passthrough()
    .optional()
}).passthrough();

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

type FoundationVariantInventoryTarget = {
  catalogVariantId: string;
  sku: string;
  sourceProductId: string | null;
  sourceSyncStatus: InventorySyncStatus | null;
  sourceLastSyncedAt: Date | null;
  productCriticalStockThreshold: number | null;
  productLowStockThreshold: number | null;
  parentCriticalStockThreshold: number | null;
  parentLowStockThreshold: number | null;
};

async function resolveFoundationVariantInventoryTargetByCatalogVariantId(
  catalogVariantId: string
): Promise<FoundationVariantInventoryTarget | null> {
  const catalogVariant = await prisma.catalogVariant.findUnique({
    where: { id: catalogVariantId },
    include: {
      inventory: true,
      catalogProduct: {
        select: {
          sourceProductId: true
        }
      }
    }
  });

  if (!catalogVariant) {
    return null;
  }

  const sourceProduct = catalogVariant.sourceProductId
    ? await prisma.product.findUnique({
        where: { id: catalogVariant.sourceProductId },
        include: {
          parent: {
            select: {
              criticalStockThreshold: true,
              lowStockThreshold: true
            }
          }
        }
      })
    : null;

  return {
    catalogVariantId: catalogVariant.id,
    sku: catalogVariant.sku,
    sourceProductId: catalogVariant.sourceProductId ?? null,
    sourceSyncStatus: sourceProduct?.syncStatus ?? null,
    sourceLastSyncedAt: sourceProduct?.lastSyncedAt ?? null,
    productCriticalStockThreshold: sourceProduct?.criticalStockThreshold ?? null,
    productLowStockThreshold: sourceProduct?.lowStockThreshold ?? null,
    parentCriticalStockThreshold: sourceProduct?.parent?.criticalStockThreshold ?? null,
    parentLowStockThreshold: sourceProduct?.parent?.lowStockThreshold ?? null
  };
}

async function resolveFoundationCatalogVariantIdByWebhookIdentifiers(input: {
  accountKey: TinyAccountKey;
  sku?: string | null;
  tinyProductId?: string | null;
}) {
  if (input.sku) {
    const bySku = await prisma.catalogVariant.findUnique({
      where: { sku: input.sku },
      select: { id: true }
    });

    if (bySku) {
      return bySku.id;
    }
  }

  if (input.tinyProductId) {
    const byMapping = await prisma.catalogTinyMapping.findFirst({
      where: {
        accountKey: input.accountKey,
        entityType: "variant",
        tinyId: input.tinyProductId,
        catalogVariantId: {
          not: null
        }
      },
      select: {
        catalogVariantId: true
      }
    });

    if (byMapping?.catalogVariantId) {
      return byMapping.catalogVariantId;
    }

    const byTinyProductId = await prisma.catalogVariant.findFirst({
      where: { tinyProductId: input.tinyProductId },
      select: { id: true }
    });

    if (byTinyProductId) {
      return byTinyProductId.id;
    }
  }

  const legacyVariant = input.sku
    ? await prisma.product.findUnique({
        where: { sku: input.sku },
        select: { id: true }
      })
    : input.tinyProductId
      ? await prisma.product.findFirst({
          where: { tinyProductId: input.tinyProductId },
          select: { id: true }
        })
      : null;

  if (!legacyVariant?.id) {
    return null;
  }

  const catalogVariant = await prisma.catalogVariant.findFirst({
    where: { sourceProductId: legacyVariant.id },
    select: { id: true }
  });

  return catalogVariant?.id ?? null;
}

async function resolveTinyProductIdForStockRefresh(input: {
  catalogVariantId: string;
  accountKey: TinyAccountKey;
  sku?: string | null;
  tinyProductId?: string | null;
}) {
  if (input.sku) {
    const exactMatches = await searchTinyProductsBySku(input.sku, input.accountKey);
    const exact = exactMatches.find((candidate) => candidate.sku === input.sku);
    if (exact?.id) {
      return exact.id;
    }
  }

  const directMapping = await prisma.catalogTinyMapping.findFirst({
    where: {
      accountKey: input.accountKey,
      entityType: "variant",
      catalogVariantId: input.catalogVariantId
    },
    select: {
      tinyId: true
    }
  });

  if (directMapping?.tinyId && /^\d+$/.test(directMapping.tinyId)) {
    return directMapping.tinyId;
  }

  if (input.tinyProductId && /^\d+$/.test(input.tinyProductId)) {
    return input.tinyProductId;
  }

  return null;
}

function readWebhookString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toStringValue(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function extractTinyStockMovementContext(parsed: z.infer<typeof tinyWebhookEnvelopeSchema>) {
  const details = parsed.dados && typeof parsed.dados === "object" ? (parsed.dados as Record<string, unknown>) : {};
  const movementOrigin =
    readWebhookString(details, ["origem", "origemMovimento", "origem_movimento", "historico", "descricao"]) ??
    readWebhookString(parsed as unknown as Record<string, unknown>, ["origem", "historico"]);
  const orderId = readWebhookString(details, [
    "idPedido",
    "id_pedido",
    "pedidoId",
    "pedido_id",
    "idObjeto",
    "numeroPedido"
  ]);
  const invoiceId = readWebhookString(details, [
    "idNotaFiscal",
    "id_nota_fiscal",
    "notaFiscalId",
    "nota_fiscal_id",
    "numeroNota",
    "numeroNotaFiscal"
  ]);
  const separationId = readWebhookString(details, [
    "idSeparacao",
    "id_separacao",
    "separacaoId",
    "separacao_id"
  ]);
  const hasCommercialContext = Boolean(orderId || invoiceId || separationId);

  return {
    movementType: parsed.dados?.tipoEstoque?.trim() ?? null,
    movementOrigin,
    orderId,
    invoiceId,
    separationId,
    hasCommercialContext,
    isManualSignal: !hasCommercialContext
  };
}

async function refreshFoundationInventoryFromTinySignal(params: {
  catalogVariantId: string;
  accountKey: TinyAccountKey;
  sku?: string | null;
  tinyProductId?: string | null;
}) {
  const authoritativeAccountKey = getPepperPhysicalStockAccountKey();
  const refreshProductId =
    (await resolveTinyProductIdForStockRefresh({
      ...params,
      accountKey: authoritativeAccountKey
    })) ??
    (params.accountKey === authoritativeAccountKey
      ? null
      : await resolveTinyProductIdForStockRefresh(params));

  if (!refreshProductId) {
    throw new Error(
      `Nao foi possivel localizar o produto Tiny da conta ${getPepperTinyAccountLabel(authoritativeAccountKey)} para reconciliar o saldo multiempresa oficial da fundacao.`
    );
  }

  const quantity = await getTinyStockByProductId(refreshProductId, authoritativeAccountKey);

  return {
    quantity,
    tinyProductId: refreshProductId,
    authoritativeAccountKey
  };
}

export async function persistFoundationVariantInventory(params: {
  catalogVariantId: string;
  quantity: number | null;
  syncStatus: InventorySyncStatus;
  syncedAt: Date;
  authoritativeAccountKey?: TinyAccountKey | null;
  signalAccountKey?: TinyAccountKey | null;
  reconciledTinyProductId?: string | null;
  rawPayload?: string | null;
  localSignalQuantity?: number | null;
}) {
  const target = await resolveFoundationVariantInventoryTargetByCatalogVariantId(params.catalogVariantId);

  if (!target) {
    throw new Error("Variacao de catalogo nao encontrada para atualizar estoque.");
  }

  const thresholds = resolveStockThresholds({
    productCritical: target.productCriticalStockThreshold,
    productLow: target.productLowStockThreshold,
    parentCritical: target.parentCriticalStockThreshold,
    parentLow: target.parentLowStockThreshold
  });

  const stockBand = getStockBand(params.quantity, thresholds);
  const targetCatalogVariantId = target.catalogVariantId;
  const targetSku = target.sku;

  await prisma.catalogInventory.upsert({
    where: {
      catalogVariantId: targetCatalogVariantId
    },
    update: {
      availableMultiCompanyStock: params.quantity,
      stockStatus: stockBand,
      inventorySyncStatus: params.syncStatus,
      lastStockSyncAt: params.syncedAt,
      source: "tiny",
      sourceAccountKey: params.authoritativeAccountKey ?? params.signalAccountKey ?? null,
      lastReconciledTinyId: params.reconciledTinyProductId ?? null,
      rawPayload: params.rawPayload ?? null
    },
    create: {
      catalogVariantId: targetCatalogVariantId,
      availableMultiCompanyStock: params.quantity,
      stockStatus: stockBand,
      inventorySyncStatus: params.syncStatus,
      lastStockSyncAt: params.syncedAt,
      source: "tiny",
      sourceAccountKey: params.authoritativeAccountKey ?? params.signalAccountKey ?? null,
      lastReconciledTinyId: params.reconciledTinyProductId ?? null,
      rawPayload: params.rawPayload ?? null
    }
  });

  async function upsertAccountState(accountKey: TinyAccountKey, localAvailableStock: number | null) {
    await prisma.catalogVariantAccountState.upsert({
      where: {
        catalogVariantId_accountKey: {
          catalogVariantId: targetCatalogVariantId,
          accountKey
        }
      },
      update: {
        sku: targetSku,
        tinyProductId: params.reconciledTinyProductId ?? null,
        localAvailableStock,
        availableMultiCompanyStock: params.quantity,
        inventorySyncStatus: params.syncStatus,
        lastStockSyncAt: params.syncedAt,
        source: "tiny",
        rawPayload: params.rawPayload ?? null
      },
      create: {
        catalogVariantId: targetCatalogVariantId,
        accountKey,
        sku: targetSku,
        tinyProductId: params.reconciledTinyProductId ?? null,
        localAvailableStock,
        availableMultiCompanyStock: params.quantity,
        inventorySyncStatus: params.syncStatus,
        lastStockSyncAt: params.syncedAt,
        source: "tiny",
        rawPayload: params.rawPayload ?? null
      }
    });
  }

  if (params.authoritativeAccountKey) {
    await upsertAccountState(
      params.authoritativeAccountKey,
      params.authoritativeAccountKey === params.signalAccountKey ? params.localSignalQuantity ?? params.quantity : null
    );
  }

  if (
    params.signalAccountKey &&
    params.signalAccountKey !== params.authoritativeAccountKey
  ) {
    await upsertAccountState(params.signalAccountKey, params.localSignalQuantity ?? null);
  }

  if (target.sourceProductId) {
    await prisma.inventorySnapshot.create({
      data: {
        productId: target.sourceProductId,
        quantity: params.quantity,
        status: params.syncStatus,
        stockBand
      }
    });

    await prisma.product.update({
      where: { id: target.sourceProductId },
      data: {
        fallbackInventory: params.quantity,
        lastSyncedAt: params.syncedAt,
        syncStatus:
          params.syncStatus === InventorySyncStatus.FRESH
            ? InventorySyncStatus.FRESH
            : InventorySyncStatus.STALE
      }
    });
  }

  return {
    sku: target.sku,
    stockBand
  };
}

export async function handleTinyStockWebhook(
  rawPayload: unknown,
  accountKey: TinyAccountKey = getPepperPhysicalStockAccountKey()
) {
  const parsed = tinyWebhookEnvelopeSchema.safeParse(rawPayload);

  if (!parsed.success) {
    const received = await beginFoundationWebhookProcessing({
      webhookType: "stock",
      accountKey,
      payload: rawPayload,
      entityType: "catalog_variant"
    });

    if (!received.duplicate) {
      await finalizeFoundationWebhookProcessing({
        logId: received.logId,
        status: "invalid_payload",
        processingStage: "failed",
        errorMessage: "Payload de webhook invalido."
      });
    }

    throw new Error("Payload de webhook invalido.");
  }

  const eventType = parsed.data.tipo?.trim() ?? "estoque";
  const isSyntheticSmokeEvent = /^smoke_/i.test(eventType);
  const sku =
    normalizeTinySku(parsed.data.dados?.sku) ??
    normalizeTinySku(parsed.data.dados?.skuMapeamento);
  const parentSku = normalizeTinySku(parsed.data.dados?.skuMapeamentoPai);
  const tinyProductId = parsed.data.dados?.idProduto
    ? String(parsed.data.dados.idProduto)
    : null;
  const quantity = toNullableNumber(parsed.data.dados?.saldo);
  const entityId = sku ?? tinyProductId ?? parentSku ?? null;
  const movementContext = extractTinyStockMovementContext(parsed.data);
  const received = await beginFoundationWebhookProcessing({
    webhookType: "stock",
    accountKey,
    eventType,
    entityType: "catalog_variant",
    entityId,
    sku,
    tinyProductId,
    payload: {
      accountKey,
      payload: rawPayload
    }
  });

  if (received.duplicate) {
    return {
      ok: true,
      duplicate: true,
      reason: "already_processed"
    };
  }

  const syncRun = await createFoundationSyncRun({
    triggerType: "webhook",
    scope: isPepperMatrixAccount(accountKey) ? "tiny_stock" : "tiny_stock_signal",
    status: "processing",
    accountKey,
    entityType: "catalog_variant",
    entityId
  });

  try {
    let catalogVariantId = await resolveFoundationCatalogVariantIdByWebhookIdentifiers({
      accountKey,
      sku,
      tinyProductId
    });

    if (!catalogVariantId) {
      const hydrationTargetSku = sku ?? parentSku;

      if (hydrationTargetSku) {
        await tryHydrateFoundationCatalogBySku({
          sku: hydrationTargetSku,
          triggerType: "stock_webhook_catalog_hydration",
          reason: "missing_catalog_variant"
        });

        catalogVariantId = await resolveFoundationCatalogVariantIdByWebhookIdentifiers({
          accountKey,
          sku,
          tinyProductId
        });
      }
    }

    if (!catalogVariantId) {
      await finalizeFoundationWebhookProcessing({
        logId: received.logId,
        status: "variant_not_found",
        processingStage: "persisted",
        entityType: "catalog_variant",
        entityId,
        sku,
        tinyProductId,
        errorMessage: "Nenhuma variacao encontrada para os identificadores do webhook."
      });
      await finalizeFoundationSyncRun({
        runId: syncRun.id,
        status: "warning",
        errorMessage: "Nenhuma variacao encontrada para os identificadores do webhook.",
        metadata: {
          accountKey,
          sku,
          tinyProductId
        }
      });

      return {
        ok: true,
        ignored: true,
        reason: "variant_not_found"
      };
    }

    const processedAt = new Date();
    const manualDependentAnomaly = !isPepperMatrixAccount(accountKey) && movementContext.isManualSignal;
    const reconciledQuantity = isSyntheticSmokeEvent
      ? null
      : await refreshFoundationInventoryFromTinySignal({
          catalogVariantId,
          accountKey,
          sku,
          tinyProductId
        });
    const finalQuantity = reconciledQuantity ? reconciledQuantity.quantity : quantity;
    const persisted = await persistFoundationVariantInventory({
      catalogVariantId,
      quantity: finalQuantity,
      syncStatus: finalQuantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
      syncedAt: processedAt,
      authoritativeAccountKey: reconciledQuantity?.authoritativeAccountKey ?? getPepperPhysicalStockAccountKey(),
      signalAccountKey: accountKey,
      reconciledTinyProductId: reconciledQuantity?.tinyProductId ?? tinyProductId,
      rawPayload: JSON.stringify(rawPayload),
      localSignalQuantity: quantity
    });
    const processingStage = isSyntheticSmokeEvent
      ? "synthetic_smoke"
      : manualDependentAnomaly
      ? "reconciled_dependent_manual_anomaly"
      : isPepperMatrixAccount(accountKey)
        ? "reconciled_matrix_signal"
        : "reconciled_dependent_signal";
    const syncStatus = manualDependentAnomaly || finalQuantity === null ? "warning" : "success";
    const anomalyMessage =
      manualDependentAnomaly
        ? `Movimentacao sem contexto de pedido/NF recebida em ${getPepperTinyAccountLabel(accountKey)}; a fundacao reconciliou o saldo multiempresa por SKU.`
        : null;

    await finalizeFoundationWebhookProcessing({
      logId: received.logId,
      status: "processed",
      processingStage,
      processedAt,
      entityType: "catalog_variant",
      entityId: catalogVariantId,
      sku: persisted.sku,
      tinyProductId: reconciledQuantity?.tinyProductId ?? tinyProductId,
      errorMessage: anomalyMessage,
      payload: {
        accountKey,
        payload: rawPayload,
        derived: {
          catalogVariantId,
          movementContext,
          quantity: finalQuantity,
          reconciledFromSignal: !isSyntheticSmokeEvent,
          reconciledTinyProductId: reconciledQuantity?.tinyProductId ?? null
        }
      }
    });
    await finalizeFoundationSyncRun({
      runId: syncRun.id,
      status: syncStatus,
      metadata: {
        accountKey,
        catalogVariantId,
        sku: persisted.sku,
        tinyProductId: reconciledQuantity?.tinyProductId ?? tinyProductId,
        quantity: finalQuantity,
        stockBand: persisted.stockBand,
        movementContext,
        reconciledFromSignal: !isSyntheticSmokeEvent
      }
    });

    if (persisted.sku) {
      await tryHydrateFoundationCatalogBySku({
        sku: persisted.sku,
        triggerType: "stock_webhook_catalog_media",
        reason: "ensure_media"
      });
    }

    return {
      ok: true,
      accountKey,
      reconciledFromSignal: !isSyntheticSmokeEvent,
      anomaly: manualDependentAnomaly,
      sku: persisted.sku,
      parentSku,
      availableMultiCompanyStock: finalQuantity,
      stockBand: persisted.stockBand
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar webhook de estoque.";

    await finalizeFoundationWebhookProcessing({
      logId: received.logId,
      status: "failed",
      processingStage: "failed",
      entityType: "catalog_variant",
      entityId,
      sku,
      tinyProductId,
      errorMessage: message
    });
    await finalizeFoundationSyncRun({
      runId: syncRun.id,
      status: "failed",
      errorMessage: message,
      metadata: {
        accountKey,
        sku,
        tinyProductId,
        quantity
      }
    });

    throw error;
  }
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

  const catalogVariants = await prisma.catalogVariant.findMany({
    where: {
      active: true,
      tinyProductId: { not: null },
      catalogProduct: {
        active: true,
        archivedAt: null
      }
    },
    include: {
      inventory: true
    },
    orderBy: { updatedAt: "asc" },
    take: params.limit ?? 200
  });

  const variants = catalogVariants.filter((variant) => {
    if (params.force) {
      return true;
    }

    if (!variant.inventory?.lastStockSyncAt) {
      return true;
    }

    if (variant.inventory.inventorySyncStatus === InventorySyncStatus.ERROR) {
      return true;
    }

    if (variant.inventory.inventorySyncStatus === InventorySyncStatus.STALE) {
      return true;
    }

    return variant.inventory.lastStockSyncAt < staleThreshold;
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
      try {
        const refreshProductId = await resolveTinyProductIdForStockRefresh({
          catalogVariantId: variant.id,
          accountKey: getPepperPhysicalStockAccountKey(),
          sku: variant.sku,
          tinyProductId: variant.tinyProductId
        });

        if (!refreshProductId) {
          throw new Error("Produto nao localizado para reconciliacao.");
        }

        const quantity = await getTinyStockByProductId(refreshProductId, getPepperPhysicalStockAccountKey());
        await persistFoundationVariantInventory({
          catalogVariantId: variant.id,
          quantity,
          syncStatus: quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
          syncedAt: new Date(),
          authoritativeAccountKey: getPepperPhysicalStockAccountKey(),
          reconciledTinyProductId: refreshProductId
        });
        updated += 1;
      } catch (error) {
        const fallbackQuantity = getTrustedFoundationInventoryQuantity(variant.inventory);
        await persistFoundationVariantInventory({
          catalogVariantId: variant.id,
          quantity: fallbackQuantity,
          syncStatus: InventorySyncStatus.ERROR,
          syncedAt: new Date(),
          authoritativeAccountKey: getPepperPhysicalStockAccountKey()
        });

        await prisma.tinyWebhookLog.create({
          data: {
            webhookType: "reconcile",
            accountKey: getPepperPhysicalStockAccountKey(),
            eventType: "inventory",
            entityType: "catalog_variant",
            entityId: variant.id,
            sku: variant.sku,
            tinyProductId: variant.tinyProductId,
            status: "error",
            processingStage: "reconcile_fallback",
            payload: JSON.stringify({
              source: "reconcile",
              sku: variant.sku
            }),
            errorMessage: error instanceof Error ? error.message : "Falha na reconciliacao.",
            processedAt: new Date()
          }
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
