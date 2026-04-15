import { InventorySyncStatus, Prisma, ProductKind } from "@prisma/client";
import { syncCatalogProductByParentSku } from "@/lib/catalog-sync";
import { prisma } from "@/lib/prisma";
import { getParentSku, normalizeSku, parseSku } from "@/lib/sku";
import { getStockBand } from "@/lib/stock";

type TinyApiEnvelope = {
  retorno?: {
    status?: string;
    status_processamento?: string;
    erros?: Array<Record<string, unknown>>;
    produtos?: unknown[];
    produto?: unknown;
    [key: string]: unknown;
  };
};

export type TinyRecord = Record<string, unknown>;

type TinySearchCandidate = {
  id: string;
  sku: string;
  name: string;
  variationType: string;
  parentTinyId?: string | null;
  raw: Record<string, unknown>;
};

export type TinyInspectedVariant = {
  id: string;
  sku: string;
  name: string;
  sizeCode?: string | null;
  colorCode?: string | null;
  quantityCode: string;
  baseCode: string;
  imageUrl?: string | null;
  quantity: number | null;
  stockStatus: "ok" | "low" | "critical" | "unknown";
  raw: Record<string, unknown>;
};

export type TinyInspectionResult = {
  searchedSku: string;
  parent: {
    id: string;
    sku: string;
    name: string;
    imageUrl?: string | null;
  };
  variants: TinyInspectedVariant[];
  suggestions: TinySearchCandidate[];
};

function getTinyToken() {
  return process.env.TINY_API_TOKEN?.trim();
}

export function isTinyConfigured() {
  return Boolean(getTinyToken());
}

export function unwrapTinyItem(value: unknown): TinyRecord {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const nested = record.produto ?? record.variacao ?? record.item ?? record;
  return typeof nested === "object" && nested ? (nested as Record<string, unknown>) : record;
}

export function toStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim();
}

export function toNumberValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractImageUrl(record: Record<string, unknown>) {
  const directCandidates = [
    record.imagemExterna,
    record.urlImagemExterna,
    record.imagemURL,
    record.imagem,
    record.url_imagem
  ];

  for (const candidate of directCandidates) {
    const value = toStringValue(candidate);
    if (value) {
      return value;
    }
  }

  const arrayCandidates = [record.imagensExternas, record.imagens, record.anexos];

  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    for (const entry of candidate) {
      const item = unwrapTinyItem(entry);
      const value =
        toStringValue(item.url) ??
        toStringValue(item.link) ??
        toStringValue(item.imagemExterna) ??
        toStringValue(item.arquivo);

      if (value) {
        return value;
      }
    }
  }

  return null;
}

function extractVariationType(record: Record<string, unknown>) {
  return (
    toStringValue(record.tipoVariacao) ??
    toStringValue(record.tipo_variacao) ??
    toStringValue(record.tipo) ??
    "N"
  );
}

function extractParentTinyId(record: Record<string, unknown>) {
  return (
    toStringValue(record.idProdutoPai) ??
    toStringValue(record.id_produto_pai) ??
    toStringValue(unwrapTinyItem(record.produtoPai).id)
  );
}

function normalizeSearchCandidate(record: Record<string, unknown>): TinySearchCandidate | null {
  const id = toStringValue(record.id);
  const sku = normalizeSku(toStringValue(record.codigo) ?? toStringValue(record.sku) ?? "");
  const name = toStringValue(record.nome);

  if (!id || !sku || !name) {
    return null;
  }

  return {
    id,
    sku,
    name,
    variationType: extractVariationType(record),
    parentTinyId: extractParentTinyId(record),
    raw: record
  };
}

function getVariantRefs(record: Record<string, unknown>) {
  const source = record.variacoes ?? record.variantes ?? [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry) => {
      const item = unwrapTinyItem(entry);
      const id =
        toStringValue(item.idProdutoFilha) ??
        toStringValue(item.idProduto) ??
        toStringValue(item.id_produto) ??
        toStringValue(item.id);
      const sku = normalizeSku(toStringValue(item.codigo) ?? toStringValue(item.sku) ?? "");

      if (!id && !sku) {
        return null;
      }

      return {
        id,
        sku
      };
    })
    .filter(Boolean) as Array<{ id?: string | null; sku?: string | null }>;
}

function extractStockQuantity(payload: TinyApiEnvelope) {
  const entries =
    (Array.isArray(payload.retorno?.produtos) ? payload.retorno?.produtos : undefined) ??
    (payload.retorno?.produto ? [payload.retorno.produto] : []);

  for (const entry of entries) {
    const item = unwrapTinyItem(entry);
    const direct = toNumberValue(item.saldo) ?? toNumberValue(item.estoque);

    if (direct !== null) {
      return direct;
    }

    const deposits = item.depositos;
    if (Array.isArray(deposits)) {
      let total = 0;
      let found = false;

      for (const depositEntry of deposits) {
        const deposit = unwrapTinyItem(depositEntry);
        const desconsiderar = toStringValue(deposit.desconsiderar)?.toUpperCase();

        if (desconsiderar === "S") {
          continue;
        }

        const saldo = toNumberValue(deposit.saldo);
        if (saldo !== null) {
          total += saldo;
          found = true;
        }
      }

      if (found) {
        return total;
      }
    }
  }

  return null;
}

export async function callTiny(endpoint: string, params: Record<string, string>) {
  const token = getTinyToken();

  if (!token) {
    throw new Error("Configure TINY_API_TOKEN no arquivo .env para consultar o Tiny.");
  }

  const body = new URLSearchParams({
    token,
    formato: "json",
    ...params
  });

  const response = await fetch(`${process.env.TINY_API_BASE_URL ?? "https://api.tiny.com.br/api2"}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar o Tiny (${response.status}).`);
  }

  const payload = (await response.json()) as TinyApiEnvelope;
  const status = payload.retorno?.status?.toUpperCase();

  if (status && status !== "OK") {
    const errorText = payload.retorno?.erros
      ?.map((entry) => toStringValue((entry as Record<string, unknown>).erro) ?? JSON.stringify(entry))
      .filter(Boolean)
      .join(" | ");

    throw new Error(errorText || "O Tiny retornou erro ao processar a solicitação.");
  }

  return payload;
}

export async function searchTinyProductsBySku(sku: string) {
  const payload = await callTiny("produtos.pesquisa.php", {
    pesquisa: normalizeSku(sku)
  });

  const products = Array.isArray(payload.retorno?.produtos) ? payload.retorno.produtos : [];

  return products
    .map((entry) => normalizeSearchCandidate(unwrapTinyItem(entry)))
    .filter(Boolean) as TinySearchCandidate[];
}

async function getTinyProductById(id: string) {
  const payload = await callTiny("produto.obter.php", { id });
  return unwrapTinyItem(payload.retorno?.produto);
}

export async function getTinyOrderById(id: string) {
  const payload = await callTiny("pedido.obter.php", { id });
  return unwrapTinyItem(payload.retorno?.pedido);
}

export async function getTinyContactById(id: string) {
  const payload = await callTiny("contato.obter.php", { id });
  return unwrapTinyItem(payload.retorno?.contato);
}

export async function getTinyStockByProductId(id: string) {
  const payload = await callTiny("produto.obter.estoque.php", { id });
  return extractStockQuantity(payload);
}

async function resolveParentProduct(candidate: TinySearchCandidate) {
  const detail = await getTinyProductById(candidate.id);
  const variationType = extractVariationType(detail).toUpperCase();

  if (variationType === "P" || candidate.sku === getParentSku(candidate.sku)) {
    return {
      parent: detail,
      selectedDetail: detail
    };
  }

  const parentTinyId = extractParentTinyId(detail) ?? candidate.parentTinyId;
  if (parentTinyId) {
    const parent = await getTinyProductById(parentTinyId);
    return {
      parent,
      selectedDetail: detail
    };
  }

  const fallbackParentSku = getParentSku(candidate.sku);
  if (fallbackParentSku) {
    const parentMatches = await searchTinyProductsBySku(fallbackParentSku);
    const exactParent = parentMatches.find((entry) => entry.sku === fallbackParentSku);

    if (exactParent) {
      const parent = await getTinyProductById(exactParent.id);
      return {
        parent,
        selectedDetail: detail
      };
    }
  }

  return {
    parent: detail,
    selectedDetail: detail
  };
}

function buildVariantFromDetail(detail: Record<string, unknown>, fallbackImage?: string | null): TinyInspectedVariant | null {
  const id = toStringValue(detail.id);
  const sku = normalizeSku(toStringValue(detail.codigo) ?? "");
  const name = toStringValue(detail.nome);
  const parsedSku = parseSku(sku);

  if (!id || !sku || !name || !parsedSku) {
    return null;
  }

  const quantity = toNumberValue(detail.saldo);

  return {
    id,
    sku,
    name,
    sizeCode: parsedSku.sizeCode,
    colorCode: parsedSku.colorCode,
    quantityCode: parsedSku.quantityCode,
    baseCode: parsedSku.baseCode,
    imageUrl: extractImageUrl(detail) ?? fallbackImage ?? null,
    quantity,
    stockStatus: getStockBand(quantity),
    raw: detail
  };
}

export async function inspectTinyProductBySku(inputSku: string): Promise<TinyInspectionResult> {
  const sku = normalizeSku(inputSku);
  const searchResults = await searchTinyProductsBySku(sku);
  const exactMatch = searchResults.find((entry) => entry.sku === sku);

  if (!exactMatch) {
    throw new Error(
      searchResults.length
        ? "Não encontrei um match exato por SKU. Revise o código e escolha um dos resultados sugeridos."
        : "Nenhum produto encontrado no Tiny para esse SKU."
    );
  }

  const { parent, selectedDetail } = await resolveParentProduct(exactMatch);
  const parentSku = normalizeSku(toStringValue(parent.codigo) ?? exactMatch.sku);
  const parentImage = extractImageUrl(parent);
  const variationRefs = getVariantRefs(parent);
  const parsedParentSku = parseSku(parentSku);

  const variantDetails =
    variationRefs.length > 0
      ? await Promise.all(
          variationRefs.map(async (entry) => {
            if (entry.id) {
              return getTinyProductById(entry.id);
            }

            if (entry.sku) {
              const matches = await searchTinyProductsBySku(entry.sku);
              const exact = matches.find((item) => item.sku === entry.sku);
              return exact ? getTinyProductById(exact.id) : null;
            }

            return null;
          })
        )
      : [selectedDetail];

  const variants = (
    await Promise.all(
      variantDetails
        .filter(Boolean)
        .map(async (detail) => {
          const variant = buildVariantFromDetail(detail as Record<string, unknown>, parentImage);

          if (!variant) {
            return null;
          }

          const quantity = await getTinyStockByProductId(variant.id);
          return {
            ...variant,
            quantity,
            stockStatus: getStockBand(quantity)
          };
        })
    )
  ).filter(Boolean) as TinyInspectedVariant[];

  if (variants.length === 0 && parsedParentSku) {
    const quantity = await getTinyStockByProductId(toStringValue(parent.id) ?? exactMatch.id);
    variants.push({
      id: toStringValue(parent.id) ?? exactMatch.id,
      sku: parentSku,
      name: toStringValue(parent.nome) ?? exactMatch.name,
      sizeCode: parsedParentSku.sizeCode,
      colorCode: parsedParentSku.colorCode,
      quantityCode: parsedParentSku.quantityCode,
      baseCode: parsedParentSku.baseCode,
      imageUrl: parentImage,
      quantity,
      stockStatus: getStockBand(quantity),
      raw: parent
    });
  }

  return {
    searchedSku: sku,
    parent: {
      id: toStringValue(parent.id) ?? exactMatch.id,
      sku: parentSku,
      name: toStringValue(parent.nome) ?? exactMatch.name,
      imageUrl: parentImage
    },
    variants,
    suggestions: searchResults.slice(0, 8)
  };
}

export async function importTinyProductBySku(params: {
  sku: string;
  supplierIds: string[];
  actorUserId: string;
}) {
  const inspection = await inspectTinyProductBySku(params.sku);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const batch = await tx.tinyImportBatch.create({
      data: {
        status: "processing",
        importedByUserId: params.actorUserId,
        notes: `Importação por SKU ${inspection.searchedSku}`
      }
    });

    let parentId: string | null = null;
    const parsedParent = parseSku(inspection.parent.sku);

    if (parsedParent) {
      const existingParent = await tx.product.findUnique({
        where: {
          sku: inspection.parent.sku
        }
      });

      const parentData: Prisma.ProductUncheckedCreateInput = {
        internalName: existingParent?.internalName ?? inspection.parent.name,
        sku: inspection.parent.sku,
        skuParent: null,
        baseCode: parsedParent.baseCode,
        quantityCode: parsedParent.quantityCode,
        sizeCode: null,
        colorCode: null,
        tinyProductId: inspection.parent.id,
        tinyVariationId: null,
        tinyCode: inspection.parent.sku,
        imageUrl: existingParent?.imageUrl ?? inspection.parent.imageUrl ?? "/brand/pepper-logo.png",
        active: existingParent?.active ?? true,
        kind: ProductKind.PARENT,
        syncStatus: InventorySyncStatus.FRESH,
        lastSyncedAt: now,
        fallbackInventory: inspection.variants.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      };

      const parent = existingParent
        ? await tx.product.update({
            where: { sku: inspection.parent.sku },
            data: {
              tinyProductId: parentData.tinyProductId,
              tinyCode: parentData.tinyCode,
              syncStatus: InventorySyncStatus.FRESH,
              lastSyncedAt: now,
              fallbackInventory: parentData.fallbackInventory
            }
          })
        : await tx.product.create({ data: parentData });

      parentId = parent.id;
    }

    let importedVariants = 0;

    for (const variant of inspection.variants) {
      const existingVariant = await tx.product.findUnique({
        where: {
          sku: variant.sku
        }
      });

      const product = existingVariant
        ? await tx.product.update({
            where: { sku: variant.sku },
            data: {
              skuParent: inspection.parent.sku,
              baseCode: variant.baseCode,
              quantityCode: variant.quantityCode,
              sizeCode: variant.sizeCode ?? null,
              colorCode: variant.colorCode ?? null,
              tinyProductId: variant.id,
              tinyVariationId: variant.id,
              tinyCode: variant.sku,
              imageUrl: existingVariant.imageUrl ?? variant.imageUrl ?? inspection.parent.imageUrl ?? "/brand/pepper-logo.png",
              parentId: parentId ?? undefined,
              syncStatus: variant.quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
              lastSyncedAt: now,
              fallbackInventory: variant.quantity ?? existingVariant.fallbackInventory
            }
          })
        : await tx.product.create({
            data: {
              internalName: variant.name,
              sku: variant.sku,
              skuParent: inspection.parent.sku,
              baseCode: variant.baseCode,
              quantityCode: variant.quantityCode,
              sizeCode: variant.sizeCode ?? null,
              colorCode: variant.colorCode ?? null,
              tinyProductId: variant.id,
              tinyVariationId: variant.id,
              tinyCode: variant.sku,
              imageUrl: variant.imageUrl ?? inspection.parent.imageUrl ?? "/brand/pepper-logo.png",
              kind: ProductKind.VARIANT,
              parentId: parentId ?? undefined,
              syncStatus: variant.quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
              lastSyncedAt: now,
              fallbackInventory: variant.quantity
            }
          });

      await tx.inventorySnapshot.create({
        data: {
          productId: product.id,
          quantity: variant.quantity,
          status: variant.quantity === null ? InventorySyncStatus.ERROR : InventorySyncStatus.FRESH,
          stockBand: getStockBand(variant.quantity)
        }
      });

      for (const supplierId of params.supplierIds) {
        await tx.productSupplier.upsert({
          where: {
            productId_supplierId: {
              productId: product.id,
              supplierId
            }
          },
          update: {
            active: true
          },
          create: {
            productId: product.id,
            supplierId,
            active: true
          }
        });
      }

      await tx.tinyImportItem.create({
        data: {
          batchId: batch.id,
          tinyProductId: variant.id,
          sku: variant.sku,
          tinyCode: variant.sku,
          imageUrl: variant.imageUrl,
          rawPayload: JSON.stringify(variant.raw),
          selectedForImport: true,
          status: "imported"
        }
      });

      importedVariants += 1;
    }

    await tx.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: "tiny.import",
        entityType: "product",
        entityId: inspection.parent.sku,
        metadata: JSON.stringify({
          sku: inspection.parent.sku,
          importedVariants,
          supplierIds: params.supplierIds
        })
      }
    });

    await tx.tinyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "completed",
        finishedAt: new Date()
      }
    });

    if (parentId) {
      await syncCatalogProductByParentSku(tx, inspection.parent.sku);
    }

    return {
      batchId: batch.id,
      importedVariants,
      parentSku: inspection.parent.sku
    };
  });
}
