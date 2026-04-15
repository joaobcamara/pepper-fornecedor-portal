import { MessageSenderRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/local-files";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const body = String(formData.get("body") ?? "").trim();
    const conversationId = String(formData.get("conversationId") ?? "").trim();
    const attachment = formData.get("attachment");
    const referenceTitle = String(formData.get("referenceTitle") ?? "").trim();
    const referenceType = String(formData.get("referenceType") ?? "").trim();
    const referenceId = String(formData.get("referenceId") ?? "").trim();
    const referenceSubtitle = String(formData.get("referenceSubtitle") ?? "").trim();
    const referenceHref = String(formData.get("referenceHref") ?? "").trim();
    const referenceBadge = String(formData.get("referenceBadge") ?? "").trim();
    const referenceMetaJson = String(formData.get("referenceMetaJson") ?? "").trim();

    const hasAttachment = attachment instanceof File && attachment.size > 0;
    const hasReference = Boolean(referenceTitle && referenceType && referenceId);

    if (!conversationId || (!body && !hasAttachment && !hasReference)) {
      return NextResponse.json({ error: "Envie uma mensagem ou um anexo." }, { status: 400 });
    }

    if (conversationId.startsWith("offline-")) {
      return NextResponse.json(
        { error: "Mensagens indisponiveis temporariamente enquanto a base se reconecta." },
        { status: 503 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
    }

    if (session.role === "SUPPLIER" && session.supplierId !== conversation.supplierId) {
      return NextResponse.json({ error: "Voce nao pode responder essa conversa." }, { status: 403 });
    }

    const uploadedAttachment =
      hasAttachment
        ? await saveUploadedFile({
            file: attachment,
            folder: "uploads/messages",
            prefix: session.role.toLowerCase()
          })
        : null;

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderUserId: session.userId,
        senderRole: session.role === "ADMIN" ? MessageSenderRole.ADMIN : MessageSenderRole.SUPPLIER,
        body: body || (uploadedAttachment ? "Arquivo enviado." : "Contexto compartilhado na conversa."),
        referenceType: hasReference ? referenceType : null,
        referenceId: hasReference ? referenceId : null,
        referenceTitle: hasReference ? referenceTitle : null,
        referenceSubtitle: hasReference ? referenceSubtitle || null : null,
        referenceHref: hasReference ? referenceHref || null : null,
        referenceBadge: hasReference ? referenceBadge || null : null,
        referenceMetaJson: hasReference ? referenceMetaJson || null : null,
        attachments: uploadedAttachment
          ? {
              create: uploadedAttachment
            }
          : undefined
      },
      include: {
        attachments: true
      }
    });

    await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        lastMessageAt: message.createdAt
      }
    });

    return NextResponse.json({
      ok: true,
      messageId: message.id
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel acessar as mensagens agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }
}
