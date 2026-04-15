type CatalogAiContext = {
  productName: string;
  skuParent?: string | null;
  sku?: string | null;
  brand?: string | null;
  categoryPath?: string | null;
  material?: string | null;
  composition?: string | null;
  gender?: string | null;
  model?: string | null;
  style?: string | null;
  colorLabel?: string | null;
  sizeLabel?: string | null;
  availableSizes?: string[] | null;
  availableColors?: string[] | null;
  availableMultiCompanyStock?: number | null;
  priceSale?: number | null;
};

function compactText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalized(values: Array<string | null | undefined>) {
  return Array.from(
    new Map(
      values
        .map((value) => value?.trim())
        .filter(Boolean)
        .map((value) => [value!.toLowerCase(), value!])
    ).values()
  );
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function buildIntentTags(context: CatalogAiContext) {
  const categoryBits =
    context.categoryPath
      ?.split(/[>/|]/)
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  return uniqueNormalized([
    context.productName,
    context.brand,
    context.material,
    context.composition,
    context.gender,
    context.model,
    context.style,
    context.colorLabel,
    context.sizeLabel,
    ...(context.availableColors ?? []),
    ...(context.availableSizes ?? []),
    ...categoryBits
  ]);
}

export function buildSearchText(context: CatalogAiContext) {
  return compactText([
    context.productName,
    context.brand,
    context.categoryPath?.replace(/[>/|]/g, " "),
    context.material,
    context.composition,
    context.gender,
    context.model,
    context.style,
    context.colorLabel,
    context.sizeLabel,
    context.availableColors?.join(" "),
    context.availableSizes?.join(" "),
    context.skuParent,
    context.sku,
    buildIntentTags(context).join(" ")
  ]).toLowerCase();
}

export function buildSalesContextAi(context: CatalogAiContext) {
  const stockPhrase =
    context.availableMultiCompanyStock == null
      ? "estoque multiempresa ainda não sincronizado"
      : context.availableMultiCompanyStock > 0
        ? `estoque disponível multiempresa de ${context.availableMultiCompanyStock} unidade(s)`
        : "estoque multiempresa zerado";

  const variantPhrase = compactText([
    context.colorLabel ? `cor ${context.colorLabel}` : null,
    context.sizeLabel ? `tamanho ${context.sizeLabel}` : null
  ]);

  const pricePhrase = formatCurrency(context.priceSale)
    ? `preço atual ${formatCurrency(context.priceSale)}`
    : null;

  const palettePhrase =
    context.availableColors && context.availableColors.length > 0
      ? `cores trabalhadas: ${uniqueNormalized(context.availableColors).join(", ")}`
      : null;

  const sizingPhrase =
    context.availableSizes && context.availableSizes.length > 0
      ? `grade disponível: ${uniqueNormalized(context.availableSizes).join(", ")}`
      : null;

  return compactText([
    context.productName,
    variantPhrase ? `na variação ${variantPhrase},` : null,
    context.categoryPath ? `categoria ${context.categoryPath},` : null,
    context.material ? `material ${context.material},` : null,
    context.composition ? `composição ${context.composition},` : null,
    context.model ? `modelo ${context.model},` : null,
    context.gender ? `gênero ${context.gender},` : null,
    context.style ? `estilo ${context.style},` : null,
    palettePhrase ? `${palettePhrase},` : null,
    sizingPhrase ? `${sizingPhrase},` : null,
    `${stockPhrase},`,
    pricePhrase ? `${pricePhrase},` : null,
    context.sku ? `SKU ${context.sku}.` : context.skuParent ? `SKU pai ${context.skuParent}.` : null
  ]);
}

export function buildCatalogAiPackage(context: CatalogAiContext) {
  const intentTags = buildIntentTags(context);

  return {
    salesContextAi: buildSalesContextAi(context),
    searchText: buildSearchText(context),
    intentTags: JSON.stringify(intentTags)
  };
}
