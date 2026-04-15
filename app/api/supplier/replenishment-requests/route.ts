import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPurchaseOrderHtml } from "@/lib/order-html";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

const itemSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  currentStock: z.number().nullable(),
  requestedQuantity: z.number().int().min(0)
});

const bodySchema = z.object({
  supplierName: z.string().min(1),
  productName: z.string().min(1),
  productSku: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  note: z.string().max(1000).optional(),
  variants: z.array(itemSchema)
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  try {
    const body = bodySchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json({ error: "Dados invalidos para enviar a solicitacao." }, { status: 400 });
    }

    const selectedItems = body.data.variants.filter((variant) => variant.requestedQuantity > 0);

    if (selectedItems.length === 0) {
      return NextResponse.json({ error: "Informe ao menos uma quantidade para enviar a solicitacao." }, { status: 400 });
    }

    const html = await buildPurchaseOrderHtml(body.data);
    const product = await prisma.product.findFirst({
      where: {
        sku: body.data.productSku
      },
      select: {
        id: true
      }
    });

    const replenishmentRequest = await prisma.replenishmentRequest.create({
      data: {
        supplierId: session.supplierId,
        createdByUserId: session.userId,
        productId: product?.id ?? null,
        productName: body.data.productName,
        productSku: body.data.productSku,
        imageUrl: body.data.imageUrl ?? null,
        note: body.data.note?.trim() || null,
        htmlContent: html,
        items: {
          create: selectedItems.map((variant) => ({
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            currentStock: variant.currentStock,
            requestedQuantity: variant.requestedQuantity
          }))
        }
      }
    });

    return NextResponse.json({
      ok: true,
      requestId: replenishmentRequest.id
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel registrar a solicitacao de reposicao agora." },
      { status: 503 }
    );
  }
}
