import { SupplierOrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

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

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as {
      supplierId?: string;
      productId?: string | null;
      productName?: string;
      productSku?: string;
      imageUrl?: string | null;
      adminNote?: string;
      items?: Array<{
        catalogVariantId?: string | null;
        sku: string;
        productName: string;
        color: string;
        size: string;
        requestedQuantity: number;
        unitCost?: number;
      }>;
    };

    const supplierId = body.supplierId?.trim();
    const productName = body.productName?.trim();
    const productSku = body.productSku?.trim();
    const productId = body.productId?.trim() || null;
    const items = (body.items ?? []).filter((item) => Number(item.requestedQuantity) > 0);

    if (!supplierId || !productName || !productSku || items.length === 0) {
      return NextResponse.json({ error: "Preencha fornecedor, produto e pelo menos um item do pedido." }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor nao encontrado." }, { status: 404 });
    }

    const estimatedTotalCost = items.reduce((sum, item) => sum + Number(item.requestedQuantity) * Number(item.unitCost ?? 0), 0);

    const order = await prisma.supplierOrder.create({
      data: {
        supplierId,
        createdByUserId: session.userId,
        updatedByUserId: session.userId,
        orderNumber: createOrderNumber(),
        status: SupplierOrderStatus.AWAITING_SUPPLIER,
        productId,
        productName,
        productSku,
        imageUrl: body.imageUrl ?? null,
        adminNote: body.adminNote?.trim() || null,
        estimatedTotalCost,
        statusHistory: {
          create: {
            toStatus: SupplierOrderStatus.AWAITING_SUPPLIER,
            note: "Pedido enviado para o fornecedor.",
            actorUserId: session.userId,
            visibleToSupplier: true
          }
        },
        workflowHistory: {
          create: {
            toStage: "AWAITING_RESPONSE",
            note: "Card operacional criado pelo admin.",
            actorUserId: session.userId
          }
        },
        items: {
          create: items.map((item) => ({
            catalogVariantId: item.catalogVariantId?.trim() || null,
            sku: item.sku,
            productName: item.productName,
            color: item.color,
            size: item.size,
            requestedQuantity: Number(item.requestedQuantity),
            unitCost: Number(item.unitCost ?? 0),
            requestedTotalCost: Number(item.requestedQuantity) * Number(item.unitCost ?? 0)
          }))
        }
      }
    });

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel criar o pedido ao fornecedor agora." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as { orderId?: string; status?: SupplierOrderStatus; adminNote?: string };
    const orderId = body.orderId?.trim();

    if (!orderId || !body.status) {
      return NextResponse.json({ error: "Pedido ou status invalido." }, { status: 400 });
    }

    const existing = await prisma.supplierOrder.findUnique({
      where: { id: orderId }
    });

    if (!existing) {
      return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
    }

    const statusChanged = existing.status !== body.status;
    const nextWorkflowStage =
      body.status === SupplierOrderStatus.CANCELED ? "CANCELED" : existing.workflowStage;
    const workflowChanged = nextWorkflowStage !== existing.workflowStage;

    await prisma.supplierOrder.update({
      where: { id: orderId },
      data: {
        status: body.status,
        workflowStage: nextWorkflowStage,
        adminNote: body.adminNote?.trim() || existing.adminNote,
        updatedByUserId: session.userId,
        statusHistory: statusChanged
          ? {
              create: {
                fromStatus: existing.status,
                toStatus: body.status,
                note: body.adminNote?.trim() || "Status atualizado pelo admin.",
                actorUserId: session.userId,
                visibleToSupplier: true
              }
            }
          : undefined,
        workflowHistory: workflowChanged
          ? {
              create: {
                fromStage: existing.workflowStage,
                toStage: nextWorkflowStage,
                note: body.adminNote?.trim() || "Etapa operacional atualizada pelo admin.",
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
