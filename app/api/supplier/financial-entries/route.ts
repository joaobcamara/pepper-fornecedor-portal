import {
  SupplierFinancialAttachmentKind,
  SupplierFinancialEntryStatus,
  SupplierOrderWorkflowStage
} from "@prisma/client";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/local-files";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const orderId = String(formData.get("orderId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || null;
    const supplierNote = String(formData.get("supplierNote") ?? "").trim() || null;
    const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
    const amountInput = Number(formData.get("amount") ?? 0);
    const romaneio = formData.get("romaneio");
    const notaFiscal = formData.get("notaFiscal");

    if (!orderId) {
      return NextResponse.json({ error: "Pedido invalido para envio ao financeiro." }, { status: 400 });
    }

    const order = await prisma.supplierOrder.findFirst({
      where: {
        id: orderId,
        supplierId: session.supplierId
      },
      include: {
        financialEntry: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
    }

    if (order.financialEntry) {
      return NextResponse.json({ error: "Este pedido ja foi enviado para o financeiro." }, { status: 409 });
    }

    const amount = Number.isFinite(amountInput) && amountInput > 0 ? amountInput : order.confirmedTotalCost;

    const [uploadedRomaneio, uploadedNotaFiscal] = await Promise.all([
      romaneio instanceof File && romaneio.size > 0
        ? saveUploadedFile({
            file: romaneio,
            folder: "uploads/financial",
            prefix: "romaneio"
          })
        : Promise.resolve(null),
      notaFiscal instanceof File && notaFiscal.size > 0
        ? saveUploadedFile({
            file: notaFiscal,
            folder: "uploads/financial",
            prefix: "nota-fiscal"
          })
        : Promise.resolve(null)
    ]);

    const created = await prisma.supplierFinancialEntry.create({
      data: {
        supplierId: order.supplierId,
        supplierOrderId: order.id,
        createdByUserId: session.userId,
        status: SupplierFinancialEntryStatus.IN_REVIEW,
        originType: order.originType,
        originReferenceId: order.originReferenceId ?? order.id,
        title: `${order.productName} • ${order.orderNumber}`,
        productName: order.productName,
        productSku: order.productSku,
        imageUrl: order.imageUrl,
        amount,
        note,
        supplierNote,
        dueDate: dueDate ? new Date(dueDate) : null,
        submittedAt: new Date(),
        attachments: {
          create: [
            uploadedRomaneio
              ? {
                  kind: SupplierFinancialAttachmentKind.ROMANEIO,
                  uploadedByUserId: session.userId,
                  ...uploadedRomaneio
                }
              : null,
            uploadedNotaFiscal
              ? {
                  kind: SupplierFinancialAttachmentKind.NOTA_FISCAL,
                  uploadedByUserId: session.userId,
                  ...uploadedNotaFiscal
                }
              : null
          ].filter(Boolean) as Array<{
            kind: SupplierFinancialAttachmentKind;
            uploadedByUserId: string;
            fileName: string;
            fileUrl: string;
            mimeType?: string | null;
            sizeBytes?: number | null;
          }>
        },
        statusHistory: {
          create: {
            toStatus: SupplierFinancialEntryStatus.IN_REVIEW,
            note: supplierNote || note || "Fornecedor enviou o pedido para revisao financeira.",
            actorUserId: session.userId
          }
        }
      }
    });

    await prisma.supplierOrder.update({
      where: { id: order.id },
      data: {
        workflowStage: SupplierOrderWorkflowStage.IN_FINANCIAL_REVIEW,
        sentToFinancialAt: new Date(),
        workflowHistory: {
          create: {
            fromStage: order.workflowStage,
            toStage: SupplierOrderWorkflowStage.IN_FINANCIAL_REVIEW,
            note: "Pedido enviado pelo fornecedor para o financeiro.",
            actorUserId: session.userId
          }
        }
      }
    });

    return NextResponse.json({ ok: true, financialEntryId: created.id });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel enviar para o financeiro agora." }, { status: 503 });
  }
}
