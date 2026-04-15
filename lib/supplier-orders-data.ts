import { SupplierOrderStatus, SupplierOrderItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getColorLabel, getSizeLabel } from "@/lib/sku";
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
  try {
    const [suppliers, products, orders] = await Promise.all([
      prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" }
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
            where: { active: true },
            include: {
              supplier: true
            }
          }
        },
        orderBy: {
          sku: "asc"
        }
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
      })
    ]);

    const costMap = new Map(
      (
        await prisma.catalogVariant.findMany({
          where: {
            sourceProductId: {
              in: products.map((product) => product.id)
            }
          },
          select: {
            sourceProductId: true,
            price: {
              select: {
                costPrice: true
              }
            }
          }
        })
      )
        .filter((item) => item.sourceProductId)
        .map((item) => [item.sourceProductId as string, item.price?.costPrice ?? 0] as const)
    );

    const groupedProducts = new Map<
      string,
      {
        id: string;
        supplierId: string;
        supplierName: string;
        productName: string;
        productSku: string;
        imageUrl: string | null;
        variants: Array<{
          id: string;
          sku: string;
          color: string;
          size: string;
          unitCost: number;
        }>;
      }
    >();

    for (const product of products) {
      for (const assignment of product.assignments) {
        const key = `${assignment.supplierId}:${product.parent?.id ?? product.id}`;
        const current = groupedProducts.get(key) ?? {
          id: product.parent?.id ?? product.id,
          supplierId: assignment.supplierId,
          supplierName: assignment.supplier.name,
          productName: product.parent?.internalName ?? product.internalName,
          productSku: product.parent?.sku ?? product.sku,
          imageUrl: product.parent?.imageUrl ?? product.imageUrl ?? null,
          variants: []
        };

        current.variants.push({
          id: product.id,
          sku: product.sku,
          color: getColorLabel(product.colorCode),
          size: getSizeLabel(product.sizeCode),
          unitCost: costMap.get(product.id) ?? 0
        });
        groupedProducts.set(key, current);
      }
    }

    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        slug: supplier.slug
      })),
      products: Array.from(groupedProducts.values()).sort((a, b) => a.productName.localeCompare(b.productName)),
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
    return {
      suppliers: [],
      products: [],
      orders: []
    };
  }
}

export async function getSupplierReceivedOrders(supplierId: string) {
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
