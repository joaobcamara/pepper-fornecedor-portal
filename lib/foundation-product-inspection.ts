import { findFoundationCatalogProductBySku } from "@/lib/foundation-catalog";
import {
  getLocalAdminSupplierOrderPageData,
  updateLocalProductConfiguration
} from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { getParentSku, normalizeSku } from "@/lib/sku";
import { getStockBand } from "@/lib/stock";
import type { TinyInspectionResult } from "@/lib/tiny";

export type FoundationImportResult = {
  batchId: string;
  importedVariants: number;
  parentSku: string;
  source: "foundation" | "tiny";
  sourceAccountKey?: string | null;
  sourceAccountLabel?: string | null;
  verification: {
    storedInFoundation: boolean;
    visibleInAdminProducts: boolean;
    visibleForSupplier: boolean;
  };
};

export async function inspectFoundationProductBySku(inputSku: string): Promise<TinyInspectionResult | null> {
  const sku = normalizeSku(inputSku);
  const parentSku = getParentSku(sku) || sku;

  if (isLocalOperationalMode()) {
    const localData = await getLocalAdminSupplierOrderPageData();
    const product =
      localData.products.find((item) => normalizeSku(item.productSku) === parentSku) ??
      localData.products.find((item) => item.variants.some((variant) => normalizeSku(variant.sku) === sku));

    if (!product) {
      return null;
    }

    return {
      searchedSku: sku,
      source: "tiny",
      sourceAccountKey: "foundation-local",
      sourceAccountLabel: "Fundacao local",
      parent: {
        id: product.id,
        sku: product.productSku,
        name: product.productName,
        imageUrl: product.imageUrl ?? null
      },
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: product.productName,
        sizeCode: variant.size,
        colorCode: variant.color,
        quantity: variant.currentStock ?? null,
        stockStatus: getStockBand(variant.currentStock ?? null),
        quantityCode: "",
        baseCode: "",
        raw: {}
      })),
      suggestions: []
    };
  }

  const foundationProduct = await findFoundationCatalogProductBySku(sku).catch(() => null);

  if (!foundationProduct) {
    return null;
  }

  return {
    searchedSku: sku,
    source: "tiny",
    sourceAccountKey: "foundation",
    sourceAccountLabel: "Fundacao Grupo Pepper",
    parent: {
      id: foundationProduct.id,
      sku: foundationProduct.parentSku,
      name: foundationProduct.internalName,
      imageUrl: foundationProduct.imageUrl ?? null
    },
    variants: foundationProduct.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: foundationProduct.internalName,
      sizeCode: variant.sizeCode,
      colorCode: variant.colorCode,
      quantity: variant.quantity,
      stockStatus: getStockBand(variant.quantity),
      quantityCode: variant.quantityCode,
      baseCode: foundationProduct.parentSku.split("-")[1] ?? "",
      raw: {}
    })),
    suggestions: []
  };
}

export async function ensureFoundationProductSupplierLinks(params: {
  parentSku: string;
  supplierIds: string[];
  actorUserId?: string;
}): Promise<FoundationImportResult> {
  const sku = normalizeSku(params.parentSku);

  if (isLocalOperationalMode()) {
    const inspection = await inspectFoundationProductBySku(sku);
    if (!inspection) {
      throw new Error("Produto nao encontrado na fundacao local.");
    }

    await updateLocalProductConfiguration({
      parentSku: inspection.parent.sku,
      internalName: inspection.parent.name,
      active: true,
      supplierIds: params.supplierIds,
      criticalStockThreshold: null,
      lowStockThreshold: null,
      variantThresholds: inspection.variants.map((variant) => ({
        sku: variant.sku,
        criticalStockThreshold: null,
        lowStockThreshold: null
      }))
    });

    return {
      batchId: `foundation-local-${inspection.parent.id}`,
      importedVariants: inspection.variants.length,
      parentSku: inspection.parent.sku,
      source: "foundation",
      sourceAccountKey: "foundation-local",
      sourceAccountLabel: "Fundacao local",
      verification: {
        storedInFoundation: true,
        visibleInAdminProducts: true,
        visibleForSupplier: params.supplierIds.length > 0
      }
    };
  }

  const foundationProduct = await findFoundationCatalogProductBySku(sku);

  if (!foundationProduct) {
    throw new Error("Produto nao encontrado na fundacao.");
  }

  const existingCatalogLinks = await prisma.catalogProductSupplier.findMany({
    where: {
      catalogProductId: foundationProduct.id
    }
  });

  const existingCatalogLinkMap = new Map(existingCatalogLinks.map((link) => [link.supplierId, link] as const));

  for (const supplierId of params.supplierIds) {
    const existing = existingCatalogLinkMap.get(supplierId);

    if (existing) {
      await prisma.catalogProductSupplier.update({
        where: {
          id: existing.id
        },
        data: {
          active: true
        }
      });
    } else {
      await prisma.catalogProductSupplier.create({
        data: {
          catalogProductId: foundationProduct.id,
          supplierId,
          active: true
        }
      });
    }
  }

  for (const existing of existingCatalogLinks) {
    if (!params.supplierIds.includes(existing.supplierId)) {
      await prisma.catalogProductSupplier.update({
        where: {
          id: existing.id
        },
        data: {
          active: false
        }
      });
    }
  }

  // A fundacao oficial ja vive na camada Catalog*. O espelho legado em ProductSupplier
  // fica fora deste fluxo para evitar travas de runtime enquanto a migracao nao termina.

  if (params.actorUserId) {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: "foundation.product.link_suppliers",
        entityType: "product",
        entityId: foundationProduct.parentSku,
        metadata: JSON.stringify({
          parentSku: foundationProduct.parentSku,
          supplierIds: params.supplierIds
        })
      }
    });
  }

  return {
    batchId: `foundation-${foundationProduct.id}`,
    importedVariants: foundationProduct.variants.length > 0 ? foundationProduct.variants.length : 1,
    parentSku: foundationProduct.parentSku,
    source: "foundation",
    sourceAccountKey: "foundation",
    sourceAccountLabel: "Fundacao Grupo Pepper",
    verification: {
      storedInFoundation: true,
      visibleInAdminProducts: true,
      visibleForSupplier: params.supplierIds.length > 0
    }
  };
}
