import { SupplierFinancialAttachmentKind, SupplierFinancialEntryStatus, SupplierOrderWorkflowStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/local-files";
import {
  getLocalAdminFinancialBoardData,
  getLocalSupplierReceivedOrders,
  updateLocalFinancialEntry
} from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
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

async function readAdminFinancialRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const comprovante = formData.get("comprovante");

    return {
      financialEntryId: String(formData.get("financialEntryId") ?? "").trim(),
      status: String(formData.get("status") ?? "").trim() as SupplierFinancialEntryStatus,
      note: String(formData.get("note") ?? "").trim() || null,
      dueDate: String(formData.get("dueDate") ?? "").trim() || null,
      comprovante:
        comprovante instanceof File && comprovante.size > 0
          ? await saveUploadedFile({
              file: comprovante,
              folder: "uploads/financial",
              prefix: "comprovante"
            })
          : null
    };
  }

  const body = (await request.json()) as {
    financialEntryId?: string;
    status?: SupplierFinancialEntryStatus;
    note?: string;
    dueDate?: string | null;
  };

  return {
    financialEntryId: body.financialEntryId?.trim() ?? "",
    status: body.status,
    note: body.note?.trim() || null,
    dueDate: body.dueDate ?? null,
    comprovante: null
  };
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const body = await readAdminFinancialRequest(request);
    const financialEntryId = body.financialEntryId;

    if (!financialEntryId || !body.status) {
      return NextResponse.json({ error: "Conta financeira invalida." }, { status: 400 });
    }

    if (isLocalOperationalMode()) {
      const updatedEntry = await updateLocalFinancialEntry({
        financialEntryId,
        status: body.status,
        note: body.note,
        dueDate: body.dueDate ?? null,
        uploadedComprovante: body.comprovante
      });

      const [adminBoard, supplierOrders] = await Promise.all([
        getLocalAdminFinancialBoardData(),
        getLocalSupplierReceivedOrders(updatedEntry.supplierId)
      ]);
      const persistedEntry = adminBoard.find((item) => item.id === financialEntryId);
      const linkedOrder = supplierOrders.find((item) => item.id === updatedEntry.supplierOrderId);

      return NextResponse.json({
        ok: true,
        verification: {
          storedInFoundation: Boolean(persistedEntry && persistedEntry.status === body.status),
          reflectedOnSupplierOrder: Boolean(
            linkedOrder && linkedOrder.workflowStage === resolveWorkflowStageFromFinancialStatus(body.status)
          ),
          comprovanteStored: body.comprovante
            ? Boolean(
                persistedEntry?.attachments.some(
                  (attachment) => attachment.kind === SupplierFinancialAttachmentKind.COMPROVANTE
                )
              )
            : true
        }
      });
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
          note: body.note || entry.note,
          dueDate: body.dueDate ? new Date(body.dueDate) : entry.dueDate,
          reviewedByUserId: session.userId,
          reviewedAt: new Date(),
          paidAt: body.status === SupplierFinancialEntryStatus.PAID ? new Date() : entry.paidAt,
          statusHistory: {
            create: {
              fromStatus: entry.status,
              toStatus: body.status,
              note: body.note || "Financeiro atualizado pelo admin.",
              actorUserId: session.userId
            }
          },
          ...(body.comprovante
            ? {
                attachments: {
                  create: [
                    {
                      kind: SupplierFinancialAttachmentKind.COMPROVANTE,
                      uploadedByUserId: session.userId,
                      ...body.comprovante
                    }
                  ]
                }
              }
            : {})
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
              note: body.note || "Financeiro atualizou a etapa do pedido.",
              actorUserId: session.userId
            }
          }
        }
      })
    ]);

    const persistedEntry = await prisma.supplierFinancialEntry.findUnique({
      where: { id: financialEntryId },
      include: {
        supplierOrder: true,
        attachments: {
          where: {
            kind: SupplierFinancialAttachmentKind.COMPROVANTE
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      verification: {
        storedInFoundation: Boolean(persistedEntry && persistedEntry.status === body.status),
        reflectedOnSupplierOrder: Boolean(
          persistedEntry?.supplierOrder.workflowStage === resolveWorkflowStageFromFinancialStatus(body.status)
        ),
        comprovanteStored: body.comprovante ? Boolean(persistedEntry?.attachments.length) : true
      }
    });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel atualizar o financeiro agora." }, { status: 503 });
  }
}
