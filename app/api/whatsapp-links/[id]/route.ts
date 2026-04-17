import { NextResponse } from "next/server";
import { WhatsAppShareStatus } from "@prisma/client";
import { z } from "zod";

import {
  deleteWhatsAppShareLinkAsOwner,
  updateWhatsAppShareLinkAsOwner
} from "@/lib/whatsapp-share";
import { getCurrentSession } from "@/lib/session";

const bodySchema = z.object({
  note: z.string().max(2000).optional(),
  status: z.nativeEnum(WhatsAppShareStatus).optional(),
  statusNote: z.string().max(2000).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para atualizar o link." }, { status: 400 });
  }

  const { id } = await context.params;

  await updateWhatsAppShareLinkAsOwner({
    id,
    ownerUserId: session.userId,
    note: body.data.note,
    status: body.data.status,
    statusNote: body.data.statusNote
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const { id } = await context.params;

  await deleteWhatsAppShareLinkAsOwner({
    id,
    ownerUserId: session.userId
  });

  return NextResponse.json({ ok: true });
}
