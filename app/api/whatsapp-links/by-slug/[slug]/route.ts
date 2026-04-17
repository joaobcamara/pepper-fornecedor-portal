import { NextResponse } from "next/server";
import { WhatsAppShareStatus } from "@prisma/client";
import { z } from "zod";

import { updateWhatsAppShareLinkBySlug } from "@/lib/whatsapp-share";

const itemSchema = z.object({
  sku: z.string().min(1),
  requestedQuantity: z.number().int().min(0)
});

const bodySchema = z.object({
  note: z.string().max(2000).optional(),
  status: z.nativeEnum(WhatsAppShareStatus).optional(),
  statusNote: z.string().max(2000).optional(),
  items: z.array(itemSchema).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para atualizar o link." }, { status: 400 });
  }

  try {
    const { slug } = await context.params;

    await updateWhatsAppShareLinkBySlug({
      slug,
      note: body.data.note,
      status: body.data.status,
      statusNote: body.data.statusNote,
      items: body.data.items
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel atualizar o link." },
      { status: 400 }
    );
  }
}
