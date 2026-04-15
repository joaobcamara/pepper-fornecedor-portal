import { ReplenishmentRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupplierOrderWorkflowLabel } from "@/lib/operations-workflow";

export async function getAdminReplenishmentRequests() {
  try {
    const requests = await prisma.replenishmentRequest.findMany({
      include: {
        supplier: true,
        createdByUser: true,
        reviewedByUser: true,
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const linkedOrders = await prisma.supplierOrder.findMany({
      where: {
        originType: "REPLENISHMENT_REQUEST",
        originReferenceId: {
          in: requests.map((request) => request.id)
        }
      },
      include: {
        financialEntry: true
      }
    });

    const linkedOrderMap = new Map(linkedOrders.map((order) => [order.originReferenceId, order]));

    return requests.map((request) => {
      const linkedOrder = linkedOrderMap.get(request.id);

      return {
        statusLabel: getReplenishmentStatusLabel(request.status),
        id: request.id,
        supplierName: request.supplier.name,
        createdBy: request.createdByUser.username,
        reviewedBy: request.reviewedByUser?.username ?? null,
        productName: request.productName,
        productSku: request.productSku,
        imageUrl: request.imageUrl,
        note: request.note,
        status: request.status,
        htmlContent: request.htmlContent,
        createdAt: request.createdAt.toLocaleString("pt-BR"),
        reviewedAt: request.reviewedAt ? request.reviewedAt.toLocaleString("pt-BR") : null,
        requestedUnits: request.items.reduce((sum, item) => sum + item.requestedQuantity, 0),
        linkedOrder: linkedOrder
          ? {
              id: linkedOrder.id,
              orderNumber: linkedOrder.orderNumber,
              workflowStage: linkedOrder.workflowStage,
              workflowStageLabel: getSupplierOrderWorkflowLabel(linkedOrder.workflowStage),
              financialStatus: linkedOrder.financialEntry?.status ?? null,
              hasFinancialEntry: Boolean(linkedOrder.financialEntry)
            }
          : null,
        items: request.items.map((item) => ({
          id: item.id,
          sku: item.sku,
          size: item.size,
          color: item.color,
          currentStock: item.currentStock,
          requestedQuantity: item.requestedQuantity
        }))
      };
    });
  } catch {
    return [];
  }
}

export function getReplenishmentStatusLabel(status: ReplenishmentRequestStatus) {
  if (status === "APPROVED") {
    return "Aprovada";
  }

  if (status === "REJECTED") {
    return "Recusada";
  }

  return "Pendente";
}
