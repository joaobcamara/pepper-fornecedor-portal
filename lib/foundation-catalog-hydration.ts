import { InventorySyncStatus, ProductKind } from "@prisma/client";

import { syncCatalogProductByParentSku } from "@/lib/catalog-sync";
import { createFoundationSyncRun, finalizeFoundationSyncRun } from "@/lib/foundation-event-orchestrator";
import { prisma } from "@/lib/prisma";
import { getParentSku, normalizeSku, parseSku } from "@/lib/sku";
import {
  PORTAL_BRAND_FALLBACK_IMAGE,
  extractImageUrls,
  getTinyProductById,
  inspectTinyProductBySku,
  preferTinyImage,
  type TinyAccountKey
} from "@/lib/tiny";

const FOUNDATION_CATALOG_HYDRATION_SCOPE = "tiny_catalog_hydration";
const FOUNDATION_CATALOG_HYDRATION_WINDOW_MS = 15 * 60 * 1000;

type CatalogHydrationReason =
  | "missing_catalog_family"
  | "missing_catalog_variant"
  | "missing_parent_image"
  | "ensure_media";

export type FoundationCatalogHydrationResult = {
  status: "hydrated" | "skipped" | "failed";
  reason: string;
  parentSku: string;
  catalogProductId: string | null;
  imageCount: number;
  updatedVariants: number;
};

function hasUsableImage(url: string | null | undefined) {
  return Boolean(url && url.trim() && url !== PORTAL_BRAND_FALLBACK_IMAGE);
}

async function findCatalogHydrationNeed(params: {
  sku: string;
  reason: CatalogHydrationReason;
}) {
  const sku = normalizeSku(params.sku);
  const parentSku = getParentSku(sku) || sku;

  const catalogProduct = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: parentSku
    },
    include: {
      images: {
        where: {
          catalogVariantId: null
        },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
      },
      variants: {
        where: sku !== parentSku ? { sku } : undefined,
        select: {
          id: true,
          sku: true
        }
      }
    }
  });

  const hasRealParentImage =
    hasUsableImage(catalogProduct?.mainImageUrl) ||
    catalogProduct?.images.some((image) => hasUsableImage(image.url)) ||
    false;
  const variantExists = sku === parentSku ? true : catalogProduct?.variants.some((variant) => variant.sku === sku) ?? false;
  const missingCatalogFamily = !catalogProduct;
  const missingCatalogVariant = sku !== parentSku && !variantExists;
  const missingParentImage = !hasRealParentImage;
  const shouldHydrate =
    params.reason === "ensure_media"
      ? missingCatalogFamily || missingCatalogVariant || missingParentImage
      : params.reason === "missing_parent_image"
        ? missingParentImage
        : params.reason === "missing_catalog_variant"
          ? missingCatalogVariant || missingCatalogFamily
          : missingCatalogFamily;

  return {
    sku,
    parentSku,
    catalogProduct,
    missingCatalogFamily,
    missingCatalogVariant,
    missingParentImage,
    shouldHydrate
  };
}

async function hasRecentCatalogHydration(parentSku: string) {
  const recentThreshold = new Date(Date.now() - FOUNDATION_CATALOG_HYDRATION_WINDOW_MS);

  return prisma.syncRun.findFirst({
    where: {
      scope: FOUNDATION_CATALOG_HYDRATION_SCOPE,
      entityType: "catalog_product",
      entityId: parentSku,
      startedAt: {
        gte: recentThreshold
      },
      status: {
        in: ["processing", "success", "completed"]
      }
    },
    orderBy: {
      startedAt: "desc"
    },
    select: {
      id: true,
      status: true,
      startedAt: true
    }
  });
}

async function upsertOperationalFamilyFromTiny(params: {
  parentSku: string;
  accountKey: TinyAccountKey;
}) {
  const inspection = await inspectTinyProductBySku(params.parentSku, {
    includeStock: false
  });
  const now = new Date();
  const parentParsed = parseSku(inspection.parent.sku);

  if (!parentParsed) {
    throw new Error(`Nao foi possivel interpretar o SKU pai ${inspection.parent.sku} para hidratar a fundacao.`);
  }

  const parentRaw = await getTinyProductById(inspection.parent.id, params.accountKey);
  const parentImageUrls = extractImageUrls(parentRaw);
  const primaryParentImage = parentImageUrls[0] ?? inspection.parent.imageUrl ?? null;

  const existingParent = await prisma.product.findUnique({
    where: {
      sku: inspection.parent.sku
    }
  });

  const parent = existingParent
    ? await prisma.product.update({
        where: {
          sku: inspection.parent.sku
        },
        data: {
          tinyProductId: inspection.parent.id,
          tinyCode: inspection.parent.sku,
          imageUrl: preferTinyImage(existingParent.imageUrl, primaryParentImage),
          kind: ProductKind.PARENT,
          active: existingParent.active,
          lastSyncedAt: now
        }
      })
    : await prisma.product.create({
        data: {
          internalName: inspection.parent.name,
          sku: inspection.parent.sku,
          skuParent: null,
          baseCode: parentParsed.baseCode,
          quantityCode: parentParsed.quantityCode,
          sizeCode: null,
          colorCode: null,
          tinyProductId: inspection.parent.id,
          tinyVariationId: null,
          tinyCode: inspection.parent.sku,
          imageUrl: primaryParentImage ?? PORTAL_BRAND_FALLBACK_IMAGE,
          active: true,
          kind: ProductKind.PARENT,
          syncStatus: InventorySyncStatus.STALE,
          lastSyncedAt: now
        }
      });

  const processedVariantSkus: string[] = [];

  for (const variant of inspection.variants) {
    const existingVariant = await prisma.product.findUnique({
      where: {
        sku: variant.sku
      }
    });
    const ownVariantImage = variant.imageUrl && variant.imageUrl !== primaryParentImage ? variant.imageUrl : null;

    await prisma.product.upsert({
      where: {
        sku: variant.sku
      },
      update: {
        internalName: existingVariant?.internalName ?? variant.name,
        skuParent: inspection.parent.sku,
        baseCode: variant.baseCode,
        quantityCode: variant.quantityCode,
        sizeCode: variant.sizeCode ?? null,
        colorCode: variant.colorCode ?? null,
        tinyProductId: variant.id,
        tinyVariationId: variant.id,
        tinyCode: variant.sku,
        imageUrl: preferTinyImage(existingVariant?.imageUrl, ownVariantImage),
        parentId: parent.id,
        kind: ProductKind.VARIANT,
        active: existingVariant?.active ?? true,
        lastSyncedAt: now
      },
      create: {
        internalName: variant.name,
        sku: variant.sku,
        skuParent: inspection.parent.sku,
        baseCode: variant.baseCode,
        quantityCode: variant.quantityCode,
        sizeCode: variant.sizeCode ?? null,
        colorCode: variant.colorCode ?? null,
        tinyProductId: variant.id,
        tinyVariationId: variant.id,
        tinyCode: variant.sku,
        imageUrl: ownVariantImage,
        active: true,
        kind: ProductKind.VARIANT,
        parentId: parent.id,
        syncStatus: InventorySyncStatus.STALE,
        lastSyncedAt: now
      }
    });

    processedVariantSkus.push(variant.sku);
  }

  await prisma.product.updateMany({
    where: {
      parentId: parent.id,
      kind: ProductKind.VARIANT,
      sku: {
        notIn: processedVariantSkus
      }
    },
    data: {
      active: false
    }
  });

  const catalogProductId = await syncCatalogProductByParentSku(prisma, inspection.parent.sku, {
    preserveInventory: true
  });

  if (catalogProductId) {
    await prisma.catalogProduct.update({
      where: {
        id: catalogProductId
      },
      data: {
        mainImageUrl: primaryParentImage
      }
    });

    await prisma.catalogImage.deleteMany({
      where: {
        catalogProductId,
        catalogVariantId: null,
        source: "tiny"
      }
    });

    const extraGalleryUrls = parentImageUrls.filter((url) => url !== primaryParentImage);
    if (extraGalleryUrls.length > 0) {
      await prisma.catalogImage.createMany({
        data: extraGalleryUrls.map((url, index) => ({
          catalogProductId,
          imageType: "DETAIL",
          url,
          isPrimary: false,
          sortOrder: index + 1,
          source: "tiny",
          sourceAccountKey: params.accountKey,
          rawPayload: JSON.stringify({
            parentSku: inspection.parent.sku,
            source: "tiny_media_hydration"
          })
        }))
      });
    }

    await prisma.foundationAsset.deleteMany({
      where: {
        ownerDomain: "catalog",
        ownerEntityType: "catalog_product",
        ownerEntityId: catalogProductId,
        provider: "tiny",
        assetType: "image",
        sourceAccountKey: params.accountKey
      }
    });

    if (parentImageUrls.length > 0) {
      await prisma.foundationAsset.createMany({
        data: parentImageUrls.map((url, index) => ({
          ownerDomain: "catalog",
          ownerEntityType: "catalog_product",
          ownerEntityId: catalogProductId,
          assetType: "image",
          provider: "tiny",
          sourceAccountKey: params.accountKey,
          fileName: url.split("/").pop() ?? null,
          extension: url.split(".").pop() ?? null,
          url,
          previewUrl: url,
          originalUrl: url,
          isPrimary: index === 0,
          sortOrder: index,
          metadataJson: JSON.stringify({
            parentSku: inspection.parent.sku
          }),
          rawPayload: JSON.stringify({
            parentSku: inspection.parent.sku,
            source: "tiny_media_hydration"
          })
        }))
      });
    }
  }

  return {
    parentSku: inspection.parent.sku,
    catalogProductId: catalogProductId ?? null,
    imageCount: parentImageUrls.length,
    updatedVariants: inspection.variants.length
  };
}

export async function hydrateFoundationCatalogBySku(params: {
  sku: string;
  accountKey?: TinyAccountKey;
  triggerType: string;
  reason?: CatalogHydrationReason;
  requestedByUserId?: string | null;
  force?: boolean;
}) {
  const reason = params.reason ?? "ensure_media";
  const need = await findCatalogHydrationNeed({
    sku: params.sku,
    reason
  });

  if (!need.shouldHydrate && !params.force) {
    return {
      status: "skipped",
      reason: "foundation_already_ready",
      parentSku: need.parentSku,
      catalogProductId: need.catalogProduct?.id ?? null,
      imageCount: 0,
      updatedVariants: 0
    } satisfies FoundationCatalogHydrationResult;
  }

  if (!params.force) {
    const recent = await hasRecentCatalogHydration(need.parentSku);
    if (recent) {
      return {
        status: "skipped",
        reason: "recent_hydration",
        parentSku: need.parentSku,
        catalogProductId: need.catalogProduct?.id ?? null,
        imageCount: 0,
        updatedVariants: 0
      } satisfies FoundationCatalogHydrationResult;
    }
  }

  const run = await createFoundationSyncRun({
    triggerType: params.triggerType,
    scope: FOUNDATION_CATALOG_HYDRATION_SCOPE,
    status: "processing",
    accountKey: params.accountKey ?? "pepper",
    entityType: "catalog_product",
    entityId: need.parentSku,
    metadata: {
      sku: need.sku,
      parentSku: need.parentSku,
      reason
    },
    requestedByUserId: params.requestedByUserId ?? null
  });

  try {
    const hydrated = await upsertOperationalFamilyFromTiny({
      parentSku: need.parentSku,
      accountKey: params.accountKey ?? "pepper"
    });

    await finalizeFoundationSyncRun({
      runId: run.id,
      status: "success",
      metadata: {
        sku: need.sku,
        parentSku: hydrated.parentSku,
        catalogProductId: hydrated.catalogProductId,
        imageCount: hydrated.imageCount,
        updatedVariants: hydrated.updatedVariants,
        reason
      }
    });

    return {
      status: "hydrated",
      reason,
      parentSku: hydrated.parentSku,
      catalogProductId: hydrated.catalogProductId,
      imageCount: hydrated.imageCount,
      updatedVariants: hydrated.updatedVariants
    } satisfies FoundationCatalogHydrationResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao hidratar catalogo da fundacao.";

    await finalizeFoundationSyncRun({
      runId: run.id,
      status: "failed",
      errorMessage: message,
      metadata: {
        sku: need.sku,
        parentSku: need.parentSku,
        reason
      }
    });

    return {
      status: "failed",
      reason: message,
      parentSku: need.parentSku,
      catalogProductId: need.catalogProduct?.id ?? null,
      imageCount: 0,
      updatedVariants: 0
    } satisfies FoundationCatalogHydrationResult;
  }
}

export async function tryHydrateFoundationCatalogBySku(params: {
  sku: string;
  accountKey?: TinyAccountKey;
  triggerType: string;
  reason?: CatalogHydrationReason;
}) {
  try {
    return await hydrateFoundationCatalogBySku(params);
  } catch {
    return null;
  }
}
