import { NextResponse } from "next/server";
import { WhatsAppShareOwnerRole } from "@prisma/client";
import { z } from "zod";

import {
  buildWhatsAppShareText,
  createWhatsAppShareLink
} from "@/lib/whatsapp-share";
import { getCurrentSession } from "@/lib/session";

const itemSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  currentStock: z.number().nullable(),
  requestedQuantity: z.number().int().min(0)
});

const bodySchema = z.object({
  supplierId: z.string().min(1).nullable().optional(),
  productSku: z.string().min(1),
  productName: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1)
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para gerar o link." }, { status: 400 });
  }

  try {
    const shareLink = await createWhatsAppShareLink({
      ownerUserId: session.userId,
      ownerRole: WhatsAppShareOwnerRole.ADMIN,
      supplierId: body.data.supplierId ?? null,
      productSku: body.data.productSku,
      productName: body.data.productName,
      imageUrl: body.data.imageUrl ?? null,
      note: body.data.note ?? null,
      items: body.data.items
    });
    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}${shareLink.shareUrlPath}`;

    return NextResponse.json({
      id: shareLink.id,
      slug: shareLink.slug,
      shareUrl,
      text: buildWhatsAppShareText({
        shareUrl,
        productName: shareLink.productName,
        productSku: shareLink.productSku,
        supplierName: shareLink.supplierName,
        note: shareLink.note
      })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel gerar o link." },
      { status: 400 }
    );
  }
}
