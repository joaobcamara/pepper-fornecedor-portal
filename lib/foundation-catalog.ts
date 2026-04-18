import { InventorySyncStatus, type Prisma } from "@prisma/client";

import {
  pickPreferredCatalogImageUrl,
  PORTAL_BRAND_FALLBACK_IMAGE,
  resolvePortalCatalogImageUrl
} from "@/lib/catalog-images";
import {
  getTrustedFoundationInventoryLastSyncAt,
  getTrustedFoundationInventoryQuantity,
  getTrustedFoundationInventorySyncStatus
} from "@/lib/foundation-inventory";
import { readPortalCatalogViewState } from "@/lib/foundation-portal-catalog-state";
import { getPepperPhysicalStockAccountKey } from "@/lib/pepper-tiny-account-data";
import { prisma } from "@/lib/prisma";
import { getColorLabel, getParentSku, getSizeLabel, normalizeSku } from "@/lib/sku";
import { getStockBand, resolveStockThresholds, type StockBand } from "@/lib/stock";

type FoundationCatalogLoadParams = {
  supplierId?: string;
  onlyActive?: boolean;
  onlyPortalVisible?: boolean;
  catalogProductIds?: string[];
};

export type FoundationCatalogSupplierLink = {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  supplierSalePrice?: number | null;
  criticalStockThreshold?: number | null;
  lowStockThreshold?: number | null;
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
  reservedStock: number | null;
  localPhysicalStock: number | null;
  localAvailableStock: number | null;
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
};

export type FoundationCatalogProductRecord = {
  id: string;
  sourceProductId: string | null;
  parentSku: string;
  internalName: string;
  imageUrl: string | null;
  active: boolean;
  archivedAt: Date | null;
  portalVisible: boolean;
  portalArchivedAt: string | null;
  availableSizes: string[];
  availableColors: string[];
  supplierLinks: FoundationCatalogSupplierLink[];
  variants: FoundationCatalogVariantRecord[];
  totalStock: number;
  totalReservedStock: number;
  staleVariantCount: number;
  syncState: "fresh" | "stale";
  lastUpdatedAt: Date | null;
};

type SourceProductRecord = {
  id: string;
  parentId: string | null;
  imageUrl: string | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  syncStatus: InventorySyncStatus;
  lastSyncedAt: Date | null;
};
function pickPreferredImageUrl(candidates: Array<string | null | undefined>) {
  return pickPreferredCatalogImageUrl(candidates);
}

function getCatalogImageUrl(params: {
  mainImageUrl?: string | null;
  sourceImageUrl?: string | null;
  productImages?: Array<{ url: string; isPrimary: boolean }>;
  variantImages?: Array<{ url: string; isPrimary: boolean }>;
}) {
  return pickPreferredImageUrl([
    params.mainImageUrl,
    params.sourceImageUrl,
    params.variantImages?.find((image) => image.isPrimary)?.url,
    params.variantImages?.[0]?.url,
    params.productImages?.find((image) => image.isPrimary)?.url,
    params.productImages?.[0]?.url
  ]);
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
          imageUrl: true,
          criticalStockThreshold: true,
          lowStockThreshold: true,
          syncStatus: true,
          lastSyncedAt: true
        }
      })
    : [];

  const variantIds = catalogProducts.flatMap((product) => product.variants.map((variant) => variant.id));
  const accountStates = variantIds.length
    ? await prisma.catalogVariantAccountState.findMany({
        where: {
          catalogVariantId: {
            in: variantIds
          }
        }
      })
    : [];

  const sourceProductById = new Map<string, SourceProductRecord>(
    sourceProducts.map((product) => [
      product.id,
      {
        id: product.id,
        parentId: product.parentId,
        imageUrl: product.imageUrl,
        criticalStockThreshold: product.criticalStockThreshold,
        lowStockThreshold: product.lowStockThreshold,
        syncStatus: product.syncStatus,
        lastSyncedAt: product.lastSyncedAt
      }
    ])
  );
  const authoritativeAccountStateByVariantId = new Map(
    accountStates
      .filter((state) => state.accountKey === getPepperPhysicalStockAccountKey())
      .map((state) => [state.catalogVariantId, state] as const)
  );
  const reservedStockByVariantId = new Map<string, number>();

  for (const state of accountStates) {
    reservedStockByVariantId.set(
      state.catalogVariantId,
      (reservedStockByVariantId.get(state.catalogVariantId) ?? 0) + Math.max(0, state.reservedStock ?? 0)
    );
  }

  const foundationProducts = catalogProducts.map<FoundationCatalogProductRecord>((catalogProduct) => {
    const portalCatalogView = readPortalCatalogViewState(catalogProduct.foundationMetadataJson);
    const parentSource = catalogProduct.sourceProductId
      ? sourceProductById.get(catalogProduct.sourceProductId) ?? null
      : null;
    const supplierLink = params.supplierId ? catalogProduct.supplierLinks[0] ?? null : null;

    const variants = catalogProduct.variants.map<FoundationCatalogVariantRecord>((variant) => {
      const sourceProduct = variant.sourceProductId ? sourceProductById.get(variant.sourceProductId) ?? null : null;
      const thresholds = resolveStockThresholds({
        productCritical: sourceProduct?.criticalStockThreshold ?? null,
        productLow: sourceProduct?.lowStockThreshold ?? null,
        parentCritical: supplierLink?.criticalStockThreshold ?? parentSource?.criticalStockThreshold ?? null,
        parentLow: supplierLink?.lowStockThreshold ?? parentSource?.lowStockThreshold ?? null
      });
      const quantity = getTrustedFoundationInventoryQuantity(variant.inventory);
      const band = getStockBand(quantity, thresholds);
      const inventorySyncStatus = getTrustedFoundationInventorySyncStatus(
        variant.inventory,
        sourceProduct?.syncStatus ?? InventorySyncStatus.STALE
      );
      const lastStockSyncAt = getTrustedFoundationInventoryLastSyncAt(variant.inventory);
      const authoritativeAccountState = authoritativeAccountStateByVariantId.get(variant.id) ?? null;

      return {
        id: variant.id,
        sourceProductId: variant.sourceProductId ?? null,
        sku: variant.sku,
        quantityCode: variant.quantityCode,
        sizeCode: variant.sizeCode ?? null,
        sizeLabel: variant.sizeLabel ?? getSizeLabel(variant.sizeCode),
        colorCode: variant.colorCode ?? null,
        colorLabel: variant.colorLabel ?? getColorLabel(variant.colorCode, catalogProduct.name),
        quantity,
        reservedStock: reservedStockByVariantId.get(variant.id) ?? null,
        localPhysicalStock: authoritativeAccountState?.localPhysicalStock ?? null,
        localAvailableStock: authoritativeAccountState?.localAvailableStock ?? null,
        stockStatus: variant.inventory?.stockStatus ?? null,
        inventorySyncStatus,
        lastStockSyncAt,
        salePrice: supplierLink?.supplierSalePrice ?? variant.price?.salePrice ?? null,
        promotionalPrice: variant.price?.promotionalPrice ?? null,
        costPrice: variant.price?.costPrice ?? null,
        imageUrl: resolvePortalCatalogImageUrl({
          sku: variant.sku,
          imageUrl: getCatalogImageUrl({
            sourceImageUrl: sourceProduct?.imageUrl ?? parentSource?.imageUrl ?? null,
            variantImages: variant.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
            productImages: catalogProduct.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary })),
            mainImageUrl: catalogProduct.mainImageUrl
          }),
          fallbackUrl: PORTAL_BRAND_FALLBACK_IMAGE
        }),
        active: variant.active,
        tinyProductId: variant.tinyProductId ?? null,
        tinyCode: variant.tinyCode ?? null,
        criticalStockThreshold: sourceProduct?.criticalStockThreshold ?? null,
        lowStockThreshold: sourceProduct?.lowStockThreshold ?? null,
        parentCriticalStockThreshold: supplierLink?.criticalStockThreshold ?? parentSource?.criticalStockThreshold ?? null,
        parentLowStockThreshold: supplierLink?.lowStockThreshold ?? parentSource?.lowStockThreshold ?? null,
        effectiveCriticalStockThreshold: thresholds.critical,
        effectiveLowStockThreshold: thresholds.low,
        band,
        sourceSyncStatus: sourceProduct?.syncStatus ?? null,
        sourceLastSyncedAt: sourceProduct?.lastSyncedAt ?? null
      };
    });

    const totalStock = variants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0);
    const totalReservedStock = variants.reduce((sum, variant) => sum + (variant.reservedStock ?? 0), 0);
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
      imageUrl: resolvePortalCatalogImageUrl({
        sku: catalogProduct.skuParent,
        imageUrl: getCatalogImageUrl({
          sourceImageUrl: parentSource?.imageUrl ?? null,
          mainImageUrl: catalogProduct.mainImageUrl,
          productImages: catalogProduct.images.map((image) => ({ url: image.url, isPrimary: image.isPrimary }))
        }),
        fallbackUrl: PORTAL_BRAND_FALLBACK_IMAGE
      }),
      active: catalogProduct.active,
      archivedAt: catalogProduct.archivedAt,
      portalVisible: portalCatalogView.visible,
      portalArchivedAt: portalCatalogView.archivedAt,
      availableSizes: variants.map((variant) => variant.sizeLabel),
      availableColors: variants.map((variant) => variant.colorLabel),
      supplierLinks: catalogProduct.supplierLinks.map((link) => ({
        id: link.supplier.id,
        name: link.supplier.name,
        slug: link.supplier.slug,
        active: link.active,
        supplierSalePrice: link.supplierSalePrice ?? null,
        criticalStockThreshold: link.criticalStockThreshold ?? null,
        lowStockThreshold: link.lowStockThreshold ?? null
      })),
      variants,
      totalStock,
      totalReservedStock,
      staleVariantCount,
      syncState: staleVariantCount > 0 ? "stale" : "fresh",
      lastUpdatedAt
    };
  });

  return params.onlyPortalVisible ? foundationProducts.filter((product) => product.portalVisible) : foundationProducts;
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
