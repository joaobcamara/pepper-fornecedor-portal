import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPurchaseOrderHtml } from "@/lib/order-html-shared";
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

  if (!session || session.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para gerar a solicitacao." }, { status: 400 });
  }

  const html = await buildPurchaseOrderHtml(body.data);
  const safeSku = body.data.productSku.replaceAll("/", "-");

  return NextResponse.json({
    fileName: `solicitacao-reposicao-${safeSku}.html`,
    html
  });
}

