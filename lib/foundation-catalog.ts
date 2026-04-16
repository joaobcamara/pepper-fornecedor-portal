import { InventorySyncStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getColorLabel, getParentSku, getSizeLabel, normalizeSku } from "@/lib/sku";
import { getStockBand, resolveStockThresholds, type StockBand } from "@/lib/stock";

type FoundationCatalogLoadParams = {
  supplierId?: string;
  onlyActive?: boolean;
  catalogProductIds?: string[];
};

export type FoundationCatalogSupplierLink = {
  id: string;
  name: string;
  slug: string;
};

export type FoundationCatalogVariantRecord = {
  id: string;
  sourceProductId: string | null;
  sku: string;
  quantityCode: string;
  sizeCode: string | null;
  sizeLabel: string;
  colorCode: string | null;
  colorLabel: string;
  quantity: number | null;
  stockStatus: string | null;
  inventorySyncStatus: InventorySyncStatus;
  lastStockSyncAt: Date | null;
  salePrice: number | null;
  promotionalPrice: number | null;
  costPrice: number | null;
  imageUrl: string | null;
  active: boolean;
  tinyProductId: string | null;
  tinyCode: string | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  parentCriticalStockThreshold: number | null;
  parentLowStockThreshold: number | null;
  effectiveCriticalStockThreshold: number;
  effectiveLowStockThreshold: number;
  band: StockBand;
  sourceSyncStatus: InventorySyncStatus | null;
  sourceLastSyncedAt: Date | null;
  sourceFallbackInventory: number | null;
};

export type FoundationCatalogProductRecord = {
  id: string;
  sourceProductId: string | null;
  parentSku: string;
  internalName: string;
  imageUrl: string | null;
  active: boolean;
  archivedAt: Date | null;
  availableSizes: string[];
  availableColors: string[];
  supplierLinks: FoundationCatalogSupplierLink[];
  variants: FoundationCatalogVariantRecord[];
  totalStock: number;
  staleVariantCount: number;
  syncState: "fresh" | "stale";
  lastUpdatedAt: Date | null;
};

type SourceProductRecord = {
  id: string;
  parentId: string | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  syncStatus: InventorySyncStatus;
  lastSyncedAt: Date | null;
  fallbackInventory: number | null;
};

function getCatalogImageUrl(params: {
  mainImageUrl?: string | null;
  productImages?: Array<{ url: string; isPrimary: boolean }>;
  variantImages?: Array<{ url: string; isPrimary: boolean }>;
}) {
  return (
    params.mainImageUrl ??
    params.variantImages?.find((image) => image.isPrimary)?.url ??
    params.variantImages?.[0]?.url ??
    params.productImages?.find((image) => image.isPrimary)?.url ??
    params.productImages?.[0]?.url ??
    null
  );
}

function getLatestDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) {
      return latest;
    }

    if (!latest || value > latest) {
      return value;
    }

    return latest;
  }, null);
}

async function loadFoundationCatalogProductsInternal(params: FoundationCatalogLoadParams) {
  const where: Prisma.CatalogProductWhereInput = {
    ...(params.onlyActive ? { active: true, archivedAt: null } : {}),
    ...(params.supplierId
      ? {
          supplierLinks: {
            some: {
              supplierId: params.supplierId,
              active: true
            }
          }
        }
      : {}),
    ...(params.catalogProductIds?.length
      ? {
          id: {
            in: params.catalogProductIds
          }
        }
      : {})
  };

  const catalogProducts = await prisma.catalogProduct.findMany({
    where,
    include: {
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
      },
      supplierLinks: {
        where: params.supplierId
          ? {
              supplierId: params.supplierId,
              active: true
            }
          : {
              active: true
            },
        include: {
          supplier: true
        }
      },
      variants: {
        where: params.onlyActive ? { active: true } : undefined,
        include: {
          inventory: true,
          price: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
          }
        },
        orderBy: {
          sku: "asc"
        }
      }
    },
    orderBy: {
      skuParent: "asc"
    }
  });

  const sourceProductIds = Array.from(
    new Set(
      catalogProducts.flatMap((product) =>
        [product.sourceProductId, ...product.variants.map((variant) => variant.sourceProductId)].filter(
          (value): value is string => Boolean(value)
        )
      )
    )
  );

  const sourceProducts = sourceProductIds.length
    ? await prisma.product.findMany({
        where: {
          id: {
            in: sourceProductIds
          }
        },
        select: {
          id: true,
          parentId: true,
          criticalStockThreshold: true,
          lowStockThreshold: true,
          syncStatus: true,
          lastSyncedAt: true,
          fallbackInventory: true
        }
      })
    : [];

  const sourceProductById = new Map<string, SourceProductRecord>(
    sourceProducts.map((product) => [
      product.id,
      {
        id: product.id,
        parentId: product.parentId,
        criticalStockThreshold: product.criticalStockThreshold,
        lowStockThreshold: product.lowStockThreshold,
        syncStatus: product.syncStatus,
        lastSyncedAt: product.lastSyncedAt,
        fallbackInventory: product.fallbackInventory
      }
    ])
  );

  return catalogProducts.map<FoundationCatalogProductRecord>((catalogProduct) => {
    const parentSource = catalogProduct.sourceProductId
      ? sourceProductById.get(catalogProduct.sourceProductId) ?? null
      : null;

    const variants = catalogProduct.variants.map<FoundationCatalogVariantRecord>((variant) => {
      const sourceProduct = variant.sourceProductId ? sourceProductById.get(variant.sourceProductId) ?? null : null;
      const thresholds = resolveStockThresholds({
        productCritical: sourceProduct?.criticalStockThreshold ?? null,
        productLow: sourceProduct?.lowStockThreshold ?? null,
        parentCritical: parentSource?.criticalStockThreshold ?? null,
        parentLow: parentSource?.lowStockThreshold ?? null
      });
      const quantity = variant.inventory?.availableMultiCompanyStock ?? sourceProduct?.fallbackInventory ?? null;
      const band = getStockBand(quantity, thresholds);

      return {
        id: variant.id,
        sourceProductId: variant.sourceProductId ?? null,
        sku: variant.sku,
        quantityCode: variant.quantityCode,
        sizeCode: variant.sizeCode ?? null,
        sizeLabel: variant.sizeLabel ?? getSizeLabel(variant.sizeCode),
        colorCode: variant.colorCode ?? null,
        colorLabel: variant.colorLabel ?? getColorLabel(variant.colorCode),
        quantity,
        stockStatus: variant.inventory?.stockStatus ?? null,
        inventorySyncStatus: variant.inventory?.inventorySyncStatus ?? sourceProduct?.syncStatus ?? InventorySyncStatus.STALE,
        lastStockSyncAt: variant.inventory?.lastStockSyncAt ?? sourceProduct?.lastSyncedAt ?? null,
        salePrice: variant.price?.salePrice ?? null,
        promotionalPrice: variant.price?.promotionalPrice ?? null,
        costPrice: variant.price?.costPrice ?? null,
        imageUrl: getCatalogImageUrl({
          variantImages: variant.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
          productImages: catalogProduct.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
          mainImageUrl: catalogProduct.mainImageUrl
        }),
        active: variant.active,
        tinyProductId: variant.tinyProductId ?? null,
        tinyCode: variant.tinyCode ?? null,
        criticalStockThreshold: sourceProduct?.criticalStockThreshold ?? null,
        lowStockThreshold: sourceProduct?.lowStockThreshold ?? null,
        parentCriticalStockThreshold: parentSource?.criticalStockThreshold ?? null,
        parentLowStockThreshold: parentSource?.lowStockThreshold ?? null,
        effectiveCriticalStockThreshold: thresholds.critical,
        effectiveLowStockThreshold: thresholds.low,
        band,
        sourceSyncStatus: sourceProduct?.syncStatus ?? null,
        sourceLastSyncedAt: sourceProduct?.lastSyncedAt ?? null,
        sourceFallbackInventory: sourceProduct?.fallbackInventory ?? null
      };
    });

    const totalStock = variants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0);
    const staleVariantCount = variants.filter((variant) => variant.inventorySyncStatus !== InventorySyncStatus.FRESH).length;
    const lastUpdatedAt = getLatestDate([
      ...variants.map((variant) => variant.lastStockSyncAt),
      catalogProduct.updatedAt
    ]);

    return {
      id: catalogProduct.id,
      sourceProductId: catalogProduct.sourceProductId ?? null,
      parentSku: catalogProduct.skuParent,
      internalName: catalogProduct.name,
      imageUrl: getCatalogImageUrl({
        mainImageUrl: catalogProduct.mainImageUrl,
        productImages: catalogProduct.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary }))
      }),
      active: catalogProduct.active,
      archivedAt: catalogProduct.archivedAt,
      availableSizes: variants.map((variant) => variant.sizeLabel),
      availableColors: variants.map((variant) => variant.colorLabel),
      supplierLinks: catalogProduct.supplierLinks.map((link) => ({
        id: link.supplier.id,
        name: link.supplier.name,
        slug: link.supplier.slug
      })),
      variants,
      totalStock,
      staleVariantCount,
      syncState: staleVariantCount > 0 ? "stale" : "fresh",
      lastUpdatedAt
    };
  });
}

export async function listFoundationCatalogProducts(params: FoundationCatalogLoadParams = {}) {
  return loadFoundationCatalogProductsInternal(params);
}

export async function findFoundationCatalogProductBySku(inputSku: string, params: Omit<FoundationCatalogLoadParams, "catalogProductIds"> = {}) {
  const sku = normalizeSku(inputSku);
  const parentSku = getParentSku(sku) ?? sku;

  const [catalogVariantMatch, catalogProductMatch] = await Promise.all([
    prisma.catalogVariant.findUnique({
      where: {
        sku
      },
      select: {
        catalogProductId: true
      }
    }),
    prisma.catalogProduct.findUnique({
      where: {
        skuParent: parentSku
      },
      select: {
        id: true
      }
    })
  ]);

  const catalogProductId = catalogVariantMatch?.catalogProductId ?? catalogProductMatch?.id ?? null;

  if (!catalogProductId) {
    return null;
  }

  const [catalogProduct] = await loadFoundationCatalogProductsInternal({
    ...params,
    catalogProductIds: [catalogProductId]
  });

  return catalogProduct ?? null;
}
