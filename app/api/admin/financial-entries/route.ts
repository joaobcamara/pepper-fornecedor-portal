import { SupplierFinancialEntryStatus, SupplierOrderWorkflowStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

function resolveWorkflowStageFromFinancialStatus(status: SupplierFinancialEntryStatus) {
  switch (status) {
    case "PENDING_PAYMENT":
      return SupplierOrderWorkflowStage.PAYMENT_PENDING;
    case "PAID":
      return SupplierOrderWorkflowStage.PAID;
    case "REJECTED":
      return SupplierOrderWorkflowStage.READY_FOR_FINANCIAL;
    case "CANCELED":
      return SupplierOrderWorkflowStage.CANCELED;
    default:
      return SupplierOrderWorkflowStage.IN_FINANCIAL_REVIEW;
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as {
      financialEntryId?: string;
      status?: SupplierFinancialEntryStatus;
      note?: string;
      dueDate?: string | null;
    };

    const financialEntryId = body.financialEntryId?.trim();

    if (!financialEntryId || !body.status) {
      return NextResponse.json({ error: "Conta financeira invalida." }, { status: 400 });
    }

    const entry = await prisma.supplierFinancialEntry.findUnique({
      where: { id: financialEntryId },
      include: {
        supplierOrder: true
      }
    });

    if (!entry) {
      return NextResponse.json({ error: "Conta financeira nao encontrada." }, { status: 404 });
    }

    const nextWorkflowStage = resolveWorkflowStageFromFinancialStatus(body.status);

    await prisma.$transaction([
      prisma.supplierFinancialEntry.update({
        where: { id: entry.id },
        data: {
          status: body.status,
          note: body.note?.trim() || entry.note,
          dueDate: body.dueDate ? new Date(body.dueDate) : entry.dueDate,
          reviewedByUserId: session.userId,
          reviewedAt: new Date(),
          paidAt: body.status === SupplierFinancialEntryStatus.PAID ? new Date() : entry.paidAt,
          statusHistory: {
            create: {
              fromStatus: entry.status,
              toStatus: body.status,
              note: body.note?.trim() || "Financeiro atualizado pelo admin.",
              actorUserId: session.userId
            }
          }
        }
      }),
      prisma.supplierOrder.update({
        where: { id: entry.supplierOrderId },
        data: {
          workflowStage: nextWorkflowStage,
          paidAt: body.status === SupplierFinancialEntryStatus.PAID ? new Date() : entry.supplierOrder.paidAt,
          workflowHistory: {
            create: {
              fromStage: entry.supplierOrder.workflowStage,
              toStage: nextWorkflowStage,
              note: body.note?.trim() || "Financeiro atualizou a etapa do pedido.",
              actorUserId: session.userId
            }
          }
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel atualizar o financeiro agora." }, { status: 503 });
  }
}
