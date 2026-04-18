"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Boxes, Clock3, Layers3, ShieldAlert, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { suggestPurchaseQuantity, summarizePurchaseSuggestions } from "@/lib/reorder-advisor";
import { safeCoverageDays, type SalesPeriodTotals } from "@/lib/sales-metrics";

type StockBand = "critical" | "low" | "ok" | "unknown";

type StockDashboardVariant = {
  id: string;
  sku: string;
  sizeCode: string | null;
  sizeLabel: string;
  colorCode: string | null;
  colorLabel: string;
  quantity: number | null;
  reservedStock?: number | null;
  band: StockBand;
  sales: SalesPeriodTotals;
  sales15d: number;
  unitCost: number | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  effectiveCriticalStockThreshold: number;
  effectiveLowStockThreshold: number;
};

type StockDashboardProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  supplierName: string;
  variantCount: number;
  totalStock: number;
  totalReservedStock?: number;
  totalEstimatedCost: number;
  band: StockBand;
  bandLabel: string;
  coverageDays: number | null;
  movementBadge: string;
  staleCount: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  updatedAt: string;
  relatedOrderCount: number;
  topColorLabel: string | null;
  topSizeLabel: string | null;
  sales: SalesPeriodTotals;
  variants: StockDashboardVariant[];
};

type StockDashboardSummary = {
  productCount: number;
  variantCount: number;
  totalStock: number;
  totalEstimatedCost: number;
  criticalCount: number;
  lowCount: number;
  staleCount: number;
};

type ModalMode = "overview" | "suggestion";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCoverageDays(value: number | null) {
  if (value === null) {
    return "Sem base";
  }

  if (value === 0) {
    return "0 dia";
  }

  return `${value.toFixed(1).replace(".", ",")} dias`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sem horario";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildAdminProductHref(sku: string) {
  const encodedSku = encodeURIComponent(sku);
  return `/admin/produtos?sku=${encodedSku}&open=${encodedSku}`;
}

function bandTone(band: StockBand) {
  if (band === "critical") return "bg-rose-100 text-rose-700";
  if (band === "low") return "bg-amber-100 text-amber-700";
  if (band === "ok") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

function summaryTone(kind: "stock" | "critical" | "low" | "stale" | "money" | "product") {
  if (kind === "stock") return "border-sky-100 bg-sky-50";
  if (kind === "critical") return "border-rose-100 bg-rose-50";
  if (kind === "low") return "border-amber-100 bg-amber-50";
  if (kind === "stale") return "border-violet-100 bg-violet-50";
  if (kind === "money") return "border-emerald-100 bg-emerald-50";
  return "border-slate-200 bg-white";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
      {label}
    </div>
  );
}

function StockProductImage({
  imageUrl,
  alt,
  size = "card"
}: {
  imageUrl: string;
  alt: string;
  size?: "card" | "hero";
}) {
  const [failed, setFailed] = useState(false);
  const resolvedImage = !failed && imageUrl ? imageUrl : "/brand/pepper-logo.png";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.6rem] border border-white/80 bg-white shadow-inner",
        size === "hero" ? "h-28 w-28 sm:h-36 sm:w-36" : "h-20 w-20"
      )}
    >
      <img
        src={resolvedImage}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("h-full w-full", resolvedImage === "/brand/pepper-logo.png" ? "object-contain p-3" : "object-cover")}
      />
    </div>
  );
}

function buildVariationSuggestion(variant: StockDashboardVariant) {
  return suggestPurchaseQuantity({
    currentStock: variant.quantity,
    sales1d: variant.sales["1d"],
    sales7d: variant.sales["7d"],
    sales15d: variant.sales15d,
    sales30d: variant.sales["1m"],
    criticalStockThreshold: variant.effectiveCriticalStockThreshold,
    lowStockThreshold: variant.effectiveLowStockThreshold
  });
}

function VariationDetailCard({ variant }: { variant: StockDashboardVariant }) {
  const suggestion = buildVariationSuggestion(variant);
  const variationCoverage = safeCoverageDays(Math.max(0, variant.quantity ?? 0), variant.sales["1m"]);

  return (
    <article className="rounded-[1.45rem] border border-slate-100 bg-white/90 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {variant.colorLabel}
            {variant.sizeLabel !== "Único" ? ` • ${variant.sizeLabel}` : ""}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500">{variant.sku}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bandTone(variant.band)}`}>
          {variant.quantity ?? "—"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Cobertura</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatCoverageDays(variationCoverage)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Reservado</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{variant.reservedStock ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Sugestão</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{suggestion.suggestedQuantity}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">15 dias</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{variant.sales15d}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">7 dias</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{variant.sales["7d"]}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">30 dias</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{variant.sales["1m"]}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Faixa</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {variant.effectiveCriticalStockThreshold} / {variant.effectiveLowStockThreshold}
          </p>
        </div>
      </div>
    </article>
  );
}

function StockProductCard({
  product,
  onOpen
}: {
  product: StockDashboardProduct;
  onOpen: (product: StockDashboardProduct, mode: ModalMode) => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product, "overview")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(product, "overview");
        }
      }}
      className="rounded-[1.7rem] border border-slate-100 bg-white/90 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-[#f3cfba] hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <StockProductImage imageUrl={product.imageUrl} alt={product.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-base font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {product.sku} • {product.supplierName}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bandTone(product.band)}`}>
              {product.bandLabel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estoque</p>
              <p className="mt-1 font-semibold text-slate-900">{product.totalStock}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reservado</p>
              <p className="mt-1 font-semibold text-slate-900">{product.totalReservedStock ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cobertura</p>
              <p className="mt-1 font-semibold text-slate-900">{formatCoverageDays(product.coverageDays)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Atualizado</p>
              <p className="mt-1 font-semibold text-slate-900">{formatUpdatedAt(product.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{product.movementBadge}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Hoje {product.salesToday}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">7 dias {product.sales7d}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">30 dias {product.sales30d}</span>
        {product.staleCount > 0 ? (
          <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">{product.staleCount} stale</span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(product, "overview");
          }}
          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900"
        >
          Gerenciar pedido
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(product, "suggestion");
          }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#f3d0bd] bg-[#fff5ef] px-3 py-2 text-sm font-semibold text-[#a94b25] transition hover:bg-[#fff0e6]"
        >
          <Bot className="h-4 w-4" />
          Sugestão IA
        </button>
      </div>
    </article>
  );
}

function StockGridSection({
  title,
  description,
  products,
  emptyLabel,
  onOpen
}: {
  title: string;
  description: string;
  products: StockDashboardProduct[];
  emptyLabel: string;
  onOpen: (product: StockDashboardProduct, mode: ModalMode) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{products.length}</span>
      </div>

      <div className="mt-5">
        {products.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <StockProductCard key={product.id} product={product} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <EmptyState label={emptyLabel} />
        )}
      </div>
    </section>
  );
}

function StockManagementModal({
  product,
  mode,
  onClose
}: {
  product: StockDashboardProduct;
  mode: ModalMode;
  onClose: () => void;
}) {
  const suggestionResults = useMemo(() => product.variants.map((variant) => buildVariationSuggestion(variant)), [product.variants]);
  const suggestionSummary = useMemo(() => summarizePurchaseSuggestions(suggestionResults), [suggestionResults]);
  const suggestedTotal = useMemo(
    () => suggestionResults.reduce((total, suggestion) => total + suggestion.suggestedQuantity, 0),
    [suggestionResults]
  );
  const sortedVariants = useMemo(() => {
    const bandScore: Record<StockBand, number> = { critical: 0, low: 1, ok: 2, unknown: 3 };

    return [...product.variants].sort((a, b) => {
      const bandDiff = bandScore[a.band] - bandScore[b.band];
      if (bandDiff !== 0) return bandDiff;

      if (a.colorLabel !== b.colorLabel) {
        return a.colorLabel.localeCompare(b.colorLabel);
      }

      return a.sizeLabel.localeCompare(b.sizeLabel);
    });
  }, [product.variants]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-3 py-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[min(96vw,1400px)] overflow-y-auto rounded-[2rem] border border-white/70 bg-[#fffaf6] p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <StockProductImage imageUrl={product.imageUrl} alt={product.name} size="hero" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d27a4f]">Gestão de pedido do estoque</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{product.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {product.sku} • {product.supplierName} • {product.variantCount} variações
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${bandTone(product.band)}`}>{product.bandLabel}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{product.movementBadge}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Atualizado {formatUpdatedAt(product.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={buildAdminProductHref(product.sku)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900"
            >
              Abrir gestor completo
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-[#f3b89a] hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Estoque total", value: product.totalStock },
            { label: "Reservado", value: product.totalReservedStock ?? 0 },
            { label: "Cobertura", value: formatCoverageDays(product.coverageDays) },
            { label: "Vendas 7d", value: product.sales7d },
            { label: "Vendas 30d", value: product.sales30d },
            { label: "Pedidos ligados", value: product.relatedOrderCount }
          ].map((item) => (
            <div key={item.label} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <section
            className={cn(
              "rounded-[1.7rem] border p-5 shadow-soft",
              mode === "suggestion" || suggestionSummary.tone === "success"
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-amber-200 bg-amber-50/80"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c75f2d]">Pepper IA</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{suggestionSummary.confidenceLabel}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{suggestionSummary.appliedMessage}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-900">Leitura por família</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cor foco</p>
                <p className="mt-1 font-semibold text-slate-900">{product.topColorLabel ?? "Sem foco"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tamanho foco</p>
                <p className="mt-1 font-semibold text-slate-900">{product.topSizeLabel ?? "Sem foco"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Variações stale</p>
                <p className="mt-1 font-semibold text-slate-900">{product.staleCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pedido sugerido</p>
                <p className="mt-1 font-semibold text-slate-900">{suggestedTotal}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[1.8rem] border border-[#f1d6c6] bg-white/90 p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Cobertura detalhada por variação</h3>
              <p className="mt-2 text-sm text-slate-500">
                Aqui o estoque já vira leitura de pedido, com cobertura, ritmo e sugestão por variação antes de abrir o gestor completo.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{sortedVariants.length} cards</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sortedVariants.map((variant) => (
              <VariationDetailCard key={variant.id} variant={variant} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminStockDashboard({
  summary,
  products
}: {
  summary: StockDashboardSummary;
  products: StockDashboardProduct[];
}) {
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState<"all" | "critical" | "stale" | "high-giro">("all");
  const [selectedProduct, setSelectedProduct] = useState<StockDashboardProduct | null>(null);
  const [selectedMode, setSelectedMode] = useState<ModalMode>("overview");

  const supplierOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.supplierName))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery);
      const matchesSupplier = supplierFilter === "all" || product.supplierName === supplierFilter;
      const matchesFocus =
        focusFilter === "all"
          ? true
          : focusFilter === "critical"
            ? product.band === "critical" || product.band === "low"
            : focusFilter === "stale"
              ? product.staleCount > 0
              : product.sales7d > 0 || product.sales30d > 0;

      return matchesQuery && matchesSupplier && matchesFocus;
    });
  }, [focusFilter, products, query, supplierFilter]);

  const filteredSummary = useMemo(
    () => ({
      productCount: filteredProducts.length,
      variantCount: filteredProducts.reduce((total, product) => total + product.variantCount, 0),
      totalStock: filteredProducts.reduce((total, product) => total + product.totalStock, 0),
      totalEstimatedCost: filteredProducts.reduce((total, product) => total + product.totalEstimatedCost, 0),
      criticalCount: filteredProducts.filter((product) => product.band === "critical").length,
      lowCount: filteredProducts.filter((product) => product.band === "low").length,
      staleCount: filteredProducts.filter((product) => product.staleCount > 0).length
    }),
    [filteredProducts]
  );

  const averageCoverage = useMemo(() => {
    const values = filteredProducts.map((product) => product.coverageDays).filter((value): value is number => value !== null);
    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [filteredProducts]);

  const sortedByUrgency = useMemo(() => {
    const bandScore = { critical: 0, low: 1, ok: 2, unknown: 3 } as const;

    return [...filteredProducts].sort((a, b) => {
      const bandDiff = bandScore[a.band] - bandScore[b.band];
      if (bandDiff !== 0) return bandDiff;

      const staleDiff = b.staleCount - a.staleCount;
      if (staleDiff !== 0) return staleDiff;

      return a.totalStock - b.totalStock;
    });
  }, [filteredProducts]);

  const topWeek = useMemo(
    () => [...filteredProducts].sort((a, b) => b.sales7d - a.sales7d || a.totalStock - b.totalStock).slice(0, 12),
    [filteredProducts]
  );
  const topMonth = useMemo(
    () => [...filteredProducts].sort((a, b) => b.sales30d - a.sales30d || a.totalStock - b.totalStock).slice(0, 12),
    [filteredProducts]
  );
  const criticalProducts = sortedByUrgency.filter((product) => product.band === "critical" || product.band === "low").slice(0, 12);
  const staleProducts = [...filteredProducts]
    .sort((a, b) => b.staleCount - a.staleCount || a.totalStock - b.totalStock)
    .filter((product) => product.staleCount > 0)
    .slice(0, 12);

  const summaryCards = [
    { label: "Produtos monitorados", value: filteredSummary.productCount, tone: summaryTone("product"), icon: Boxes },
    { label: "Variações monitoradas", value: filteredSummary.variantCount, tone: summaryTone("stock"), icon: Layers3 },
    { label: "Estoque consolidado", value: filteredSummary.totalStock, tone: summaryTone("stock"), icon: Boxes },
    { label: "Ruptura crítica", value: filteredSummary.criticalCount, tone: summaryTone("critical"), icon: ShieldAlert },
    { label: "Atenção baixa", value: filteredSummary.lowCount, tone: summaryTone("low"), icon: AlertTriangle },
    { label: "Sincronização stale", value: filteredSummary.staleCount, tone: summaryTone("stale"), icon: Clock3 }
  ];

  function openProduct(product: StockDashboardProduct, mode: ModalMode) {
    setSelectedProduct(product);
    setSelectedMode(mode);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar por SKU ou nome</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: 01-1041"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="all">Todos</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-700">Foco</span>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "Tudo" },
                { key: "critical", label: "Críticos" },
                { key: "stale", label: "Stale" },
                { key: "high-giro", label: "Alto giro" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFocusFilter(item.key as typeof focusFilter)}
                  className={
                    focusFilter === item.key
                      ? "rounded-2xl border border-[#f3b89a] bg-[#fff1e7] px-4 py-3 text-sm font-semibold text-[#a94b25]"
                      : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label} className={`rounded-[1.7rem] border p-5 shadow-soft ${card.tone}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl bg-white/90 p-3 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">{card.label}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-soft xl:flex-[1.4]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#fff3eb] p-3 text-[#c75f2d]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Leitura central de estoque</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Este painel agora abre os produtos direto em modal de gestão de pedido. A leitura continua vindo só da fundação, sem depender do Tiny em tempo de tela.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:flex-[1.2]">
            <div className="rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c75f2d]">Valor em estoque</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(filteredSummary.totalEstimatedCost)}</p>
              <p className="mt-2 text-sm text-slate-500">Base consolidada pelo custo atual confiável da fundação.</p>
            </div>
            <div className="rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c75f2d]">Cobertura média</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCoverageDays(averageCoverage)}</p>
              <p className="mt-2 text-sm text-slate-500">Leitura resumida dos produtos filtrados no momento.</p>
            </div>
            <div className="rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c75f2d]">Ação rápida</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/admin/sincronizacoes"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900"
                >
                  Sincronizações
                </Link>
                <Link
                  href="/admin/produtos"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900"
                >
                  Produtos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StockGridSection
        title="Estoque crítico"
        description="Cards de ação rápida para decidir cobertura, sugestão e abertura do gestor completo."
        products={criticalProducts}
        emptyLabel="Nenhum produto ficou em faixa crítica nesta leitura."
        onOpen={openProduct}
      />

      <StockGridSection
        title="Maior giro em 7 dias"
        description="Produtos que aceleraram no curto prazo e merecem atenção de pedido."
        products={topWeek}
        emptyLabel="Ainda não há giro suficiente na semana para montar esta leitura."
        onOpen={openProduct}
      />

      <StockGridSection
        title="Maior giro em 30 dias"
        description="Leitura base de cobertura e pressão de reposição olhando o mês consolidado."
        products={topMonth}
        emptyLabel="Assim que as métricas crescerem, o top do mês aparece aqui."
        onOpen={openProduct}
      />

      <StockGridSection
        title="Sincronização pendente"
        description="Produtos com variações stale que ainda merecem acompanhamento de conciliação."
        products={staleProducts}
        emptyLabel="Nenhum produto ficou stale nesta leitura."
        onOpen={openProduct}
      />

      {selectedProduct ? (
        <StockManagementModal product={selectedProduct} mode={selectedMode} onClose={() => setSelectedProduct(null)} />
      ) : null}
    </div>
  );
}
