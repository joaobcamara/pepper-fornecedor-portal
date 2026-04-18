import { NextResponse } from "next/server";
import { z } from "zod";

import { reconcileFoundationStockBySku } from "@/lib/foundation-stock-reconcile";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const maxDuration = 120;

const bodySchema = z.object({
  parentSku: z.string().min(1),
  batchSize: z.number().int().min(1).max(20).optional(),
  pauseMs: z.number().int().min(0).max(5000).optional()
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos para reconciliar o estoque do produto." }, { status: 400 });
  }

  try {
    const result = await reconcileFoundationStockBySku({
      prisma,
      sku: body.data.parentSku,
      batchSize: body.data.batchSize ?? 10,
      pauseMs: body.data.pauseMs ?? 1200
    });

    return NextResponse.json({
      ok: true,
      summary: {
        parentSku: result.sku,
        reconciled: result.reconciled,
        failed: result.failed,
        authoritativeAccountKey: result.authoritativeAccountKey
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nao foi possivel reconciliar o estoque do produto agora."
      },
      { status: 500 }
    );
  }
}
