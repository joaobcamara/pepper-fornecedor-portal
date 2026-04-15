export type TinyLikeVariationRow = {
  variationLabel: string;
  size: string;
  color: string;
  sku: string;
  price: string;
  promotionalPrice: string;
  stock: string;
  imageStatus: string;
  note: string;
};

export type TinyLikeDraft = {
  tabs: string[];
  general: {
    type: string;
    productName: string;
    skuReference: string;
    salePrice: string;
    promotionalPrice: string;
    origin: string;
    unit: string;
    supplierName: string;
    gtin: string;
    ncm: string;
    category: string;
    brand: string;
  };
  complementary: {
    material: string;
    modelDescription: string;
    complementaryDescription: string;
    seoKeywords: string;
    seoTitle: string;
    seoDescription: string;
    videoUrl: string;
    slug: string;
  };
  technical: {
    packageType: string;
    packageProfile: string;
    netWeight: string;
    grossWeight: string;
    volumes: string;
    width: string;
    height: string;
    length: string;
  };
  variations: {
    sizes: string[];
    colors: string[];
    rows: TinyLikeVariationRow[];
  };
  prices: {
    costPrice: string;
    minimumPrice: string;
    marginNotes: string;
  };
  other: {
    internalNotes: string;
    aiInstructions: string;
    cadastroChecklist: string[];
    aiSummary: string;
    aiWarnings: string[];
    visualHighlights: string[];
  };
};

type DraftSeed = {
  productName: string;
  price: number;
  material: string;
  modelDescription: string;
  sizes: string[];
  colors: string[];
  supplierName: string;
};

function formatMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createTinyLikeDraft(seed: DraftSeed): TinyLikeDraft {
  const basePrice = formatMoney(seed.price);
  const rows = seed.sizes.flatMap((size) =>
    seed.colors.map((color) => ({
      variationLabel: `${size} | ${color}`,
      size,
      color,
      sku: "",
      price: basePrice,
      promotionalPrice: "",
      stock: "",
      imageStatus: "Pendente",
      note: ""
    }))
  );

  return {
    tabs: ["dados gerais", "dados complementares", "ficha tecnica", "variacoes", "precos", "outros"],
    general: {
      type: "Simples",
      productName: seed.productName,
      skuReference: "",
      salePrice: basePrice,
      promotionalPrice: "",
      origin: "0 - Nacional",
      unit: "UN",
      supplierName: seed.supplierName,
      gtin: "",
      ncm: "",
      category: "",
      brand: ""
    },
    complementary: {
      material: seed.material,
      modelDescription: seed.modelDescription,
      complementaryDescription: `${seed.productName}\n\nMaterial: ${seed.material}\nModelo: ${seed.modelDescription}`,
      seoKeywords: [seed.productName, seed.material, ...seed.colors].filter(Boolean).join(", "),
      seoTitle: seed.productName,
      seoDescription: `${seed.productName} em ${seed.material}. Variacoes sugeridas em ${seed.colors.join(", ")}.`,
      videoUrl: "",
      slug: slugify(seed.productName)
    },
    technical: {
      packageType: "Pacote / Caixa",
      packageProfile: "Embalagem customizada",
      netWeight: "",
      grossWeight: "",
      volumes: "1",
      width: "",
      height: "",
      length: ""
    },
    variations: {
      sizes: seed.sizes,
      colors: seed.colors,
      rows
    },
    prices: {
      costPrice: "",
      minimumPrice: "",
      marginNotes: "Revisar margem antes de enviar ao cadastro no Tiny."
    },
    other: {
      internalNotes: `Sugestao enviada por ${seed.supplierName}. Revisar categoria, ficha tecnica e imagens antes do cadastro no Tiny.`,
      aiInstructions:
        "Usar fotos e campos estruturados para sugerir descricao comercial, categoria e preenchimento de cadastro.",
      cadastroChecklist: [
        "Revisar fotos frente e costas",
        "Confirmar material e modelo",
        "Definir categoria e marca",
        "Validar precos",
        "Preparar variacoes para cadastro no Tiny"
      ],
      aiSummary: `Produto sugerido por ${seed.supplierName} com foco em ${seed.material}. Validar categoria, descricao e variacoes antes do cadastro.`,
      aiWarnings: [
        "Conferir se a categoria sugerida bate com o tipo real do produto.",
        "Nao enviar GTIN, NCM ou marca se nao houver confirmacao."
      ],
      visualHighlights: [
        "Analisar acabamento geral nas fotos.",
        "Confirmar se a modelagem percebida combina com a descricao do fornecedor."
      ]
    }
  };
}

export function normalizeTinyLikeDraft(raw: unknown, seed: DraftSeed): TinyLikeDraft {
  const fallback = createTinyLikeDraft(seed);

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const rawGeneral = (candidate.general as Record<string, unknown> | undefined) ?? {};
  const rawComplementary = (candidate.complementary as Record<string, unknown> | undefined) ?? {};
  const rawTechnical = (candidate.technical as Record<string, unknown> | undefined) ?? {};
  const rawVariations = (candidate.variations as Record<string, unknown> | undefined) ?? {};
  const rawPrices = (candidate.prices as Record<string, unknown> | undefined) ?? {};
  const rawOther = (candidate.other as Record<string, unknown> | undefined) ?? {};

  const rawRows = Array.isArray(rawVariations.rows) ? (rawVariations.rows as Array<Record<string, unknown>>) : [];
  const normalizedRows = fallback.variations.rows.map((fallbackRow) => {
    const rawRow =
      rawRows.find((row) => String(row.variationLabel ?? "") === fallbackRow.variationLabel) ??
      rawRows.find((row) => {
        const size = String(row.size ?? "").trim();
        const color = String(row.color ?? "").trim();
        return size === fallbackRow.size && color === fallbackRow.color;
      });

    if (!rawRow) {
      return fallbackRow;
    }

    const legacyPrice = rawRow.price;
    const normalizedPrice =
      typeof legacyPrice === "number"
        ? formatMoney(legacyPrice)
        : typeof legacyPrice === "string" && legacyPrice.trim()
          ? legacyPrice
          : fallbackRow.price;

    return {
      variationLabel: String(rawRow.variationLabel ?? fallbackRow.variationLabel),
      size: String(rawRow.size ?? fallbackRow.size),
      color: String(rawRow.color ?? fallbackRow.color),
      sku: String(rawRow.sku ?? fallbackRow.sku),
      price: normalizedPrice,
      promotionalPrice: String(rawRow.promotionalPrice ?? fallbackRow.promotionalPrice),
      stock: String(rawRow.stock ?? fallbackRow.stock),
      imageStatus: String(rawRow.imageStatus ?? fallbackRow.imageStatus),
      note: String(rawRow.note ?? fallbackRow.note)
    };
  });

  return {
    tabs: fallback.tabs,
    general: {
      type: String(rawGeneral.type ?? fallback.general.type),
      productName: String(rawGeneral.productName ?? fallback.general.productName),
      skuReference: String(rawGeneral.skuReference ?? fallback.general.skuReference),
      salePrice:
        typeof rawGeneral.salePrice === "number"
          ? formatMoney(rawGeneral.salePrice)
          : String(rawGeneral.salePrice ?? fallback.general.salePrice),
      promotionalPrice: String(rawGeneral.promotionalPrice ?? fallback.general.promotionalPrice),
      origin: String(rawGeneral.origin ?? fallback.general.origin),
      unit: String(rawGeneral.unit ?? rawGeneral.unidade ?? fallback.general.unit),
      supplierName: String(rawGeneral.supplierName ?? fallback.general.supplierName),
      gtin: String(rawGeneral.gtin ?? fallback.general.gtin),
      ncm: String(rawGeneral.ncm ?? fallback.general.ncm),
      category: String(rawGeneral.category ?? fallback.general.category),
      brand: String(rawGeneral.brand ?? fallback.general.brand)
    },
    complementary: {
      material: String(rawComplementary.material ?? fallback.complementary.material),
      modelDescription: String(rawComplementary.modelDescription ?? fallback.complementary.modelDescription),
      complementaryDescription: String(
        rawComplementary.complementaryDescription ?? fallback.complementary.complementaryDescription
      ),
      seoKeywords: String(rawComplementary.seoKeywords ?? fallback.complementary.seoKeywords),
      seoTitle: String(rawComplementary.seoTitle ?? fallback.complementary.seoTitle),
      seoDescription: String(rawComplementary.seoDescription ?? fallback.complementary.seoDescription),
      videoUrl: String(rawComplementary.videoUrl ?? fallback.complementary.videoUrl),
      slug: String(rawComplementary.slug ?? fallback.complementary.slug)
    },
    technical: {
      packageType: String(rawTechnical.packageType ?? fallback.technical.packageType),
      packageProfile: String(rawTechnical.packageProfile ?? fallback.technical.packageProfile),
      netWeight: String(rawTechnical.netWeight ?? fallback.technical.netWeight),
      grossWeight: String(rawTechnical.grossWeight ?? fallback.technical.grossWeight),
      volumes: String(rawTechnical.volumes ?? fallback.technical.volumes),
      width: String(rawTechnical.width ?? fallback.technical.width),
      height: String(rawTechnical.height ?? fallback.technical.height),
      length: String(rawTechnical.length ?? fallback.technical.length)
    },
    variations: {
      sizes: Array.isArray(rawVariations.sizes)
        ? (rawVariations.sizes as unknown[]).map((value) => String(value))
        : fallback.variations.sizes,
      colors: Array.isArray(rawVariations.colors)
        ? (rawVariations.colors as unknown[]).map((value) => String(value))
        : fallback.variations.colors,
      rows: normalizedRows
    },
    prices: {
      costPrice: String(rawPrices.costPrice ?? fallback.prices.costPrice),
      minimumPrice: String(rawPrices.minimumPrice ?? fallback.prices.minimumPrice),
      marginNotes: String(rawPrices.marginNotes ?? fallback.prices.marginNotes)
    },
    other: {
      internalNotes: String(rawOther.internalNotes ?? fallback.other.internalNotes),
      aiInstructions: String(rawOther.aiInstructions ?? fallback.other.aiInstructions),
      cadastroChecklist: Array.isArray(rawOther.cadastroChecklist)
        ? (rawOther.cadastroChecklist as unknown[]).map((value) => String(value))
        : fallback.other.cadastroChecklist,
      aiSummary: String(rawOther.aiSummary ?? fallback.other.aiSummary),
      aiWarnings: Array.isArray(rawOther.aiWarnings)
        ? (rawOther.aiWarnings as unknown[]).map((value) => String(value))
        : fallback.other.aiWarnings,
      visualHighlights: Array.isArray(rawOther.visualHighlights)
        ? (rawOther.visualHighlights as unknown[]).map((value) => String(value))
        : fallback.other.visualHighlights
    }
  };
}
