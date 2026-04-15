import { ProductSuggestionStatus, SuggestionImageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function parseTagValues(input: string) {
  return input
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getSuggestionStatusLabel(status: ProductSuggestionStatus | string) {
  switch (status) {
    case "NEEDS_REVISION":
      return "Precisa de correcao";
    case "APPROVED_FOR_CATALOG":
      return "Aprovado para cadastro";
    case "IMPORTED_BY_CATALOG":
      return "Importado pelo cadastro";
    case "REJECTED":
      return "Reprovado";
    case "REVIEWING":
      return "Em analise";
    case "READY_FOR_CADASTRO":
      return "Pronto para cadastro";
    case "ARCHIVED":
      return "Arquivado";
    default:
      return "Pendente";
  }
}

export async function getSupplierSuggestions(supplierId: string) {
  try {
    const suggestions = await prisma.productSuggestion.findMany({
      where: {
        supplierId
      },
      include: {
        images: true,
        sizes: true,
        colors: true,
        onboardingItem: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return suggestions.map((suggestion) => ({
      id: suggestion.id,
      productName: suggestion.productName,
      status: suggestion.status,
      statusLabel: getSuggestionStatusLabel(suggestion.status),
      price: suggestion.price,
      material: suggestion.material,
      modelDescription: suggestion.modelDescription,
      createdAt: suggestion.createdAt.toLocaleString("pt-BR"),
      frontImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.FRONT)?.fileUrl ?? null,
      backImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.BACK)?.fileUrl ?? null,
      sizes: suggestion.sizes.map((size) => size.label),
      colors: suggestion.colors.map((color) => color.label),
      supplierVisibleNote: suggestion.supplierVisibleNote,
      revisionCount: suggestion.revisionCount,
      canResubmit: suggestion.status === "NEEDS_REVISION",
      onboardingStatus: suggestion.onboardingItem?.status ?? null
    }));
  } catch {
    return [];
  }
}

export async function getAdminSuggestionCards() {
  try {
    const suggestions = await prisma.productSuggestion.findMany({
      include: {
        supplier: true,
        approvedByUser: true,
        images: true,
        sizes: true,
        colors: true,
        onboardingItem: true,
        statusHistory: {
          include: {
            actorUser: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 8
        }
      },
      orderBy: [
        {
          createdAt: "desc"
        }
      ]
    });

    return suggestions.map((suggestion) => ({
      id: suggestion.id,
      status: suggestion.status,
      statusLabel: getSuggestionStatusLabel(suggestion.status),
      supplierName: suggestion.supplier.name,
      productName: suggestion.productName,
      price: suggestion.price,
      material: suggestion.material,
      modelDescription: suggestion.modelDescription,
      createdAt: suggestion.createdAt.toLocaleString("pt-BR"),
      approvedAt: suggestion.approvedAt?.toLocaleString("pt-BR") ?? null,
      approvedBy: suggestion.approvedByUser?.username ?? null,
      supplierVisibleNote: suggestion.supplierVisibleNote,
      internalReviewNote: suggestion.internalReviewNote,
      revisionCount: suggestion.revisionCount,
      frontImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.FRONT)?.fileUrl ?? null,
      backImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.BACK)?.fileUrl ?? null,
      sizes: suggestion.sizes.map((size) => size.label),
      colors: suggestion.colors.map((color) => color.label),
      onboardingItem: suggestion.onboardingItem
        ? {
            id: suggestion.onboardingItem.id,
            status: suggestion.onboardingItem.status,
            readyForCatalogAt: suggestion.onboardingItem.readyForCatalogAt.toLocaleString("pt-BR"),
            importedAt: suggestion.onboardingItem.importedAt?.toLocaleString("pt-BR") ?? null,
            importedBy: suggestion.onboardingItem.importedBy ?? null
          }
        : null,
      statusHistory: suggestion.statusHistory.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        toStatusLabel: getSuggestionStatusLabel(entry.toStatus),
        note: entry.note,
        visibleToSupplier: entry.visibleToSupplier,
        actorName: entry.actorUser?.username ?? null,
        createdAt: entry.createdAt.toLocaleString("pt-BR")
      }))
    }));
  } catch {
    return [];
  }
}
