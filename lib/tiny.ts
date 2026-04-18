import { InventorySyncStatus, Prisma, ProductKind } from "@prisma/client";
import { syncCatalogProductByParentSku } from "@/lib/catalog-sync";
import {
  getPepperCatalogImportAccountKey,
  getPepperTinyAccountLabel,
  getPepperTinyPlanCallsPerMinute,
  getPepperTinyRecommendedTargetCallsPerMinute,
  PEPPER_TINY_ACCOUNT_REFERENCES,
  shouldReadAvailableMultiCompanyStock,
  type PepperTinyAccountKey
} from "@/lib/pepper-tiny-account-data";
import { prisma } from "@/lib/prisma";
import { getParentSku, normalizeSku, parseSku } from "@/lib/sku";
import { getStockBand } from "@/lib/stock";
import { buildFoundationSkuImportPlan, type FoundationSkuImportPlan } from "@/lib/foundation-import-policy";

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

export const PORTAL_BRAND_FALLBACK_IMAGE = "/brand/pepper-logo.png";

export type TinyRecord = Record<string, unknown>;

type TinySearchCandidate = {
  id: string;
  sku: string;
  name: string;
  variationType: string;
  accountKey: TinyAccountKey;
  accountLabel: string;
  parentTinyId?: string | null;
  raw: Record<string, unknown>;
};

type TinyStructureRef = {
  id: string;
  sku: string | null;
  name: string | null;
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

export type TinyStockSnapshot = {
  accountKey: TinyAccountKey;
  stockBalance: number | null;
  reservedStock: number | null;
  availableMultiCompanyStock: number | null;
};

export type TinyInspectionResult = {
  searchedSku: string;
  source: "tiny";
  sourceAccountKey: InspectionSourceAccountKey;
  sourceAccountLabel: string;
  parent: {
    id: string;
    sku: string;
    name: string;
    imageUrl?: string | null;
  };
  variants: TinyInspectedVariant[];
  suggestions: TinySearchCandidate[];
  importPlan?: FoundationSkuImportPlan;
};

export type TinyOrderSearchResult = {
  id: string;
  number: string | null;
  ecommerceNumber: string | null;
  statusLabel: string | null;
  orderDate: string | null;
  customerName: string | null;
  totalAmount: number | null;
  raw: Record<string, unknown>;
};

export type TinyOrderSearchPage = {
  page: number;
  totalPages: number;
  orders: TinyOrderSearchResult[];
};

export type TinyAccountKey = PepperTinyAccountKey;
export type InspectionSourceAccountKey = TinyAccountKey | "foundation" | "foundation-local";

const TINY_ACCOUNT_CONFIG: Array<{
  key: TinyAccountKey;
  label: string;
  tokenEnvKey: string;
}> = PEPPER_TINY_ACCOUNT_REFERENCES.map((account) => ({
  key: account.key,
  label: account.label,
  tokenEnvKey:
    account.key === "pepper"
      ? "TINY_API_TOKEN"
      : account.key === "showlook"
        ? "TINY_SHOWLOOK_API_TOKEN"
        : "TINY_ONSHOP_API_TOKEN"
}));

type TinyThrottleState = {
  queue: Promise<void>;
  lastCallAt: number;
  adaptiveMinIntervalMs: number | null;
};

const tinyThrottleByAccount = new Map<TinyAccountKey, TinyThrottleState>();

function getTinyThrottleState(accountKey: TinyAccountKey) {
  const existing = tinyThrottleByAccount.get(accountKey);
  if (existing) {
    return existing;
  }

  const created: TinyThrottleState = {
    queue: Promise.resolve(),
    lastCallAt: 0,
    adaptiveMinIntervalMs: null
  };
  tinyThrottleByAccount.set(accountKey, created);
  return created;
}

function getTinyAccountEnvPrefix(accountKey: TinyAccountKey) {
  return accountKey === "pepper" ? "TINY_PEPPER" : accountKey === "showlook" ? "TINY_SHOWLOOK" : "TINY_ONSHOP";
}

function readTinyPositiveNumber(raw: string | undefined) {
  const parsed = Number(raw ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTinyConfiguredMinIntervalMs(accountKey: TinyAccountKey) {
  const accountEnvPrefix = getTinyAccountEnvPrefix(accountKey);
  const configured =
    readTinyPositiveNumber(process.env[`${accountEnvPrefix}_API_MIN_INTERVAL_MS`]) ??
    readTinyPositiveNumber(process.env.TINY_API_MIN_INTERVAL_MS);

  if (configured !== null && configured >= 0) {
    return configured;
  }

  const targetCallsPerMinute =
    readTinyPositiveNumber(process.env[`${accountEnvPrefix}_API_TARGET_CALLS_PER_MIN`]) ??
    readTinyPositiveNumber(process.env.TINY_API_TARGET_CALLS_PER_MIN) ??
    getPepperTinyRecommendedTargetCallsPerMinute(accountKey);

  if (targetCallsPerMinute !== null && targetCallsPerMinute > 0) {
    const planFloorIntervalMs = Math.ceil(60000 / getPepperTinyPlanCallsPerMinute(accountKey));
    const targetIntervalMs = Math.ceil(60000 / targetCallsPerMinute);
    return Math.max(planFloorIntervalMs, targetIntervalMs);
  }

  return 750;
}

function getTinyMinIntervalMs(accountKey: TinyAccountKey) {
  const state = getTinyThrottleState(accountKey);
  return Math.max(getTinyConfiguredMinIntervalMs(accountKey), state.adaptiveMinIntervalMs ?? 0);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTinyRequestTimeoutMs() {
  const configured = Number(process.env.TINY_API_TIMEOUT_MS ?? "5000");
  return Number.isFinite(configured) && configured >= 1000 ? configured : 5000;
}

function isTinyRateLimitMessage(message: string) {
  return /excedido o numero de acessos|excesso de acessos|muitas requisicoes|too many requests|rate limit|acessos concorrentes|ultimo minuto/i.test(
    message
  );
}

function updateTinyAdaptiveThrottle(accountKey: TinyAccountKey, limitHeader: string | null) {
  const parsedLimit = Number(limitHeader ?? "");

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return;
  }

  const perMinuteIntervalMs = Math.ceil(60000 / parsedLimit);
  const state = getTinyThrottleState(accountKey);
  state.adaptiveMinIntervalMs = Math.max(300, perMinuteIntervalMs + 150);
}

function extractTinyErrorDetails(payload: TinyApiEnvelope) {
  const errors = Array.isArray(payload.retorno?.erros) ? payload.retorno.erros : [];
  const codes: string[] = [];
  const messages: string[] = [];

  for (const entry of errors) {
    const record = entry as Record<string, unknown>;
    const nestedError = typeof record.erro === "object" && record.erro ? (record.erro as Record<string, unknown>) : null;
    const code =
      toStringValue(record.codigo) ??
      toStringValue(record.cod_erro) ??
      toStringValue(record.code) ??
      toStringValue(nestedError?.codigo);

    const message =
      toStringValue(record.erro) ??
      toStringValue(record.mensagem) ??
      toStringValue(record.message) ??
      JSON.stringify(entry);

    if (code) {
      codes.push(code);
    }

    if (message) {
      messages.push(message);
    }
  }

  return {
    codes,
    message: messages.filter(Boolean).join(" | ")
  };
}

async function runTinyCallWithThrottle<T>(accountKey: TinyAccountKey, fn: () => Promise<T>) {
  const state = getTinyThrottleState(accountKey);
  let releaseQueue = () => {};
  const previousQueue = state.queue;
  state.queue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previousQueue;

  try {
    const elapsed = Date.now() - state.lastCallAt;
    const waitMs = Math.max(0, getTinyMinIntervalMs(accountKey) - elapsed);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const result = await fn();
    state.lastCallAt = Date.now();
    return result;
  } finally {
    releaseQueue();
  }
}

export function getConfiguredTinyAccounts() {
  return TINY_ACCOUNT_CONFIG.filter((account) => Boolean(process.env[account.tokenEnvKey]?.trim()));
}

export function getTinyAccountLabel(accountKey: TinyAccountKey) {
  return getPepperTinyAccountLabel(accountKey);
}

function getTinyToken(accountKey: TinyAccountKey = "pepper") {
  const config = TINY_ACCOUNT_CONFIG.find((account) => account.key === accountKey);
  return config ? process.env[config.tokenEnvKey]?.trim() : undefined;
}

export function isTinyConfigured() {
  return Boolean(getTinyToken(getPepperCatalogImportAccountKey()));
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

function formatTinyDate(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    timeZone: "America/Fortaleza"
  });
}

export function extractImageUrls(record: Record<string, unknown>) {
  const directCandidates = [
    record.imageUrl,
    record.imagemExterna,
    record.urlImagemExterna,
    record.imagemURL,
    record.imagem,
    record.url_imagem
  ];
  const urls: string[] = [];

  for (const candidate of directCandidates) {
    const value = toStringValue(candidate);
    if (value) {
      urls.push(value);
    }
  }

  const arrayCandidates = [
    record.imagensExternas,
    record.imagens_externas,
    record.imagens,
    record.anexos,
    record.anexosExternos
  ];

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
        toStringValue(item.anexo) ??
        toStringValue(item.arquivo);

      if (value) {
        urls.push(value);
      }
    }
  }

  return Array.from(new Set(urls));
}

export function extractImageUrl(record: Record<string, unknown>) {
  return extractImageUrls(record)[0] ?? null;
}

export function preferTinyImage(existingImageUrl: string | null | undefined, incomingImageUrl: string | null | undefined) {
  const existing = toStringValue(existingImageUrl);
  const incoming = toStringValue(incomingImageUrl);

  if (!existing || existing === PORTAL_BRAND_FALLBACK_IMAGE) {
    return incoming ?? existing ?? PORTAL_BRAND_FALLBACK_IMAGE;
  }

  return existing;
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

function normalizeTinyFieldKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function extractNumericByKeyPattern(value: unknown, matcher: (normalizedKey: string) => boolean): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const queue: unknown[] = [value];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }

      continue;
    }

    for (const [key, entry] of Object.entries(current)) {
      const normalizedKey = normalizeTinyFieldKey(key);
      if (matcher(normalizedKey)) {
        const parsed = toNumberValue(entry);
        if (parsed !== null) {
          return parsed;
        }
      }

      if (entry && typeof entry === "object") {
        queue.push(entry);
      }
    }
  }

  return null;
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
    accountKey: "pepper",
    accountLabel: getTinyAccountLabel("pepper"),
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

export async function getTinyProductStructureById(id: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("produto.obter.estrutura.php", { id }, accountKey);
  const product = unwrapTinyItem(payload.retorno?.produto);
  const structure = Array.isArray(product.estrutura) ? product.estrutura : [];

  return structure
    .map((entry) => {
      const item = unwrapTinyItem(unwrapTinyItem(entry).item ?? entry);
      const componentId =
        toStringValue(item.id_componente) ??
        toStringValue(item.idProdutoFilha) ??
        toStringValue(item.idProduto) ??
        toStringValue(item.id);

      if (!componentId) {
        return null;
      }

      return {
        id: componentId,
        sku: normalizeSku(toStringValue(item.codigo) ?? toStringValue(item.sku) ?? ""),
        name: toStringValue(item.nome)
      } satisfies TinyStructureRef;
    })
    .filter(Boolean) as TinyStructureRef[];
}

function extractStockSnapshot(payload: TinyApiEnvelope, accountKey: TinyAccountKey = "pepper"): TinyStockSnapshot {
  const entries =
    (Array.isArray(payload.retorno?.produtos) ? payload.retorno?.produtos : undefined) ??
    (payload.retorno?.produto ? [payload.retorno.produto] : []);

  for (const entry of entries) {
    const item = unwrapTinyItem(entry);
    const preferMultiCompany = shouldReadAvailableMultiCompanyStock(accountKey);
    const reservedStock =
      toNumberValue(item.saldoReservado) ??
      extractNumericByKeyPattern(item, (normalizedKey) => {
        const mentionsReserved = normalizedKey.includes("saldoreservado") || normalizedKey.includes("reservado");
        const mentionsStock =
          normalizedKey.includes("saldo") ||
          normalizedKey.includes("estoque") ||
          normalizedKey.includes("disponivel");

        return mentionsReserved && mentionsStock;
      });
    let availableMultiCompanyStock: number | null = null;
    let stockBalance: number | null = null;

    if (preferMultiCompany) {
      availableMultiCompanyStock = extractNumericByKeyPattern(item, (normalizedKey) => {
        const mentionsMultiCompany =
          normalizedKey.includes("multiempresa") ||
          normalizedKey.includes("multempresa") ||
          normalizedKey.includes("multicompany") ||
          normalizedKey.includes("compartilhado");
        return mentionsMultiCompany && normalizedKey.includes("disponivel");
      });

      stockBalance = extractNumericByKeyPattern(item, (normalizedKey) => {
        const mentionsMultiCompany =
          normalizedKey.includes("multiempresa") ||
          normalizedKey.includes("multempresa") ||
          normalizedKey.includes("multicompany") ||
          normalizedKey.includes("compartilhado");
        const mentionsStock =
          normalizedKey.includes("saldo") ||
          normalizedKey.includes("estoque");

        return mentionsMultiCompany && mentionsStock && !normalizedKey.includes("reservado");
      });
    }

    const direct = toNumberValue(item.saldo) ?? toNumberValue(item.estoque);

    if (stockBalance === null && direct !== null) {
      stockBalance = direct;
    }

    if (stockBalance === null) {
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
          stockBalance = total;
        }
      }
    }

    if (availableMultiCompanyStock === null && stockBalance !== null) {
      availableMultiCompanyStock = Math.max(0, stockBalance - Math.max(0, reservedStock ?? 0));
    }

    if (stockBalance !== null || reservedStock !== null || availableMultiCompanyStock !== null) {
      return {
        accountKey,
        stockBalance,
        reservedStock,
        availableMultiCompanyStock
      };
    }
  }

  return {
    accountKey,
    stockBalance: null,
    reservedStock: null,
    availableMultiCompanyStock: null
  };
}

export async function callTiny(endpoint: string, params: Record<string, string>, accountKey: TinyAccountKey = "pepper") {
  const token = getTinyToken(accountKey);

  if (!token) {
    throw new Error(`Configure o token Tiny da conta ${getTinyAccountLabel(accountKey)} no arquivo .env para consultar o Tiny.`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runTinyCallWithThrottle(accountKey, async () => {
        const body = new URLSearchParams({
          token,
          formato: "json",
          ...params
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), getTinyRequestTimeoutMs());

        let response: Response;

        try {
          response = await fetch(`${process.env.TINY_API_BASE_URL ?? "https://api.tiny.com.br/api2"}/${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body,
            cache: "no-store",
            signal: controller.signal
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error(
              `Consulta ao Tiny (${getTinyAccountLabel(accountKey)}) demorou demais para responder. O sistema manteve a fundacao como fonte principal e interrompeu o fallback temporariamente.`
            );
          }

          throw error;
        } finally {
          clearTimeout(timeout);
        }

        updateTinyAdaptiveThrottle(accountKey, response.headers.get("x-limit-api"));

        if (response.status === 429) {
          throw new Error("API do Tiny bloqueou temporariamente por excesso de acessos. Aguarde e tente novamente.");
        }

        if (!response.ok) {
          throw new Error(`Falha ao consultar o Tiny (${response.status}).`);
        }

        const payload = (await response.json()) as TinyApiEnvelope;
        const status = payload.retorno?.status?.toUpperCase();
        const errorDetails = extractTinyErrorDetails(payload);

        if (status && status !== "OK") {
          const errorText = errorDetails.message || "O Tiny retornou erro ao processar a solicitacao.";

          if (errorDetails.codes.includes("6")) {
            throw new Error("API do Tiny excedeu o limite de acessos no ultimo minuto. Aguarde alguns instantes e tente novamente.");
          }

          if (errorDetails.codes.includes("11")) {
            throw new Error("API do Tiny bloqueou acessos concorrentes. O sistema vai desacelerar e tentar novamente.");
          }

          throw new Error(errorText);
        }

        return payload;
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha ao consultar o Tiny.");

      if (!isTinyRateLimitMessage(lastError.message) || attempt === 2) {
        break;
      }

      await sleep((attempt + 1) * 2500);
    }
  }

  throw lastError ?? new Error("Falha ao consultar o Tiny.");
}

export async function searchTinyProductsBySku(sku: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("produtos.pesquisa.php", {
    pesquisa: normalizeSku(sku)
  }, accountKey);

  const products = Array.isArray(payload.retorno?.produtos) ? payload.retorno.produtos : [];

  return products
    .map((entry) => {
      const candidate = normalizeSearchCandidate(unwrapTinyItem(entry));
      return candidate
        ? {
            ...candidate,
            accountKey,
            accountLabel: getTinyAccountLabel(accountKey)
          }
        : null;
    })
    .filter(Boolean) as TinySearchCandidate[];
}

export async function getTinyProductById(id: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("produto.obter.php", { id }, accountKey);
  return unwrapTinyItem(payload.retorno?.produto);
}

export async function getTinyOrderById(id: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("pedido.obter.php", { id }, accountKey);
  return unwrapTinyItem(payload.retorno?.pedido);
}

export async function searchTinyOrdersByDateRange(params: {
  startDate: Date;
  endDate: Date;
  page?: number;
  accountKey?: TinyAccountKey;
}) {
  const page = params.page ?? 1;
  const payload = await callTiny("pedidos.pesquisa.php", {
    dataInicial: formatTinyDate(params.startDate),
    dataFinal: formatTinyDate(params.endDate),
    pagina: String(page)
  }, params.accountKey ?? "pepper");

  const rawOrders = Array.isArray(payload.retorno?.pedidos) ? payload.retorno.pedidos : [];
  const orders = rawOrders
    .map((entry) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const item = unwrapTinyItem(record.pedido ?? record);
      const id =
        toStringValue(item.id) ??
        toStringValue(item.idPedido) ??
        toStringValue(item.id_pedido);

      if (!id) {
        return null;
      }

      return {
        id,
        number: toStringValue(item.numero) ?? toStringValue(item.numeroPedido),
        ecommerceNumber: toStringValue(item.numeroEcommerce),
        statusLabel: toStringValue(item.situacao),
        orderDate:
          toStringValue(item.dataPedido) ??
          toStringValue(item.data_pedido) ??
          toStringValue(item.data),
        customerName:
          toStringValue(item.nomeCliente) ??
          toStringValue(item.nome) ??
          toStringValue(unwrapTinyItem(item.cliente).nome) ??
          toStringValue(unwrapTinyItem(item.contato).nome),
        totalAmount:
          toNumberValue(item.valorTotal) ??
          toNumberValue(item.total) ??
          toNumberValue(item.valor),
        raw: item
      } satisfies TinyOrderSearchResult;
    })
    .filter(Boolean) as TinyOrderSearchResult[];

  const totalPages =
    Math.max(
      1,
      Number(
        payload.retorno?.numero_paginas ??
          payload.retorno?.numeroPaginas ??
          payload.retorno?.total_paginas ??
          payload.retorno?.totalPaginas ??
          page
      )
    ) || 1;

  return {
    page,
    totalPages,
    orders
  } satisfies TinyOrderSearchPage;
}

export async function getTinyContactById(id: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("contato.obter.php", { id }, accountKey);
  return unwrapTinyItem(payload.retorno?.contato);
}

export async function getTinyStockSnapshotByProductId(id: string, accountKey: TinyAccountKey = "pepper") {
  const payload = await callTiny("produto.obter.estoque.php", { id }, accountKey);
  return extractStockSnapshot(payload, accountKey);
}

export async function getTinyStockByProductId(id: string, accountKey: TinyAccountKey = "pepper") {
  const snapshot = await getTinyStockSnapshotByProductId(id, accountKey);
  return snapshot.availableMultiCompanyStock;
}

async function resolveParentProduct(candidate: TinySearchCandidate) {
  const detail = await getTinyProductById(candidate.id, candidate.accountKey);
  const variationType = extractVariationType(detail).toUpperCase();

  if (variationType === "P" || candidate.sku === getParentSku(candidate.sku)) {
    return {
      parent: detail,
      selectedDetail: detail
    };
  }

  const parentTinyId = extractParentTinyId(detail) ?? candidate.parentTinyId;
  if (parentTinyId) {
    const parent = await getTinyProductById(parentTinyId, candidate.accountKey);
    return {
      parent,
      selectedDetail: detail
    };
  }

  const fallbackParentSku = getParentSku(candidate.sku);
  if (fallbackParentSku) {
    const parentMatches = await searchTinyProductsBySku(fallbackParentSku, candidate.accountKey);
    const exactParent = parentMatches.find((entry) => entry.sku === fallbackParentSku && entry.accountKey === candidate.accountKey);

    if (exactParent) {
      const parent = await getTinyProductById(exactParent.id, candidate.accountKey);
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

export async function inspectTinyProductBySku(
  inputSku: string,
  options?: {
    includeStock?: boolean;
  }
): Promise<TinyInspectionResult> {
  const sku = normalizeSku(inputSku);
  const includeStock = options?.includeStock ?? true;
  const parentSku = getParentSku(sku) || sku;
  const parentSearchResults = await searchTinyProductsBySku(parentSku, "pepper");
  const directSearchResults = sku === parentSku ? parentSearchResults : await searchTinyProductsBySku(sku, "pepper");
  const exactParent = parentSearchResults.find((entry) => entry.sku === parentSku);
  const exactMatch = directSearchResults.find((entry) => entry.sku === sku);
  const searchResults = [...parentSearchResults, ...directSearchResults].filter(
    (entry, index, array) => array.findIndex((candidate) => candidate.sku === entry.sku) === index
  );

  if (!exactParent && !exactMatch) {
    throw new Error(
      searchResults.length
        ? "NÃ£o encontrei um match exato por SKU. Revise o cÃ³digo e escolha um dos resultados sugeridos."
        : "Nenhum produto encontrado no Tiny para esse SKU."
    );
  }

  const resolved =
    exactParent
      ? {
          parent: await getTinyProductById(exactParent.id, "pepper"),
          selectedDetail:
            exactMatch && exactMatch.id !== exactParent.id
              ? await getTinyProductById(exactMatch.id, "pepper")
              : await getTinyProductById(exactParent.id, "pepper")
        }
      : await resolveParentProduct(exactMatch!);

  const { parent, selectedDetail } = resolved;
  const resolvedParentSku = normalizeSku(toStringValue(parent.codigo) ?? exactParent?.sku ?? exactMatch?.sku ?? parentSku);
  const resolvedParentName = toStringValue(parent.nome) ?? exactParent?.name ?? exactMatch?.name ?? resolvedParentSku;
  const parentImage = extractImageUrl(parent);
  const resolvedParentId = toStringValue(parent.id) ?? exactParent?.id ?? exactMatch?.id;
  const structureRefs = resolvedParentId
    ? await getTinyProductStructureById(resolvedParentId, "pepper").catch(() => [])
    : [];
  const importPlan = buildFoundationSkuImportPlan(structureRefs.length);
  const variationRefs =
    structureRefs.length > 0
      ? structureRefs.map((entry) => ({
          id: entry.id,
          sku: entry.sku
        }))
      : getVariantRefs(parent);
  const parsedParentSku = parseSku(resolvedParentSku);

  const variantDetails =
    variationRefs.length > 0
      ? await Promise.all(
          variationRefs.map(async (entry) => {
            if (entry.id) {
              return getTinyProductById(entry.id, "pepper");
            }

            if (entry.sku) {
              const matches = await searchTinyProductsBySku(entry.sku, "pepper");
              const exact = matches.find((item) => item.sku === entry.sku);
              return exact ? getTinyProductById(exact.id, "pepper") : null;
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

          if (!includeStock) {
            return variant;
          }

          const quantity = await getTinyStockByProductId(variant.id, "pepper");
          return {
            ...variant,
            quantity,
            stockStatus: getStockBand(quantity)
          };
        })
    )
  ).filter(Boolean) as TinyInspectedVariant[];

  if (variants.length === 0 && parsedParentSku) {
    const quantity = includeStock && resolvedParentId ? await getTinyStockByProductId(resolvedParentId, "pepper") : null;
    variants.push({
      id: resolvedParentId ?? resolvedParentSku,
      sku: resolvedParentSku,
      name: resolvedParentName,
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
    source: "tiny",
    sourceAccountKey: "pepper",
    sourceAccountLabel: getTinyAccountLabel("pepper"),
    parent: {
      id: resolvedParentId ?? resolvedParentSku,
      sku: resolvedParentSku,
      name: resolvedParentName,
      imageUrl: parentImage
    },
    variants,
    suggestions: searchResults.slice(0, 8),
    importPlan
  };
}

export async function importTinyProductBySku(params: {
  sku: string;
  supplierIds: string[];
  actorUserId: string;
}) {
  const inspection = await inspectTinyProductBySku(params.sku);
  const importPlan = inspection.importPlan ?? buildFoundationSkuImportPlan(inspection.variants.length);
  const now = new Date();
  const batch = await prisma.tinyImportBatch.create({
    data: {
      status: "processing",
      importedByUserId: params.actorUserId,
      notes:
        importPlan.mode === "staged_family"
          ? `Importaçao em etapas por SKU ${inspection.searchedSku} | filhas=${importPlan.variantCount} | lote=${importPlan.chunkSize}`
          : `Importaçao por SKU ${inspection.searchedSku}`
    }
  });

  try {
    let parentId: string | null = null;
    const parsedParent = parseSku(inspection.parent.sku);

    if (parsedParent) {
      const existingParent = await prisma.product.findUnique({
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
        imageUrl: preferTinyImage(existingParent?.imageUrl, inspection.parent.imageUrl),
        active: existingParent?.active ?? true,
        kind: ProductKind.PARENT,
        syncStatus: InventorySyncStatus.FRESH,
        lastSyncedAt: now,
        fallbackInventory: inspection.variants.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
      };

      const parent = existingParent
        ? await prisma.product.update({
            where: { sku: inspection.parent.sku },
          data: {
            tinyProductId: parentData.tinyProductId,
            tinyCode: parentData.tinyCode,
            imageUrl: parentData.imageUrl,
            syncStatus: InventorySyncStatus.FRESH,
            lastSyncedAt: now,
            fallbackInventory: parentData.fallbackInventory
            }
          })
        : await prisma.product.create({ data: parentData });

      parentId = parent.id;
    }

    let importedVariants = 0;

    for (const variant of inspection.variants) {
      await prisma.$transaction(async (tx) => {
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
                imageUrl: preferTinyImage(existingVariant.imageUrl, variant.imageUrl ?? inspection.parent.imageUrl),
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
                imageUrl: preferTinyImage(null, variant.imageUrl ?? inspection.parent.imageUrl),
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
            imageUrl: variant.imageUrl ?? inspection.parent.imageUrl ?? null,
            rawPayload: JSON.stringify(variant.raw),
            selectedForImport: true,
            status: "imported"
          }
        });
      });

      importedVariants += 1;
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: "tiny.import",
        entityType: "product",
        entityId: inspection.parent.sku,
        metadata: JSON.stringify({
          sku: inspection.parent.sku,
          importedVariants,
          supplierIds: params.supplierIds,
          importMode: importPlan.mode,
          importChunkSize: importPlan.chunkSize,
          variantCount: importPlan.variantCount
        })
      }
    });

    await prisma.tinyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "completed",
        finishedAt: new Date()
      }
    });

    if (parentId) {
      await syncCatalogProductByParentSku(prisma, inspection.parent.sku, {
        preserveInventory: true
      });
    }

    return {
      batchId: batch.id,
      importedVariants,
      parentSku: inspection.parent.sku,
      importPlan
    };
  } catch (error) {
    await prisma.tinyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        notes: `Falha ao importar SKU ${inspection.searchedSku}`
      }
    });

    throw error;
  }
}

