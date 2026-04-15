import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/session";
import { reconcileTinySalesOrders } from "@/lib/tiny-sales-events";

const bodySchema = z
  .object({
    days: z.number().int().min(1).max(180).optional(),
    maxPages: z.number().int().min(1).max(50).optional(),
    maxOrders: z.number().int().min(1).max(2000).optional()
  })
  .default({});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos para importacao de vendas." }, { status: 400 });
  }

  const result = await reconcileTinySalesOrders({
    ...parsed.data,
    requestedByUserId: session.userId
  });

  return NextResponse.json(result);
}
