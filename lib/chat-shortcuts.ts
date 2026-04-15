import { prisma } from "@/lib/prisma";
import { ConversationShortcutGroup, ConversationShortcutItem } from "@/lib/chat-shortcuts-shared";
import {
  getOperationalOriginLabel,
  getProductSuggestionNextStep,
  getReplenishmentNextStep,
  getSupplierFinancialStatusLabel,
  getSupplierOrderLinkedModules,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import { getSuggestionStatusLabel } from "@/lib/suggestion-data-v2";

function buildHref(pathname: string, params?: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getReplenishmentStatusLabel(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") {
    return "Aprovada";
  }

  if (status === "REJECTED") {
    return "Recusada";
  }

  return "Pendente";
}

function buildReferenceMeta(meta: {
  originLabel: string;
  currentLabel: string;
  nextStepLabel: string;
  modules: string[];
  helperLabel?: string | null;
}) {
  return JSON.stringify(meta);
}

export async function getAdminConversationShortcutGroups(): Promise<ConversationShortcutGroup[]> {
  try {
    const [suppliers, users, suggestions, replenishments, orders, products] = await Promise.all([
      prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        take: 12
      }),
      prisma.user.findMany({
        where: { active: true },
        orderBy: { username: "asc" },
        take: 12
      }),
      prisma.productSuggestion.findMany({
        include: { supplier: true },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.replenishmentRequest.findMany({
        include: { supplier: true },
        orderBy: { createdAt: "desc" },
        take: 12
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
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.product.findMany({
        where: {
          kind: "VARIANT",
          active: true,
          archivedAt: null,
          assignments: {
            some: {
              active: true
            }
          }
        },
        include: {
          parent: true,
          assignments: {
            where: {
              active: true
            },
            include: {
              supplier: true
            }
          }
        },
        orderBy: { sku: "asc" },
        take: 40
      })
    ]);

    const productItems = new Map<string, ConversationShortcutItem>();
    const latestReplenishmentByKey = new Map<string, (typeof replenishments)[number]>();
    const latestOrderByKey = new Map<string, (typeof orders)[number]>();

    for (const request of replenishments) {
      const key = `${request.supplierId}:${request.productSku}`;
      if (!latestReplenishmentByKey.has(key)) {
        latestReplenishmentByKey.set(key, request);
      }
    }

    for (const order of orders) {
      const key = `${order.supplierId}:${order.productSku}`;
      if (!latestOrderByKey.has(key)) {
        latestOrderByKey.set(key, order);
      }
    }

    for (const product of products) {
      const parentId = product.parent?.id ?? product.id;
      const parentSku = product.parent?.sku ?? product.sku;
      const parentName = product.parent?.internalName ?? product.internalName;

      for (const assignment of product.assignments) {
        const key = `${assignment.supplierId}:${parentId}`;

        if (!productItems.has(key)) {
          const replenishment = latestReplenishmentByKey.get(`${assignment.supplierId}:${parentSku}`);
          const order = latestOrderByKey.get(`${assignment.supplierId}:${parentSku}`);
          const nextStepLabel = order
            ? getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label
            : replenishment
              ? getReplenishmentNextStep(replenishment.status as "PENDING" | "APPROVED" | "REJECTED").label
              : "Acompanhar estoque e decidir a proxima compra";

          productItems.set(key, {
            id: key,
            referenceType: "PRODUCT",
            referenceId: parentId,
            title: parentName,
            subtitle: `${parentSku} - ${nextStepLabel}`,
            badge: assignment.supplier.name,
            href: buildHref("/admin/produtos", { sku: parentSku }),
            metaJson: buildReferenceMeta({
              originLabel: order
                ? getOperationalOriginLabel(order.originType)
                : replenishment
                  ? "Sugestao de compra"
                  : "Produto monitorado",
              currentLabel: order
                ? getSupplierOrderWorkflowLabel(order.workflowStage)
                : replenishment
                  ? getReplenishmentStatusLabel(replenishment.status as "PENDING" | "APPROVED" | "REJECTED")
                  : "Sem fluxo aberto",
              nextStepLabel,
              modules: order
                ? getSupplierOrderLinkedModules(order.workflowStage, Boolean(order.financialEntry))
                : replenishment
                  ? ["Sugestao de compra", "Pedidos ao Fornecedor"]
                  : ["Produtos"],
              helperLabel: `Fornecedor ${assignment.supplier.name}`
            })
          });
        }
      }
    }

    return [
      {
        key: "products",
        label: "Produtos",
        description: "Compartilhe um produto ou SKU com contexto na conversa.",
        items: Array.from(productItems.values()).slice(0, 12)
      },
      {
        key: "suggestions",
        label: "Sugestoes de produto",
        description: "Envie uma sugestao para discutir revisao, aprovacao ou correcao.",
        items: suggestions.map((suggestion) => ({
          id: suggestion.id,
          referenceType: "PRODUCT_SUGGESTION",
          referenceId: suggestion.id,
          title: suggestion.productName,
          subtitle: `${suggestion.supplier.name} - ${getProductSuggestionNextStep(
            suggestion.status,
            suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
          ).label}`,
          badge: suggestion.status,
          href: buildHref("/admin/sugestoes-produto", { suggestion: suggestion.id }),
          metaJson: buildReferenceMeta({
            originLabel: "Sugestao de produto",
            currentLabel: getSuggestionStatusLabel(suggestion.status),
            nextStepLabel: getProductSuggestionNextStep(
              suggestion.status,
              suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
            ).label,
            modules:
              suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
                ? ["Sugestoes de Produto", "Fila de cadastro"]
                : ["Sugestoes de Produto"],
            helperLabel: `Fornecedor ${suggestion.supplier.name}`
          })
        }))
      },
      {
        key: "replenishments",
        label: "Solicitacoes de reposicao",
        description: "Anexe uma solicitacao de reposicao para alinhar quantidades e prioridades.",
        items: replenishments.map((request) => ({
          id: request.id,
          referenceType: "REPLENISHMENT_REQUEST",
          referenceId: request.id,
          title: request.productName,
          subtitle: `${request.productSku} - ${getReplenishmentNextStep(request.status as "PENDING" | "APPROVED" | "REJECTED").label}`,
          badge: request.supplier.name,
          href: buildHref("/admin/solicitacoes-reposicao", { request: request.id }),
          metaJson: buildReferenceMeta({
            originLabel: "Sugestao de compra",
            currentLabel: getReplenishmentStatusLabel(request.status as "PENDING" | "APPROVED" | "REJECTED"),
            nextStepLabel: getReplenishmentNextStep(request.status as "PENDING" | "APPROVED" | "REJECTED").label,
            modules:
              request.status === "APPROVED"
                ? ["Solicitacoes de reposicao", "Pedidos ao Fornecedor"]
                : ["Solicitacoes de reposicao"],
            helperLabel: `Fornecedor ${request.supplier.name}`
          })
        }))
      },
      {
        key: "supplierOrders",
        label: "Pedidos ao Fornecedor",
        description: "Compartilhe um pedido ao fornecedor ja criado para discutir atendimento.",
        items: orders.map((order) => ({
          id: order.id,
          referenceType: "SUPPLIER_ORDER",
          referenceId: order.id,
          title: order.orderNumber,
          subtitle: `${order.productName} • ${order.productSku}`,
          badge: getSupplierOrderWorkflowLabel(order.workflowStage),
          href: buildHref("/admin/pedidos-fornecedor", { order: order.id }),
          metaJson: buildReferenceMeta({
            originLabel: getOperationalOriginLabel(order.originType),
            currentLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
            nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label,
            modules: getSupplierOrderLinkedModules(order.workflowStage, Boolean(order.financialEntry)),
            helperLabel: `${order.supplier.name} - ${order.productSku}${order.financialEntry ? ` - Financeiro ${getSupplierFinancialStatusLabel(order.financialEntry.status)}` : ""}`
          })
        }))
      },
      {
        key: "suppliers",
        label: "Fornecedores",
        description: "Marque um fornecedor da base para continuar a conversa com contexto.",
        items: suppliers.map((supplier) => ({
          id: supplier.id,
          referenceType: "SUPPLIER",
          referenceId: supplier.id,
          title: supplier.name,
          subtitle: supplier.slug,
          badge: supplier.active ? "Ativo" : "Inativo",
          href: buildHref("/admin/fornecedores", { supplier: supplier.id }),
          metaJson: buildReferenceMeta({
            originLabel: "Fornecedor",
            currentLabel: supplier.active ? "Ativo" : "Inativo",
            nextStepLabel: supplier.active ? "Gerenciar produtos, pedidos e financeiro" : "Revisar ativacao do cadastro",
            modules: ["Fornecedores", "Produtos", "Pedidos ao Fornecedor", "Financeiro"],
            helperLabel: supplier.slug
          })
        }))
      },
      {
        key: "users",
        label: "Usuarios",
        description: "Compartilhe um usuario cadastrado para alinhar permissoes e ownership.",
        items: users.map((user) => ({
          id: user.id,
          referenceType: "USER",
          referenceId: user.id,
          title: user.username,
          subtitle: user.role,
          badge: user.active ? "Ativo" : "Inativo",
          href: buildHref("/admin/usuarios", { user: user.id }),
          metaJson: buildReferenceMeta({
            originLabel: "Usuario",
            currentLabel: user.active ? "Ativo" : "Inativo",
            nextStepLabel: user.active ? "Revisar ownership, acessos e conversas" : "Reavaliar acesso ao painel",
            modules: ["Usuarios", "Conversas"],
            helperLabel: user.role
          })
        }))
      }
    ].filter((group) => group.items.length > 0);
  } catch {
    return [];
  }
}

export async function getSupplierConversationShortcutGroups(supplierId: string): Promise<ConversationShortcutGroup[]> {
  try {
    const [products, suggestions, replenishments, orders] = await Promise.all([
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
          parent: true
        },
        orderBy: { sku: "asc" },
        take: 40
      }),
      prisma.productSuggestion.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.replenishmentRequest.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.supplierOrder.findMany({
        where: { supplierId },
        include: {
          financialEntry: {
            select: {
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 12
      })
    ]);

    const productItems = new Map<string, ConversationShortcutItem>();
    const latestReplenishmentBySku = new Map<string, (typeof replenishments)[number]>();
    const latestOrderBySku = new Map<string, (typeof orders)[number]>();

    for (const request of replenishments) {
      if (!latestReplenishmentBySku.has(request.productSku)) {
        latestReplenishmentBySku.set(request.productSku, request);
      }
    }

    for (const order of orders) {
      if (!latestOrderBySku.has(order.productSku)) {
        latestOrderBySku.set(order.productSku, order);
      }
    }

    for (const product of products) {
      const parentId = product.parent?.id ?? product.id;
      const parentSku = product.parent?.sku ?? product.sku;

      if (!productItems.has(parentId)) {
        const replenishment = latestReplenishmentBySku.get(parentSku);
        const order = latestOrderBySku.get(parentSku);
        const nextStepLabel = order
          ? getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label
          : replenishment
            ? getReplenishmentNextStep(replenishment.status as "PENDING" | "APPROVED" | "REJECTED").label
            : "Acompanhar giro e abrir reposicao quando necessario";

        productItems.set(parentId, {
          id: parentId,
          referenceType: "PRODUCT",
          referenceId: parentId,
          title: product.parent?.internalName ?? product.internalName,
          subtitle: `${parentSku} - ${nextStepLabel}`,
          badge: "Produto monitorado",
          href: buildHref("/produtos", { sku: parentSku }),
          metaJson: buildReferenceMeta({
            originLabel: order
              ? getOperationalOriginLabel(order.originType)
              : replenishment
                ? "Sugestao de compra"
                : "Produto monitorado",
            currentLabel: order
              ? getSupplierOrderWorkflowLabel(order.workflowStage)
              : replenishment
                ? getReplenishmentStatusLabel(replenishment.status as "PENDING" | "APPROVED" | "REJECTED")
                : "Sem fluxo aberto",
            nextStepLabel,
            modules: order
              ? getSupplierOrderLinkedModules(order.workflowStage, Boolean(order.financialEntry))
              : replenishment
                ? ["Sugestao de compra", "Pedidos Recebidos"]
                : ["Produtos"]
          })
        });
      }
    }

    return [
      {
        key: "products",
        label: "Produtos",
        description: "Envie um produto da sua grade para discutir estoque, giro ou cadastro.",
        items: Array.from(productItems.values()).slice(0, 12)
      },
      {
        key: "suggestions",
        label: "Sugestoes de produto",
        description: "Compartilhe uma sugestao recente para alinhar correcoes e retorno da Pepper.",
        items: suggestions.map((suggestion) => ({
          id: suggestion.id,
          referenceType: "PRODUCT_SUGGESTION",
          referenceId: suggestion.id,
          title: suggestion.productName,
          subtitle: getProductSuggestionNextStep(
            suggestion.status,
            suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
          ).label,
          badge: suggestion.status,
          href: buildHref("/sugestao-produto", { suggestion: suggestion.id }),
          metaJson: buildReferenceMeta({
            originLabel: "Sugestao de produto",
            currentLabel: getSuggestionStatusLabel(suggestion.status),
            nextStepLabel: getProductSuggestionNextStep(
              suggestion.status,
              suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
            ).label,
            modules:
              suggestion.status === "APPROVED_FOR_CATALOG" || suggestion.status === "IMPORTED_BY_CATALOG"
                ? ["Sugestao de Produto", "Fila de cadastro"]
                : ["Sugestao de Produto"]
          })
        }))
      },
      {
        key: "replenishments",
        label: "Reposicao",
        description: "Anexe uma solicitacao de reposicao para discutir quantidades sugeridas.",
        items: replenishments.map((request) => ({
          id: request.id,
          referenceType: "REPLENISHMENT_REQUEST",
          referenceId: request.id,
          title: request.productName,
          subtitle: `${request.productSku} â€¢ ${getReplenishmentNextStep(request.status as "PENDING" | "APPROVED" | "REJECTED").label}`,
          badge: request.status,
          href: "/produtos",
          metaJson: buildReferenceMeta({
            originLabel: "Sugestao de compra",
            currentLabel: getReplenishmentStatusLabel(request.status as "PENDING" | "APPROVED" | "REJECTED"),
            nextStepLabel: getReplenishmentNextStep(request.status as "PENDING" | "APPROVED" | "REJECTED").label,
            modules:
              request.status === "APPROVED"
                ? ["Reposicao", "Pedidos Recebidos"]
                : ["Reposicao"]
          })
        }))
      },
      {
        key: "supplierOrders",
        label: "Pedidos recebidos",
        description: "Compartilhe um pedido recebido para alinhar disponibilidade, romaneio ou envio.",
        items: orders.map((order) => ({
          id: order.id,
          referenceType: "SUPPLIER_ORDER",
          referenceId: order.id,
          title: order.orderNumber,
          subtitle: `${order.productName} • ${order.productSku}`,
          badge: order.financialEntry
            ? `Financeiro ${getSupplierFinancialStatusLabel(order.financialEntry.status)}`
            : getSupplierOrderWorkflowLabel(order.workflowStage),
          href: buildHref("/pedidos-recebidos", { order: order.id }),
          metaJson: buildReferenceMeta({
            originLabel: getOperationalOriginLabel(order.originType),
            currentLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
            nextStepLabel: getSupplierOrderNextStep(order.workflowStage, Boolean(order.financialEntry)).label,
            modules: getSupplierOrderLinkedModules(order.workflowStage, Boolean(order.financialEntry)),
            helperLabel: `${order.productSku}${order.financialEntry ? ` - Financeiro ${getSupplierFinancialStatusLabel(order.financialEntry.status)}` : ""}`
          })
        }))
      }
    ].filter((group) => group.items.length > 0);
  } catch {
    return [];
  }
}
