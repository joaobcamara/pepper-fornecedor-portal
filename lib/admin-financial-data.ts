import { getDemoAdminPageData } from "@/lib/demo-data";
import { getFinancialPeriodMeta, type FinancialPeriodKey } from "@/lib/financial-period";
import { getTrustedFoundationInventoryQuantity } from "@/lib/foundation-inventory";
import { prisma } from "@/lib/prisma";
import { sumNumbers } from "@/lib/sales-metrics";

export type AdminFinancialData = {
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
    topRevenueProductName: string | null;
    topRevenueProductValue: number;
  };
  supplierHighlights: Array<{
    id: string;
    name: string;
    periodRevenue: number;
    unitsSold: number;
  }>;
  productHighlights: Array<{
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    inventorySaleValue: number;
    inventoryCostValue: number;
    periodRevenue: number;
    unitsSold: number;
  }>;
};

export async function getAdminFinancialData(periodKey: FinancialPeriodKey): Promise<AdminFinancialData> {
  const period = getFinancialPeriodMeta(periodKey);

  try {
    const [catalogProducts, productMetrics, supplierMetrics] = await Promise.all([
      prisma.catalogProduct.findMany({
        where: { active: true, archivedAt: null },
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
      }),
      prisma.productSalesMetricDaily.findMany({
        where: {
          date: {
            gte: period.startDate,
            lte: period.endDate
          }
        }
      }),
      prisma.supplierSalesMetricDaily.findMany({
        where: {
          date: {
            gte: period.startDate,
            lte: period.endDate
          }
        },
        include: {
          supplier: true
        }
      })
    ]);

    const revenueByProduct = new Map<string, { unitsSold: number; revenue: number }>();
    for (const metric of productMetrics) {
      const current = revenueByProduct.get(metric.catalogProductId) ?? { unitsSold: 0, revenue: 0 };
      current.unitsSold += metric.unitsSold;
      current.revenue += metric.grossRevenue;
      revenueByProduct.set(metric.catalogProductId, current);
    }

    const productHighlights = catalogProducts
      .map((product) => {
        const inventorySaleValue = Number(
          sumNumbers(
            product.variants.map((variant) => {
              const quantity = getTrustedFoundationInventoryQuantity(variant.inventory) ?? 0;
              const effectivePrice = variant.price?.promotionalPrice ?? variant.price?.salePrice ?? 0;
              return quantity * effectivePrice;
            })
          )
        );
        const inventoryCostValue = Number(
          sumNumbers(
            product.variants.map((variant) => {
              const quantity = getTrustedFoundationInventoryQuantity(variant.inventory) ?? 0;
              return quantity * (variant.price?.costPrice ?? 0);
            })
          )
        );
        const metrics = revenueByProduct.get(product.id) ?? { unitsSold: 0, revenue: 0 };

        return {
          id: product.id,
          name: product.name,
          sku: product.skuParent,
          supplierName: product.supplierLinks[0]?.supplier.name ?? "Sem fornecedor",
          inventorySaleValue,
          inventoryCostValue,
          periodRevenue: Number(metrics.revenue),
          unitsSold: Number(metrics.unitsSold)
        };
      })
      .sort((a, b) => b.inventorySaleValue - a.inventorySaleValue);

    const supplierHighlights = Array.from(
      supplierMetrics.reduce(
        (map, metric) => {
          const current = map.get(metric.supplierId) ?? {
            id: metric.supplierId,
            name: metric.supplier.name,
            periodRevenue: 0,
            unitsSold: 0
          };
          current.periodRevenue += metric.grossRevenue;
          current.unitsSold += metric.unitsSold;
          map.set(metric.supplierId, current);
          return map;
        },
        new Map<string, { id: string; name: string; periodRevenue: number; unitsSold: number }>()
      ).values()
    )
      .sort((a, b) => b.periodRevenue - a.periodRevenue)
      .slice(0, 6);

    const totalInventorySaleValue = Number(sumNumbers(productHighlights.map((product) => product.inventorySaleValue)));
    const totalInventoryCostValue = Number(sumNumbers(productHighlights.map((product) => product.inventoryCostValue)));
    const periodRevenue = Number(sumNumbers(productMetrics.map((metric) => metric.grossRevenue)));
    const periodUnitsSold = Number(sumNumbers(productMetrics.map((metric) => metric.unitsSold)));
    const periodOrderCount = Number(sumNumbers(productMetrics.map((metric) => metric.orderCount)));
    const averageTicket = periodOrderCount > 0 ? periodRevenue / periodOrderCount : 0;
    const topInventoryProduct = productHighlights[0] ?? null;
    const topRevenueProduct = [...productHighlights].sort((a, b) => b.periodRevenue - a.periodRevenue)[0] ?? null;

    return {
      period: {
        key: period.key,
        label: period.label,
        days: period.days
      },
      metrics: {
        periodUnitsSold,
        periodRevenue,
        totalInventorySaleValue,
        totalInventoryCostValue,
        averageTicket: Number(averageTicket),
        topInventoryProductName: topInventoryProduct?.name ?? null,
        topInventoryProductValue: topInventoryProduct?.inventorySaleValue ?? 0,
        topRevenueProductName: topRevenueProduct?.name ?? null,
        topRevenueProductValue: topRevenueProduct?.periodRevenue ?? 0
      },
      supplierHighlights,
      productHighlights: productHighlights.slice(0, 8)
    };
  } catch {
    const demo = getDemoAdminPageData();
    return {
      period: {
        key: period.key,
        label: period.label,
        days: period.days
      },
      metrics: {
        periodUnitsSold: period.days >= 30 ? demo.dashboard.totalSales30d : period.days >= 15 ? demo.dashboard.totalSales7d * 2 : demo.dashboard.totalSales7d,
        periodRevenue: 1198.8,
        totalInventorySaleValue: 1438.2,
        totalInventoryCostValue: 718.2,
        averageTicket: 299.7,
        topInventoryProductName: demo.topProducts[0]?.name ?? null,
        topInventoryProductValue: 1438.2,
        topRevenueProductName: demo.topProducts[0]?.name ?? null,
        topRevenueProductValue: 1198.8
      },
      supplierHighlights: demo.topSuppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        periodRevenue: supplier.revenue,
        unitsSold: supplier.unitsSold
      })),
      productHighlights: demo.topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        supplierName: product.supplierName,
        inventorySaleValue: 1438.2,
        inventoryCostValue: 718.2,
        periodRevenue: product.revenue,
        unitsSold: product.unitsSold
      }))
    };
  }
}
