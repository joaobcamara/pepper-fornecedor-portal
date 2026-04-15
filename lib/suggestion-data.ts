import { ProductSuggestionStatus, SuggestionImageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function parseTagValues(input: string) {
  return input
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function getSupplierSuggestions(supplierId: string) {
  const suggestions = await prisma.productSuggestion.findMany({
    where: {
      supplierId
    },
    include: {
      images: true,
      sizes: true,
      colors: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    productName: suggestion.productName,
    status: suggestion.status,
    price: suggestion.price,
    material: suggestion.material,
    modelDescription: suggestion.modelDescription,
    createdAt: suggestion.createdAt.toLocaleString("pt-BR"),
    frontImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.FRONT)?.fileUrl ?? null,
    sizes: suggestion.sizes.map((size) => size.label),
    colors: suggestion.colors.map((color) => color.label)
  }));
}

export async function getAdminSuggestionCards() {
  const suggestions = await prisma.productSuggestion.findMany({
    include: {
      supplier: true,
      images: true,
      sizes: true,
      colors: true
    },
    orderBy: [
      {
        status: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    status: suggestion.status,
    supplierName: suggestion.supplier.name,
    productName: suggestion.productName,
    price: suggestion.price,
    material: suggestion.material,
    modelDescription: suggestion.modelDescription,
    createdAt: suggestion.createdAt.toLocaleString("pt-BR"),
    frontImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.FRONT)?.fileUrl ?? null,
    backImageUrl: suggestion.images.find((image) => image.type === SuggestionImageType.BACK)?.fileUrl ?? null,
    sizes: suggestion.sizes.map((size) => size.label),
    colors: suggestion.colors.map((color) => color.label),
    generatedCatalogJson: suggestion.generatedCatalogJson,
    adminDraftName: suggestion.adminDraftName,
    adminDraftPrice: suggestion.adminDraftPrice,
    adminDraftMaterial: suggestion.adminDraftMaterial,
    adminDraftModel: suggestion.adminDraftModel
  }));
}

export function buildTinyLikeDraft(params: {
  productName: string;
  price: number;
  material: string;
  modelDescription: string;
  sizes: string[];
  colors: string[];
  supplierName: string;
}) {
  const variations = params.sizes.flatMap((size) =>
    params.colors.map((color) => ({
      variationLabel: `${size} | ${color}`,
      sku: "",
      price: params.price,
      stock: "",
      imageStatus: "Pendente"
    }))
  );

  return {
    tabs: ["dados gerais", "dados complementares", "variações", "preços", "outros"],
    general: {
      type: "Simples",
      productName: params.productName,
      skuReference: "",
      salePrice: params.price.toFixed(2).replace(".", ","),
      origin: "0 - Nacional",
      unidade: "UN",
      supplierName: params.supplierName
    },
    complementary: {
      material: params.material,
      modelDescription: params.modelDescription,
      seoKeywords: `${params.productName}, ${params.material}, ${params.colors.join(", ")}`
    },
    variations: {
      sizes: params.sizes,
      colors: params.colors,
      rows: variations
    }
  };
}

export async function seedGeneratedDraftForSuggestion(suggestionId: string) {
  const suggestion = await prisma.productSuggestion.findUnique({
    where: {
      id: suggestionId
    },
    include: {
      supplier: true,
      sizes: true,
      colors: true
    }
  });

  if (!suggestion) {
    return null;
  }

  const generated = buildTinyLikeDraft({
    productName: suggestion.adminDraftName ?? suggestion.productName,
    price: suggestion.adminDraftPrice ?? suggestion.price,
    material: suggestion.adminDraftMaterial ?? suggestion.material,
    modelDescription: suggestion.adminDraftModel ?? suggestion.modelDescription,
    sizes: suggestion.sizes.map((size) => size.label),
    colors: suggestion.colors.map((color) => color.label),
    supplierName: suggestion.supplier.name
  });

  const updated = await prisma.productSuggestion.update({
    where: {
      id: suggestionId
    },
    data: {
      generatedCatalogJson: JSON.stringify(generated),
      processedAt: new Date(),
      status: ProductSuggestionStatus.REVIEWING
    }
  });

  return {
    id: updated.id,
    generated
  };
}
