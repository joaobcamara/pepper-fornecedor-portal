import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureFoundationProductSupplierLinks,
  inspectFoundationProductBySku
} from "@/lib/foundation-product-inspection";
import { importLocalTinyProduct } from "@/lib/local-operations-store";
import { prisma } from "@/lib/prisma";
import { isLocalOperationalMode } from "@/lib/runtime-mode";
import { withTinyFallbackTimeout } from "@/lib/tiny-fallback-timeout";
import { getTinyAccountLabel, importTinyProductBySku, inspectTinyProductBySku } from "@/lib/tiny";
import { getCurrentSession } from "@/lib/session";

const bodySchema = z.object({
  sku: z.string().min(3),
  supplierIds: z.array(z.string().min(1)).default([])
});

async function resolveValidSupplierIds(supplierIds: string[]) {
  const requestedSupplierIds = Array.from(new Set(supplierIds));

  if (requestedSupplierIds.length === 0) {
    return [];
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      id: {
        in: requestedSupplierIds
      },
      active: true
    },
    select: {
      id: true
    }
  });

  return suppliers.map((supplier) => supplier.id);
}

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
    const validSupplierIds = await resolveValidSupplierIds(body.data.supplierIds);

    if (body.data.supplierIds.length > 0 && validSupplierIds.length === 0) {
      return NextResponse.json(
        {
          error: "Nenhum fornecedor ativo vÃ¡lido foi encontrado para concluir a importaÃ§Ã£o."
        },
        { status: 400 }
      );
    }

    const foundationInspection = await inspectFoundationProductBySku(body.data.sku);

    if (foundationInspection) {
      const result = await ensureFoundationProductSupplierLinks({
        parentSku: foundationInspection.parent.sku,
        supplierIds: validSupplierIds,
        actorUserId: session.userId
      });

      return NextResponse.json(result);
    }

    if (isLocalOperationalMode()) {
      const inspection = await withTinyFallbackTimeout(inspectTinyProductBySku(body.data.sku));
      const result = await importLocalTinyProduct({
        inspection,
        supplierIds: validSupplierIds
      });

      return NextResponse.json({
        ...result,
        source: "tiny",
        sourceAccountKey: inspection.sourceAccountKey,
        sourceAccountLabel: inspection.sourceAccountLabel,
        verification: {
          storedInFoundation: true,
          visibleInAdminProducts: true,
          visibleForSupplier: validSupplierIds.length > 0
        }
      });
    }

    const result = await withTinyFallbackTimeout(
      importTinyProductBySku({
        sku: body.data.sku,
        supplierIds: validSupplierIds,
        actorUserId: session.userId
      })
    );

    return NextResponse.json({
      ...result,
      source: "tiny",
      sourceAccountKey: "pepper",
      sourceAccountLabel: getTinyAccountLabel("pepper"),
      verification: {
        storedInFoundation: true,
        visibleInAdminProducts: true,
        visibleForSupplier: validSupplierIds.length > 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível importar o produto."
      },
      { status: 400 }
    );
  }
}
