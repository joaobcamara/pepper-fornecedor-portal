import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { askPepperIa } from "@/lib/pepperia-openai";
import { buildPepperIaFallbackReply, getOrCreatePepperIaThread, getPepperIaContext, storePepperIaExchange } from "@/lib/pepperia-data";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string; pageKey?: string; pageHint?: string | null };
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para a Pepper IA." }, { status: 400 });
  }

  const thread = await getOrCreatePepperIaThread({
    userId: session.userId,
    username: session.username,
    role: session.role,
    supplierId: session.supplierId
  });

  const history = await prisma.pepperIaMessage.findMany({
    where: {
      threadId: thread.id
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 20
  });

  const context = await getPepperIaContext({
    userId: session.userId,
    username: session.username,
    role: session.role,
    supplierId: session.supplierId
  });

  let assistantMessage: string;

  try {
    assistantMessage = await askPepperIa({
      role: session.role,
      question: message,
      context,
      history: history.map((item) => ({ role: item.role, body: item.body })),
      pageInfo: {
        pageKey: body.pageKey,
        pageHint: body.pageHint ?? null
      }
    });
  } catch {
    assistantMessage = buildPepperIaFallbackReply(message, context, {
      pageKey: body.pageKey,
      pageHint: body.pageHint ?? null
    });
  }

  await storePepperIaExchange({
    threadId: thread.id,
    userId: session.userId,
    userMessage: message,
    assistantMessage,
    metadata: {
      role: session.role,
      scope: context.scope,
      pageKey: body.pageKey,
      pageHint: body.pageHint ?? null
    }
  });

  return NextResponse.json({ ok: true, assistantMessage });
}
