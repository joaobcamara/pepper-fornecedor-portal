import { getDemoAdminPageData } from "@/lib/demo-data";
import {
  getOperationalOriginLabel,
  getReplenishmentNextStep,
  getSupplierFinancialStatusLabel,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import { prisma } from "@/lib/prisma";
import { getDateWindows, safeCoverageDays, sumNumbers } from "@/lib/sales-metrics";
import { getColorLabel, getSizeLabel } from "@/lib/sku";
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
    staleCount: number;
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
  let suppliers;
  let recentBatches;
  let syncRuns;
  let parentProducts;
  let supplierMetrics;
  let productMetrics;
  let replenishmentRequests;
  let supplierOrders;
  const windows = getDateWindows();

  try {
    [suppliers, recentBatches, syncRuns, parentProducts, supplierMetrics, productMetrics, replenishmentRequests, supplierOrders] = await Promise.all([
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
      prisma.product.findMany({
        where: {
          kind: "PARENT"
        },
        include: {
          variants: {
            include: {
              assignments: {
                include: {
                  supplier: true
                }
              },
              inventorySnapshots: {
                orderBy: {
                  syncedAt: "desc"
                },
                take: 1
              }
            },
            orderBy: {
              sku: "asc"
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
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
          date: { gte: windows.thirtyDaysAgo }
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

  const productGroups = parentProducts.map((parent) => {
    const supplierMap = new Map<string, { id: string; name: string }>();
    let totalStock = 0;
    let staleCount = 0;

    for (const variant of parent.variants) {
      const latestSnapshot = variant.inventorySnapshots[0];
      totalStock += latestSnapshot?.quantity ?? variant.fallbackInventory ?? 0;

      if (variant.syncStatus === "STALE" || variant.syncStatus === "ERROR") {
        staleCount += 1;
      }

      for (const assignment of variant.assignments) {
        if (assignment.active) {
          supplierMap.set(assignment.supplierId, {
            id: assignment.supplierId,
            name: assignment.supplier.name
          });
        }
      }
    }

    return {
      id: parent.id,
      parentSku: parent.sku,
      internalName: parent.internalName,
      imageUrl: parent.imageUrl ?? "/brand/pepper-logo.png",
      active: parent.active,
      criticalStockThreshold: parent.criticalStockThreshold,
      lowStockThreshold: parent.lowStockThreshold,
      variantCount: parent.variants.length,
      totalStock,
      staleCount,
      supplierIds: Array.from(supplierMap.keys()),
      suppliers: Array.from(supplierMap.values()),
      updatedAt: parent.updatedAt.toLocaleString("pt-BR"),
      relatedOrderCount: relatedOrderCountBySku.get(parent.sku) ?? 0,
      replenishmentCard: latestReplenishmentBySku.get(parent.sku) ?? null,
      activeOrder: latestOrderBySku.get(parent.sku) ?? null,
      variants: parent.variants.map((variant) => {
        const latestSnapshot = variant.inventorySnapshots[0];
        const quantity = latestSnapshot?.quantity ?? variant.fallbackInventory ?? null;
        const thresholds = resolveStockThresholds({
          productCritical: variant.criticalStockThreshold,
          productLow: variant.lowStockThreshold,
          parentCritical: parent.criticalStockThreshold,
          parentLow: parent.lowStockThreshold
        });

        return {
          id: variant.id,
          sku: variant.sku,
          sizeCode: variant.sizeCode,
          sizeLabel: getSizeLabel(variant.sizeCode),
          colorCode: variant.colorCode,
          colorLabel: getColorLabel(variant.colorCode),
          quantity,
          band: getStockBand(quantity, thresholds),
          criticalStockThreshold: variant.criticalStockThreshold,
          lowStockThreshold: variant.lowStockThreshold,
          effectiveCriticalStockThreshold: thresholds.critical,
          effectiveLowStockThreshold: thresholds.low
        };
      })
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
        catalogProduct.variants.map((variant) => variant.inventory?.availableMultiCompanyStock ?? 0)
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
        imageUrl: catalogProduct.mainImageUrl ?? "/brand/pepper-logo.png",
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
