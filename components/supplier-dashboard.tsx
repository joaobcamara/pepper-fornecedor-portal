"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, PackageSearch, RefreshCcw, Search, ShoppingCart } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/cn";
import type { StockBand } from "@/lib/stock";

type MatrixItem = {
  sku: string;
  size: string;
  colorLabel: string;
  quantity: number | null;
  status: string;
};

type DashboardCard = {
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
  matrix: Array<{
    color: string;
    items: MatrixItem[];
  }>;
};

const filters = [
  { label: "Todos", value: "all" },
  { label: "Críticos", value: "critical" },
  { label: "Baixos", value: "low" },
  { label: "OK", value: "ok" }
] as const;

type Filter = (typeof filters)[number]["value"];

export function SupplierDashboard({ products }: { products: DashboardCard[] }) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const text = `${product.name} ${product.sku}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesFilter = activeFilter === "all" ? true : product.band === activeFilter;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, products, query]);

  const selected = visibleProducts.find((product) => product.id === selectedId) ?? visibleProducts[0] ?? null;
  const criticalCount = products.filter((product) => product.band === "critical").length;
  const lowCount = products.filter((product) => product.band === "low").length;

  return (
    <div className="min-h-screen bg-pepper-glow text-slate-700">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-5 lg:px-8 lg:py-8">
        <header className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <LogoMark />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d47549]">Dashboard de estoque</p>
                <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 lg:text-[2.65rem]">
                  Estoque em tempo real com leitura clara, rápida e pronta para reposição.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 lg:text-base">
                  Veja apenas os produtos da sua operação, destaque os itens críticos e abra o detalhamento em grade
                  por cor e tamanho com um clique.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Produtos" value={products.length.toString()} tone="soft" />
              <MetricCard label="Críticos" value={criticalCount.toString()} tone="critical" />
              <MetricCard label="Baixos" value={lowCount.toString()} tone="low" />
              <MetricCard label="Última sincronização" value="Agora" tone="soft" />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <section className="space-y-5">
            <div className="rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-soft backdrop-blur lg:p-5">
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

                <div className="flex flex-1 items-center justify-end gap-3">
                  <label className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Atualizar
                  </button>
                </div>
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[#f3cbb7] bg-white/70 p-10 text-center shadow-soft">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2ea]">
                  <PackageSearch className="h-6 w-6 text-[#d06737]" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Nenhum produto encontrado</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Ajuste a busca ou troque o filtro rápido. Assim que houver itens vinculados ao seu usuário, eles
                  aparecem aqui com prioridade visual por reposição.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    className={cn(
                      "group rounded-[2rem] border bg-white/80 p-5 text-left shadow-soft backdrop-blur transition hover:-translate-y-1",
                      selected?.id === product.id ? "border-[#f0b290] ring-2 ring-[#ffd9c4]" : "border-white/70"
                    )}
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
                        </div>
                        <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-inner">
                          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>{product.lastUpdated}</span>
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

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#b4582d]">Abrir grade detalhada</span>
                      <ChevronRight className="h-4 w-4 text-[#b4582d]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur lg:p-6">
            {selected ? (
              <DetailModalContent product={selected} />
            ) : (
              <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-[#fff1e8] p-4">
                  <ShoppingCart className="h-6 w-6 text-[#b4552b]" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Selecione um produto</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Ao abrir um card, exibimos a grade por cor e tamanho e deixamos a ordem de compra pronta para o
                  próximo passo.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
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
    <div className={cn("min-w-[10rem] rounded-[1.6rem] border px-4 py-3 shadow-soft", tones[tone])}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function DetailModalContent({ product }: { product: DashboardCard }) {
  const sizes = Array.from(new Set(product.matrix.flatMap((row) => row.items.map((item) => item.size))));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d27a4f]">Detalhamento do produto</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{product.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{product.sku}</p>
        </div>
        <StatusPill band={product.band} label={product.bandLabel} />
      </div>

      <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,#fff4eb_0%,#eef8f7_100%)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Fornecedor</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{product.supplier}</p>
          </div>
          <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/80 bg-white">
            <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.7rem] border border-[#f4d7c7]">
        <div className="grid grid-cols-[1.1fr_repeat(3,0.9fr)] bg-[#fff7f1] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <div className="px-4 py-3">Cor</div>
          {sizes.map((size) => (
            <div key={size} className="px-4 py-3 text-center">
              {size}
            </div>
          ))}
        </div>
        {product.matrix.map((row) => (
          <div key={row.color} className="grid grid-cols-[1.1fr_repeat(3,0.9fr)] border-t border-[#f8e4d9] bg-white">
            <div className="px-4 py-4 text-sm font-semibold text-slate-900">{row.color}</div>
            {sizes.map((size) => {
              const item = row.items.find((entry) => entry.size === size);
              return (
                <div key={`${row.color}-${size}`} className="px-3 py-3">
                  {item ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                      <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                      <p className="text-[11px] text-slate-500">{item.sku}</p>
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

      <div className="rounded-[1.7rem] border border-[#f0d2c0] bg-[#fffaf7] p-4">
        <h3 className="text-sm font-semibold text-slate-900">Ordem de compra</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Na próxima etapa, este bloco gera o HTML com a grade cor x tamanho para envio. A base visual já está pronta
          para conectarmos ao fluxo definitivo do Tiny e à emissão do arquivo.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#ec6232] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391]"
        >
          <ShoppingCart className="h-4 w-4" />
          Gerar ordem de compra
        </button>
      </div>
    </div>
  );
}
