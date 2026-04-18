"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackageSearch, RefreshCcw, Search, ShoppingCart, X } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { StatusPill } from "@/components/status-pill";
import { SupplierTopNav } from "@/components/supplier-top-nav";
import { cn } from "@/lib/cn";
import type { StockBand } from "@/lib/stock";

type MatrixItem = {
  sku: string;
  size: string;
  colorLabel: string;
  quantity: number | null;
  status: string;
  band: StockBand;
  criticalStockThreshold: number;
  lowStockThreshold: number;
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
  { label: "Criticos", value: "critical" },
  { label: "Baixos", value: "low" },
  { label: "OK", value: "ok" }
] as const;

type Filter = (typeof filters)[number]["value"];

export function SupplierDashboardV2({ products, unreadCount = 0 }: { products: DashboardCard[]; unreadCount?: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const text = `${product.name} ${product.sku}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesFilter = activeFilter === "all" ? true : product.band === activeFilter;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, products, query]);

  const selected = visibleProducts.find((product) => product.id === selectedId) ?? null;
  const criticalCount = products.filter((product) => product.band === "critical").length;
  const lowCount = products.filter((product) => product.band === "low").length;
  const staleCount = products.filter((product) => product.syncState === "stale").length;

  async function handleRefresh() {
    setSyncMessage(null);
    setSyncError(null);
    setIsRefreshing(true);

    try {
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
    } catch (requestError) {
      setSyncError(requestError instanceof Error ? requestError.message : "Nao foi possivel sincronizar agora.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-pepper-glow text-slate-700">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-5 py-5 lg:px-8 lg:py-8">
        <SupplierTopNav unreadCount={unreadCount} />

        <header className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <LogoMark />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d47549]">Dashboard de estoque</p>
                <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 lg:text-[2.65rem]">
                  Estoque com leitura rapida, status visual e ordem de compra pronta para emissao.
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 lg:text-base">
                  O painel sincroniza o estoque das suas variacoes no acesso, mantem fallback quando o Tiny falha e
                  deixa a grade cor x tamanho pronta para acao.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Produtos" value={products.length.toString()} tone="soft" />
              <MetricCard label="Criticos" value={criticalCount.toString()} tone="critical" />
              <MetricCard label="Baixos" value={lowCount.toString()} tone="low" />
              <MetricCard label="Desatualizados" value={staleCount.toString()} tone="soft" />
            </div>
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
                disabled={isRefreshing}
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Sincronizando" : "Atualizar"}
              </button>
            </div>
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

                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#ec6232] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391]">
                  <ShoppingCart className="h-4 w-4" />
                  Ver detalhes e sugerir reposicao
                </div>
              </button>
            ))}
          </section>
        )}

        {selected ? <ProductModal product={selected} onClose={() => setSelectedId(null)} /> : null}
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

function ProductModal({ product, onClose }: { product: DashboardCard; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sizes = Array.from(new Set(product.matrix.flatMap((row) => row.items.map((item) => item.size))));

  async function submitReplenishmentRequest() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar a solicitacao de reposicao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
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
                </div>
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/80 bg-white">
                  <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.7rem] border border-[#f4d7c7]">
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
                              critico {item.criticalStockThreshold} • baixo {item.lowStockThreshold}
                            </p>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Solicitacao de reposicao</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Preencha as quantidades por cor e tamanho e envie a sugestao para a Pepper aprovar a compra.
                  </p>
                </div>
                <StatusPill band={product.band} label={product.bandLabel} />
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
                disabled={isSubmitting}
                onClick={() => void submitReplenishmentRequest()}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#ec6232] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {isSubmitting ? "Enviando..." : "Enviar para aprovacao"}
              </button>
            </div>

            <div className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Como funciona a aprovacao</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Imagem embutida em base64 para nao quebrar fora do sistema.</li>
                <li>Linhas so com os SKUs que receberam quantidade pedida.</li>
                <li>Estoque atual exibido junto com a quantidade solicitada.</li>
                <li>HTML pronto para encaminhar no seu fluxo operacional.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

