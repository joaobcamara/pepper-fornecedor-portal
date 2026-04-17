import { getStockBand, getStockBandLabel, type StockBand } from "@/lib/stock";
import type { AdminDashboardData } from "@/lib/admin-data";
import type { SupplierDashboardData } from "@/lib/supplier-dashboard-data";

export const demoUsers = [
  {
    id: "demo-admin",
    username: "admin",
    passwordHash: "7a3477dad66e666bd203b834c54b6dfe8b546bdbc5283462ad14052abfb06600",
    role: "ADMIN" as const,
    supplierId: null,
    active: true
  },
  {
    id: "demo-supplier",
    username: "luna",
    passwordHash: "7a3477dad66e666bd203b834c54b6dfe8b546bdbc5283462ad14052abfb06600",
    role: "SUPPLIER" as const,
    supplierId: "demo-supplier-id",
    active: true
  }
];

export function getDemoSupplierDashboardData(): SupplierDashboardData {
  const variants = [
    { sku: "01-2504-21-01", size: "P", color: "Preto", quantity: 3, critical: 2, low: 8 },
    { sku: "01-2504-22-01", size: "M", color: "Preto", quantity: 7, critical: 5, low: 14 },
    { sku: "01-2504-23-01", size: "G", color: "Preto", quantity: 0, critical: 2, low: 8 },
    { sku: "01-2504-21-03", size: "P", color: "Vermelho", quantity: 2, critical: 2, low: 8 },
    { sku: "01-2504-22-03", size: "M", color: "Vermelho", quantity: 6, critical: 2, low: 8 }
  ];

  const matrix = Array.from(new Set(variants.map((variant) => variant.color))).map((color) => ({
    color,
    items: variants
      .filter((variant) => variant.color === color)
      .map((variant) => {
        const band = getStockBand(variant.quantity, { critical: variant.critical, low: variant.low });

        return {
          sku: variant.sku,
          size: variant.size,
          colorLabel: variant.color,
          quantity: variant.quantity,
          salePrice: 89.9,
          promotionalPrice: 79.9,
          costPrice: 39.9,
          status: getStockBandLabel(band),
          band,
          criticalStockThreshold: variant.critical,
          lowStockThreshold: variant.low
        };
      })
  }));

  const overallBand: StockBand = variants.some((variant) => variant.quantity <= variant.critical)
    ? "critical"
    : variants.some((variant) => variant.quantity <= variant.low)
      ? "low"
      : "ok";

  const products = [
    {
      id: "01-2504",
      supplier: "Luna Textil",
      name: "Conjunto Fitness Aura",
      sku: "01-2504",
      imageUrl: "/brand/pepper-logo.png",
      lastUpdated: "Modo demonstracao local",
      syncState: "stale" as const,
      total: variants.reduce((sum, variant) => sum + variant.quantity, 0),
      band: overallBand,
      bandLabel: getStockBandLabel(overallBand),
      priceFrom: 79.9,
      priceTo: 79.9,
      inventorySaleValue: 1438.2,
      inventoryCostValue: 718.2,
      matrix: matrix.map((row) => ({
        color: row.color,
        items: row.items.map((item) => ({
          id: item.sku,
          ...item,
          salesToday: item.size === "M" ? 2 : 0,
          sales7d: item.colorLabel === "Preto" ? 5 : 2,
          sales30d: item.colorLabel === "Preto" ? 16 : 8,
          lastSaleAt: "13/04/2026"
        }))
      })),
      salesToday: 3,
      sales7d: 12,
      sales30d: 24,
      lastSaleAt: "13/04/2026",
      coverageDays: 22.5,
      movementBadge: "Alto giro",
      topColorLabel: "Preto",
      topSizeLabel: "M",
      relatedOrderCount: 1,
      replenishmentCard: {
        requestId: "demo-replenishment-1",
        status: "APPROVED" as const,
        statusLabel: "Aprovada",
        linkedOrderNumber: "PF-20260413-DEMO",
        linkedFinancialStatusLabel: null,
        nextStepLabel: "Pedido PF-20260413-DEMO em andamento"
      },
      activeOrder: {
        orderId: "demo-order-1",
        orderNumber: "PF-20260413-DEMO",
        workflowStage: "IN_PREPARATION",
        workflowStageLabel: "Em preparacao",
        financialStatus: null,
        financialStatusLabel: null
      }
    }
  ];

  return {
    products,
    summary: {
      productCount: products.length,
      criticalCount: 1,
      lowCount: 0,
      staleCount: 1,
      totalSalesToday: 3,
      totalSales7d: 12,
      totalSales30d: 24,
      totalInventorySaleValue: 1438.2,
      totalInventoryCostValue: 718.2,
      topProductName: "Conjunto Fitness Aura",
      topInventoryProductName: "Conjunto Fitness Aura",
      topInventoryProductValue: 1438.2,
      topColor: "Preto",
      topSize: "M",
      replenishmentPendingCount: 0,
      replenishmentApprovedCount: 1,
      replenishmentLinkedCount: 1,
      orderCardsInProgress: 1,
      orderCardsInFinancial: 0,
      orderCardsShipped: 0
    }
  };
}

export function getDemoAdminPageData(): AdminDashboardData {
  return {
    suppliers: [
      {
        id: "demo-supplier-id",
        name: "Luna Textil",
        slug: "luna-textil"
      }
    ],
    recentImports: [
      {
        id: "demo-import-1",
        status: "completed",
        startedAt: "13/04/2026 03:00:00",
        notes: "Importacao Tiny de demonstracao",
        itemCount: 5
      }
    ],
    syncRuns: [
      {
        id: "demo-sync-1",
        triggerType: "manual",
        status: "partial",
        startedAt: "13/04/2026 03:05:00",
        finishedAt: "13/04/2026 03:05:12",
        errorMessage: null
      }
    ],
    productGroups: [
      {
        id: "demo-parent-1",
        parentSku: "01-2504",
        internalName: "Conjunto Fitness Aura",
        imageUrl: "/brand/pepper-logo.png",
        active: true,
        criticalStockThreshold: 2,
        lowStockThreshold: 8,
        variantCount: 5,
        totalStock: 18,
        totalEstimatedCost: 718.2,
        staleCount: 1,
        band: "critical" as const,
        bandLabel: "Crítico",
        sales: { "1d": 3, "7d": 12, "1m": 24, "3m": 54, "6m": 87, "1a": 131 },
        coverageDays: 22.5,
        movementBadge: "Atencao reposicao",
        topColorLabel: "Preto",
        topSizeLabel: "M",
        supplierIds: ["demo-supplier-id"],
        suppliers: [{ id: "demo-supplier-id", name: "Luna Textil" }],
        updatedAt: "13/04/2026 03:00:00",
        relatedOrderCount: 1,
        replenishmentCard: {
          requestId: "demo-replenishment-admin-1",
          status: "APPROVED" as const,
          statusLabel: "Aprovada",
          linkedOrderNumber: "PF-20260413-DEMO",
          linkedFinancialStatusLabel: null,
          nextStepLabel: "Pedido PF-20260413-DEMO em andamento",
          supplierName: "Luna Textil"
        },
        activeOrder: {
          orderId: "demo-order-admin-1",
          orderNumber: "PF-20260413-DEMO",
          workflowStage: "IN_PREPARATION",
          workflowStageLabel: "Em preparacao",
          financialStatus: null,
          financialStatusLabel: null,
          supplierName: "Luna Textil",
          originLabel: "Sugestao de compra"
        },
        variants: [
          {
            id: "demo-variant-1",
            sku: "01-2504-21-01",
            sizeCode: "21",
            sizeLabel: "P",
            colorCode: "01",
            colorLabel: "Preto",
            quantity: 3,
            band: "low" as const,
            sales: { "1d": 0, "7d": 2, "1m": 4, "3m": 9, "6m": 16, "1a": 24 },
            sales15d: 3,
            unitCost: 39.9,
            criticalStockThreshold: 1,
            lowStockThreshold: 4,
            effectiveCriticalStockThreshold: 1,
            effectiveLowStockThreshold: 4
          },
          {
            id: "demo-variant-2",
            sku: "01-2504-22-01",
            sizeCode: "22",
            sizeLabel: "M",
            colorCode: "01",
            colorLabel: "Preto",
            quantity: 2,
            band: "critical" as const,
            sales: { "1d": 1, "7d": 4, "1m": 9, "3m": 18, "6m": 28, "1a": 41 },
            sales15d: 6,
            unitCost: 39.9,
            criticalStockThreshold: 2,
            lowStockThreshold: 5,
            effectiveCriticalStockThreshold: 2,
            effectiveLowStockThreshold: 5
          },
          {
            id: "demo-variant-3",
            sku: "01-2504-23-01",
            sizeCode: "23",
            sizeLabel: "G",
            colorCode: "01",
            colorLabel: "Preto",
            quantity: 5,
            band: "low" as const,
            sales: { "1d": 0, "7d": 1, "1m": 3, "3m": 7, "6m": 12, "1a": 19 },
            sales15d: 2,
            unitCost: 39.9,
            criticalStockThreshold: null,
            lowStockThreshold: null,
            effectiveCriticalStockThreshold: 2,
            effectiveLowStockThreshold: 8
          },
          {
            id: "demo-variant-4",
            sku: "01-2504-21-03",
            sizeCode: "21",
            sizeLabel: "P",
            colorCode: "03",
            colorLabel: "Vermelho",
            quantity: 4,
            band: "low" as const,
            sales: { "1d": 1, "7d": 3, "1m": 5, "3m": 12, "6m": 20, "1a": 30 },
            sales15d: 4,
            unitCost: 39.9,
            criticalStockThreshold: null,
            lowStockThreshold: null,
            effectiveCriticalStockThreshold: 2,
            effectiveLowStockThreshold: 8
          },
          {
            id: "demo-variant-5",
            sku: "01-2504-22-03",
            sizeCode: "22",
            sizeLabel: "M",
            colorCode: "03",
            colorLabel: "Vermelho",
            quantity: 4,
            band: "low" as const,
            sales: { "1d": 1, "7d": 2, "1m": 3, "3m": 8, "6m": 11, "1a": 17 },
            sales15d: 2,
            unitCost: 39.9,
            criticalStockThreshold: null,
            lowStockThreshold: null,
            effectiveCriticalStockThreshold: 2,
            effectiveLowStockThreshold: 8
          }
        ]
      }
    ],
    dashboard: {
      supplierCount: 1,
      importCount: 1,
      productCount: 1,
      staleCount: 1,
      syncCount: 1,
      totalSalesToday: 3,
      totalSales7d: 12,
      totalSales30d: 24,
      atRiskCount: 1,
      replenishmentPendingCount: 0,
      orderCardsInProgress: 1,
      readyForFinancialCount: 0,
      financialReviewCount: 0,
      paymentPendingCount: 0
    },
    topSuppliers: [
      {
        id: "demo-supplier-id",
        name: "Luna Textil",
        unitsSold: 12,
        revenue: 1198.8,
        lastOrderAt: "13/04/2026"
      }
    ],
    topProducts: [
      {
        id: "demo-parent-1",
        name: "Conjunto Fitness Aura",
        sku: "01-2504",
        supplierName: "Luna Textil",
        imageUrl: "/brand/pepper-logo.png",
        unitsSold: 12,
        revenue: 1198.8,
        stock: 18,
        band: "critical" as const,
        bandLabel: "Crítico",
        coverageDays: 22.5
      }
    ],
    priorityProducts: [
      {
        id: "demo-parent-1",
        name: "Conjunto Fitness Aura",
        sku: "01-2504",
        supplierName: "Luna Textil",
        imageUrl: "/brand/pepper-logo.png",
        unitsSold: 12,
        revenue: 1198.8,
        stock: 18,
        band: "critical" as const,
        bandLabel: "Crítico",
        coverageDays: 22.5
      }
    ],
    workflowWatchlist: [
      {
        id: "demo-order-admin-1",
        supplierName: "Luna Textil",
        productName: "Conjunto Fitness Aura",
        productSku: "01-2504",
        orderNumber: "PF-20260413-DEMO",
        workflowStage: "IN_PREPARATION",
        workflowStageLabel: "Em preparacao",
        originLabel: "Sugestao de compra",
        financialStatusLabel: null,
        nextStepLabel: "Confirmar separacao"
      }
    ],
    tinyConfigured: Boolean(process.env.TINY_API_TOKEN?.trim())
  };
}

export function getDemoUnreadCount() {
  return 1;
}

export function getDemoSupplierDirectory() {
  return [
    {
      id: "demo-supplier-id",
      name: "Luna Textil",
      slug: "luna-textil",
      logoUrl: null,
      contactName: "Carol Aguiar",
      contactPhone: "(85) 99999-9999",
      contactEmail: "contato@lunatextil.com.br",
      address: "Rua das Industrias, 150 - Fortaleza/CE",
      active: true,
      canViewProductValues: false,
      canViewFinancialDashboard: false,
      productCount: 5,
      userCount: 1,
      createdAt: "15/04/2026"
    }
  ];
}

export function getDemoAdminSupplierOrdersData() {
  return {
    suppliers: [
      {
        id: "demo-supplier-id",
        name: "Luna Textil",
        slug: "luna-textil"
      }
    ],
    products: [
      {
        id: "demo-parent-1",
        supplierId: "demo-supplier-id",
        supplierName: "Luna Textil",
        productName: "Conjunto Fitness Aura",
        productSku: "01-2504",
        imageUrl: "/brand/pepper-logo.png",
        variants: [
          { id: "demo-variant-1", sku: "01-2504-21-01", color: "Preto", size: "P", unitCost: 39.9, currentStock: 3, sales: { "1d": 0, "7d": 2, "1m": 4, "3m": 9, "6m": 16, "1a": 24 } },
          { id: "demo-variant-2", sku: "01-2504-22-01", color: "Preto", size: "M", unitCost: 39.9, currentStock: 2, sales: { "1d": 1, "7d": 4, "1m": 9, "3m": 18, "6m": 28, "1a": 41 } },
          { id: "demo-variant-3", sku: "01-2504-23-01", color: "Preto", size: "G", unitCost: 39.9, currentStock: 5, sales: { "1d": 0, "7d": 1, "1m": 3, "3m": 7, "6m": 12, "1a": 19 } },
          { id: "demo-variant-4", sku: "01-2504-21-03", color: "Vermelho", size: "P", unitCost: 39.9, currentStock: 4, sales: { "1d": 1, "7d": 3, "1m": 5, "3m": 12, "6m": 20, "1a": 30 } },
          { id: "demo-variant-5", sku: "01-2504-22-03", color: "Vermelho", size: "M", unitCost: 39.9, currentStock: 4, sales: { "1d": 1, "7d": 2, "1m": 3, "3m": 8, "6m": 11, "1a": 17 } }
        ]
      }
    ],
    orders: [
      {
        id: "demo-order-admin-1",
        orderNumber: "PF-20260413-DEMO",
        supplierId: "demo-supplier-id",
        supplierName: "Luna Textil",
        productName: "Conjunto Fitness Aura",
        productSku: "01-2504",
        imageUrl: "/brand/pepper-logo.png",
        status: "IN_PREPARATION",
        statusLabel: "Em preparacao",
        workflowStage: "IN_PREPARATION",
        workflowStageLabel: "Em preparacao",
        originType: "REPLENISHMENT_REQUEST",
        originLabel: "Sugestao de compra",
        adminNote: "Pedido demo para simular o fluxo local.",
        supplierNote: "Separacao em andamento.",
        supplierHasNoStock: false,
        createdAt: "13/04/2026 10:00:00",
        respondedAt: "13/04/2026 10:20:00",
        shippedAt: null,
        expectedShipDate: "16/04/2026",
        separationConfirmedAt: null,
        sentToFinancialAt: null,
        paidAt: null,
        estimatedTotalCost: 199.5,
        estimatedTotalCostLabel: "R$ 199,50",
        confirmedTotalCost: 0,
        confirmedTotalCostLabel: "R$ 0,00",
        createdBy: "admin",
        updatedBy: "luna",
        hasRomaneio: false,
        financialEntry: null,
        attachments: [],
        history: [
          {
            id: "demo-order-history-1",
            fromStatus: null,
            toStatus: "AWAITING_SUPPLIER",
            toStatusLabel: "Aguardando resposta",
            note: "Pedido demo criado para validacao local.",
            createdAt: "13/04/2026 10:00:00"
          }
        ],
        workflowHistory: [
          {
            id: "demo-order-workflow-1",
            fromStage: null,
            toStage: "IN_PREPARATION",
            toStageLabel: "Em preparacao",
            note: "Fornecedor iniciou a separacao do pedido demo.",
            createdAt: "13/04/2026 10:20:00"
          }
        ],
        items: [
          {
            id: "demo-order-item-1",
            sku: "01-2504-22-01",
            color: "Preto",
            size: "M",
            productName: "Conjunto Fitness Aura M Preto",
            requestedQuantity: 3,
            fulfilledQuantity: 0,
            itemStatus: "PENDING",
            itemStatusLabel: "Pendente",
            unitCost: 39.9,
            requestedTotalCost: 119.7,
            confirmedUnitCost: null,
            confirmedTotalCost: 0,
            supplierItemNote: null
          },
          {
            id: "demo-order-item-2",
            sku: "01-2504-22-03",
            color: "Vermelho",
            size: "M",
            productName: "Conjunto Fitness Aura M Vermelho",
            requestedQuantity: 2,
            fulfilledQuantity: 0,
            itemStatus: "PENDING",
            itemStatusLabel: "Pendente",
            unitCost: 39.9,
            requestedTotalCost: 79.8,
            confirmedUnitCost: null,
            confirmedTotalCost: 0,
            supplierItemNote: null
          }
        ]
      }
    ]
  };
}
