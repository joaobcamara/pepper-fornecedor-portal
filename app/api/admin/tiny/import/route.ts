import { NextResponse } from "next/server";
import { z } from "zod";
import { importTinyProductBySku } from "@/lib/tiny";
import { getCurrentSession } from "@/lib/session";

const bodySchema = z.object({
  sku: z.string().min(3),
  supplierIds: z.array(z.string().min(1)).default([])
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados de importação inválidos." }, { status: 400 });
  }

  try {
    const result = await importTinyProductBySku({
      sku: body.data.sku,
      supplierIds: body.data.supplierIds,
      actorUserId: session.userId
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível importar o produto."
      },
      { status: 400 }
    );
  }
}
