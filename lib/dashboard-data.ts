import { prisma } from "@/lib/prisma";
import { buildCatalogProductImageProxyUrl, PORTAL_BRAND_FALLBACK_IMAGE } from "@/lib/catalog-images";
import { getColorLabel, getParentSku, getSizeLabel } from "@/lib/sku";
import { getStockBand, getStockBandLabel, type StockBand, resolveStockThresholds } from "@/lib/stock";

type GroupedVariant = {
  sku: string;
  size: string;
  color: string;
  quantity: number | null;
  band: StockBand;
  bandLabel: string;
  criticalStockThreshold: number;
  lowStockThreshold: number;
};

export async function getSupplierDashboardDataFromDb(supplierId: string) {
  const products = await prisma.product.findMany({
    where: {
      kind: "VARIANT",
      active: true,
      archivedAt: null,
      assignments: {
        some: {
          supplierId,
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
      },
      assignments: {
        where: {
          supplierId,
          active: true
        },
        include: {
          supplier: true
        }
      }
    },
    orderBy: {
      sku: "asc"
    }
  });

  const groups = new Map<
    string,
    {
      id: string;
      sku: string;
      supplier: string;
      name: string;
      imageUrl: string;
      syncState: "fresh" | "stale";
      lastUpdated: string;
      variants: GroupedVariant[];
    }
  >();

  for (const product of products) {
    const parentSku = getParentSku(product.sku) ?? product.sku;
    const snapshot = product.inventorySnapshots[0];
    const supplier = product.assignments[0]?.supplier.name ?? "Fornecedor";
    const quantity = snapshot?.quantity ?? product.fallbackInventory ?? null;
    const thresholds = resolveStockThresholds({
      productCritical: product.criticalStockThreshold,
      productLow: product.lowStockThreshold,
      parentCritical: product.parent?.criticalStockThreshold,
      parentLow: product.parent?.lowStockThreshold
    });
    const variantBand = getStockBand(quantity, thresholds);
    const entry = groups.get(parentSku) ?? {
      id: parentSku,
      sku: parentSku,
      supplier,
      name: product.internalName.replace(/\s[PMGXÚÚNICO0-9]+?\s[A-Za-zÀ-ÿ]+$/u, "").trim() || product.internalName,
      imageUrl: buildCatalogProductImageProxyUrl(parentSku, product.imageUrl ?? PORTAL_BRAND_FALLBACK_IMAGE),
      syncState: product.syncStatus === "STALE" || product.syncStatus === "ERROR" ? "stale" : "fresh",
      lastUpdated: snapshot?.syncedAt
        ? `Atualizado em ${snapshot.syncedAt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          })}`
        : "Sem sincronização",
      variants: []
    };

    entry.variants.push({
      sku: product.sku,
      size: getSizeLabel(product.sizeCode),
      color: getColorLabel(product.colorCode),
      quantity,
      band: variantBand,
      bandLabel: getStockBandLabel(variantBand),
      criticalStockThreshold: thresholds.critical,
      lowStockThreshold: thresholds.low
    });

    groups.set(parentSku, entry);
  }

  return Array.from(groups.values()).map((group) => {
    const total = group.variants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0);
    const band: StockBand = getStockBand(total);
    const matrix = Array.from(new Set(group.variants.map((variant) => variant.color))).map((color) => ({
      color,
      items: group.variants
        .filter((variant) => variant.color === color)
        .map((variant) => ({
          sku: variant.sku,
          size: variant.size,
          colorLabel: variant.color,
          quantity: variant.quantity,
          status: variant.bandLabel,
          band: variant.band,
          criticalStockThreshold: variant.criticalStockThreshold,
          lowStockThreshold: variant.lowStockThreshold
        }))
    }));

    return {
      id: group.id,
      supplier: group.supplier,
      name: group.name,
      sku: group.sku,
      imageUrl: group.imageUrl,
      lastUpdated: group.lastUpdated,
      syncState: group.syncState,
      total,
      band,
      bandLabel: getStockBandLabel(band),
      matrix
    };
  });
}
