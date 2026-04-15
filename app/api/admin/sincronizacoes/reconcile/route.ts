import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/session";
import { reconcileVariantInventory } from "@/lib/tiny-stock-events";

const bodySchema = z
  .object({
    force: z.boolean().optional(),
    staleMinutes: z.number().int().min(1).max(1440).optional(),
    limit: z.number().int().min(1).max(500).optional()
  })
  .default({});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos para reconciliacao." }, { status: 400 });
  }

  const result = await reconcileVariantInventory(parsed.data);
  return NextResponse.json(result);
}
