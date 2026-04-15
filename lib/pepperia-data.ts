import { PepperIaScope, PepperIaMessageRole, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminPageData } from "@/lib/admin-data";
import {
  getReplenishmentNextStep,
  getSupplierFinancialStatusLabel,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import { getSupplierDashboardDataFromDb } from "@/lib/supplier-dashboard-data";
import { getSupplierSuggestions } from "@/lib/suggestion-data-v2";

export type PepperIaSession = {
  userId: string;
  username: string;
  role: UserRole;
  supplierId?: string | null;
};

export async function getOrCreatePepperIaThread(session: PepperIaSession) {
  const scope = session.role === "ADMIN" ? PepperIaScope.ADMIN : PepperIaScope.SUPPLIER;

  const existing = await prisma.pepperIaThread.findFirst({
    where: {
      userId: session.userId,
      scope,
      supplierId: scope === PepperIaScope.SUPPLIER ? session.supplierId ?? null : null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.pepperIaThread.create({
    data: {
      userId: session.userId,
      scope,
      supplierId: scope === PepperIaScope.SUPPLIER ? session.supplierId ?? null : null,
      title: "Pepper IA"
    }
  });
}

export async function getPepperIaView(session: PepperIaSession) {
  const thread = await getOrCreatePepperIaThread(session);
  const messages = await prisma.pepperIaMessage.findMany({
    where: {
      threadId: thread.id
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 40
  });

  return {
    threadId: thread.id,
    scope: thread.scope,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      body: message.body,
      createdAt: message.createdAt.toLocaleString("pt-BR")
    }))
  };
}

export async function getPepperIaContext(session: PepperIaSession) {
  if (session.role === "SUPPLIER" && session.supplierId) {
    const [dashboard, suggestions, replenishmentRequests, supplierOrders, financialEntries] = await Promise.all([
      getSupplierDashboardDataFromDb(session.supplierId),
      getSupplierSuggestions(session.supplierId),
      prisma.replenishmentRequest.findMany({
        where: {
          supplierId: session.supplierId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 8
      }),
      prisma.supplierOrder.findMany({
        where: {
          supplierId: session.supplierId
        },
        include: {
          financialEntry: true
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 8
      }),
      prisma.supplierFinancialEntry.findMany({
        where: {
          supplierId: session.supplierId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 8
      })
    ]);

    const supplierOrderSummary = {
      awaitingResponse: supplierOrders.filter((order) => order.workflowStage === "AWAITING_RESPONSE").length,
      inPreparation: supplierOrders.filter((order) => order.workflowStage === "IN_PREPARATION").length,
      readyForFinancial: supplierOrders.filter((order) => order.workflowStage === "SEPARATION_CONFIRMED").length,
      inFinancialReview: supplierOrders.filter((order) => order.workflowStage === "IN_FINANCIAL_REVIEW").length,
      paymentPending: supplierOrders.filter((order) => order.workflowStage === "PAYMENT_PENDING").length,
      paid: supplierOrders.filter((order) => order.workflowStage === "PAID").length,
      shipped: supplierOrders.filter((order) => order.workflowStage === "SHIPPED").length
    };

    const supplierFinancialSummary = {
      inReview: financialEntries.filter((entry) => entry.status === "IN_REVIEW").length,
      pending: financialEntries.filter((entry) => entry.status === "PENDING_PAYMENT").length,
      paid: financialEntries.filter((entry) => entry.status === "PAID").length,
      rejected: financialEntries.filter((entry) => entry.status === "REJECTED").length
    };

    return {
      scope: "supplier" as const,
      supplierId: session.supplierId,
      username: session.username,
      summary: dashboard.summary,
      products: dashboard.products.slice(0, 8).map((product) => ({
        name: product.name,
        sku: product.sku,
        stock: product.total,
        priceFrom: product.priceFrom,
        priceTo: product.priceTo,
        inventorySaleValue: product.inventorySaleValue,
        inventoryCostValue: product.inventoryCostValue,
        band: product.bandLabel,
        sales7d: product.sales7d,
        sales30d: product.sales30d,
        topColor: product.topColorLabel,
        topSize: product.topSizeLabel,
        coverageDays: product.coverageDays,
        lastSaleAt: product.lastSaleAt,
        variants: product.matrix.flatMap((row) =>
          row.items.map((item) => ({
            sku: item.sku,
            color: row.color,
            size: item.size,
            stock: item.quantity,
            salePrice: item.salePrice,
            promotionalPrice: item.promotionalPrice,
            costPrice: item.costPrice,
            sales30d: item.sales30d
          }))
        ).slice(0, 12)
      })),
      suggestions: suggestions.slice(0, 8).map((suggestion) => ({
        productName: suggestion.productName,
        status: suggestion.statusLabel,
        supplierVisibleNote: suggestion.supplierVisibleNote,
        canResubmit: suggestion.canResubmit,
        onboardingStatus: suggestion.onboardingStatus
      })),
      replenishmentRequests: replenishmentRequests.map((request) => ({
        productName: request.productName,
        productSku: request.productSku,
        status: request.status,
        nextStepLabel: getReplenishmentNextStep(request.status).label,
        createdAt: request.createdAt.toLocaleString("pt-BR")
      })),
      orderSummary: supplierOrderSummary,
      latestOrderCards: supplierOrders.map((order) => ({
        orderNumber: order.orderNumber,
        productName: order.productName,
        productSku: order.productSku,
        workflowStage: order.workflowStage,
        workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
        nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label,
        financialStatus: order.financialEntry?.status ?? null,
        financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null
      })),
      financialSummary: supplierFinancialSummary,
      latestFinancialCards: financialEntries.map((entry) => ({
        title: entry.title,
        productName: entry.productName,
        amount: entry.amount,
        status: entry.status,
        statusLabel: getSupplierFinancialStatusLabel(entry.status),
        dueDate: entry.dueDate?.toLocaleDateString("pt-BR") ?? null
      })),
      workflowWatchlist: dashboard.products
        .filter((product) => product.replenishmentCard || product.activeOrder)
        .slice(0, 6)
        .map((product) => ({
          productName: product.name,
          sku: product.sku,
          replenishmentStatus: product.replenishmentCard?.statusLabel ?? null,
          replenishmentNextStep: product.replenishmentCard?.nextStepLabel ?? null,
          orderStage: product.activeOrder?.workflowStageLabel ?? null,
          orderNextStep: product.activeOrder
            ? getSupplierOrderNextStep(product.activeOrder.workflowStage as never, Boolean(product.activeOrder.financialStatus)).label
            : null,
          financialStatus: product.activeOrder?.financialStatusLabel ?? null
        }))
    };
  }

  const [adminData, suggestionCounts, onboardingCounts, replenishmentCounts, supplierOrderCounts, financialCounts, latestOrders, latestFinancialEntries] = await Promise.all([
    getAdminPageData(),
    prisma.productSuggestion.groupBy({
      by: ["status"],
      _count: true
    }),
    prisma.catalogOnboardingItem.groupBy({
      by: ["status"],
      _count: true
    }),
    prisma.replenishmentRequest.groupBy({
      by: ["status"],
      _count: true
    }),
    prisma.supplierOrder.groupBy({
      by: ["workflowStage"],
      _count: true
    }),
    prisma.supplierFinancialEntry.groupBy({
      by: ["status"],
      _count: true
    }),
    prisma.supplierOrder.findMany({
      include: {
        supplier: true,
        financialEntry: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 8
    }),
    prisma.supplierFinancialEntry.findMany({
      include: {
        supplier: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 8
    })
  ]);

  return {
    scope: "admin" as const,
    username: session.username,
    dashboard: adminData.dashboard,
    topSuppliers: adminData.topSuppliers.slice(0, 5),
    topProducts: adminData.topProducts.slice(0, 6),
    priorityProducts: adminData.priorityProducts.slice(0, 6),
    suggestions: suggestionCounts.map((item) => ({ status: item.status, count: item._count })),
    onboarding: onboardingCounts.map((item) => ({ status: item.status, count: item._count })),
    replenishment: replenishmentCounts.map((item) => ({ status: item.status, count: item._count })),
    orderCards: supplierOrderCounts.map((item) => ({ stage: item.workflowStage, count: item._count })),
    financialCards: financialCounts.map((item) => ({ status: item.status, count: item._count })),
    latestOrderCards: latestOrders.map((order) => ({
      supplierName: order.supplier.name,
      orderNumber: order.orderNumber,
      productName: order.productName,
      workflowStage: order.workflowStage,
      workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
      nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label,
      financialStatus: order.financialEntry?.status ?? null,
      financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null
    })),
    latestFinancialCards: latestFinancialEntries.map((entry) => ({
      supplierName: entry.supplier.name,
      title: entry.title,
      productName: entry.productName,
      amount: entry.amount,
      status: entry.status,
      statusLabel: getSupplierFinancialStatusLabel(entry.status),
      dueDate: entry.dueDate?.toLocaleDateString("pt-BR") ?? null
    })),
    workflowWatchlist: latestOrders.slice(0, 6).map((order) => ({
      supplierName: order.supplier.name,
      productName: order.productName,
      orderNumber: order.orderNumber,
      workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
      nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label,
      financialStatusLabel: order.financialEntry ? getSupplierFinancialStatusLabel(order.financialEntry.status) : null
    }))
  };
}

export function buildPepperIaFallbackReply(
  question: string,
  context: Awaited<ReturnType<typeof getPepperIaContext>>,
  pageInfo?: { pageKey?: string; pageHint?: string | null }
) {
  if (context.scope === "supplier") {
    const summary = context.summary ?? {
      productCount: 0,
      criticalCount: 0,
      totalSales7d: 0,
      totalInventorySaleValue: 0
    };
    const products = (context.products ?? []) as Array<{
      name: string;
      sku: string;
      stock: number | null;
      band: string;
      priceFrom?: number | null;
      priceTo?: number | null;
    }>;
    const suggestions = (context.suggestions ?? []) as Array<{
      productName: string;
      status: string;
    }>;
    const orderSummary = context.orderSummary ?? {
      awaitingResponse: 0,
      inPreparation: 0,
      readyForFinancial: 0,
      inFinancialReview: 0,
      paymentPending: 0,
      paid: 0,
      shipped: 0
    };
    const financialSummary = context.financialSummary ?? {
      inReview: 0,
      pending: 0,
      paid: 0,
      rejected: 0
    };
    const workflowWatchlist = (context.workflowWatchlist ?? []) as Array<{
      productName: string;
      sku: string;
      replenishmentStatus?: string | null;
      replenishmentNextStep?: string | null;
      orderStage?: string | null;
      orderNextStep?: string | null;
      financialStatus?: string | null;
    }>;

    return [
      `Pergunta recebida: ${question}`,
      pageInfo?.pageHint ? `Contexto atual da pagina: ${pageInfo.pageHint}` : null,
      `Resumo do seu painel: ${summary.productCount} produtos monitorados, ${summary.criticalCount} criticos, ${summary.totalSales7d} vendas nos ultimos 7 dias e R$ ${(summary.totalInventorySaleValue ?? 0).toFixed(2).replace(".", ",")} em valor potencial de estoque.`,
      products[0]
        ? `Produto em destaque: ${products[0].name} (${products[0].sku}), saldo ${products[0].stock}, status ${products[0].band}, faixa de preco ${products[0].priceFrom ? `R$ ${products[0].priceFrom.toFixed(2).replace(".", ",")}` : "sem preco"}${products[0].priceTo && products[0].priceTo !== products[0].priceFrom ? ` a R$ ${products[0].priceTo.toFixed(2).replace(".", ",")}` : ""}.`
        : "Ainda nao encontrei produtos suficientes no seu escopo para detalhar.",
      suggestions[0]
        ? `Ultima sugestao registrada: ${suggestions[0].productName} com status ${suggestions[0].status}.`
        : "Nao ha sugestoes recentes registradas.",
      `Sugestoes de compra e pedidos: ${summary.replenishmentPendingCount ?? 0} compras pendentes, ${summary.replenishmentApprovedCount ?? 0} aprovadas para pedido e ${summary.replenishmentLinkedCount ?? 0} ligadas ao fluxo operacional.`,
      `Pedidos do seu fluxo: ${orderSummary.awaitingResponse} aguardando resposta, ${orderSummary.inPreparation} em preparacao, ${orderSummary.readyForFinancial} prontos para financeiro e ${orderSummary.paymentPending} aguardando pagamento.`,
      `Financeiro do seu fluxo: ${financialSummary.inReview} em revisao, ${financialSummary.pending} pendentes e ${financialSummary.paid} pagos.`,
      workflowWatchlist[0]
        ? `Produto com fluxo em destaque: ${workflowWatchlist[0].productName} (${workflowWatchlist[0].sku})${workflowWatchlist[0].replenishmentStatus ? `, compra ${workflowWatchlist[0].replenishmentStatus}` : ""}${workflowWatchlist[0].orderStage ? `, pedido em ${workflowWatchlist[0].orderStage}` : ""}${workflowWatchlist[0].financialStatus ? ` e financeiro ${workflowWatchlist[0].financialStatus}` : ""}. Proximo passo: ${workflowWatchlist[0].orderNextStep ?? workflowWatchlist[0].replenishmentNextStep ?? "acompanhar a operacao"}.`
        : "Nao ha produtos com fluxo operacional aberto agora.",
      "Se quiser uma resposta mais rica, configure a OPENAI_API_KEY para ativar a Pepper IA com analise completa."
    ]
      .filter(Boolean)
      .join(" ");
  }

  const dashboard = context.dashboard ?? {
    productCount: 0,
    supplierCount: 0,
    atRiskCount: 0,
    totalSales7d: 0
  };
  const topProducts = (context.topProducts ?? []) as Array<{
    name: string;
    sku: string;
    unitsSold: number;
  }>;
  const orderCards = (context.orderCards ?? []) as Array<{ stage: string; count: number }>;
  const financialCards = (context.financialCards ?? []) as Array<{ status: string; count: number }>;
  const workflowWatchlist = (context.workflowWatchlist ?? []) as Array<{
    supplierName: string;
    productName: string;
    orderNumber: string;
    workflowStageLabel: string;
    nextStepLabel: string;
    financialStatusLabel?: string | null;
  }>;

  return [
    `Pergunta recebida: ${question}`,
    pageInfo?.pageHint ? `Contexto atual da pagina: ${pageInfo.pageHint}` : null,
    `Resumo atual: ${dashboard.productCount} produtos pai, ${dashboard.supplierCount} fornecedores ativos, ${dashboard.atRiskCount} itens em risco e ${dashboard.totalSales7d} vendas nos ultimos 7 dias.`,
    topProducts[0]
      ? `Produto com maior giro agora: ${topProducts[0].name} (${topProducts[0].sku}) com ${topProducts[0].unitsSold} vendas na semana.`
      : "Ainda nao ha produtos suficientes para destacar no giro.",
    `Cards operacionais: ${orderCards.reduce((sum, item) => sum + item.count, 0)} no fluxo de pedidos e ${financialCards.reduce((sum, item) => sum + item.count, 0)} no financeiro.`,
    workflowWatchlist[0]
      ? `Fluxo operacional em destaque: ${workflowWatchlist[0].supplierName} / ${workflowWatchlist[0].productName} no pedido ${workflowWatchlist[0].orderNumber}, etapa ${workflowWatchlist[0].workflowStageLabel}${workflowWatchlist[0].financialStatusLabel ? ` e financeiro ${workflowWatchlist[0].financialStatusLabel}` : ""}. Proximo passo: ${workflowWatchlist[0].nextStepLabel}.`
      : "Nao ha fluxo operacional recente destacado no momento.",
    "Se quiser uma resposta mais rica, configure a OPENAI_API_KEY para ativar a Pepper IA com analise completa."
  ]
    .filter(Boolean)
    .join(" ");
}

export async function storePepperIaExchange(params: {
  threadId: string;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.pepperIaMessage.createMany({
    data: [
      {
        threadId: params.threadId,
        userId: params.userId,
        role: PepperIaMessageRole.USER,
        body: params.userMessage,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      },
      {
        threadId: params.threadId,
        userId: params.userId,
        role: PepperIaMessageRole.ASSISTANT,
        body: params.assistantMessage,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      }
    ]
  });
}
