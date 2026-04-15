import { ProductSuggestionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
  }

  const body = (await request.json()) as {
    suggestionId?: string;
    productName?: string;
    price?: number;
    material?: string;
    modelDescription?: string;
    internalReviewNote?: string;
    supplierVisibleNote?: string;
    status?:
      | "NEW"
      | "REVIEWING"
      | "NEEDS_REVISION"
      | "APPROVED_FOR_CATALOG"
      | "READY_FOR_CADASTRO"
      | "REJECTED"
      | "IMPORTED_BY_CATALOG"
      | "ARCHIVED";
  };

  if (!body.suggestionId) {
    return NextResponse.json({ error: "Sugestao invalida." }, { status: 400 });
  }

  const suggestion = await prisma.productSuggestion.findUnique({
    where: {
      id: body.suggestionId
    },
    include: {
      supplier: true,
      images: true,
      sizes: true,
      colors: true,
      onboardingItem: true
    }
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Sugestao nao encontrada." }, { status: 404 });
  }

  const nextStatus =
    body.status && Object.values(ProductSuggestionStatus).includes(body.status as ProductSuggestionStatus)
      ? (body.status as ProductSuggestionStatus)
      : ProductSuggestionStatus.REVIEWING;

  const baseData = {
    adminDraftName: body.productName?.trim() || null,
    adminDraftPrice: typeof body.price === "number" && Number.isFinite(body.price) ? body.price : null,
    adminDraftMaterial: body.material?.trim() || null,
    adminDraftModel: body.modelDescription?.trim() || null,
    internalReviewNote: body.internalReviewNote?.trim() || null,
    supplierVisibleNote: body.supplierVisibleNote?.trim() || null,
    status: nextStatus,
    approvedAt: nextStatus === ProductSuggestionStatus.APPROVED_FOR_CATALOG ? new Date() : null,
    approvedByUserId: nextStatus === ProductSuggestionStatus.APPROVED_FOR_CATALOG ? session.userId : null,
    revisionRequestedAt: nextStatus === ProductSuggestionStatus.NEEDS_REVISION ? new Date() : null,
    rejectedAt: nextStatus === ProductSuggestionStatus.REJECTED ? new Date() : null
  };

  const updated = await prisma.productSuggestion.update({
    where: {
      id: suggestion.id
    },
    data: {
      ...baseData,
      statusHistory: {
        create: {
          fromStatus: suggestion.status,
          toStatus: nextStatus,
          note: body.supplierVisibleNote?.trim() || body.internalReviewNote?.trim() || null,
          visibleToSupplier: nextStatus === ProductSuggestionStatus.NEEDS_REVISION || nextStatus === ProductSuggestionStatus.APPROVED_FOR_CATALOG
            ? true
            : false,
          actorUserId: session.userId
        }
      }
    }
  });

  if (nextStatus === ProductSuggestionStatus.APPROVED_FOR_CATALOG) {
    const imagesJson = JSON.stringify(
      suggestion.images.map((image) => ({
        type: image.type,
        fileName: image.fileName,
        fileUrl: image.fileUrl,
        mimeType: image.mimeType
      }))
    );

    await prisma.catalogOnboardingItem.upsert({
      where: {
        suggestionId: suggestion.id
      },
      update: {
        supplierId: suggestion.supplierId,
        supplierName: suggestion.supplier.name,
        productName: body.productName?.trim() || suggestion.productName,
        price: typeof body.price === "number" && Number.isFinite(body.price) ? body.price : suggestion.price,
        material: body.material?.trim() || suggestion.material,
        modelDescription: body.modelDescription?.trim() || suggestion.modelDescription,
        sizesJson: JSON.stringify(suggestion.sizes.map((item) => item.label)),
        colorsJson: JSON.stringify(suggestion.colors.map((item) => item.label)),
        imagesJson,
        supplierVisibleNote: body.supplierVisibleNote?.trim() || null,
        internalReviewNote: body.internalReviewNote?.trim() || null,
        generatedCatalogJson: suggestion.generatedCatalogJson,
        readyForCatalogAt: new Date(),
        status: "READY",
        importedAt: null,
        importedBy: null
      },
      create: {
        suggestionId: suggestion.id,
        supplierId: suggestion.supplierId,
        supplierName: suggestion.supplier.name,
        productName: body.productName?.trim() || suggestion.productName,
        price: typeof body.price === "number" && Number.isFinite(body.price) ? body.price : suggestion.price,
        material: body.material?.trim() || suggestion.material,
        modelDescription: body.modelDescription?.trim() || suggestion.modelDescription,
        sizesJson: JSON.stringify(suggestion.sizes.map((item) => item.label)),
        colorsJson: JSON.stringify(suggestion.colors.map((item) => item.label)),
        imagesJson,
        supplierVisibleNote: body.supplierVisibleNote?.trim() || null,
        internalReviewNote: body.internalReviewNote?.trim() || null,
        generatedCatalogJson: suggestion.generatedCatalogJson,
        status: "READY"
      }
    });
  }

  if (nextStatus === ProductSuggestionStatus.IMPORTED_BY_CATALOG && suggestion.onboardingItem) {
    await prisma.catalogOnboardingItem.update({
      where: { suggestionId: suggestion.id },
      data: {
        status: "IMPORTED",
        importedAt: new Date(),
        importedBy: body.internalReviewNote?.trim() || session.username
      }
    });
  }

  return NextResponse.json({
    ok: true,
    status: updated.status
  });
}
