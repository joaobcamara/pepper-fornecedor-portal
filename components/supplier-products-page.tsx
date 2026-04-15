"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackageSearch, RefreshCcw, Search, ShoppingCart, X } from "lucide-react";

import { ProductOperationalStrip } from "@/components/product-operational-strip";
import { SupplierIdentityHero } from "@/components/supplier-identity-hero";
import { StatusPill } from "@/components/status-pill";
import { SupplierTopNav } from "@/components/supplier-top-nav";
import { cn } from "@/lib/cn";
import type { StockBand } from "@/lib/stock";

type MatrixItem = {
  id: string;
  sku: string;
  size: string;
  colorLabel: string;
  quantity: number | null;
  salePrice: number | null;
  promotionalPrice: number | null;
  costPrice: number | null;
  status: string;
  band: StockBand;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: string | null;
};

type ProductCard = {
  id: string;
  supplier: string;
  name: string;
  sku: string;
  imageUrl: string;
  lastUpdated: string;
  syncState: "fresh" | "stale";
  total: number;
  band: StockBand;
  bandLabel: string;
  priceFrom: number | null;
  priceTo: number | null;
  inventorySaleValue: number;
  inventoryCostValue: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: string | null;
  coverageDays: number | null;
  movementBadge: string;
  topColorLabel: string | null;
  topSizeLabel: string | null;
  relatedOrderCount: number;
  replenishmentCard: {
    requestId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    statusLabel: string;
    linkedOrderNumber: string | null;
    linkedFinancialStatusLabel: string | null;
    nextStepLabel: string;
  } | null;
  activeOrder: {
    orderId: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    financialStatusLabel: string | null;
  } | null;
  matrix: Array<{
    color: string;
    items: MatrixItem[];
  }>;
};

type ProductSummary = {
  productCount: number;
  criticalCount: number;
  lowCount: number;
  staleCount: number;
  totalSalesToday: number;
  totalSales7d: number;
  totalSales30d: number;
  totalInventorySaleValue: number;
  totalInventoryCostValue: number;
  topProductName: string | null;
  topInventoryProductName: string | null;
  topInventoryProductValue: number;
  topColor: string | null;
  topSize: string | null;
  replenishmentPendingCount: number;
  replenishmentApprovedCount: number;
  replenishmentLinkedCount: number;
  orderCardsInProgress: number;
  orderCardsInFinancial: number;
  orderCardsShipped: number;
};

const filters = [
  { label: "Todos", value: "all" },
  { label: "Criticos", value: "critical" },
  { label: "Baixos", value: "low" },
  { label: "OK", value: "ok" }
] as const;

type Filter = (typeof filters)[number]["value"];

export function SupplierProductsPage({
  products,
  summary,
  unreadCount = 0,
  supplierName = "Fornecedor Pepper",
  supplierInitials = "PF",
  supplierLogoUrl = null,
  canViewProductValues = false,
  canViewFinancialDashboard = false
}: {
  products: ProductCard[];
  summary: ProductSummary;
  unreadCount?: number;
  supplierName?: string;
  supplierInitials?: string;
  supplierLogoUrl?: string | null;
  canViewProductValues?: boolean;
  canViewFinancialDashboard?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const text = `${product.name} ${product.sku}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesFilter = activeFilter === "all" ? true : product.band === activeFilter;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, products, query]);

  const selected = visibleProducts.find((product) => product.id === selectedId) ?? null;

  async function handleRefresh() {
    setSyncMessage(null);
    setSyncError(null);

    const response = await fetch("/api/supplier/sync", { method: "POST" });
    const payload = (await response.json()) as { error?: string; status?: string; updated?: number; stale?: number };

    if (!response.ok) {
      setSyncError(payload.error ?? "Nao foi possivel sincronizar agora.");
      return;
    }

    setSyncMessage(
      payload.status === "completed"
        ? `Sincronizacao concluida com ${payload.updated ?? 0} variacoes atualizadas.`
        : `Sincronizacao finalizada com fallback em ${payload.stale ?? 0} variacoes.`
    );

    router.refresh();
  }

  return (
    <div className="min-h-screen bg-pepper-glow text-slate-700">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 pb-24 pt-4 sm:px-5 sm:pt-5 md:pb-5 lg:px-8 lg:py-8">
        <SupplierTopNav
          unreadCount={unreadCount}
          supplierName={supplierName}
          supplierInitials={supplierInitials}
          supplierLogoUrl={supplierLogoUrl}
        />

        <header className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <SupplierIdentityHero supplierName={supplierName} supplierInitials={supplierInitials} supplierLogoUrl={supplierLogoUrl} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d47549]">Produtos monitorados</p>
                <h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-[2.65rem]">
                  Estoque, giro e reposicao reunidos no mesmo painel.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 lg:text-base">
                  Cada card mostra saldo, vendas do periodo, ultima venda e uma leitura rapida do que merece atencao.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Produtos" value={summary.productCount.toString()} tone="soft" />
              <MetricCard label="Vendas hoje" value={summary.totalSalesToday.toString()} tone="soft" />
              <MetricCard label="Vendas 7d" value={summary.totalSales7d.toString()} tone="low" />
              <MetricCard label="Criticos" value={summary.criticalCount.toString()} tone="critical" />
            </div>
          </div>

          {canViewFinancialDashboard ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="Valor total dos produtos" value={formatCurrency(summary.totalInventorySaleValue)} tone="soft" />
              <MetricCard label="Custo estimado em estoque" value={formatCurrency(summary.totalInventoryCostValue)} tone="soft" />
              <MetricCard
                label={summary.topInventoryProductName ? `Maior valor: ${summary.topInventoryProductName}` : "Maior valor em estoque"}
                value={formatCurrency(summary.topInventoryProductValue)}
                tone="low"
              />
            </div>
            ) : null}
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="Pedidos em andamento" value={summary.orderCardsInProgress.toString()} tone="soft" />
              <MetricCard label="No financeiro" value={summary.orderCardsInFinancial.toString()} tone="low" />
              <MetricCard label="Enviados" value={summary.orderCardsShipped.toString()} tone="soft" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Sugestoes de compra pendentes: {summary.replenishmentPendingCount}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Aprovadas para pedido: {summary.replenishmentApprovedCount}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Ligadas a pedido: {summary.replenishmentLinkedCount}
              </span>
            </div>
        </header>

        <section className="rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-soft backdrop-blur lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={cn(
                    "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    activeFilter === filter.value
                      ? "border-[#f5b79b] bg-[#fff1e7] text-[#a84722]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#f4c4ae] hover:text-slate-900"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-end lg:flex-1">
              <label className="flex h-[3.25rem] w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Buscar por nome ou SKU"
                />
              </label>
              <button
                type="button"
                onClick={() => startRefreshTransition(() => void handleRefresh())}
                className="inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/50 sm:w-auto"
              >
                <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Sincronizando" : "Atualizar"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {summary.topProductName ? (
              <span className="rounded-full bg-[#fff1e7] px-3 py-2 font-semibold text-[#a84722]">
                Produto campeao: {summary.topProductName}
              </span>
            ) : null}
            {summary.topColor ? (
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Cor lider: {summary.topColor}
              </span>
            ) : null}
            {summary.topSize ? (
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Tamanho lider: {summary.topSize}
              </span>
            ) : null}
            {canViewFinancialDashboard ? (
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                Valor em estoque: {formatCurrency(summary.totalInventorySaleValue)}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              Cards em andamento: {summary.orderCardsInProgress}
            </span>
            {summary.orderCardsInFinancial > 0 ? (
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                No financeiro: {summary.orderCardsInFinancial}
              </span>
            ) : null}
          </div>

          {syncMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {syncMessage}
            </div>
          ) : null}

          {syncError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {syncError}
            </div>
          ) : null}
        </section>

        {visibleProducts.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[#f3cbb7] bg-white/70 p-10 text-center shadow-soft">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2ea]">
              <PackageSearch className="h-6 w-6 text-[#d06737]" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Nenhum produto encontrado</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Ajuste a busca ou troque o filtro rapido. Assim que houver itens vinculados ao seu usuario, eles aparecem
              aqui com prioridade visual por reposicao.
            </p>
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                className="group rounded-[2rem] border border-white/70 bg-white/80 p-5 text-left shadow-soft backdrop-blur transition hover:-translate-y-1"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-slate-400">{product.supplier}</p>
                    <h3 className="text-xl font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-sm text-slate-500">{product.sku}</p>
                  </div>
                  <StatusPill band={product.band} label={product.bandLabel} />
                </div>

                  <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,#fff7f0_0%,#f4fbfb_100%)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                      <p className="text-sm text-slate-500">Saldo consolidado</p>
                      <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{product.total}</p>
                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <p>Vendas hoje: {product.salesToday}</p>
                          <p>Vendas 7d: {product.sales7d}</p>
                          <p>Vendas 30d: {product.sales30d}</p>
                          {canViewProductValues ? <p>Valor total: {formatCurrency(product.inventorySaleValue)}</p> : null}
                        </div>
                      </div>
                    <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-inner">
                      <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs font-medium text-slate-500">
                    <div className="space-y-1">
                      <span className="block">{product.lastUpdated}</span>
                      <span className="block">{product.lastSaleAt ? `Ultima venda ${product.lastSaleAt}` : "Sem venda recente"}</span>
                    </div>
                    {product.syncState === "stale" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1e7] px-3 py-1 text-[#b15529]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Dados desatualizados
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Sincronizado</span>
                    )}
                  </div>
                </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">{product.movementBadge}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                      Cobertura: {product.coverageDays === null ? "Sem base" : `${product.coverageDays} dias`}
                    </span>
                    {product.topColorLabel ? (
                      <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                        Cor lider: {product.topColorLabel}
                      </span>
                    ) : null}
                    {canViewProductValues ? (
                      <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                        Faixa: {formatPriceRange(product.priceFrom, product.priceTo)}
                      </span>
                    ) : null}
                  </div>

                  <ProductOperationalStrip
                    compact
                    replenishmentCard={product.replenishmentCard}
                    activeOrder={product.activeOrder}
                    relatedOrderCount={product.relatedOrderCount}
                  />

                <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ec6232] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] sm:w-auto">
                  <ShoppingCart className="h-4 w-4" />
                  Ver detalhes e sugerir reposicao
                </div>
              </button>
            ))}
          </section>
        )}

        {selected ? <ProductModal product={selected} onClose={() => setSelectedId(null)} canViewProductValues={canViewProductValues} /> : null}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatPriceRange(priceFrom: number | null, priceTo: number | null) {
  if (priceFrom === null && priceTo === null) return "Sem preco";
  if (priceFrom !== null && priceTo !== null && priceFrom !== priceTo) {
    return `${formatCurrency(priceFrom)} a ${formatCurrency(priceTo)}`;
  }
  return formatCurrency(priceFrom ?? priceTo ?? 0);
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "soft" | "critical" | "low";
}) {
  const tones = {
    soft: "border-white bg-white/80",
    critical: "border-rose-100 bg-rose-50",
    low: "border-amber-100 bg-amber-50"
  };

  return (
    <div className={cn("flex min-h-[6.25rem] flex-col justify-between rounded-[1.6rem] border px-4 py-3 shadow-soft", tones[tone])}>
      <p className="min-h-[2rem] text-xs font-medium leading-tight text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  canViewProductValues
}: {
  product: ProductCard;
  onClose: () => void;
  canViewProductValues: boolean;
}) {
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sizes = Array.from(new Set(product.matrix.flatMap((row) => row.items.map((item) => item.size))));

  function suggestQuantitiesWithPepperIa() {
    const suggestedQuantities = Object.fromEntries(
      product.matrix.flatMap((row) =>
        row.items.map((item) => {
          const currentStock = item.quantity ?? 0;
          const recentDemand = Math.max(item.sales30d, Math.ceil(item.sales7d * 4.3), item.salesToday * 15);
          const minimumTarget = Math.max(item.lowStockThreshold * 2, item.criticalStockThreshold + 2);
          const targetStock = Math.max(recentDemand, minimumTarget);
          const suggested = Math.max(0, targetStock - currentStock);

          return [item.sku, suggested];
        })
      )
    );

    setQuantities(suggestedQuantities);
    setError(null);
    setMessage("Pepper IA preencheu a planilha com base nas vendas dos ultimos 30 dias e no saldo atual.");
  }

  function clearSpreadsheet() {
    setQuantities({});
    setError(null);
    setMessage("Planilha limpa.");
  }

  async function submitReplenishmentRequest() {
    setError(null);
    setMessage(null);

    const variants = product.matrix.flatMap((row) =>
      row.items.map((item) => ({
        sku: item.sku,
        size: item.size,
        color: row.color,
        currentStock: item.quantity,
        requestedQuantity: quantities[item.sku] ?? 0
      }))
    );

    const response = await fetch("/api/supplier/replenishment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        supplierName: product.supplier,
        productName: product.name,
        productSku: product.sku,
        imageUrl: product.imageUrl,
        note,
        variants
      })
    });

    const payload = (await response.json()) as { error?: string; requestId?: string };

    if (!response.ok || !payload.requestId) {
      setError(payload.error ?? "Nao foi possivel enviar a solicitacao de reposicao.");
      return;
    }
    setQuantities({});
    setNote("");
    setMessage("Solicitacao enviada com sucesso. A Pepper vai analisar e aprovar a compra internamente.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="h-[calc(100vh-1rem)] w-full overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-4 shadow-panel sm:max-h-[92vh] sm:max-w-6xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Detalhamento do produto</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{product.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{product.sku}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,#fff4eb_0%,#eef8f7_100%)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Fornecedor</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{product.supplier}</p>
                  <p className="mt-3 text-sm text-slate-500">{product.lastUpdated}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="rounded-2xl bg-white/70 px-3 py-2">Vendas hoje: {product.salesToday}</div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">Vendas 7d: {product.sales7d}</div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">Vendas 30d: {product.sales30d}</div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      Cobertura: {product.coverageDays === null ? "Sem base" : `${product.coverageDays} dias`}
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      Cards vinculados: {product.relatedOrderCount}
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-2">
                      {product.activeOrder ? `Status: ${product.activeOrder.workflowStageLabel}` : "Sem card em andamento"}
                    </div>
                    {canViewProductValues ? (
                      <>
                        <div className="rounded-2xl bg-white/70 px-3 py-2">Valor total: {formatCurrency(product.inventorySaleValue)}</div>
                        <div className="rounded-2xl bg-white/70 px-3 py-2">Faixa: {formatPriceRange(product.priceFrom, product.priceTo)}</div>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/80 bg-white">
                  <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
                </div>
              </div>

              <ProductOperationalStrip
                replenishmentCard={product.replenishmentCard}
                activeOrder={product.activeOrder}
                relatedOrderCount={product.relatedOrderCount}
              />
            </div>

            <div className="overflow-hidden rounded-[1.7rem] border border-[#f4d7c7] lg:hidden">
              <div className="space-y-4 bg-[#fffaf6] p-4">
                {product.matrix.map((row) => (
                  <section key={row.color} className="rounded-[1.4rem] border border-[#f8e4d9] bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">{row.color}</h3>
                    <div className="mt-3 space-y-3">
                      {row.items.map((item) => (
                        <div key={item.sku} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.size}</p>
                              <p className="text-[11px] text-slate-500">{item.sku}</p>
                            </div>
                            <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                          </div>
                          <p
                            className={cn(
                              "mt-2 text-[11px] font-semibold",
                              item.band === "critical" && "text-rose-700",
                              item.band === "low" && "text-amber-700",
                              item.band === "ok" && "text-emerald-700",
                              item.band === "unknown" && "text-slate-500"
                            )}
                          >
                            {item.status}
                          </p>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                            <div className="rounded-xl bg-white px-2 py-2 text-center">Hoje {item.salesToday}</div>
                            <div className="rounded-xl bg-white px-2 py-2 text-center">7d {item.sales7d}</div>
                            <div className="rounded-xl bg-white px-2 py-2 text-center">30d {item.sales30d}</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={quantities[item.sku] ?? ""}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [item.sku]: Number(event.target.value || 0)
                              }))
                            }
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm outline-none"
                            placeholder="Sugerir"
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-[1.7rem] border border-[#f4d7c7] lg:block">
              <div
                className="grid bg-[#fff7f1] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                style={{ gridTemplateColumns: `1.1fr repeat(${sizes.length}, minmax(0, 1fr))` }}
              >
                <div className="px-4 py-3">Cor</div>
                {sizes.map((size) => (
                  <div key={size} className="px-4 py-3 text-center">
                    {size}
                  </div>
                ))}
              </div>

              {product.matrix.map((row) => (
                <div
                  key={row.color}
                  className="grid border-t border-[#f8e4d9] bg-white"
                  style={{ gridTemplateColumns: `1.1fr repeat(${sizes.length}, minmax(0, 1fr))` }}
                >
                  <div className="px-4 py-4 text-sm font-semibold text-slate-900">{row.color}</div>
                  {sizes.map((size) => {
                    const item = row.items.find((entry) => entry.size === size);

                    return (
                      <div key={`${row.color}-${size}`} className="px-3 py-3">
                        {item ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                            <p className="text-[11px] text-slate-500">{item.sku}</p>
                            <p
                              className={cn(
                                "mt-2 text-[11px] font-semibold",
                                item.band === "critical" && "text-rose-700",
                                item.band === "low" && "text-amber-700",
                                item.band === "ok" && "text-emerald-700",
                                item.band === "unknown" && "text-slate-500"
                              )}
                            >
                              {item.status}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              critico {item.criticalStockThreshold} | baixo {item.lowStockThreshold}
                            </p>
                            <div className="mt-2 text-[11px] text-slate-500">
                              <p>Hoje: {item.salesToday}</p>
                              <p>7d: {item.sales7d}</p>
                              <p>30d: {item.sales30d}</p>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={quantities[item.sku] ?? ""}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.sku]: Number(event.target.value || 0)
                                }))
                              }
                              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm outline-none"
                              placeholder="Sugerir"
                            />
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-300">
                            -
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.7rem] border border-[#f0d2c0] bg-[#fffaf7] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Solicitacao de reposicao</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Preencha as quantidades por cor e tamanho e envie a sugestao para a Pepper aprovar a compra.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={suggestQuantitiesWithPepperIa}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Sugerir com Pepper IA
                </button>
                <button
                  type="button"
                  onClick={clearSpreadsheet}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                >
                  Limpar planilha
                </button>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Ex.: sugerir reposicao da vitrine e reforco do tamanho M."
                />
              </label>

              {message ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => startSubmitting(() => void submitReplenishmentRequest())}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ec6232] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] sm:w-auto"
              >
                <ShoppingCart className="h-4 w-4" />
                {isSubmitting ? "Enviando..." : "Enviar para aprovacao"}
              </button>
            </div>

            <div className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Leitura do fluxo operacional</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Badge principal: {product.movementBadge}.</li>
                <li>{product.lastSaleAt ? `Ultima venda em ${product.lastSaleAt}.` : "Sem venda recente registrada."}</li>
                <li>{product.topColorLabel ? `Cor com maior giro: ${product.topColorLabel}.` : "Sem cor lider definida."}</li>
                <li>{product.topSizeLabel ? `Tamanho com maior giro: ${product.topSizeLabel}.` : "Sem tamanho lider definido."}</li>
                {product.replenishmentCard ? (
                  <li>
                    Sugestao de compra: {product.replenishmentCard.statusLabel}
                    {product.replenishmentCard.linkedOrderNumber ? ` e ligada ao pedido ${product.replenishmentCard.linkedOrderNumber}.` : "."}
                  </li>
                ) : (
                  <li>Este produto ainda nao abriu sugestao de compra recente.</li>
                )}
                <li>
                  {product.activeOrder
                    ? `Card operacional atual: ${product.activeOrder.orderNumber} em ${product.activeOrder.workflowStageLabel}.`
                    : "Nenhum card operacional em andamento para este produto."}
                </li>
                {product.activeOrder?.financialStatusLabel ? (
                  <li>Financeiro vinculado: {product.activeOrder.financialStatusLabel}.</li>
                ) : null}
                <li>
                  Proximo passo:{" "}
                  {product.activeOrder
                    ? product.activeOrder.financialStatusLabel
                      ? `acompanhar ${product.activeOrder.financialStatusLabel.toLowerCase()} no financeiro ou seguir para envio.`
                      : product.activeOrder.workflowStageLabel.toLowerCase()
                    : product.replenishmentCard
                      ? product.replenishmentCard.nextStepLabel.toLowerCase()
                      : "acompanhar vendas e abrir reposicao quando o giro pedir."}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

