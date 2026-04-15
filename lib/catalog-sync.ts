import { InventorySyncStatus, Prisma, PrismaClient, ProductKind } from "@prisma/client";

import { buildCatalogAiPackage } from "@/lib/catalog-ai";
import { getColorLabel, getSizeLabel } from "@/lib/sku";

type DbClient = Prisma.TransactionClient | PrismaClient;

function getDistinct<T>(values: T[]) {
  return Array.from(new Set(values));
}

async function loadOperationalParent(db: DbClient, parentSku: string) {
  return db.product.findUnique({
    where: { sku: parentSku },
    include: {
      assignments: true,
      variants: {
        include: {
          assignments: true,
          inventorySnapshots: {
            orderBy: { syncedAt: "desc" },
            take: 1
          }
        },
        orderBy: { sku: "asc" }
      }
    }
  });
}

async function removeCatalogProduct(db: DbClient, catalogProductId: string) {
  const variants = await db.catalogVariant.findMany({
    where: { catalogProductId },
    select: { id: true }
  });

  const variantIds = variants.map((variant) => variant.id);

  await db.catalogTinyMapping.deleteMany({
    where: {
      OR: [{ catalogProductId }, { catalogVariantId: { in: variantIds } }]
    }
  });

  await db.catalogAttribute.deleteMany({
    where: {
      OR: [{ catalogProductId }, { catalogVariantId: { in: variantIds } }]
    }
  });

  await db.catalogImage.deleteMany({
    where: {
      OR: [{ catalogProductId }, { catalogVariantId: { in: variantIds } }]
    }
  });

  await db.catalogPrice.deleteMany({
    where: { catalogVariantId: { in: variantIds } }
  });

  await db.catalogInventory.deleteMany({
    where: { catalogVariantId: { in: variantIds } }
  });

  await db.catalogMarketplaceListing.deleteMany({
    where: { catalogProductId }
  });

  await db.catalogProductSupplier.deleteMany({
    where: { catalogProductId }
  });

  await db.catalogVariant.deleteMany({
    where: { catalogProductId }
  });

  await db.catalogProduct.delete({
    where: { id: catalogProductId }
  });
}

export async function syncCatalogProductByParentSku(db: DbClient, parentSku: string) {
  const parent = await loadOperationalParent(db, parentSku);

  if (!parent || parent.kind !== ProductKind.PARENT) {
    return null;
  }

  const existingCatalogProduct = await db.catalogProduct.findFirst({
    where: {
      OR: [{ sourceProductId: parent.id }, { skuParent: parent.sku }]
    },
    select: { id: true }
  });

  if (existingCatalogProduct) {
    await removeCatalogProduct(db, existingCatalogProduct.id);
  }

  const availableSizes = getDistinct(
    parent.variants.map((variant) => getSizeLabel(variant.sizeCode))
  );
  const availableColors = getDistinct(
    parent.variants.map((variant) => getColorLabel(variant.colorCode))
  );

  const parentAi = buildCatalogAiPackage({
    productName: parent.internalName,
    skuParent: parent.sku,
    material: null,
    composition: null,
    model: null,
    gender: null,
    style: null,
    availableSizes,
    availableColors
  });

  const catalogProduct = await db.catalogProduct.create({
    data: {
      sourceProductId: parent.id,
      skuParent: parent.sku,
      baseCode: parent.baseCode,
      quantityCode: parent.quantityCode,
      name: parent.internalName,
      availableSizes: availableSizes.join(", "),
      availableColors: availableColors.join(", "),
      salesContextAi: parentAi.salesContextAi,
      searchText: parentAi.searchText,
      intentTags: parentAi.intentTags,
      tinyProductId: parent.tinyProductId,
      tinyCode: parent.tinyCode,
      mainImageUrl: parent.imageUrl,
      active: parent.active,
      archivedAt: parent.archivedAt
    }
  });

  const supplierIds = getDistinct([
    ...parent.assignments
      .filter((assignment) => assignment.active)
      .map((assignment) => assignment.supplierId),
    ...parent.variants.flatMap((variant) =>
      variant.assignments
        .filter((assignment) => assignment.active)
        .map((assignment) => assignment.supplierId)
    )
  ]);

  if (supplierIds.length > 0) {
    await db.catalogProductSupplier.createMany({
      data: supplierIds.map((supplierId) => ({
        catalogProductId: catalogProduct.id,
        supplierId
      }))
    });
  }

  if (parent.imageUrl) {
    await db.catalogImage.create({
      data: {
        catalogProductId: catalogProduct.id,
        imageType: "FRONT",
        url: parent.imageUrl,
        isPrimary: true,
        source: "portal"
      }
    });
  }

  if (parent.tinyProductId) {
    await db.catalogTinyMapping.create({
      data: {
        entityType: "product",
        catalogProductId: catalogProduct.id,
        sku: parent.sku,
        tinyId: parent.tinyProductId,
        tinyCode: parent.tinyCode,
        lastSyncAt: parent.lastSyncedAt,
        rawPayload: JSON.stringify({
          sku: parent.sku,
          tinyCode: parent.tinyCode,
          sourceProductId: parent.id
        })
      }
    });
  }

  for (const variant of parent.variants) {
    const latestInventory = variant.inventorySnapshots[0];
    const variantAi = buildCatalogAiPackage({
      productName: parent.internalName,
      skuParent: parent.sku,
      sku: variant.sku,
      colorLabel: getColorLabel(variant.colorCode),
      sizeLabel: getSizeLabel(variant.sizeCode),
      availableSizes,
      availableColors,
      availableMultiCompanyStock:
        latestInventory?.quantity ?? variant.fallbackInventory ?? null
    });

    const catalogVariant = await db.catalogVariant.create({
      data: {
        catalogProductId: catalogProduct.id,
        sourceProductId: variant.id,
        sku: variant.sku,
        quantityCode: variant.quantityCode,
        sizeCode: variant.sizeCode,
        sizeLabel: getSizeLabel(variant.sizeCode),
        colorCode: variant.colorCode,
        colorLabel: getColorLabel(variant.colorCode),
        salesContextAi: variantAi.salesContextAi,
        searchText: variantAi.searchText,
        intentTags: variantAi.intentTags,
        tinyProductId: variant.tinyProductId,
        tinyCode: variant.tinyCode,
        active: variant.active
      }
    });

    await db.catalogInventory.create({
      data: {
        catalogVariantId: catalogVariant.id,
        availableMultiCompanyStock:
          latestInventory?.quantity ?? variant.fallbackInventory ?? null,
        stockStatus: latestInventory?.stockBand ?? "not_imported",
        inventorySyncStatus: latestInventory?.status ?? "STALE",
        lastStockSyncAt: latestInventory?.syncedAt ?? variant.lastSyncedAt,
        source: "tiny"
      }
    });

    if (variant.imageUrl) {
      await db.catalogImage.create({
        data: {
          catalogProductId: catalogProduct.id,
          catalogVariantId: catalogVariant.id,
          imageType: "FRONT",
          url: variant.imageUrl,
          isPrimary: true,
          source: "portal"
        }
      });
    }

    if (variant.tinyProductId) {
      await db.catalogTinyMapping.create({
        data: {
          entityType: "variant",
          catalogProductId: catalogProduct.id,
          catalogVariantId: catalogVariant.id,
          sku: variant.sku,
          tinyId: variant.tinyProductId,
          tinyParentId: parent.tinyProductId,
          tinyCode: variant.tinyCode,
          lastSyncAt: variant.lastSyncedAt,
          rawPayload: JSON.stringify({
            sku: variant.sku,
            tinyCode: variant.tinyCode,
            sourceProductId: variant.id
          })
        }
      });
    }
  }

  return catalogProduct.id;
}

export async function rebuildCatalogLayer(db: DbClient) {
  await db.catalogProductSupplier.deleteMany();
  await db.catalogMarketplaceListing.deleteMany();
  await db.catalogTinyMapping.deleteMany();
  await db.catalogAttribute.deleteMany();
  await db.catalogImage.deleteMany();
  await db.catalogPrice.deleteMany();
  await db.catalogInventory.deleteMany();
  await db.catalogVariant.deleteMany();
  await db.catalogProduct.deleteMany();

  const parents = await db.product.findMany({
    where: { kind: ProductKind.PARENT },
    orderBy: { sku: "asc" },
    select: { sku: true }
  });

  for (const parent of parents) {
    await syncCatalogProductByParentSku(db, parent.sku);
  }
}

export async function syncCatalogVariantInventory(
  db: DbClient,
  params: {
    sourceProductId: string;
    availableMultiCompanyStock: number | null;
    stockStatus: string;
    inventorySyncStatus: InventorySyncStatus;
    syncedAt: Date;
  }
) {
  const catalogVariant = await db.catalogVariant.findFirst({
    where: {
      OR: [{ sourceProductId: params.sourceProductId }]
    },
    select: { id: true }
  });

  if (!catalogVariant) {
    return;
  }

  await db.catalogInventory.upsert({
    where: {
      catalogVariantId: catalogVariant.id
    },
    update: {
      availableMultiCompanyStock: params.availableMultiCompanyStock,
      stockStatus: params.stockStatus,
      inventorySyncStatus: params.inventorySyncStatus,
      lastStockSyncAt: params.syncedAt,
      source: "tiny"
    },
    create: {
      catalogVariantId: catalogVariant.id,
      availableMultiCompanyStock: params.availableMultiCompanyStock,
      stockStatus: params.stockStatus,
      inventorySyncStatus: params.inventorySyncStatus,
      lastStockSyncAt: params.syncedAt,
      source: "tiny"
    }
  });
}
