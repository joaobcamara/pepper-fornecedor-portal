"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Bot, ChevronRight, Clock3, Layers3, ShieldAlert, Sparkles } from "lucide-react";

type StockBand = "critical" | "low" | "ok" | "unknown";

type StockDashboardProduct = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
  supplierName: string;
  variantCount: number;
  totalStock: number;
  totalEstimatedCost: number;
  band: StockBand;
  bandLabel: string;
  coverageDays: number | null;
  movementBadge: string;
  staleCount: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  topColorLabel: string | null;
  topSizeLabel: string | null;
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

function StockProductRow({ product }: { product: StockDashboardProduct }) {
  return (
    <article className="rounded-[1.6rem] border border-slate-100 bg-white/85 p-4 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-16 w-16 overflow-hidden rounded-[1.2rem] border border-slate-100 bg-slate-50">
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="64px" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {product.sku} • {product.supplierName}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${bandTone(product.band)}`}>{product.bandLabel}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{product.movementBadge}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estoque</p>
              <p className="mt-1 font-semibold text-slate-900">{product.totalStock}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cobertura</p>
              <p className="mt-1 font-semibold text-slate-900">{formatCoverageDays(product.coverageDays)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Variações</p>
              <p className="mt-1 font-semibold text-slate-900">{product.variantCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Valor estimado</p>
              <p className="mt-1 font-semibold text-slate-900">{formatCurrency(product.totalEstimatedCost)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Hoje {product.salesToday}</span>
              <span>7 dias {product.sales7d}</span>
              <span>30 dias {product.sales30d}</span>
              {product.topColorLabel ? <span>Cor foco {product.topColorLabel}</span> : null}
              {product.topSizeLabel ? <span>Tamanho foco {product.topSizeLabel}</span> : null}
              {product.staleCount > 0 ? <span className="font-semibold text-violet-700">{product.staleCount} variacoes stale</span> : null}
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Link
                href={buildAdminProductHref(product.sku)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900 sm:flex-none"
              >
                Abrir produto
              </Link>
              <Link
                href="/admin/pepperia"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#f3d0bd] bg-[#fff5ef] px-3 py-2 text-xs font-semibold text-[#a94b25] transition hover:bg-[#fff0e6] sm:flex-none"
              >
                <Bot className="h-3.5 w-3.5" />
                Sugestão IA
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StockListSection({
  title,
  description,
  products,
  emptyLabel
}: {
  title: string;
  description: string;
  products: StockDashboardProduct[];
  emptyLabel: string;
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

      <div className="mt-5 space-y-4">
        {products.length > 0 ? products.map((product) => <StockProductRow key={product.id} product={product} />) : <EmptyState label={emptyLabel} />}
      </div>
    </section>
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

  const topToday = useMemo(
    () => [...filteredProducts].sort((a, b) => b.salesToday - a.salesToday || a.totalStock - b.totalStock).slice(0, 10),
    [filteredProducts]
  );
  const topWeek = useMemo(
    () => [...filteredProducts].sort((a, b) => b.sales7d - a.sales7d || a.totalStock - b.totalStock).slice(0, 10),
    [filteredProducts]
  );
  const topMonth = useMemo(
    () => [...filteredProducts].sort((a, b) => b.sales30d - a.sales30d || a.totalStock - b.totalStock).slice(0, 10),
    [filteredProducts]
  );
  const criticalProducts = sortedByUrgency.filter((product) => product.band === "critical" || product.band === "low").slice(0, 12);
  const staleProducts = [...filteredProducts].sort((a, b) => b.staleCount - a.staleCount || a.totalStock - b.totalStock).filter((product) => product.staleCount > 0).slice(0, 12);

  const summaryCards = [
    { label: "Produtos monitorados", value: filteredSummary.productCount, tone: summaryTone("product"), icon: Boxes },
    { label: "Variacoes monitoradas", value: filteredSummary.variantCount, tone: summaryTone("stock"), icon: Layers3 },
    { label: "Estoque consolidado", value: filteredSummary.totalStock, tone: summaryTone("stock"), icon: Boxes },
    { label: "Ruptura critica", value: filteredSummary.criticalCount, tone: summaryTone("critical"), icon: ShieldAlert },
    { label: "Atenção baixa", value: filteredSummary.lowCount, tone: summaryTone("low"), icon: AlertTriangle },
    { label: "Sincronizacao stale", value: filteredSummary.staleCount, tone: summaryTone("stale"), icon: Clock3 }
  ];

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
                { key: "critical", label: "Criticos" },
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

        <p className="mt-4 text-sm text-slate-500">
          Leitura instantânea: se o produto já está no portal, este painel consome só a fundação. Tiny fica só para cadastro sob demanda e reconciliação pontual.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Leitura central de estoque</h2>
              <p className="text-sm text-slate-500">
                Este painel olha somente para estoque da fundação. Produto já cadastrado abre pelo Supabase, sem depender de Tiny em tempo de tela.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.4rem] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c75f2d]">Valor em estoque</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(filteredSummary.totalEstimatedCost)}</p>
              <p className="mt-2 text-sm text-slate-500">Estimativa consolidada pelo custo atual das variacoes na fundação.</p>
            </div>
            <div className="rounded-[1.4rem] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c75f2d]">Ação rápida</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/admin/produtos"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900 sm:w-auto"
                >
                  Revisar cards
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admin/sincronizacoes"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900 sm:w-auto"
                >
                  Sincronizacoes
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-3 text-sm text-slate-500">Aqui entra só saúde do estoque. Pedido, financeiro e fluxo operacional continuam nos módulos próprios.</p>
            </div>
          </div>
        </section>

        <StockListSection
          title="Estoque critico"
          description="Itens que precisam de atenção imediata pela combinação de saldo, cobertura e criticidade configurada."
          products={criticalProducts}
          emptyLabel="Nenhum produto ficou em faixa critica nesta leitura."
        />
      </section>

      <StockListSection
        title="Top 10 do dia"
        description="Produtos que mais giraram hoje e merecem acompanhamento de reposição e cobertura."
        products={topToday}
        emptyLabel="Ainda nao ha giro suficiente hoje para montar o top 10."
      />

      <StockListSection
        title="Top 10 da semana"
        description="Visao dos produtos que mais drenaram estoque nos ultimos 7 dias."
        products={topWeek}
        emptyLabel="Ainda nao ha giro suficiente na semana para montar o top 10."
      />

      <StockListSection
        title="Top 10 do mes"
        description="Leitura principal de estoque com base no giro de 30 dias da fundação."
        products={topMonth}
        emptyLabel="Assim que as metricas crescerem, o top 10 do mes aparece aqui."
      />

      <StockListSection
        title="Sincronizacao pendente"
        description="Itens com variacoes stale ou dependentes de revisao de conciliação na fundação."
        products={staleProducts}
        emptyLabel="Nenhum produto ficou stale nesta leitura."
      />
    </div>
  );
}
