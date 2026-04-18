import { getDemoAdminPageData } from "@/lib/demo-data";
import { buildCatalogProductImageProxyUrl, PORTAL_BRAND_FALLBACK_IMAGE } from "@/lib/catalog-images";
import { getTrustedFoundationInventoryQuantity } from "@/lib/foundation-inventory";
import { listFoundationCatalogProducts } from "@/lib/foundation-catalog";
import { getLocalAdminDashboardData } from "@/lib/local-dashboard-data";
import {
  getOperationalOriginLabel,
  getReplenishmentNextStep,
  getSupplierFinancialStatusLabel,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import {
  buildSalesPeriodTotals,
  getUnitsSoldInLastDays,
  getDateWindows,
  getMovementBadge,
  safeCoverageDays,
  sumNumbers,
  type SalesPeriodTotals
} from "@/lib/sales-metrics";
import { getStockBand, getStockBandLabel, resolveStockThresholds, type StockBand } from "@/lib/stock";

export type AdminDashboardData = {
  suppliers: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  recentImports: Array<{
    id: string;
    status: string;
    startedAt: string;
    notes: string | null;
    itemCount: number;
  }>;
  syncRuns: Array<{
    id: string;
    triggerType: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  }>;
  productGroups: Array<{
    id: string;
    parentSku: string;
    internalName: string;
    imageUrl: string;
    active: boolean;
    criticalStockThreshold: number | null;
    lowStockThreshold: number | null;
    variantCount: number;
    totalStock: number;
    totalEstimatedCost: number;
    staleCount: number;
    band: StockBand;
    bandLabel: string;
    sales: SalesPeriodTotals;
    coverageDays: number | null;
    movementBadge: string;
    topColorLabel: string | null;
    topSizeLabel: string | null;
    supplierIds: string[];
    suppliers: Array<{ id: string; name: string }>;
    updatedAt: string;
    relatedOrderCount: number;
    replenishmentCard: {
      requestId: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      statusLabel: string;
      linkedOrderNumber: string | null;
      linkedFinancialStatusLabel: string | null;
      nextStepLabel: string;
      supplierName: string;
    } | null;
    activeOrder: {
      orderId: string;
      orderNumber: string;
      workflowStage: string;
      workflowStageLabel: string;
      financialStatus: string | null;
      financialStatusLabel: string | null;
      supplierName: string;
      originLabel: string;
    } | null;
      variants: Array<{
        id: string;
        sku: string;
      sizeCode: string | null;
      sizeLabel: string;
      colorCode: string | null;
      colorLabel: string;
        quantity: number | null;
        band: StockBand;
        sales: SalesPeriodTotals;
        sales15d: number;
        unitCost: number | null;
        criticalStockThreshold: number | null;
        lowStockThreshold: number | null;
      effectiveCriticalStockThreshold: number;
      effectiveLowStockThreshold: number;
    }>;
  }>;
  dashboard: {
    supplierCount: number;
    importCount: number;
    productCount: number;
    staleCount: number;
    syncCount: number;
    totalSalesToday: number;
    totalSales7d: number;
    totalSales30d: number;
    atRiskCount: number;
    replenishmentPendingCount: number;
    orderCardsInProgress: number;
    readyForFinancialCount: number;
    financialReviewCount: number;
    paymentPendingCount: number;
  };
  topSuppliers: Array<{
    id: string;
    name: string;
    unitsSold: number;
    revenue: number;
    lastOrderAt: string | null;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    imageUrl: string;
    unitsSold: number;
    revenue: number;
    stock: number;
    band: StockBand;
    bandLabel: string;
    coverageDays: number | null;
  }>;
  priorityProducts: Array<{
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    imageUrl: string;
    unitsSold: number;
    revenue: number;
    stock: number;
    band: StockBand;
    bandLabel: string;
    coverageDays: number | null;
  }>;
  workflowWatchlist: Array<{
    id: string;
    supplierName: string;
    productName: string;
    productSku: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    originLabel: string;
    financialStatusLabel: string | null;
    nextStepLabel: string;
  }>;
  tinyConfigured: boolean;
};

export async function getAdminPageData(): Promise<AdminDashboardData> {
  if (isLocalOperationalMode()) {
    return getLocalAdminDashboardData();
  }

  let suppliers;
  let recentBatches;
  let syncRuns;
  let catalogProducts;
  let supplierMetrics;
  let productMetrics;
  let replenishmentRequests;
  let supplierOrders;
  let variantMetrics;
  const windows = getDateWindows();

  try {
    [suppliers, recentBatches, syncRuns, catalogProducts, supplierMetrics, productMetrics, replenishmentRequests, supplierOrders] = await Promise.all([
      prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" }
      }),
      prisma.tinyImportBatch.findMany({
        take: 6,
        orderBy: { startedAt: "desc" },
        include: {
          items: true
        }
      }),
      prisma.syncRun.findMany({
        take: 8,
        orderBy: { startedAt: "desc" }
      }),
      listFoundationCatalogProducts({
        onlyActive: true
      }),
      prisma.supplierSalesMetricDaily.findMany({
        where: {
          date: { gte: windows.thirtyDaysAgo }
        },
        include: {
          supplier: true
        }
      }),
      prisma.productSalesMetricDaily.findMany({
        where: {
          date: { gte: windows.oneYearAgo }
        },
        include: {
          catalogProduct: {
            include: {
              variants: {
                include: {
                  inventory: true,
                  price: true
                }
              },
              supplierLinks: {
                where: { active: true },
                include: {
                  supplier: true
                }
              }
            }
          }
        }
      }),
      prisma.replenishmentRequest.findMany({
        include: {
          supplier: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.supplierOrder.findMany({
        include: {
          supplier: true,
          financialEntry: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);
  } catch {
    return getDemoAdminPageData();
  }

  try {
    const catalogVariantIds = catalogProducts.flatMap((product) => product.variants.map((variant) => variant.id));

    variantMetrics = catalogVariantIds.length
      ? await prisma.variantSalesMetricDaily.findMany({
          where: {
            variantId: {
              in: catalogVariantIds
            },
            date: {
              gte: windows.oneYearAgo
            }
          }
        })
      : [];
  } catch {
    return getDemoAdminPageData();
  }

  const supplierMetricMap = new Map<string, typeof supplierMetrics>();
  for (const metric of supplierMetrics) {
    const list = supplierMetricMap.get(metric.supplierId) ?? [];
    list.push(metric);
    supplierMetricMap.set(metric.supplierId, list);
  }

  const productMetricMap = new Map<string, typeof productMetrics>();
  for (const metric of productMetrics) {
    const list = productMetricMap.get(metric.catalogProductId) ?? [];
    list.push(metric);
    productMetricMap.set(metric.catalogProductId, list);
  }

  const variantMetricMap = new Map<string, typeof variantMetrics>();
  for (const metric of variantMetrics) {
    const list = variantMetricMap.get(metric.variantId) ?? [];
    list.push(metric);
    variantMetricMap.set(metric.variantId, list);
  }

  const linkedReplenishmentOrderMap = new Map<string, { orderNumber: string; financialStatusLabel: string | null }>();
  const latestReplenishmentBySku = new Map<
    string,
    {
      requestId: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      statusLabel: string;
      linkedOrderNumber: string | null;
      linkedFinancialStatusLabel: string | null;
      nextStepLabel: string;
      supplierName: string;
    }
  >();
  const latestOrderBySku = new Map<
    string,
    {
      orderId: string;
      orderNumber: string;
      workflowStage: string;
      workflowStageLabel: string;
      financialStatus: string | null;
      financialStatusLabel: string | null;
      supplierName: string;
      originLabel: string;
    }
  >();
  const relatedOrderCountBySku = new Map<string, number>();

  for (const order of supplierOrders) {
    relatedOrderCountBySku.set(order.productSku, (relatedOrderCountBySku.get(order.productSku) ?? 0) + 1);

    if (!latestOrderBySku.has(order.productSku)) {
      latestOrderBySku.set(order.productSku, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        workflowStage: order.workflowStage,
        workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
        financialStatus: order.financialEntry?.status ?? null,
        financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null,
        supplierName: order.supplier.name,
        originLabel: getOperationalOriginLabel(order.originType)
      });
    }

    if (order.originType === "REPLENISHMENT_REQUEST" && order.originReferenceId && !linkedReplenishmentOrderMap.has(order.originReferenceId)) {
      linkedReplenishmentOrderMap.set(order.originReferenceId, {
        orderNumber: order.orderNumber,
        financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null
      });
    }
  }

  for (const request of replenishmentRequests) {
    if (!latestReplenishmentBySku.has(request.productSku)) {
      const linkedOrder = linkedReplenishmentOrderMap.get(request.id);
      latestReplenishmentBySku.set(request.productSku, {
        requestId: request.id,
        status: request.status,
        statusLabel:
          request.status === "APPROVED"
            ? "Aprovada"
            : request.status === "REJECTED"
              ? "Recusada"
              : "Pendente",
        linkedOrderNumber: linkedOrder?.orderNumber ?? null,
        linkedFinancialStatusLabel: linkedOrder?.financialStatusLabel ?? null,
        nextStepLabel: getReplenishmentNextStep(request.status, linkedOrder ? {
          orderNumber: linkedOrder.orderNumber,
          hasFinancialEntry: Boolean(linkedOrder.financialStatusLabel)
        } : null).label,
        supplierName: request.supplier.name
      });
    }
  }

  const productGroups = catalogProducts.map((product) => {
    const supplierMap = new Map(product.supplierLinks.map((link) => [link.id, { id: link.id, name: link.name }] as const));
    const totalStock = product.totalStock;
    let totalEstimatedCost = 0;
    const colorSales = new Map<string, number>();
    const sizeSales = new Map<string, number>();

    const variants = product.variants.map((variant) => {
      const variantMetricsForPeriod = variantMetricMap.get(variant.id) ?? [];
      const sales = buildSalesPeriodTotals(variantMetricsForPeriod);
      const sales15d = getUnitsSoldInLastDays(variantMetricsForPeriod, 15);
      const thresholds = resolveStockThresholds({
        productCritical: variant.criticalStockThreshold,
        productLow: variant.lowStockThreshold,
        parentCritical: variant.parentCriticalStockThreshold,
        parentLow: variant.parentLowStockThreshold
      });
      const band = getStockBand(variant.quantity, thresholds);

      totalEstimatedCost += (variant.quantity ?? 0) * (variant.costPrice ?? 0);

      const sales30d = sales["1m"];
      colorSales.set(variant.colorLabel, (colorSales.get(variant.colorLabel) ?? 0) + sales30d);
      sizeSales.set(variant.sizeLabel, (sizeSales.get(variant.sizeLabel) ?? 0) + sales30d);

      return {
        id: variant.id,
        sku: variant.sku,
        sizeCode: variant.sizeCode,
        sizeLabel: variant.sizeLabel,
        colorCode: variant.colorCode,
        colorLabel: variant.colorLabel,
        quantity: variant.quantity,
        band,
        sales,
        sales15d,
        unitCost: variant.costPrice,
        criticalStockThreshold: variant.criticalStockThreshold,
        lowStockThreshold: variant.lowStockThreshold,
        effectiveCriticalStockThreshold: thresholds.critical,
        effectiveLowStockThreshold: thresholds.low
      };
    });

    const band: StockBand = variants.some((variant) => variant.band === "critical")
      ? "critical"
      : variants.some((variant) => variant.band === "low")
        ? "low"
        : variants.some((variant) => variant.band === "ok")
          ? "ok"
          : "unknown";
    const sales = variants.reduce<SalesPeriodTotals>(
      (current, variant) => ({
        "1d": current["1d"] + variant.sales["1d"],
        "7d": current["7d"] + variant.sales["7d"],
        "1m": current["1m"] + variant.sales["1m"],
        "3m": current["3m"] + variant.sales["3m"],
        "6m": current["6m"] + variant.sales["6m"],
        "1a": current["1a"] + variant.sales["1a"]
      }),
      { "1d": 0, "7d": 0, "1m": 0, "3m": 0, "6m": 0, "1a": 0 }
    );
    const coverageDays = safeCoverageDays(totalStock, sales["1m"]);
    const topColorLabel =
      [...colorSales.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const topSizeLabel =
      [...sizeSales.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

    return {
        id: product.sourceProductId ?? product.id,
        parentSku: product.parentSku,
        internalName: product.internalName,
        imageUrl: product.imageUrl ?? PORTAL_BRAND_FALLBACK_IMAGE,
        active: product.portalVisible,
        criticalStockThreshold: product.variants[0]?.parentCriticalStockThreshold ?? null,
        lowStockThreshold: product.variants[0]?.parentLowStockThreshold ?? null,
      variantCount: product.variants.length,
      totalStock,
      totalEstimatedCost,
      staleCount: product.staleVariantCount,
      band,
      bandLabel: getStockBandLabel(band),
      sales,
      coverageDays,
      movementBadge: getMovementBadge({
        sales7d: sales["7d"],
        sales30d: sales["1m"],
        coverageDays,
        stockBand: band
      }),
      topColorLabel,
      topSizeLabel,
      supplierIds: Array.from(supplierMap.keys()),
      suppliers: Array.from(supplierMap.values()),
      updatedAt: (product.lastUpdatedAt ?? new Date()).toLocaleString("pt-BR"),
      relatedOrderCount: relatedOrderCountBySku.get(product.parentSku) ?? 0,
      replenishmentCard: latestReplenishmentBySku.get(product.parentSku) ?? null,
      activeOrder: latestOrderBySku.get(product.parentSku) ?? null,
      variants
    };
  });

  const totalSalesToday = Number(
    sumNumbers(
    productMetrics
      .filter((metric) => metric.date >= windows.today && metric.date < windows.tomorrow)
      .map((metric) => metric.unitsSold)
    )
  );
  const totalSales7d = Number(
    sumNumbers(
    productMetrics.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold)
    )
  );
  const totalSales30d = Number(sumNumbers(productMetrics.map((metric) => metric.unitsSold)));

  const topSuppliers: AdminDashboardData["topSuppliers"] = suppliers
    .map((supplier) => {
      const metricsForSupplier = supplierMetricMap.get(supplier.id) ?? [];
      const unitsSold = Number(
        sumNumbers(
        metricsForSupplier.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold)
        )
      );
      const revenue = Number(
        sumNumbers(
        metricsForSupplier.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.grossRevenue)
        )
      );
      const lastOrderAt = metricsForSupplier.reduce<Date | null>(
        (latest, metric) => (!latest || (metric.lastOrderAt && metric.lastOrderAt > latest) ? metric.lastOrderAt : latest),
        null
      );

      return {
        id: supplier.id,
        name: supplier.name,
        unitsSold,
        revenue,
        lastOrderAt: lastOrderAt ? lastOrderAt.toLocaleDateString("pt-BR") : null
      };
    })
    .filter((supplier) => supplier.unitsSold > 0 || supplier.revenue > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const topProducts: AdminDashboardData["topProducts"] = Array.from(productMetricMap.entries())
    .map(([catalogProductId, metricsForProduct]) => {
      const catalogProduct = metricsForProduct[0]?.catalogProduct;
      if (!catalogProduct) {
        return null;
      }

      const unitsSold = Number(
        sumNumbers(
        metricsForProduct.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.unitsSold)
        )
      );
      const revenue = Number(
        sumNumbers(
        metricsForProduct.filter((metric) => metric.date >= windows.sevenDaysAgo).map((metric) => metric.grossRevenue)
        )
      );
      const stock = Number(
        sumNumbers(
        catalogProduct.variants.map((variant) => getTrustedFoundationInventoryQuantity(variant.inventory) ?? 0)
        )
      );
      const band: StockBand =
        stock <= 0
          ? "critical"
          : stock <= 5
            ? "low"
            : "ok";
      const supplierName = catalogProduct.supplierLinks[0]?.supplier.name ?? "Sem fornecedor";
      const coverageDays = safeCoverageDays(
        stock,
        Number(sumNumbers(metricsForProduct.map((metric) => metric.unitsSold)))
      );

      return {
        id: catalogProductId,
        name: catalogProduct.name,
        sku: catalogProduct.skuParent,
        supplierName,
        imageUrl: catalogProduct.mainImageUrl
          ? buildCatalogProductImageProxyUrl(catalogProduct.skuParent, PORTAL_BRAND_FALLBACK_IMAGE)
          : PORTAL_BRAND_FALLBACK_IMAGE,
        unitsSold,
        revenue,
        stock,
        band,
        bandLabel: getStockBandLabel(band),
        coverageDays
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 6);

  const priorityProducts = [...topProducts]
    .filter((product) => product.band !== "ok" || (product.coverageDays !== null && product.coverageDays <= 15))
    .sort((a, b) => {
      const aScore = (a.band === "critical" ? 100 : a.band === "low" ? 50 : 0) + a.unitsSold;
      const bScore = (b.band === "critical" ? 100 : b.band === "low" ? 50 : 0) + b.unitsSold;
      return bScore - aScore;
    })
    .slice(0, 4);

  return {
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      slug: supplier.slug
    })),
    recentImports: recentBatches.map((batch) => ({
      id: batch.id,
      status: batch.status,
      startedAt: batch.startedAt.toLocaleString("pt-BR"),
      notes: batch.notes,
      itemCount: batch.items.length
    })),
    syncRuns: syncRuns.map((run) => ({
      id: run.id,
      triggerType: run.triggerType,
      status: run.status,
      startedAt: run.startedAt.toLocaleString("pt-BR"),
      finishedAt: run.finishedAt ? run.finishedAt.toLocaleString("pt-BR") : null,
      errorMessage: run.errorMessage
    })),
    productGroups,
    dashboard: {
      supplierCount: suppliers.length,
      importCount: recentBatches.length,
      productCount: productGroups.length,
      staleCount: productGroups.reduce((sum, item) => sum + item.staleCount, 0),
      syncCount: syncRuns.length,
      totalSalesToday,
      totalSales7d,
      totalSales30d,
      atRiskCount: topProducts.filter((product) => product.band !== "ok").length,
      replenishmentPendingCount: replenishmentRequests.filter((request) => request.status === "PENDING").length,
      orderCardsInProgress: supplierOrders.filter((order) =>
        ["AWAITING_RESPONSE", "IN_PREPARATION", "SEPARATION_CONFIRMED", "READY_FOR_FINANCIAL"].includes(order.workflowStage)
      ).length,
      readyForFinancialCount: supplierOrders.filter((order) => order.workflowStage === "READY_FOR_FINANCIAL").length,
      financialReviewCount: supplierOrders.filter((order) => order.workflowStage === "IN_FINANCIAL_REVIEW").length,
      paymentPendingCount: supplierOrders.filter((order) => order.workflowStage === "PAYMENT_PENDING").length
    },
    topSuppliers,
    topProducts,
    priorityProducts,
    workflowWatchlist: supplierOrders.slice(0, 6).map((order) => ({
      id: order.id,
      supplierName: order.supplier.name,
      productName: order.productName,
      productSku: order.productSku,
      orderNumber: order.orderNumber,
      workflowStage: order.workflowStage,
      workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
      originLabel: getOperationalOriginLabel(order.originType),
      financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null,
      nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label
    })),
    tinyConfigured: Boolean(process.env.TINY_API_TOKEN?.trim())
  };
}
