import {
  SupplierOrderItemStatus,
  SupplierOrderStatus,
  SupplierOrderWorkflowStage
} from "@prisma/client";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/local-files";
import { updateLocalSupplierOrder } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { getCurrentSession } from "@/lib/session";

function resolveOrderStatus(params: {
  requestedStatus?: string | null;
  supplierHasNoStock: boolean;
  anyNoStock: boolean;
  anyPartial: boolean;
}) {
  if (params.requestedStatus === "IN_PREPARATION") return SupplierOrderStatus.IN_PREPARATION;
  if (params.requestedStatus === "SHIPPED") return SupplierOrderStatus.SHIPPED;
  if (params.supplierHasNoStock) return SupplierOrderStatus.NO_STOCK;
  if (params.anyNoStock || params.anyPartial) return SupplierOrderStatus.PARTIALLY_FULFILLED;
  return SupplierOrderStatus.SUPPLIER_REVIEWED;
}

function resolveWorkflowStage(params: {
  currentStage: SupplierOrderWorkflowStage;
  workflowAction?: string | null;
  supplierHasNoStock: boolean;
  nextStatus: SupplierOrderStatus;
}) {
  if (params.workflowAction === "PREPARE_ORDER") return SupplierOrderWorkflowStage.IN_PREPARATION;
  if (params.workflowAction === "CONFIRM_SEPARATION") return SupplierOrderWorkflowStage.SEPARATION_CONFIRMED;
  if (params.workflowAction === "MARK_SHIPPED" || params.nextStatus === SupplierOrderStatus.SHIPPED) {
    return SupplierOrderWorkflowStage.SHIPPED;
  }
  if (params.workflowAction === "MARK_NO_STOCK" || params.supplierHasNoStock || params.nextStatus === SupplierOrderStatus.NO_STOCK) {
    return SupplierOrderWorkflowStage.NO_STOCK;
  }
  return params.currentStage;
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const orderId = String(formData.get("orderId") ?? "").trim();
    const supplierNote = String(formData.get("supplierNote") ?? "").trim() || null;
    const expectedShipDate = String(formData.get("expectedShipDate") ?? "").trim() || null;
    const requestedStatus = String(formData.get("status") ?? "").trim() || null;
    const workflowAction = String(formData.get("workflowAction") ?? "").trim() || null;
    const supplierHasNoStock = String(formData.get("supplierHasNoStock") ?? "false") === "true";
    const itemsJson = String(formData.get("itemsJson") ?? "[]");
    const romaneio = formData.get("romaneio");

    if (!orderId) {
      return NextResponse.json({ error: "Pedido invalido." }, { status: 400 });
    }

    const parsedItems = (JSON.parse(itemsJson) as Array<{
      id: string;
      fulfilledQuantity?: number;
      itemStatus?: SupplierOrderItemStatus;
      supplierItemNote?: string;
      confirmedUnitCost?: number | null;
    }>).map((item) => ({
      id: item.id,
      fulfilledQuantity: Number(item.fulfilledQuantity ?? 0),
      itemStatus: item.itemStatus ?? SupplierOrderItemStatus.PENDING,
      supplierItemNote: item.supplierItemNote?.trim() || null,
      confirmedUnitCost:
        item.confirmedUnitCost === null || item.confirmedUnitCost === undefined || item.confirmedUnitCost === 0
          ? null
          : Number(item.confirmedUnitCost)
    }));

    const uploadedRomaneio =
      romaneio instanceof File && romaneio.size > 0
        ? await saveUploadedFile({
            file: romaneio,
            folder: "uploads/supplier-orders",
            prefix: "romaneio"
          })
        : null;

    if (isLocalOperationalMode()) {
      await updateLocalSupplierOrder({
        supplierId: session.supplierId,
        orderId,
        supplierNote,
        expectedShipDate,
        requestedStatus,
        workflowAction,
        supplierHasNoStock,
        items: parsedItems,
        uploadedRomaneio,
        actorUsername: session.username
      });

      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.supplierOrder.findFirst({
      where: {
        id: orderId,
        supplierId: session.supplierId
      },
      include: {
        items: true
      }
    });

    if (!existing) {
      return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
    }

    const anyNoStock = supplierHasNoStock || parsedItems.some((item) => item.itemStatus === SupplierOrderItemStatus.NO_STOCK);
    const anyPartial = parsedItems.some((item) => item.itemStatus === SupplierOrderItemStatus.PARTIAL);
    const nextStatus = resolveOrderStatus({
      requestedStatus,
      supplierHasNoStock,
      anyNoStock,
      anyPartial
    });
    const nextWorkflowStage = resolveWorkflowStage({
      currentStage: existing.workflowStage,
      workflowAction,
      supplierHasNoStock,
      nextStatus
    });

    const confirmedTotalCost = existing.items.reduce((sum, item) => {
      const update = parsedItems.find((entry) => entry.id === item.id);
      const fulfilledQuantity = update?.fulfilledQuantity ?? item.fulfilledQuantity ?? 0;
      const confirmedUnitCost = update?.confirmedUnitCost ?? item.confirmedUnitCost ?? item.unitCost ?? 0;
      return sum + fulfilledQuantity * confirmedUnitCost;
    }, 0);

    await prisma.supplierOrder.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        workflowStage: nextWorkflowStage,
        supplierNote,
        supplierHasNoStock,
        expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null,
        respondedAt: new Date(),
        separationConfirmedAt:
          nextWorkflowStage === SupplierOrderWorkflowStage.SEPARATION_CONFIRMED ? new Date() : existing.separationConfirmedAt,
        shippedAt: nextStatus === SupplierOrderStatus.SHIPPED ? new Date() : existing.shippedAt,
        confirmedTotalCost,
        updatedByUserId: session.userId,
        attachments: uploadedRomaneio
          ? {
              create: {
                kind: "ROMANEIO",
                uploadedByUserId: session.userId,
                ...uploadedRomaneio
              }
            }
          : undefined,
        items: {
          update: parsedItems.map((item) => ({
            where: { id: item.id },
            data: {
              fulfilledQuantity: item.fulfilledQuantity,
              itemStatus: item.itemStatus,
              supplierItemNote: item.supplierItemNote,
              confirmedUnitCost: item.confirmedUnitCost,
              confirmedTotalCost: item.fulfilledQuantity * (item.confirmedUnitCost ?? 0)
            }
          }))
        },
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: nextStatus,
            note: supplierNote || "Fornecedor atualizou o pedido.",
            actorUserId: session.userId,
            visibleToSupplier: true
          }
        },
        workflowHistory:
          nextWorkflowStage !== existing.workflowStage
            ? {
                create: {
                  fromStage: existing.workflowStage,
                  toStage: nextWorkflowStage,
                  note: supplierNote || "Fornecedor atualizou a etapa operacional do pedido.",
                  actorUserId: session.userId
                }
              }
            : undefined
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel atualizar o pedido agora." }, { status: 503 });
  }
}
