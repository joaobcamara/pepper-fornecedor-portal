import { SupplierOrderStatus, SupplierOrderItemStatus } from "@prisma/client";
import { getDemoAdminSupplierOrdersData } from "@/lib/demo-data";
import { listFoundationCatalogProducts } from "@/lib/foundation-catalog";
import {
  getLocalAdminSupplierOrderPageData,
  getLocalSupplierReceivedOrders
} from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { buildSalesPeriodTotals } from "@/lib/sales-metrics";
import {
  getOperationalOriginLabel,
  getSupplierFinancialStatusLabel,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";

function formatCurrency(value: number | null | undefined) {
  return `R$ ${(value ?? 0).toFixed(2).replace(".", ",")}`;
}

export function getSupplierOrderStatusLabel(status: SupplierOrderStatus) {
  switch (status) {
    case "AWAITING_SUPPLIER":
      return "Aguardando resposta";
    case "SUPPLIER_REVIEWED":
      return "Respondido";
    case "IN_PREPARATION":
      return "Em preparacao";
    case "PARTIALLY_FULFILLED":
      return "Atendido parcialmente";
    case "SHIPPED":
      return "Enviado";
    case "NO_STOCK":
      return "Sem estoque";
    case "CANCELED":
      return "Cancelado";
    default:
      return "Rascunho";
  }
}

export function getSupplierOrderItemStatusLabel(status: SupplierOrderItemStatus) {
  switch (status) {
    case "AVAILABLE":
      return "Disponivel";
    case "PARTIAL":
      return "Parcial";
    case "NO_STOCK":
      return "Sem estoque";
    default:
      return "Pendente";
  }
}

export async function getAdminSupplierOrderPageData() {
  if (isLocalOperationalMode()) {
    return getLocalAdminSupplierOrderPageData();
  }

  try {
    const [suppliers, orders, catalogProducts] = await Promise.all([
      prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" }
      }),
      prisma.supplierOrder.findMany({
        include: {
          supplier: true,
          createdByUser: true,
          updatedByUser: true,
          financialEntry: true,
          attachments: {
            orderBy: { createdAt: "desc" }
          },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 8
          },
          workflowHistory: {
            orderBy: { createdAt: "desc" },
            take: 8
          },
          items: {
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      listFoundationCatalogProducts({
        onlyActive: true,
        onlyPortalVisible: true
      })
    ]);

    const variantMetrics = catalogProducts.length
      ? await prisma.variantSalesMetricDaily.findMany({
        where: {
          variantId: {
              in: catalogProducts.flatMap((product) => product.variants.map((variant) => variant.id))
            },
            date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 364))
            }
          }
        })
      : [];

    const variantMetricMap = new Map<string, typeof variantMetrics>();
    for (const metric of variantMetrics) {
      const list = variantMetricMap.get(metric.variantId) ?? [];
      list.push(metric);
      variantMetricMap.set(metric.variantId, list);
    }

    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        slug: supplier.slug
      })),
      products: catalogProducts
        .flatMap((product) =>
          product.supplierLinks.map((supplierLink) => ({
            id: product.id,
            supplierId: supplierLink.id,
            supplierName: supplierLink.name,
            productName: product.internalName,
            productSku: product.parentSku,
            imageUrl: product.imageUrl,
            variants: product.variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              color: variant.colorLabel,
              size: variant.sizeLabel,
              unitCost: variant.costPrice ?? 0,
              currentStock: variant.quantity,
              sales: buildSalesPeriodTotals(variantMetricMap.get(variant.id) ?? [])
            }))
          }))
        )
        .sort((a, b) => a.productName.localeCompare(b.productName)),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierId: order.supplierId,
        supplierName: order.supplier.name,
        productName: order.productName,
        productSku: order.productSku,
        imageUrl: order.imageUrl,
        status: order.status,
        statusLabel: getSupplierOrderStatusLabel(order.status),
        workflowStage: order.workflowStage,
        workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
        originType: order.originType,
        originLabel: getOperationalOriginLabel(order.originType),
        adminNote: order.adminNote,
        supplierNote: order.supplierNote,
        supplierHasNoStock: order.supplierHasNoStock,
        createdAt: order.createdAt.toLocaleString("pt-BR"),
        respondedAt: order.respondedAt?.toLocaleString("pt-BR") ?? null,
        shippedAt: order.shippedAt?.toLocaleString("pt-BR") ?? null,
        expectedShipDate: order.expectedShipDate?.toLocaleDateString("pt-BR") ?? null,
        separationConfirmedAt: order.separationConfirmedAt?.toLocaleString("pt-BR") ?? null,
        sentToFinancialAt: order.sentToFinancialAt?.toLocaleString("pt-BR") ?? null,
        paidAt: order.paidAt?.toLocaleString("pt-BR") ?? null,
        estimatedTotalCost: order.estimatedTotalCost,
        estimatedTotalCostLabel: formatCurrency(order.estimatedTotalCost),
        confirmedTotalCost: order.confirmedTotalCost,
        confirmedTotalCostLabel: formatCurrency(order.confirmedTotalCost),
        createdBy: order.createdByUser.username,
        updatedBy: order.updatedByUser?.username ?? null,
        hasRomaneio: order.attachments.length > 0,
        financialEntry: order.financialEntry
          ? {
              id: order.financialEntry.id,
              status: order.financialEntry.status,
              statusLabel: getSupplierFinancialStatusLabel(order.financialEntry.status),
              amount: order.financialEntry.amount,
              amountLabel: formatCurrency(order.financialEntry.amount)
            }
          : null,
        attachments: order.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          kind: attachment.kind,
          createdAt: attachment.createdAt.toLocaleString("pt-BR")
        })),
        history: order.statusHistory.map((entry) => ({
          id: entry.id,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          toStatusLabel: getSupplierOrderStatusLabel(entry.toStatus),
          note: entry.note,
          createdAt: entry.createdAt.toLocaleString("pt-BR")
        })),
        workflowHistory: order.workflowHistory.map((entry) => ({
          id: entry.id,
          fromStage: entry.fromStage,
          toStage: entry.toStage,
          toStageLabel: getSupplierOrderWorkflowLabel(entry.toStage),
          note: entry.note,
          createdAt: entry.createdAt.toLocaleString("pt-BR")
        })),
        items: order.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          color: item.color,
          size: item.size,
          productName: item.productName,
          requestedQuantity: item.requestedQuantity,
          fulfilledQuantity: item.fulfilledQuantity,
          itemStatus: item.itemStatus,
          itemStatusLabel: getSupplierOrderItemStatusLabel(item.itemStatus),
          unitCost: item.unitCost,
          requestedTotalCost: item.requestedTotalCost,
          confirmedUnitCost: item.confirmedUnitCost,
          confirmedTotalCost: item.confirmedTotalCost,
          supplierItemNote: item.supplierItemNote
        }))
      }))
    };
  } catch {
    return getDemoAdminSupplierOrdersData();
  }
}

export async function getSupplierReceivedOrders(supplierId: string) {
  if (isLocalOperationalMode()) {
    return getLocalSupplierReceivedOrders(supplierId);
  }

  try {
    const orders = await prisma.supplierOrder.findMany({
      where: {
        supplierId
      },
      include: {
        financialEntry: true,
        attachments: {
          orderBy: { createdAt: "desc" }
        },
        items: {
          orderBy: { createdAt: "asc" }
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 8
        },
        workflowHistory: {
          orderBy: { createdAt: "desc" },
          take: 8
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      productName: order.productName,
      productSku: order.productSku,
      imageUrl: order.imageUrl,
      status: order.status,
      statusLabel: getSupplierOrderStatusLabel(order.status),
      workflowStage: order.workflowStage,
      workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
      originType: order.originType,
      originLabel: getOperationalOriginLabel(order.originType),
      adminNote: order.adminNote,
      supplierNote: order.supplierNote,
      supplierHasNoStock: order.supplierHasNoStock,
      createdAt: order.createdAt.toLocaleString("pt-BR"),
      respondedAt: order.respondedAt?.toLocaleString("pt-BR") ?? null,
      shippedAt: order.shippedAt?.toLocaleString("pt-BR") ?? null,
      expectedShipDate: order.expectedShipDate?.toLocaleDateString("pt-BR") ?? null,
      separationConfirmedAt: order.separationConfirmedAt?.toLocaleString("pt-BR") ?? null,
      sentToFinancialAt: order.sentToFinancialAt?.toLocaleString("pt-BR") ?? null,
      paidAt: order.paidAt?.toLocaleString("pt-BR") ?? null,
      estimatedTotalCost: order.estimatedTotalCost,
      estimatedTotalCostLabel: formatCurrency(order.estimatedTotalCost),
      confirmedTotalCost: order.confirmedTotalCost,
      confirmedTotalCostLabel: formatCurrency(order.confirmedTotalCost),
      financialEntry: order.financialEntry
        ? {
            id: order.financialEntry.id,
            status: order.financialEntry.status,
            statusLabel: getSupplierFinancialStatusLabel(order.financialEntry.status),
            amount: order.financialEntry.amount,
            amountLabel: formatCurrency(order.financialEntry.amount)
          }
        : null,
      attachments: order.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        kind: attachment.kind,
        createdAt: attachment.createdAt.toLocaleString("pt-BR")
      })),
      history: order.statusHistory.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        toStatusLabel: getSupplierOrderStatusLabel(entry.toStatus),
        note: entry.note,
        createdAt: entry.createdAt.toLocaleString("pt-BR")
      })),
      workflowHistory: order.workflowHistory.map((entry) => ({
        id: entry.id,
        fromStage: entry.fromStage,
        toStage: entry.toStage,
        toStageLabel: getSupplierOrderWorkflowLabel(entry.toStage),
        note: entry.note,
        createdAt: entry.createdAt.toLocaleString("pt-BR")
      })),
      items: order.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        color: item.color,
        size: item.size,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        fulfilledQuantity: item.fulfilledQuantity,
        itemStatus: item.itemStatus,
        itemStatusLabel: getSupplierOrderItemStatusLabel(item.itemStatus),
        unitCost: item.unitCost,
        requestedTotalCost: item.requestedTotalCost,
        confirmedUnitCost: item.confirmedUnitCost,
        confirmedTotalCost: item.confirmedTotalCost,
        supplierItemNote: item.supplierItemNote
      }))
    }));
  } catch {
    return [];
  }
}
