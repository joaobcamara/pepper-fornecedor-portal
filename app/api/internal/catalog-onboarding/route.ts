import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const token = request.headers.get("x-catalog-token") ?? new URL(request.url).searchParams.get("token");
  return Boolean(process.env.CATALOG_QUEUE_TOKEN) && token === process.env.CATALOG_QUEUE_TOKEN;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const items = await prisma.catalogOnboardingItem.findMany({
    where: {
      status: "READY"
    },
    orderBy: {
      readyForCatalogAt: "asc"
    }
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      suggestionId: item.suggestionId,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      productName: item.productName,
      price: item.price,
      material: item.material,
      modelDescription: item.modelDescription,
      sizes: JSON.parse(item.sizesJson) as string[],
      colors: JSON.parse(item.colorsJson) as string[],
      images: JSON.parse(item.imagesJson) as Array<{ type: string; fileName: string; fileUrl: string; mimeType?: string | null }>,
      supplierVisibleNote: item.supplierVisibleNote,
      internalReviewNote: item.internalReviewNote,
      generatedCatalogJson: item.generatedCatalogJson ? JSON.parse(item.generatedCatalogJson) : null,
      readyForCatalogAt: item.readyForCatalogAt.toISOString()
    }))
  });
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; importedBy?: string };

  if (!body.id) {
    return NextResponse.json({ error: "Item invalido." }, { status: 400 });
  }

  const importedBy = body.importedBy?.trim() || "catalog-system";
  const importedAt = new Date();

  const updated = await prisma.catalogOnboardingItem.update({
    where: {
      id: body.id
    },
    data: {
      status: "IMPORTED",
      importedAt,
      importedBy,
      suggestion: {
        update: {
          status: "IMPORTED_BY_CATALOG",
          importedAt,
          importedBy
        }
      }
    }
  });

  await prisma.productSuggestionStatusHistory.create({
    data: {
      suggestionId: updated.suggestionId,
      fromStatus: "APPROVED_FOR_CATALOG",
      toStatus: "IMPORTED_BY_CATALOG",
      note: `Importado pelo sistema de cadastro: ${importedBy}`,
      visibleToSupplier: true
    }
  });

  return NextResponse.json({ ok: true });
}
