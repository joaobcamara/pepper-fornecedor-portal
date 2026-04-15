import { getDemoSupplierDashboardData } from "@/lib/demo-data";
import { getFinancialPeriodMeta, type FinancialPeriodKey } from "@/lib/financial-period";
import { prisma } from "@/lib/prisma";
import { getSupplierDashboardDataFromDb, type SupplierDashboardProduct } from "@/lib/supplier-dashboard-data";
import { sumNumbers } from "@/lib/sales-metrics";

export type SupplierFinancialData = {
  period: {
    key: FinancialPeriodKey;
    label: string;
    days: number;
  };
  metrics: {
    periodUnitsSold: number;
    periodRevenue: number;
    totalInventorySaleValue: number;
    totalInventoryCostValue: number;
    averageTicket: number;
    topInventoryProductName: string | null;
    topInventoryProductValue: number;
    topSalesProductName: string | null;
    topSalesProductUnits: number;
  };
  productHighlights: Array<{
    id: string;
    name: string;
    sku: string;
    inventorySaleValue: number;
    inventoryCostValue: number;
    salesInPeriod: number;
    sales30d: number;
    lastSaleAt: string | null;
  }>;
};

export async function getSupplierFinancialData(
  supplierId: string,
  periodKey: FinancialPeriodKey
): Promise<SupplierFinancialData> {
  const period = getFinancialPeriodMeta(periodKey);

  try {
    const [dashboardData, supplierMetrics] = await Promise.all([
      getSupplierDashboardDataFromDb(supplierId),
      prisma.supplierSalesMetricDaily.findMany({
        where: {
          supplierId,
          date: {
            gte: period.startDate,
            lte: period.endDate
          }
        }
      })
    ]);

    return buildSupplierFinancialView(
      dashboardData.products,
      { key: period.key, label: period.label, days: period.days },
      {
        periodUnitsSold: Number(sumNumbers(supplierMetrics.map((metric) => metric.unitsSold))),
        periodRevenue: Number(sumNumbers(supplierMetrics.map((metric) => metric.grossRevenue))),
        periodOrderCount: Number(sumNumbers(supplierMetrics.map((metric) => metric.orderCount)))
      }
    );
  } catch {
    const demoData = getDemoSupplierDashboardData();
    const inferredRevenue = Number(sumNumbers(demoData.products.map((product) => product.inventorySaleValue * 0.12)));

    return buildSupplierFinancialView(
      demoData.products,
      { key: period.key, label: period.label, days: period.days },
      {
        periodUnitsSold: period.days >= 30 ? demoData.summary.totalSales30d : period.days >= 15 ? demoData.summary.totalSales7d * 2 : demoData.summary.totalSales7d,
        periodRevenue: inferredRevenue,
        periodOrderCount: Math.max(1, Math.round(inferredRevenue / 240))
      }
    );
  }
}

function buildSupplierFinancialView(
  products: SupplierDashboardProduct[],
  period: SupplierFinancialData["period"],
  aggregate: {
    periodUnitsSold: number;
    periodRevenue: number;
    periodOrderCount: number;
  }
): SupplierFinancialData {
  const topInventoryProduct = [...products].sort((a, b) => b.inventorySaleValue - a.inventorySaleValue)[0] ?? null;
  const topSalesProduct = [...products].sort((a, b) => b.sales30d - a.sales30d)[0] ?? null;
  const averageTicket = aggregate.periodOrderCount > 0 ? aggregate.periodRevenue / aggregate.periodOrderCount : 0;

  return {
    period,
    metrics: {
      periodUnitsSold: aggregate.periodUnitsSold,
      periodRevenue: aggregate.periodRevenue,
      totalInventorySaleValue: Number(sumNumbers(products.map((product) => product.inventorySaleValue))),
      totalInventoryCostValue: Number(sumNumbers(products.map((product) => product.inventoryCostValue))),
      averageTicket: Number(averageTicket),
      topInventoryProductName: topInventoryProduct?.name ?? null,
      topInventoryProductValue: topInventoryProduct?.inventorySaleValue ?? 0,
      topSalesProductName: topSalesProduct?.name ?? null,
      topSalesProductUnits: topSalesProduct?.sales30d ?? 0
    },
    productHighlights: [...products]
      .sort((a, b) => b.inventorySaleValue - a.inventorySaleValue)
      .slice(0, 6)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        inventorySaleValue: product.inventorySaleValue,
        inventoryCostValue: product.inventoryCostValue,
        salesInPeriod: period.days >= 30 ? product.sales30d : period.days >= 15 ? product.sales7d : product.sales7d,
        sales30d: product.sales30d,
        lastSaleAt: product.lastSaleAt
      }))
  };
}
