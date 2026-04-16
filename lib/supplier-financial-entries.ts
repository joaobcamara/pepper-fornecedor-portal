import "server-only";
import {
  SupplierFinancialAttachmentKind,
  SupplierFinancialEntryStatus,
  SupplierOrderWorkflowStage
} from "@prisma/client";
import {
  getLocalAdminFinancialBoardData,
  getLocalSupplierFinancialBoardData
} from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import {
  type AdminFinancialBoardEntry,
  type SupplierFinancialBoardEntry,
  type SupplierFinancialReadyOrder
} from "@/lib/supplier-financial-shared";
import {
  getOperationalOriginLabel,
  getSupplierFinancialStatusLabel,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";

function formatCurrency(value: number | null | undefined) {
  return `R$ ${(value ?? 0).toFixed(2).replace(".", ",")}`;
}

export async function getSupplierFinancialBoardData(supplierId: string) {
  if (isLocalOperationalMode()) {
    return getLocalSupplierFinancialBoardData(supplierId);
  }

  try {
    const [entries, readyOrders] = await Promise.all([
      prisma.supplierFinancialEntry.findMany({
        where: { supplierId },
        include: {
          supplierOrder: {
            include: {
              items: {
                orderBy: { createdAt: "asc" }
              }
            }
          },
          attachments: {
            orderBy: { createdAt: "desc" }
          },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 8
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.supplierOrder.findMany({
        where: {
          supplierId,
          workflowStage: SupplierOrderWorkflowStage.SEPARATION_CONFIRMED,
          financialEntry: null
        },
        include: {
          items: {
            orderBy: { createdAt: "asc" }
          },
          attachments: {
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    return {
      readyOrders: readyOrders.map((order): SupplierFinancialReadyOrder => ({
        id: order.id,
        orderNumber: order.orderNumber,
        productName: order.productName,
        productSku: order.productSku,
        imageUrl: order.imageUrl,
        workflowStage: order.workflowStage,
        workflowStageLabel: getSupplierOrderWorkflowLabel(order.workflowStage),
        originLabel: getOperationalOriginLabel(order.originType),
        confirmedTotalCost: order.confirmedTotalCost,
        confirmedTotalCostLabel: formatCurrency(order.confirmedTotalCost),
        expectedShipDate: order.expectedShipDate?.toLocaleDateString("pt-BR") ?? null,
        attachments: order.attachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl
        })),
        items: order.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          color: item.color,
          size: item.size,
          requestedQuantity: item.requestedQuantity,
          fulfilledQuantity: item.fulfilledQuantity,
          confirmedTotalCost: item.confirmedTotalCost
        }))
      })),
      entries: entries.map((entry): SupplierFinancialBoardEntry => ({
        id: entry.id,
        supplierOrderId: entry.supplierOrderId,
        orderNumber: entry.supplierOrder.orderNumber,
        title: entry.title,
        status: entry.status,
        statusLabel: getSupplierFinancialStatusLabel(entry.status),
        originLabel: getOperationalOriginLabel(entry.originType),
        productName: entry.productName,
        productSku: entry.productSku,
        imageUrl: entry.imageUrl,
        workflowStage: entry.supplierOrder.workflowStage,
        workflowStageLabel: getSupplierOrderWorkflowLabel(entry.supplierOrder.workflowStage),
        amount: entry.amount,
        amountLabel: formatCurrency(entry.amount),
        dueDate: entry.dueDate?.toLocaleDateString("pt-BR") ?? null,
        note: entry.note,
        supplierNote: entry.supplierNote,
        submittedAt: entry.submittedAt?.toLocaleString("pt-BR") ?? null,
        reviewedAt: entry.reviewedAt?.toLocaleString("pt-BR") ?? null,
        paidAt: entry.paidAt?.toLocaleString("pt-BR") ?? null,
        attachments: entry.attachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind,
          kindLabel: getAttachmentKindLabel(attachment.kind),
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          createdAt: attachment.createdAt.toLocaleString("pt-BR")
        })),
        history: entry.statusHistory.map((history) => ({
          id: history.id,
          status: history.toStatus,
          statusLabel: getSupplierFinancialStatusLabel(history.toStatus),
          note: history.note,
          createdAt: history.createdAt.toLocaleString("pt-BR")
        })),
        items: entry.supplierOrder.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          color: item.color,
          size: item.size,
          requestedQuantity: item.requestedQuantity,
          fulfilledQuantity: item.fulfilledQuantity,
          confirmedTotalCost: item.confirmedTotalCost
        }))
      }))
    };
  } catch {
    return {
      readyOrders: [],
      entries: []
    };
  }
}

export async function getAdminFinancialBoardData() {
  if (isLocalOperationalMode()) {
    return getLocalAdminFinancialBoardData();
  }

  try {
    const entries = await prisma.supplierFinancialEntry.findMany({
      include: {
        supplier: true,
        supplierOrder: {
          include: {
            items: {
              orderBy: { createdAt: "asc" }
            }
          }
        },
        attachments: {
          orderBy: { createdAt: "desc" }
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 8
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return entries.map((entry): AdminFinancialBoardEntry => ({
      id: entry.id,
      supplierId: entry.supplierId,
      supplierName: entry.supplier.name,
      supplierOrderId: entry.supplierOrderId,
      orderNumber: entry.supplierOrder.orderNumber,
      title: entry.title,
      status: entry.status,
      statusLabel: getSupplierFinancialStatusLabel(entry.status),
      originLabel: getOperationalOriginLabel(entry.originType),
      productName: entry.productName,
      productSku: entry.productSku,
      imageUrl: entry.imageUrl,
      workflowStage: entry.supplierOrder.workflowStage,
      workflowStageLabel: getSupplierOrderWorkflowLabel(entry.supplierOrder.workflowStage),
      amount: entry.amount,
      amountLabel: formatCurrency(entry.amount),
      dueDate: entry.dueDate?.toLocaleDateString("pt-BR") ?? null,
      note: entry.note,
      supplierNote: entry.supplierNote,
      submittedAt: entry.submittedAt?.toLocaleString("pt-BR") ?? null,
      reviewedAt: entry.reviewedAt?.toLocaleString("pt-BR") ?? null,
      paidAt: entry.paidAt?.toLocaleString("pt-BR") ?? null,
      attachments: entry.attachments.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        kindLabel: getAttachmentKindLabel(attachment.kind),
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        createdAt: attachment.createdAt.toLocaleString("pt-BR")
      })),
      history: entry.statusHistory.map((history) => ({
        id: history.id,
        status: history.toStatus,
        statusLabel: getSupplierFinancialStatusLabel(history.toStatus),
        note: history.note,
        createdAt: history.createdAt.toLocaleString("pt-BR")
      })),
      items: entry.supplierOrder.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        color: item.color,
        size: item.size,
        requestedQuantity: item.requestedQuantity,
        fulfilledQuantity: item.fulfilledQuantity,
        confirmedTotalCost: item.confirmedTotalCost
      }))
    }));
  } catch {
    return [];
  }
}

function getAttachmentKindLabel(kind: SupplierFinancialAttachmentKind) {
  switch (kind) {
    case "NOTA_FISCAL":
      return "Nota fiscal";
    case "COMPROVANTE":
      return "Comprovante";
    default:
      return "Romaneio";
  }
}
