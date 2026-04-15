import type { ProductSuggestion, ProductSuggestionColor, ProductSuggestionImage, ProductSuggestionSize, Supplier } from "@prisma/client";
import { normalizeTinyLikeDraft, type TinyLikeDraft } from "@/lib/tiny-like-draft";

type SuggestionWithRelations = ProductSuggestion & {
  supplier: Supplier;
  images: ProductSuggestionImage[];
  sizes: ProductSuggestionSize[];
  colors: ProductSuggestionColor[];
};

type ValidationResult = {
  ok: boolean;
  errors: string[];
  draft: TinyLikeDraft;
};

function toNumberString(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

function buildSeed(suggestion: SuggestionWithRelations) {
  return {
    productName: suggestion.adminDraftName ?? suggestion.productName,
    price: suggestion.adminDraftPrice ?? suggestion.price,
    material: suggestion.adminDraftMaterial ?? suggestion.material,
    modelDescription: suggestion.adminDraftModel ?? suggestion.modelDescription,
    sizes: suggestion.sizes.map((size) => size.label),
    colors: suggestion.colors.map((color) => color.label),
    supplierName: suggestion.supplier.name
  };
}

export function validateTinyCadastroDraft(suggestion: SuggestionWithRelations): ValidationResult {
  const draft = normalizeTinyLikeDraft(suggestion.generatedCatalogJson ? JSON.parse(suggestion.generatedCatalogJson) : null, buildSeed(suggestion));
  const errors: string[] = [];

  if (!draft.general.productName.trim()) {
    errors.push("Nome do produto obrigatorio.");
  }

  if (!toNumberString(draft.general.salePrice)) {
    errors.push("Preco de venda invalido.");
  }

  if (!draft.general.unit.trim()) {
    errors.push("Unidade obrigatoria.");
  }

  if (!draft.general.origin.trim()) {
    errors.push("Origem obrigatoria.");
  }

  if (!draft.complementary.material.trim()) {
    errors.push("Material obrigatorio.");
  }

  if (!draft.complementary.modelDescription.trim()) {
    errors.push("Caracteristica / modelo obrigatorio.");
  }

  if (draft.variations.rows.length === 0) {
    errors.push("A sugestao precisa ter pelo menos uma variacao.");
  }

  for (const row of draft.variations.rows) {
    if (!row.size.trim() || !row.color.trim()) {
      errors.push(`Variacao ${row.variationLabel} esta incompleta.`);
      continue;
    }

    if (!toNumberString(row.price || draft.general.salePrice)) {
      errors.push(`Preco invalido na variacao ${row.variationLabel}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    draft
  };
}

export function buildTinyCadastroPayload(suggestion: SuggestionWithRelations, draft: TinyLikeDraft) {
  const salePrice = toNumberString(draft.general.salePrice) ?? "0.00";
  const promotionalPrice = toNumberString(draft.general.promotionalPrice);

  const product = {
    sequencia: 1,
    nome: draft.general.productName,
    codigo: draft.general.skuReference || undefined,
    unidade: draft.general.unit,
    preco: salePrice,
    preco_promocional: promotionalPrice || undefined,
    ncm: draft.general.ncm || undefined,
    origem: draft.general.origin.charAt(0) || "0",
    gtin: draft.general.gtin || undefined,
    preco_custo: toNumberString(draft.prices.costPrice) || undefined,
    situacao: "A",
    tipo: "P",
    descricao_complementar: draft.complementary.complementaryDescription || undefined,
    obs: draft.other.internalNotes || undefined,
    marca: draft.general.brand || undefined,
    categoria: draft.general.category || undefined,
    peso_liquido: toNumberString(draft.technical.netWeight) || undefined,
    peso_bruto: toNumberString(draft.technical.grossWeight) || undefined,
    tipo_embalagem:
      draft.technical.packageType === "Envelope"
        ? 1
        : draft.technical.packageType === "Rolo / Cilindro"
          ? 3
          : 2,
    altura_embalagem: toNumberString(draft.technical.height) || undefined,
    largura_embalagem: toNumberString(draft.technical.width) || undefined,
    comprimento_embalagem: toNumberString(draft.technical.length) || undefined,
    classe_produto: draft.variations.rows.length > 0 ? "V" : "S",
    seo: {
      seo_title: draft.complementary.seoTitle || undefined,
      seo_keywords: draft.complementary.seoKeywords || undefined,
      link_video: draft.complementary.videoUrl || undefined,
      seo_description: draft.complementary.seoDescription || undefined,
      slug: draft.complementary.slug || undefined
    },
    imagens_externas: suggestion.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({
        imagem_externa: {
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002"}${image.fileUrl}`
        }
      })),
    variacoes: draft.variations.rows.map((row) => ({
      variacao: {
        codigo: row.sku || undefined,
        preco: toNumberString(row.price || draft.general.salePrice) || salePrice,
        preco_promocional: toNumberString(row.promotionalPrice) || undefined,
        estoque_atual: toNumberString(row.stock) || undefined,
        grade: [
          {
            Tamanho: row.size
          },
          {
            Cor: row.color
          }
        ]
      }
    }))
  };

  return {
    produtos: [
      {
        produto: product
      }
    ]
  };
}

export async function sendSuggestionToTiny(suggestion: SuggestionWithRelations) {
  const token = process.env.TINY_API_TOKEN?.trim();

  if (!token) {
    throw new Error("Configure TINY_API_TOKEN no ambiente antes de enviar ao Tiny.");
  }

  const validation = validateTinyCadastroDraft(suggestion);

  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  const payload = buildTinyCadastroPayload(suggestion, validation.draft);
  const body = new URLSearchParams({
    token,
    formato: "json",
    produto: JSON.stringify(payload)
  });

  const response = await fetch(`${process.env.TINY_API_BASE_URL ?? "https://api.tiny.com.br/api2"}/produto.incluir.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao enviar produto ao Tiny (${response.status}).`);
  }

  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error("O Tiny retornou uma resposta invalida ao cadastrar o produto.");
  }

  const retorno = (parsed.retorno ?? {}) as Record<string, unknown>;
  const status = String(retorno.status ?? "").toUpperCase();

  if (status && status !== "OK") {
    const errors = Array.isArray(retorno.erros)
      ? retorno.erros
          .map((entry) => {
            const item = entry as Record<string, unknown>;
            return String(item.erro ?? JSON.stringify(item));
          })
          .join(" | ")
      : "O Tiny retornou erro ao processar o cadastro.";

    throw new Error(errors);
  }

  return {
    payload,
    raw: parsed
  };
}
