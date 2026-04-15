import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectTinyProductBySku } from "@/lib/tiny";
import { getCurrentSession } from "@/lib/session";

const bodySchema = z.object({
  sku: z.string().min(3)
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Informe um SKU válido." }, { status: 400 });
  }

  try {
    const inspection = await inspectTinyProductBySku(body.data.sku);
    return NextResponse.json(inspection);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível consultar o Tiny."
      },
      { status: 400 }
    );
  }
}
