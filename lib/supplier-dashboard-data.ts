import { getDemoSupplierDashboardData } from "@/lib/demo-data";
import {
  getReplenishmentNextStep,
  getSupplierFinancialStatusLabel,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import { prisma } from "@/lib/prisma";
import { getReplenishmentStatusLabel } from "@/lib/replenishment-data";
import { getDateWindows, getMovementBadge, safeCoverageDays, sumNumbers } from "@/lib/sales-metrics";
import { getColorLabel, getParentSku, getSizeLabel } from "@/lib/sku";
import { getStockBand, getStockBandLabel, type StockBand, resolveStockThresholds } from "@/lib/stock";

type GroupedVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  quantity: number | null;
  salePrice: number | null;
  promotionalPrice: number | null;
  costPrice: number | null;
  band: StockBand;
  bandLabel: string;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: Date | null;
};

export type SupplierDashboardMatrixItem = {
  id: string;
  sku: string;
  size: string;
  colorLabel: string;
  quantity: number | null;
  salePrice: number | null;
  promotionalPrice: number | null;
  costPrice: number | null;
  status: string;
  band: StockBand;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: string | null;
};

export type SupplierDashboardProduct = {
  id: string;
  supplier: string;
  name: string;
  sku: string;
  imageUrl: string;
  lastUpdated: string;
  syncState: "fresh" | "stale";
  total: number;
  band: StockBand;
  bandLabel: string;
  priceFrom: number | null;
  priceTo: number | null;
  inventorySaleValue: number;
  inventoryCostValue: number;
  matrix: Array<{
    color: string;
    items: SupplierDashboardMatrixItem[];
  }>;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: string | null;
  coverageDays: number | null;
  movementBadge: string;
  topColorLabel: string | null;
  topSizeLabel: string | null;
  relatedOrderCount: number;
  replenishmentCard: {
    requestId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    statusLabel: string;
    linkedOrderNumber: string | null;
    linkedFinancialStatusLabel: string | null;
    nextStepLabel: string;
  } | null;
  activeOrder: {
    orderId: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    financialStatusLabel: string | null;
  } | null;
};

export type SupplierDashboardSummary = {
  productCount: number;
  criticalCount: number;
  lowCount: number;
  staleCount: number;
  totalSalesToday: number;
  totalSales7d: number;
  totalSales30d: number;
  totalInventorySaleValue: number;
  totalInventoryCostValue: number;
  topProductName: string | null;
  topInventoryProductName: string | null;
  topInventoryProductValue: number;
  topColor: string | null;
  topSize: string | null;
  replenishmentPendingCount: number;
  replenishmentApprovedCount: number;
  replenishmentLinkedCount: number;
  orderCardsInProgress: number;
  orderCardsInFinancial: number;
  orderCardsShipped: number;
};

export type SupplierDashboardData = {
  products: SupplierDashboardProduct[];
  summary: SupplierDashboardSummary;
};

export async function getSupplierDashboardDataFromDb(supplierId: string): Promise<SupplierDashboardData> {
  let products;
  let metrics;
  let productMetrics;
  let variantRefs;
  let supplierOrders;
  let replenishmentRequests;
  const windows = getDateWindows();

  try {
    [products, variantRefs, supplierOrders, replenishmentRequests] = await Promise.all([
      prisma.product.findMany({
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
      }),
      prisma.catalogVariant.findMany({
        where: {
          catalogProduct: {
            supplierLinks: {
              some: {
                supplierId,
                active: true
              }
            }
          }
        },
        select: {
          id: true,
          sourceProductId: true,
          colorLabel: true,
          sizeLabel: true,
          catalogProductId: true,
          price: {
            select: {
              salePrice: true,
              promotionalPrice: true,
              costPrice: true
            }
          }
        }
      }),
      prisma.supplierOrder.findMany({
        where: {
          supplierId
        },
        include: {
          financialEntry: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.replenishmentRequest.findMany({
        where: {
          supplierId
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    const variantIds = variantRefs.map((variant) => variant.id);
    const catalogProductIds = Array.from(new Set(variantRefs.map((variant) => variant.catalogProductId)));

    [metrics, productMetrics] = await Promise.all([
      prisma.variantSalesMetricDaily.findMany({
        where: {
          variantId: { in: variantIds },
          date: { gte: windows.thirtyDaysAgo }
        }
      }),
      prisma.productSalesMetricDaily.findMany({
        where: {
          catalogProductId: { in: catalogProductIds },
          date: { gte: windows.thirtyDaysAgo }
        }
      })
    ]);
  } catch {
    return getDemoSupplierDashboardData();
  }

  const linkedReplenishmentOrders = replenishmentRequests.length
    ? await prisma.supplierOrder.findMany({
        where: {
          originType: "REPLENISHMENT_REQUEST",
          originReferenceId: {
            in: replenishmentRequests.map((request) => request.id)
          }
        },
        include: {
          financialEntry: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }).catch(() => [])
    : [];

  const orderMap = new Map<string, typeof supplierOrders>();
  for (const order of supplierOrders) {
    const list = orderMap.get(order.productSku) ?? [];
    list.push(order);
    orderMap.set(order.productSku, list);
  }

  const linkedReplenishmentOrderMap = new Map(
    linkedReplenishmentOrders
      .filter((order) => order.originReferenceId)
      .map((order) => [order.originReferenceId as string, order] as const)
  );

  const replenishmentMap = new Map<
    string,
    {
      requestId: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      statusLabel: string;
      linkedOrderNumber: string | null;
      linkedFinancialStatusLabel: string | null;
      nextStepLabel: string;
    }
  >();

  for (const request of replenishmentRequests) {
    if (replenishmentMap.has(request.productSku)) {
      continue;
    }

    const linkedOrder = linkedReplenishmentOrderMap.get(request.id);
    const nextStep = getReplenishmentNextStep(request.status, linkedOrder ? {
      orderNumber: linkedOrder.orderNumber,
      hasFinancialEntry: Boolean(linkedOrder.financialEntry)
    } : null);

    replenishmentMap.set(request.productSku, {
      requestId: request.id,
      status: request.status,
      statusLabel: getReplenishmentStatusLabel(request.status),
      linkedOrderNumber: linkedOrder?.orderNumber ?? null,
      linkedFinancialStatusLabel: linkedOrder?.financialEntry
        ? getSupplierFinancialStatusLabel(linkedOrder.financialEntry.status)
        : null,
      nextStepLabel: nextStep.label
    });
  }

  const metricMap = new Map<string, typeof metrics>();
  for (const metric of metrics) {
    const list = metricMap.get(metric.variantId) ?? [];
    list.push(metric);
    metricMap.set(metric.variantId, list);
  }

  const productMetricMap = new Map<string, typeof productMetrics>();
  for (const metric of productMetrics) {
    const list = productMetricMap.get(metric.catalogProductId) ?? [];
    list.push(metric);
    productMetricMap.set(metric.catalogProductId, list);
  }

  const variantRefBySourceId = new Map(
    variantRefs
      .filter((variant) => variant.sourceProductId)
      .map((variant) => [variant.sourceProductId as string, variant] as const)
  );

  const groups = new Map<
    string,
    {
      id: string;
      catalogProductId?: string;
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
    const variantRef = variantRefBySourceId.get(product.id);
    const variantMetrics = variantRef ? metricMap.get(variantRef.id) ?? [] : [];
    const salesToday = sumNumbers(
      variantMetrics
        .filter((metric) => metric.date >= windows.today && metric.date < windows.tomorrow)
        .map((metric) => metric.unitsSold)
    );
    const sales7d = sumNumbers(
      variantMetrics.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold)
    );
    const sales30d = sumNumbers(variantMetrics.map((metric) => metric.unitsSold));
    const lastSaleAt = variantMetrics.reduce<Date | null>(
      (latest, metric) => (!latest || (metric.lastOrderAt && metric.lastOrderAt > latest) ? metric.lastOrderAt : latest),
      null
    );
    const thresholds = resolveStockThresholds({
      productCritical: product.criticalStockThreshold,
      productLow: product.lowStockThreshold,
      parentCritical: product.parent?.criticalStockThreshold,
      parentLow: product.parent?.lowStockThreshold
    });
    const variantBand = getStockBand(quantity, thresholds);
    const entry = groups.get(parentSku) ?? {
      id: parentSku,
      catalogProductId: variantRef?.catalogProductId,
      sku: parentSku,
      supplier,
      name: product.parent?.internalName ?? product.internalName,
      imageUrl: product.parent?.imageUrl ?? product.imageUrl ?? "/brand/pepper-logo.png",
      syncState: product.syncStatus === "STALE" || product.syncStatus === "ERROR" ? "stale" : "fresh",
      lastUpdated: snapshot?.syncedAt
        ? `Atualizado em ${snapshot.syncedAt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          })}`
        : "Sem sincronizacao",
      variants: []
    };

    entry.variants.push({
      id: product.id,
      sku: product.sku,
      size: getSizeLabel(product.sizeCode),
      color: getColorLabel(product.colorCode),
      quantity,
      salePrice: variantRef?.price?.salePrice ?? null,
      promotionalPrice: variantRef?.price?.promotionalPrice ?? null,
      costPrice: variantRef?.price?.costPrice ?? null,
      band: variantBand,
      bandLabel: getStockBandLabel(variantBand),
      criticalStockThreshold: thresholds.critical,
      lowStockThreshold: thresholds.low,
      salesToday,
      sales7d,
      sales30d,
      lastSaleAt
    });
    entry.syncState =
      entry.syncState === "stale" || product.syncStatus === "STALE" || product.syncStatus === "ERROR" ? "stale" : "fresh";

    groups.set(parentSku, entry);
  }

  const productCards = Array.from(groups.values()).map((group) => {
    const total = group.variants.reduce((sum, variant) => sum + (variant.quantity ?? 0), 0);
    const priceValues = group.variants
      .map((variant) => variant.promotionalPrice ?? variant.salePrice)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const band: StockBand = group.variants.some((variant) => variant.band === "critical")
      ? "critical"
      : group.variants.some((variant) => variant.band === "low")
        ? "low"
        : group.variants.some((variant) => variant.band === "ok")
          ? "ok"
          : "unknown";
    const priceFrom = priceValues.length > 0 ? Math.min(...priceValues) : null;
    const priceTo = priceValues.length > 0 ? Math.max(...priceValues) : null;
    const matrix = Array.from(new Set(group.variants.map((variant) => variant.color))).map((color) => ({
      color,
        items: group.variants
        .filter((variant) => variant.color === color)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          colorLabel: variant.color,
          quantity: variant.quantity,
          salePrice: variant.salePrice,
          promotionalPrice: variant.promotionalPrice,
          costPrice: variant.costPrice,
          status: variant.bandLabel,
          band: variant.band,
          criticalStockThreshold: variant.criticalStockThreshold,
          lowStockThreshold: variant.lowStockThreshold,
          salesToday: variant.salesToday,
          sales7d: variant.sales7d,
          sales30d: variant.sales30d,
          lastSaleAt: variant.lastSaleAt ? variant.lastSaleAt.toLocaleDateString("pt-BR") : null
        }))
    }));

    const aggregateMetrics = group.catalogProductId ? productMetricMap.get(group.catalogProductId) ?? [] : [];
    const salesToday = sumNumbers(
      aggregateMetrics
        .filter((metric) => metric.date >= windows.today && metric.date < windows.tomorrow)
        .map((metric) => metric.unitsSold)
    );
    const inventorySaleValue = Number(
      sumNumbers(
        group.variants.map((variant) => {
          const quantity = variant.quantity ?? 0;
          const effectivePrice = variant.promotionalPrice ?? variant.salePrice ?? 0;
          return quantity * effectivePrice;
        })
      )
    );
    const inventoryCostValue = Number(
      sumNumbers(
        group.variants.map((variant) => {
          const quantity = variant.quantity ?? 0;
          return quantity * (variant.costPrice ?? 0);
        })
      )
    );
    const sales7d = sumNumbers(
      aggregateMetrics.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold)
    );
    const sales30d = sumNumbers(aggregateMetrics.map((metric) => metric.unitsSold));
    const lastSaleAt = aggregateMetrics.reduce<Date | null>(
      (latest, metric) => (!latest || (metric.lastOrderAt && metric.lastOrderAt > latest) ? metric.lastOrderAt : latest),
      null
    );
    const coverageDays = safeCoverageDays(total, sales30d);
    const movementBadge = getMovementBadge({ sales7d, sales30d, coverageDays, stockBand: band });
    const topColor = group.variants.reduce<Record<string, number>>((acc, variant) => {
      acc[variant.color] = (acc[variant.color] ?? 0) + variant.sales30d;
      return acc;
    }, {});
    const topSize = group.variants.reduce<Record<string, number>>((acc, variant) => {
      acc[variant.size] = (acc[variant.size] ?? 0) + variant.sales30d;
      return acc;
    }, {});
    const topColorLabel =
      Object.entries(topColor).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topSizeLabel =
      Object.entries(topSize).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const relatedOrders = orderMap.get(group.sku) ?? [];
    const activeOrder =
      relatedOrders.find((order) => !["SHIPPED", "CANCELED", "NO_STOCK"].includes(order.workflowStage)) ??
      relatedOrders[0] ??
      null;

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
      priceFrom,
      priceTo,
      inventorySaleValue,
      inventoryCostValue,
      matrix,
      salesToday,
      sales7d,
      sales30d,
      lastSaleAt: lastSaleAt ? lastSaleAt.toLocaleDateString("pt-BR") : null,
      coverageDays,
      movementBadge,
      topColorLabel,
      topSizeLabel,
      relatedOrderCount: relatedOrders.length,
      replenishmentCard: replenishmentMap.get(group.sku) ?? null,
      activeOrder: activeOrder
        ? {
            orderId: activeOrder.id,
            orderNumber: activeOrder.orderNumber,
            workflowStage: activeOrder.workflowStage,
            workflowStageLabel: getSupplierOrderWorkflowLabel(activeOrder.workflowStage),
            financialStatus: activeOrder.financialEntry?.status ?? null,
            financialStatusLabel: activeOrder.financialEntry
              ? getSupplierFinancialStatusLabel(activeOrder.financialEntry.status)
              : null
          }
        : null
    };
  });

  const totalSalesToday = sumNumbers(productCards.map((product) => product.salesToday));
  const totalSales7d = sumNumbers(productCards.map((product) => product.sales7d));
  const totalSales30d = sumNumbers(productCards.map((product) => product.sales30d));
  const totalInventorySaleValue = Number(sumNumbers(productCards.map((product) => product.inventorySaleValue)));
  const totalInventoryCostValue = Number(sumNumbers(productCards.map((product) => product.inventoryCostValue)));
  const topProduct = [...productCards].sort((a, b) => b.sales7d - a.sales7d)[0] ?? null;
  const topInventoryProduct = [...productCards].sort((a, b) => b.inventorySaleValue - a.inventorySaleValue)[0] ?? null;

  const colorTotals = new Map<string, number>();
  const sizeTotals = new Map<string, number>();
  for (const card of productCards) {
    for (const row of card.matrix) {
      for (const item of row.items) {
        colorTotals.set(row.color, (colorTotals.get(row.color) ?? 0) + item.sales30d);
        sizeTotals.set(item.size, (sizeTotals.get(item.size) ?? 0) + item.sales30d);
      }
    }
  }

  const topColor = [...colorTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topSize = [...sizeTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const replenishmentPendingCount = replenishmentRequests.filter((request) => request.status === "PENDING").length;
  const replenishmentApprovedCount = replenishmentRequests.filter((request) => request.status === "APPROVED").length;
  const replenishmentLinkedCount = replenishmentRequests.filter((request) => linkedReplenishmentOrderMap.has(request.id)).length;
  const orderCardsInProgress = supplierOrders.filter((order) =>
    ["AWAITING_RESPONSE", "IN_PREPARATION", "SEPARATION_CONFIRMED", "READY_FOR_FINANCIAL"].includes(order.workflowStage)
  ).length;
  const orderCardsInFinancial = supplierOrders.filter((order) =>
    ["IN_FINANCIAL_REVIEW", "PAYMENT_PENDING", "PAID"].includes(order.workflowStage)
  ).length;
  const orderCardsShipped = supplierOrders.filter((order) => order.workflowStage === "SHIPPED").length;

  return {
    products: productCards,
    summary: {
      productCount: productCards.length,
      criticalCount: productCards.filter((product) => product.band === "critical").length,
      lowCount: productCards.filter((product) => product.band === "low").length,
      staleCount: productCards.filter((product) => product.syncState === "stale").length,
      totalSalesToday,
      totalSales7d,
      totalSales30d,
      totalInventorySaleValue,
      totalInventoryCostValue,
      topProductName: topProduct?.name ?? null,
      topInventoryProductName: topInventoryProduct?.name ?? null,
      topInventoryProductValue: topInventoryProduct?.inventorySaleValue ?? 0,
      topColor,
      topSize,
      replenishmentPendingCount,
      replenishmentApprovedCount,
      replenishmentLinkedCount,
      orderCardsInProgress,
      orderCardsInFinancial,
      orderCardsShipped
    }
  };
}

