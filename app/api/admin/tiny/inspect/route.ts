import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectFoundationProductBySku } from "@/lib/foundation-product-inspection";
import { withTinyFallbackTimeout } from "@/lib/tiny-fallback-timeout";
import { inspectTinyProductBySku } from "@/lib/tiny";
import { getCurrentSession } from "@/lib/session";

const bodySchema = z.object({
  sku: z.string().min(3)
});

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Informe um SKU valido." }, { status: 400 });
  }

  try {
    const foundationInspection = await inspectFoundationProductBySku(body.data.sku);
    if (foundationInspection) {
      return NextResponse.json({
        ...foundationInspection,
        source: "foundation"
      });
    }

    const inspection = await withTinyFallbackTimeout(inspectTinyProductBySku(body.data.sku));
    return NextResponse.json(inspection);
  } catch (error) {
    console.error("[tiny-inspect]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nao foi possivel consultar o Tiny."
      },
      { status: 400 }
    );
  }
}
