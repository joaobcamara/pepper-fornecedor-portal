import { prisma } from "@/lib/prisma";
import { getTinyAccountLabel, type TinyAccountKey } from "@/lib/tiny";

type SyncRunRow = {
  id: string;
  triggerType: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

type WebhookRow = {
  id: string;
  webhookType: string;
  eventType: string | null;
  sku: string | null;
  tinyProductId: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
};

type SyncSummary = {
  totalRuns: number;
  completedRuns: number;
  partialRuns: number;
  failedRuns: number;
  webhookProcessed: number;
  webhookErrors: number;
  lastWebhookAt: string | null;
};

type FoundationAccountHealth = {
  accountKey: TinyAccountKey;
  label: string;
  orderCount: number;
  lastOrderAt: string | null;
};

type FoundationRecentSalesOrder = {
  id: string;
  accountLabel: string;
  number: string | null;
  ecommerceNumber: string | null;
  statusLabel: string | null;
  marketplace: string | null;
  totalAmount: number | null;
  orderDate: string | null;
  itemCount: number;
};

type FoundationHealth = {
  catalogProductCount: number;
  catalogVariantCount: number;
  inventoryVariantCount: number;
  salesOrderCount: number;
  salesItemCount: number;
  variantMetricCount: number;
  productMetricCount: number;
  supplierMetricCount: number;
  lastStockSyncAt: string | null;
  lastStockSku: string | null;
  lastStockProductName: string | null;
  lastSalesOrderAt: string | null;
  lastSalesOrderNumber: string | null;
  lastSalesOrderAccountLabel: string | null;
  lastMetricDate: string | null;
  lastMetricSku: string | null;
  lastMetricProductName: string | null;
  salesOrdersByAccount: FoundationAccountHealth[];
  recentSalesOrders: FoundationRecentSalesOrder[];
  note: string;
};

type WebhookHealthTone = "healthy" | "warning" | "critical";
type MonitoredWebhookType = "sales" | "orders" | "stock";

type WebhookAccountHealth = {
  accountKey: TinyAccountKey;
  accountLabel: string;
  webhookType: MonitoredWebhookType;
  processedCount24h: number;
  errorCount24h: number;
  lastEventAt: string | null;
  lastStatus: string | null;
  tone: WebhookHealthTone;
  note: string;
};

export type AdminSyncPageData = {
  summary: SyncSummary;
  syncRuns: SyncRunRow[];
  webhookLogs: WebhookRow[];
  foundationHealth: FoundationHealth;
  webhookHealth: WebhookAccountHealth[];
  pepperIaAlertCount: number;
  pepperIaHint: string;
};

const TINY_ACCOUNTS: TinyAccountKey[] = ["pepper", "showlook", "onshop"];
const MONITORED_WEBHOOKS: MonitoredWebhookType[] = ["sales", "orders", "stock"];

function formatDateTime(value?: Date | null) {
  return value ? value.toLocaleString("pt-BR") : null;
}

function formatDate(value?: Date | null) {
  return value ? value.toLocaleDateString("pt-BR") : null;
}

function parseTinyAccountKeyFromScopedValue(value?: string | null): TinyAccountKey | null {
  if (!value) {
    return null;
  }

  const [prefix] = value.split(":");
  const normalized = prefix?.trim().toLowerCase();

  if (normalized === "pepper" || normalized === "showlook" || normalized === "onshop") {
    return normalized;
  }

  return null;
}

function deriveTinyAccountKeyFromMarketplace(value?: string | null): TinyAccountKey | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes("show")) {
    return "showlook";
  }

  if (normalized.includes("on shop") || normalized.includes("onshop")) {
    return "onshop";
  }

  if (normalized.includes("pepper")) {
    return "pepper";
  }

  return null;
}

function safeJsonParse<T>(value?: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function deriveTinyAccountKeyFromWebhookPayload(payload?: string | null): TinyAccountKey | null {
  const parsed = safeJsonParse<{ accountKey?: string; payload?: unknown }>(payload);
  const normalized = parsed?.accountKey?.trim().toLowerCase();

  if (normalized === "pepper" || normalized === "showlook" || normalized === "onshop") {
    return normalized;
  }

  return null;
}

function resolveSalesOrderAccountKey(order: { tinyOrderId: string; marketplace: string | null }) {
  return parseTinyAccountKeyFromScopedValue(order.tinyOrderId) ?? deriveTinyAccountKeyFromMarketplace(order.marketplace) ?? "pepper";
}

export async function getAdminSyncPageData(): Promise<AdminSyncPageData> {
  const webhookHealthSince = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const [
    syncRuns,
    webhookLogs,
    webhookHealthLogs,
    catalogProductCount,
    catalogVariantCount,
    inventoryVariantCount,
    salesOrderCount,
    salesItemCount,
    variantMetricCount,
    productMetricCount,
    supplierMetricCount,
    latestInventory,
    latestSalesOrder,
    latestVariantMetric,
    recentSalesOrders
  ] = await Promise.all([
    prisma.syncRun.findMany({
      take: 12,
      orderBy: {
        startedAt: "desc"
      }
    }),
    prisma.tinyWebhookLog.findMany({
      take: 16,
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.tinyWebhookLog.findMany({
      where: {
        createdAt: {
          gte: webhookHealthSince
        },
        accountKey: {
          in: TINY_ACCOUNTS
        },
        webhookType: {
          in: MONITORED_WEBHOOKS
        }
      },
      take: 300,
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.catalogProduct.count(),
    prisma.catalogVariant.count(),
    prisma.catalogInventory.count({
      where: {
        lastStockSyncAt: {
          not: null
        }
      }
    }),
    prisma.salesOrder.count(),
    prisma.salesOrderItem.count(),
    prisma.variantSalesMetricDaily.count(),
    prisma.productSalesMetricDaily.count(),
    prisma.supplierSalesMetricDaily.count(),
    prisma.catalogInventory.findFirst({
      where: {
        lastStockSyncAt: {
          not: null
        }
      },
      orderBy: {
        lastStockSyncAt: "desc"
      },
      include: {
        catalogVariant: {
          select: {
            sku: true,
            catalogProduct: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.salesOrder.findFirst({
      orderBy: [
        {
          orderDate: "desc"
        },
        {
          updatedAt: "desc"
        }
      ]
    }),
    prisma.variantSalesMetricDaily.findFirst({
      orderBy: [
        {
          date: "desc"
        },
        {
          updatedAt: "desc"
        }
      ],
      include: {
        variant: {
          select: {
            sku: true,
            catalogProduct: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.salesOrder.findMany({
      take: 8,
      orderBy: [
        {
          orderDate: "desc"
        },
        {
          updatedAt: "desc"
        }
      ],
      include: {
        _count: {
          select: {
            items: true
          }
        }
      }
    })
  ]);

  const summary: SyncSummary = {
    totalRuns: syncRuns.length,
    completedRuns: syncRuns.filter((run) => run.status === "completed").length,
    partialRuns: syncRuns.filter((run) => run.status === "partial").length,
    failedRuns: syncRuns.filter((run) => run.status === "failed").length,
    webhookProcessed: webhookLogs.filter((log) => log.status === "processed").length,
    webhookErrors: webhookLogs.filter((log) => ["error", "invalid_payload", "variant_not_found", "missing_order_id"].includes(log.status)).length,
    lastWebhookAt: formatDateTime(webhookLogs[0]?.createdAt)
  };

  const salesOrdersByAccount = TINY_ACCOUNTS.map((accountKey) => {
    const orders = recentSalesOrders.filter((order) => resolveSalesOrderAccountKey(order) === accountKey);
    const latest = orders.reduce<Date | null>((current, order) => {
      const candidate = order.orderDate ?? order.updatedAt ?? null;
      if (!candidate) {
        return current;
      }

      if (!current || candidate > current) {
        return candidate;
      }

      return current;
    }, null);

    return {
      accountKey,
      label: getTinyAccountLabel(accountKey),
      orderCount: orders.length,
      lastOrderAt: formatDateTime(latest)
    };
  });

  const recentSalesOrderCards: FoundationRecentSalesOrder[] = recentSalesOrders.map((order) => {
    const accountKey = resolveSalesOrderAccountKey(order);

    return {
      id: order.id,
      accountLabel: getTinyAccountLabel(accountKey),
      number: order.number,
      ecommerceNumber: order.ecommerceNumber,
      statusLabel: order.statusLabel,
      marketplace: order.marketplace,
      totalAmount: order.totalAmount,
      orderDate: formatDateTime(order.orderDate ?? order.updatedAt),
      itemCount: order._count.items
    };
  });

  const webhookHealth: WebhookAccountHealth[] = TINY_ACCOUNTS.flatMap((accountKey) =>
    MONITORED_WEBHOOKS.map((webhookType) => {
      const logs = webhookHealthLogs.filter((log) => log.accountKey === accountKey && log.webhookType === webhookType);
      const processedCount24h = logs.filter((log) => log.status === "processed").length;
      const errorCount24h = logs.filter((log) => log.status !== "processed").length;
      const latest = logs[0];

      let tone: WebhookHealthTone = "warning";
      let note = "Sem evento recente.";

      if (processedCount24h > 0 && errorCount24h === 0) {
        tone = "healthy";
        note = `${processedCount24h} eventos processados nas ultimas 24h.`;
      } else if (processedCount24h > 0) {
        tone = "warning";
        note = `${processedCount24h} eventos processados e ${errorCount24h} com revisao nas ultimas 24h.`;
      } else if (errorCount24h > 0) {
        tone = "warning";
        note = `${errorCount24h} eventos com revisao e nenhum processado nas ultimas 24h.`;
      } else if (webhookType === "sales" && accountKey === "pepper") {
        tone = "critical";
        note = "A URL publica responde 200, mas a conta Pepper nao manteve vendas ativas no Tiny.";
      } else if (webhookType === "orders") {
        note = "Sem evento organico recente de pedidos enviados.";
      } else if (webhookType === "stock") {
        note = "Sem evento organico recente de estoque.";
      } else {
        note = "Sem evento organico recente de vendas.";
      }

      return {
        accountKey,
        accountLabel: getTinyAccountLabel(accountKey),
        webhookType,
        processedCount24h,
        errorCount24h,
        lastEventAt: formatDateTime(latest?.createdAt),
        lastStatus: latest?.status ?? null,
        tone,
        note
      };
    })
  );

  const foundationHealth: FoundationHealth = {
    catalogProductCount,
    catalogVariantCount,
    inventoryVariantCount,
    salesOrderCount,
    salesItemCount,
    variantMetricCount,
    productMetricCount,
    supplierMetricCount,
    lastStockSyncAt: formatDateTime(latestInventory?.lastStockSyncAt),
    lastStockSku: latestInventory?.catalogVariant.sku ?? null,
    lastStockProductName: latestInventory?.catalogVariant.catalogProduct.name ?? null,
    lastSalesOrderAt: formatDateTime(latestSalesOrder?.orderDate ?? latestSalesOrder?.updatedAt),
    lastSalesOrderNumber: latestSalesOrder?.number ?? latestSalesOrder?.ecommerceNumber ?? null,
    lastSalesOrderAccountLabel: latestSalesOrder
      ? getTinyAccountLabel(resolveSalesOrderAccountKey(latestSalesOrder))
      : null,
    lastMetricDate: formatDate(latestVariantMetric?.date),
    lastMetricSku: latestVariantMetric?.variant.sku ?? null,
    lastMetricProductName: latestVariantMetric?.variant.catalogProduct.name ?? null,
    salesOrdersByAccount,
    recentSalesOrders: recentSalesOrderCards,
    note:
      salesOrderCount === 0 || variantMetricCount === 0
        ? "A Pepper IA ainda fica limitada enquanto pedidos e metricas reais nao entrarem na fundacao com regularidade."
        : "Pedidos, estoque e metricas ja estao alimentando a fundacao oficial para leitura do portal."
  };

  const recentSalesWebhookErrors = webhookLogs.filter((log) => log.webhookType === "sales" && log.status !== "processed").length;
  const recentSalesWebhookProcessed = webhookLogs.filter((log) => log.webhookType === "sales" && log.status === "processed").length;
  const recentSalesWebhookAccountKeys = Array.from(
    new Set(
      webhookLogs
        .map((log) => deriveTinyAccountKeyFromWebhookPayload(log.payload))
        .filter((value): value is TinyAccountKey => Boolean(value))
    )
  );

  const pepperIaHint =
    salesOrderCount > 0 || variantMetricCount > 0
      ? `${salesOrderCount} pedidos e ${variantMetricCount} metricas de venda ja foram consolidados na fundacao. Webhooks de venda: ${recentSalesWebhookProcessed} processados e ${recentSalesWebhookErrors} com revisao.`
      : `A fundacao segue forte em produto/estoque, mas vendas ainda estao rasas: ${salesOrderCount} pedidos, ${variantMetricCount} metricas e ${recentSalesWebhookErrors} webhooks de venda com revisao.${recentSalesWebhookAccountKeys.length ? ` Contas vistas recentemente: ${recentSalesWebhookAccountKeys.map((key) => getTinyAccountLabel(key)).join(", ")}.` : ""}`;

  return {
    summary,
    syncRuns: syncRuns.map((run) => ({
      id: run.id,
      triggerType: run.triggerType,
      status: run.status,
      startedAt: formatDateTime(run.startedAt) ?? "",
      finishedAt: formatDateTime(run.finishedAt),
      errorMessage: run.errorMessage
    })),
    webhookLogs: webhookLogs.map((log) => ({
      id: log.id,
      webhookType: log.webhookType,
      eventType: log.eventType,
      sku: log.sku,
      tinyProductId: log.tinyProductId,
      status: log.status,
      errorMessage: log.errorMessage,
      processedAt: formatDateTime(log.processedAt),
      createdAt: formatDateTime(log.createdAt) ?? ""
    })),
    foundationHealth,
    webhookHealth,
    pepperIaAlertCount:
      summary.failedRuns +
      summary.partialRuns +
      summary.webhookErrors +
      webhookHealth.filter((item) => item.tone !== "healthy").length +
      (salesOrderCount === 0 ? 1 : 0),
    pepperIaHint
  };
}
