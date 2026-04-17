import { getLocalOperationsSnapshot } from "@/lib/local-operations-store";
import {
  getReplenishmentNextStep
} from "@/lib/operations-workflow";
import { getReplenishmentStatusLabel } from "@/lib/replenishment-data";
import { getMovementBadge, safeCoverageDays, type SalesPeriodTotals } from "@/lib/sales-metrics";
import { getStockBand, getStockBandLabel, type StockBand } from "@/lib/stock";
import type { AdminDashboardData } from "@/lib/admin-data";
import type { SupplierDashboardData } from "@/lib/supplier-dashboard-data";

const DEFAULT_THRESHOLDS = {
  critical: 2,
  low: 8
};

function emptySales(): SalesPeriodTotals {
  return {
    "1d": 0,
    "7d": 0,
    "1m": 0,
    "3m": 0,
    "6m": 0,
    "1a": 0
  };
}

function sumSales(items: Array<SalesPeriodTotals | undefined>): SalesPeriodTotals {
  return items.reduce<SalesPeriodTotals>(
    (acc, sales) => ({
      "1d": acc["1d"] + (sales?.["1d"] ?? 0),
      "7d": acc["7d"] + (sales?.["7d"] ?? 0),
      "1m": acc["1m"] + (sales?.["1m"] ?? 0),
      "3m": acc["3m"] + (sales?.["3m"] ?? 0),
      "6m": acc["6m"] + (sales?.["6m"] ?? 0),
      "1a": acc["1a"] + (sales?.["1a"] ?? 0)
    }),
    emptySales()
  );
}

function sortSizes(sizes: string[]) {
  return [...sizes].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function computeCoverage(totalStock: number, sales30d: number) {
  if (sales30d <= 0) {
    return safeCoverageDays(totalStock, 0);
  }

  return safeCoverageDays(totalStock, sales30d);
}

export async function getLocalAdminDashboardData(): Promise<AdminDashboardData> {
  const snapshot = await getLocalOperationsSnapshot();

  const productGroups = snapshot.products.map((product) => {
    const sales = sumSales(product.variants.map((variant) => variant.sales));
    const totalStock = product.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0), 0);
    const totalEstimatedCost = product.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0) * (variant.unitCost ?? 0), 0);
    const topVariant = [...product.variants].sort((left, right) => (right.sales?.["1m"] ?? 0) - (left.sales?.["1m"] ?? 0))[0] ?? null;
    const band = product.variants.reduce<StockBand>((current, variant) => {
      const next = getStockBand(variant.currentStock ?? null, DEFAULT_THRESHOLDS);
      if (next === "critical") return "critical";
      if (next === "low" && current !== "critical") return "low";
      if (next === "ok" && current === "unknown") return "ok";
      return current;
    }, "unknown");
    const relatedOrders = snapshot.orders.filter((order) => order.productSku === product.productSku);
    const latestOrder = relatedOrders[0] ?? null;
    const latestReplenishment = snapshot.replenishmentRequests.find((request) => request.productSku === product.productSku) ?? null;
    const linkedOrder = latestReplenishment?.linkedOrderId
      ? snapshot.orders.find((order) => order.id === latestReplenishment.linkedOrderId) ?? null
      : null;

    return {
      id: product.id,
      parentSku: product.productSku,
      internalName: product.productName,
      imageUrl: product.imageUrl ?? "/brand/pepper-logo.png",
      active: true,
      criticalStockThreshold: null,
      lowStockThreshold: null,
      variantCount: product.variants.length,
      totalStock,
      totalEstimatedCost,
      staleCount: 0,
      band,
      bandLabel: getStockBandLabel(band),
      sales,
      coverageDays: computeCoverage(totalStock, sales["1m"]),
      movementBadge: getMovementBadge({
        sales7d: sales["7d"],
        sales30d: sales["1m"],
        coverageDays: computeCoverage(totalStock, sales["1m"]),
        stockBand: band
      }),
      topColorLabel: topVariant?.color ?? null,
      topSizeLabel: topVariant?.size ?? null,
      supplierIds: [product.supplierId],
      suppliers: [{ id: product.supplierId, name: product.supplierName }],
      updatedAt: "Fundacao local",
      relatedOrderCount: relatedOrders.length,
      replenishmentCard: latestReplenishment
        ? {
            requestId: latestReplenishment.id,
            status: latestReplenishment.status,
            statusLabel: getReplenishmentStatusLabel(latestReplenishment.status),
            linkedOrderNumber: linkedOrder?.orderNumber ?? null,
            linkedFinancialStatusLabel: linkedOrder?.financialEntry?.statusLabel ?? null,
            nextStepLabel: getReplenishmentNextStep(
              latestReplenishment.status,
              linkedOrder
                ? {
                    orderNumber: linkedOrder.orderNumber,
                    hasFinancialEntry: Boolean(linkedOrder.financialEntry)
                  }
                : undefined
            ).label,
            supplierName: latestReplenishment.supplierName
          }
        : null,
      activeOrder: latestOrder
        ? {
            orderId: latestOrder.id,
            orderNumber: latestOrder.orderNumber,
            workflowStage: latestOrder.workflowStage,
            workflowStageLabel: latestOrder.workflowStageLabel,
            financialStatus: latestOrder.financialEntry?.status ?? null,
            financialStatusLabel: latestOrder.financialEntry?.statusLabel ?? null,
            supplierName: latestOrder.supplierName,
            originLabel: latestOrder.originLabel
          }
        : null,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        sizeCode: variant.size || null,
        sizeLabel: variant.size || "-",
        colorCode: variant.color || null,
        colorLabel: variant.color || "-",
        quantity: variant.currentStock ?? null,
        band: getStockBand(variant.currentStock ?? null, DEFAULT_THRESHOLDS),
        sales: variant.sales ?? emptySales(),
        sales15d: Math.max(variant.sales?.["7d"] ?? 0, Math.round((variant.sales?.["1m"] ?? 0) / 2)),
        unitCost: variant.unitCost ?? null,
        criticalStockThreshold: null,
        lowStockThreshold: null,
        effectiveCriticalStockThreshold: DEFAULT_THRESHOLDS.critical,
        effectiveLowStockThreshold: DEFAULT_THRESHOLDS.low
      }))
    };
  });

  const dashboard = {
    supplierCount: snapshot.suppliers.filter((supplier) => supplier.active).length,
    importCount: 0,
    productCount: productGroups.length,
    staleCount: 0,
    syncCount: 0,
    totalSalesToday: productGroups.reduce((sum, group) => sum + group.sales["1d"], 0),
    totalSales7d: productGroups.reduce((sum, group) => sum + group.sales["7d"], 0),
    totalSales30d: productGroups.reduce((sum, group) => sum + group.sales["1m"], 0),
    atRiskCount: productGroups.filter((group) => group.band === "critical" || group.band === "low").length,
    replenishmentPendingCount: snapshot.replenishmentRequests.filter((request) => request.status === "PENDING").length,
    orderCardsInProgress: snapshot.orders.filter((order) => ["AWAITING_RESPONSE", "IN_PREPARATION", "SEPARATION_CONFIRMED"].includes(order.workflowStage)).length,
    readyForFinancialCount: snapshot.orders.filter((order) => order.workflowStage === "READY_FOR_FINANCIAL").length,
    financialReviewCount: snapshot.financialEntries.filter((entry) => entry.status === "IN_REVIEW").length,
    paymentPendingCount: snapshot.financialEntries.filter((entry) => entry.status === "PENDING_PAYMENT").length
  };

  const topProducts = [...productGroups]
    .sort((left, right) => right.sales["1m"] - left.sales["1m"])
    .slice(0, 5)
    .map((group) => ({
      id: group.id,
      name: group.internalName,
      sku: group.parentSku,
      supplierName: group.suppliers[0]?.name ?? "Fornecedor",
      imageUrl: group.imageUrl,
      unitsSold: group.sales["1m"],
      revenue: 0,
      stock: group.totalStock,
      band: group.band,
      bandLabel: group.bandLabel,
      coverageDays: group.coverageDays
    }));

  const topSuppliers = snapshot.suppliers.map((supplier) => {
    const supplierProducts = productGroups.filter((group) => group.supplierIds.includes(supplier.id));
    return {
      id: supplier.id,
      name: supplier.name,
      unitsSold: supplierProducts.reduce((sum, product) => sum + product.sales["1m"], 0),
      revenue: 0,
      lastOrderAt: snapshot.orders.find((order) => order.supplierId === supplier.id)?.createdAt ?? null
    };
  });

  return {
    suppliers: snapshot.suppliers.filter((supplier) => supplier.active).map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      slug: supplier.slug
    })),
    recentImports: [],
    syncRuns: [],
    productGroups,
    dashboard,
    topSuppliers,
    topProducts,
    priorityProducts: [...topProducts].sort((left, right) => {
      if (left.band === right.band) return right.unitsSold - left.unitsSold;
      if (left.band === "critical") return -1;
      if (right.band === "critical") return 1;
      if (left.band === "low") return -1;
      if (right.band === "low") return 1;
      return 0;
    }),
    workflowWatchlist: snapshot.orders.slice(0, 6).map((order) => ({
      id: order.id,
      supplierName: order.supplierName,
      productName: order.productName,
      productSku: order.productSku,
      orderNumber: order.orderNumber,
      workflowStage: order.workflowStage,
      workflowStageLabel: order.workflowStageLabel,
      originLabel: order.originLabel,
      financialStatusLabel: order.financialEntry?.statusLabel ?? null,
      nextStepLabel: order.financialEntry?.statusLabel
        ? `Financeiro ${order.financialEntry.statusLabel.toLowerCase()}`
        : order.workflowStageLabel
    })),
    tinyConfigured: Boolean(process.env.TINY_API_TOKEN?.trim())
  };
}

export async function getLocalSupplierDashboardData(supplierId: string): Promise<SupplierDashboardData> {
  const snapshot = await getLocalOperationsSnapshot();
  const products = snapshot.products.filter((product) => product.supplierId === supplierId);

  const mappedProducts = products.map((product) => {
    const sales = sumSales(product.variants.map((variant) => variant.sales));
    const totalStock = product.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0), 0);
    const band = product.variants.reduce<StockBand>((current, variant) => {
      const next = getStockBand(variant.currentStock ?? null, DEFAULT_THRESHOLDS);
      if (next === "critical") return "critical";
      if (next === "low" && current !== "critical") return "low";
      if (next === "ok" && current === "unknown") return "ok";
      return current;
    }, "unknown");
    const latestReplenishment = snapshot.replenishmentRequests.find((request) => request.supplierId === supplierId && request.productSku === product.productSku) ?? null;
    const linkedOrder = latestReplenishment?.linkedOrderId
      ? snapshot.orders.find((order) => order.id === latestReplenishment.linkedOrderId) ?? null
      : null;
    const activeOrder = snapshot.orders.find((order) => order.supplierId === supplierId && order.productSku === product.productSku) ?? null;
    const topVariant = [...product.variants].sort((left, right) => (right.sales?.["1m"] ?? 0) - (left.sales?.["1m"] ?? 0))[0] ?? null;

    return {
      id: product.id,
      supplier: product.supplierName,
      name: product.productName,
      sku: product.productSku,
      imageUrl: product.imageUrl ?? "/brand/pepper-logo.png",
      lastUpdated: "Fundacao local",
      syncState: "fresh" as const,
      total: totalStock,
      band,
      bandLabel: getStockBandLabel(band),
      priceFrom: null,
      priceTo: null,
      inventorySaleValue: 0,
      inventoryCostValue: product.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0) * (variant.unitCost ?? 0), 0),
      matrix: Array.from(new Set(product.variants.map((variant) => variant.color || "-"))).map((color) => ({
        color,
        items: sortSizes(product.variants.filter((variant) => (variant.color || "-") === color).map((variant) => variant.size || "-")).map((size) => {
          const variant = product.variants.find((entry) => (entry.color || "-") === color && (entry.size || "-") === size)!;
          const quantity = variant.currentStock ?? null;
          const variantBand = getStockBand(quantity, DEFAULT_THRESHOLDS);
          return {
            id: variant.id,
            sku: variant.sku,
            size: variant.size || "-",
            colorLabel: color,
            quantity,
            salePrice: null,
            promotionalPrice: null,
            costPrice: variant.unitCost ?? null,
            status: getStockBandLabel(variantBand),
            band: variantBand,
            criticalStockThreshold: DEFAULT_THRESHOLDS.critical,
            lowStockThreshold: DEFAULT_THRESHOLDS.low,
            salesToday: variant.sales?.["1d"] ?? 0,
            sales7d: variant.sales?.["7d"] ?? 0,
            sales30d: variant.sales?.["1m"] ?? 0,
            lastSaleAt: null
          };
        })
      })),
      salesToday: sales["1d"],
      sales7d: sales["7d"],
      sales30d: sales["1m"],
      lastSaleAt: null,
      coverageDays: computeCoverage(totalStock, sales["1m"]),
      movementBadge: getMovementBadge({
        sales7d: sales["7d"],
        sales30d: sales["1m"],
        coverageDays: computeCoverage(totalStock, sales["1m"]),
        stockBand: band
      }),
      topColorLabel: topVariant?.color ?? null,
      topSizeLabel: topVariant?.size ?? null,
      relatedOrderCount: snapshot.orders.filter((order) => order.supplierId === supplierId && order.productSku === product.productSku).length,
      replenishmentCard: latestReplenishment
        ? {
            requestId: latestReplenishment.id,
            status: latestReplenishment.status,
            statusLabel: getReplenishmentStatusLabel(latestReplenishment.status),
            linkedOrderNumber: linkedOrder?.orderNumber ?? null,
            linkedFinancialStatusLabel: linkedOrder?.financialEntry?.statusLabel ?? null,
            nextStepLabel: getReplenishmentNextStep(
              latestReplenishment.status,
              linkedOrder
                ? {
                    orderNumber: linkedOrder.orderNumber,
                    hasFinancialEntry: Boolean(linkedOrder.financialEntry)
                  }
                : undefined
            ).label
          }
        : null,
      activeOrder: activeOrder
        ? {
            orderId: activeOrder.id,
            orderNumber: activeOrder.orderNumber,
            workflowStage: activeOrder.workflowStage,
            workflowStageLabel: activeOrder.workflowStageLabel,
            financialStatus: activeOrder.financialEntry?.status ?? null,
            financialStatusLabel: activeOrder.financialEntry?.statusLabel ?? null
          }
        : null
    };
  });

  return {
    products: mappedProducts,
    summary: {
      productCount: mappedProducts.length,
      criticalCount: mappedProducts.filter((product) => product.band === "critical").length,
      lowCount: mappedProducts.filter((product) => product.band === "low").length,
      staleCount: 0,
      totalSalesToday: mappedProducts.reduce((sum, product) => sum + product.salesToday, 0),
      totalSales7d: mappedProducts.reduce((sum, product) => sum + product.sales7d, 0),
      totalSales30d: mappedProducts.reduce((sum, product) => sum + product.sales30d, 0),
      totalInventorySaleValue: 0,
      totalInventoryCostValue: mappedProducts.reduce((sum, product) => sum + product.inventoryCostValue, 0),
      topProductName: mappedProducts[0]?.name ?? null,
      topInventoryProductName: mappedProducts[0]?.name ?? null,
      topInventoryProductValue: mappedProducts[0]?.inventoryCostValue ?? 0,
      topColor: mappedProducts[0]?.topColorLabel ?? null,
      topSize: mappedProducts[0]?.topSizeLabel ?? null,
      replenishmentPendingCount: snapshot.replenishmentRequests.filter((request) => request.supplierId === supplierId && request.status === "PENDING").length,
      replenishmentApprovedCount: snapshot.replenishmentRequests.filter((request) => request.supplierId === supplierId && request.status === "APPROVED").length,
      replenishmentLinkedCount: snapshot.replenishmentRequests.filter((request) => request.supplierId === supplierId && Boolean(request.linkedOrderId)).length,
      orderCardsInProgress: snapshot.orders.filter((order) => order.supplierId === supplierId && ["AWAITING_RESPONSE", "IN_PREPARATION", "SEPARATION_CONFIRMED"].includes(order.workflowStage)).length,
      orderCardsInFinancial: snapshot.orders.filter((order) => order.supplierId === supplierId && ["IN_FINANCIAL_REVIEW", "PAYMENT_PENDING"].includes(order.workflowStage)).length,
      orderCardsShipped: snapshot.orders.filter((order) => order.supplierId === supplierId && order.workflowStage === "SHIPPED").length
    }
  };
}
