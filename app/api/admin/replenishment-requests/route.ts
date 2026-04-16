import { OperationalCardOriginType, SupplierOrderStatus, SupplierOrderWorkflowStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createLocalAdminSupplierOrder, getLocalReplenishmentRequests, updateLocalReplenishmentRequest } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { getRouteSession } from "@/lib/route-session";
import { isLocalOperationalMode } from "@/lib/runtime-mode";

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"])
});

function createOrderNumber() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PF-${parts}-${suffix}`;
}

export async function PATCH(request: Request) {
  const session = await getRouteSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  try {
    const payload = patchSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Dados invalidos para atualizar a solicitacao." }, { status: 400 });
    }

    if (isLocalOperationalMode()) {
      const requests = await getLocalReplenishmentRequests();
      const existing = requests.find((item) => item.id === payload.data.id);

      if (!existing) {
        return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
      }

      const updated = await updateLocalReplenishmentRequest({
        requestId: payload.data.id,
        status: payload.data.status,
        reviewedByUserId: session.userId,
        reviewedByUsername: session.username
      });

      let linkedOrderId: string | null = existing.linkedOrderId ?? null;

      if (payload.data.status === "APPROVED" && !existing.linkedOrderId) {
        const order = await createLocalAdminSupplierOrder({
          supplierId: updated.supplierId,
          productId: updated.productId,
          originReferenceId: updated.id,
          productName: updated.productName,
          productSku: updated.productSku,
          imageUrl: updated.imageUrl,
          adminNote: updated.note || "Pedido criado automaticamente a partir de uma sugestao de compra aprovada.",
          actorUsername: session.username,
          items: updated.items.map((item) => ({
            sku: item.sku,
            productName: updated.productName,
            color: item.color,
            size: item.size,
            requestedQuantity: item.requestedQuantity,
            unitCost: 0
          }))
        });
        linkedOrderId = order.id;
      }

      return NextResponse.json({
        ok: true,
        verification: {
          storedInFoundation: true,
          linkedOrderCreated: payload.data.status !== "APPROVED" || Boolean(linkedOrderId)
        }
      });
    }

    const updated = await prisma.replenishmentRequest.update({
      where: {
        id: payload.data.id
      },
      include: {
        items: true
      },
      data: {
        status: payload.data.status,
        reviewedAt: new Date(),
        reviewedByUserId: session.userId
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: payload.data.status === "APPROVED" ? "approve_replenishment_request" : "reject_replenishment_request",
        entityType: "ReplenishmentRequest",
        entityId: updated.id
      }
    });

    if (payload.data.status === "APPROVED") {
      const existingOrder = await prisma.supplierOrder.findFirst({
        where: {
          originType: OperationalCardOriginType.REPLENISHMENT_REQUEST,
          originReferenceId: updated.id
        }
      });

      if (!existingOrder) {
        await prisma.supplierOrder.create({
          data: {
            supplierId: updated.supplierId,
            createdByUserId: session.userId,
            updatedByUserId: session.userId,
            orderNumber: createOrderNumber(),
            status: SupplierOrderStatus.AWAITING_SUPPLIER,
            workflowStage: SupplierOrderWorkflowStage.AWAITING_RESPONSE,
            originType: OperationalCardOriginType.REPLENISHMENT_REQUEST,
            originReferenceId: updated.id,
            productId: updated.productId,
            productName: updated.productName,
            productSku: updated.productSku,
            imageUrl: updated.imageUrl,
            adminNote: updated.note || "Pedido criado automaticamente a partir de uma sugestao de compra aprovada.",
            items: {
              create: updated.items.map((item) => ({
                sku: item.sku,
                productName: updated.productName,
                color: item.color,
                size: item.size,
                requestedQuantity: item.requestedQuantity,
                unitCost: 0,
                requestedTotalCost: 0
              }))
            },
            statusHistory: {
              create: {
                toStatus: SupplierOrderStatus.AWAITING_SUPPLIER,
                note: "Pedido criado automaticamente a partir da aprovacao da sugestao de compra.",
                actorUserId: session.userId,
                visibleToSupplier: true
              }
            },
            workflowHistory: {
              create: {
                toStage: SupplierOrderWorkflowStage.AWAITING_RESPONSE,
                note: "Card operacional criado a partir da aprovacao da sugestao de compra.",
                actorUserId: session.userId
              }
            }
          }
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel atualizar a solicitacao agora." }, { status: 503 });
  }
}
