"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, LoaderCircle, Search, X } from "lucide-react";
import { ProductOperationalStrip } from "@/components/product-operational-strip";
import { cn } from "@/lib/cn";
import { DEFAULT_STOCK_THRESHOLDS, getStockBand, getStockBandLabel } from "@/lib/stock";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type VariantRow = {
  id: string;
  sku: string;
  sizeCode: string | null;
  sizeLabel: string;
  colorCode: string | null;
  colorLabel: string;
  quantity: number | null;
  band: "critical" | "low" | "ok" | "unknown";
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  effectiveCriticalStockThreshold: number;
  effectiveLowStockThreshold: number;
};

type ProductGroup = {
  id: string;
  parentSku: string;
  internalName: string;
  imageUrl: string;
  active: boolean;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  variantCount: number;
  totalStock: number;
  staleCount: number;
  supplierIds: string[];
  suppliers: Array<{
    id: string;
    name: string;
  }>;
  updatedAt: string;
  relatedOrderCount: number;
  replenishmentCard: {
    requestId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    statusLabel: string;
    linkedOrderNumber: string | null;
    linkedFinancialStatusLabel: string | null;
    nextStepLabel: string;
    supplierName: string;
  } | null;
  activeOrder: {
    orderId: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    financialStatusLabel: string | null;
    supplierName: string;
    originLabel: string;
  } | null;
  variants: VariantRow[];
};

type GroupDraft = {
  internalName: string;
  active: boolean;
  supplierIds: string[];
  criticalStockThreshold: string;
  lowStockThreshold: string;
  variants: Record<
    string,
    {
      criticalStockThreshold: string;
      lowStockThreshold: string;
    }
  >;
};

function toInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function toNullableNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  return Number(value);
}

export function AdminProductThresholdManager({
  suppliers,
  productGroups
}: {
  suppliers: SupplierOption[];
  productGroups: ProductGroup[];
}) {
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>(() =>
    Object.fromEntries(
      productGroups.map((group) => [
        group.parentSku,
        {
          internalName: group.internalName,
          active: group.active,
          supplierIds: group.supplierIds,
          criticalStockThreshold: toInputValue(group.criticalStockThreshold),
          lowStockThreshold: toInputValue(group.lowStockThreshold),
          variants: Object.fromEntries(
            group.variants.map((variant) => [
              variant.sku,
              {
                criticalStockThreshold: toInputValue(variant.criticalStockThreshold),
                lowStockThreshold: toInputValue(variant.lowStockThreshold)
              }
            ])
          )
        }
      ])
    )
  );
  const [expandedSku, setExpandedSku] = useState<string | null>(productGroups[0]?.parentSku ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [skuQuery, setSkuQuery] = useState("");

  const filteredGroups = productGroups.filter((group) => {
    const normalizedQuery = skuQuery.trim().toLowerCase();
    const matchesSupplier = selectedSupplierId === "all" || group.supplierIds.includes(selectedSupplierId);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      group.parentSku.toLowerCase().includes(normalizedQuery) ||
      group.internalName.toLowerCase().includes(normalizedQuery) ||
      group.variants.some((variant) => variant.sku.toLowerCase().includes(normalizedQuery));

    return matchesSupplier && matchesQuery;
  });

  function updateDraft(parentSku: string, data: Partial<GroupDraft>) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        ...data
      }
    }));
  }

  function updateVariantDraft(parentSku: string, sku: string, field: "criticalStockThreshold" | "lowStockThreshold", value: string) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        variants: {
          ...current[parentSku].variants,
          [sku]: {
            ...current[parentSku].variants[sku],
            [field]: value
          }
        }
      }
    }));
  }

  function clearVariantOverrides(parentSku: string, variants: VariantRow[]) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        variants: Object.fromEntries(
          variants.map((variant) => [
            variant.sku,
            {
              criticalStockThreshold: "",
              lowStockThreshold: ""
            }
          ])
        )
      }
    }));
  }

  async function saveGroup(group: ProductGroup) {
    setFeedback(null);
    setError(null);

    const draft = drafts[group.parentSku];
    const response = await fetch("/api/admin/products/configure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parentSku: group.parentSku,
        internalName: draft.internalName,
        active: draft.active,
        supplierIds: draft.supplierIds,
        criticalStockThreshold: toNullableNumber(draft.criticalStockThreshold),
        lowStockThreshold: toNullableNumber(draft.lowStockThreshold),
        variantThresholds: group.variants.map((variant) => ({
          sku: variant.sku,
          criticalStockThreshold: toNullableNumber(draft.variants[variant.sku]?.criticalStockThreshold ?? ""),
          lowStockThreshold: toNullableNumber(draft.variants[variant.sku]?.lowStockThreshold ?? "")
        }))
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível atualizar o produto.");
      return;
    }

    setFeedback(`Configuração de estoque de ${group.parentSku} salva com sucesso.`);
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Gestão interna</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produtos, vínculos e limites por variação</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Defina um limite padrão no produto e, quando necessário, faça override por cor x tamanho para refletir a
            rotatividade real de cada variação.
          </p>
        </div>
        <div className="rounded-2xl border border-[#f2d4c3] bg-[#fff8f3] px-4 py-3 text-sm text-slate-600">
          A prioridade do card do fornecedor passa a respeitar o pior cenário entre as variações.
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-[1.7rem] border border-[#f2d7c7] bg-[#fff9f5] p-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Filtrar por fornecedor</span>
          <select
            value={selectedSupplierId}
            onChange={(event) => setSelectedSupplierId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="all">Todos</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar por SKU pai, SKU filha ou nome</span>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={skuQuery}
              onChange={(event) => setSkuQuery(event.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Ex.: 01-2504 ou 01-2504-22-01"
            />
          </div>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setSelectedSupplierId("all");
              setSkuQuery("");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <X className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="mt-6 space-y-5">
        {filteredGroups.map((group) => {
          const draft = drafts[group.parentSku];
          const expanded = expandedSku === group.parentSku;
          const sizes = Array.from(new Set(group.variants.map((variant) => variant.sizeLabel)));
          const colors = Array.from(new Set(group.variants.map((variant) => variant.colorLabel)));
          const matrix = colors.map((color) => ({
            color,
            items: sizes.map((size) => group.variants.find((variant) => variant.colorLabel === color && variant.sizeLabel === size) ?? null)
          }));

          return (
            <article key={group.parentSku} className="rounded-[1.8rem] border border-slate-100 bg-slate-50/70 p-5 shadow-soft">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white bg-white shadow-inner">
                    <Image src={group.imageUrl} alt={group.internalName} fill className="object-contain p-2" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{group.parentSku}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{group.internalName}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {group.variantCount} variações • estoque total {group.totalStock}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      group.staleCount > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {group.staleCount > 0 ? `${group.staleCount} desatualizadas` : "Sincronizado"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedSku(expanded ? null : group.parentSku)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {expanded ? "Fechar detalhes" : "Editar limites"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="xl:col-span-2">
                  <ProductOperationalStrip
                    compact
                    replenishmentCard={group.replenishmentCard}
                    activeOrder={group.activeOrder}
                    relatedOrderCount={group.relatedOrderCount}
                  />
                  {group.activeOrder ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Fluxo em destaque: {group.activeOrder.supplierName} - {group.activeOrder.originLabel}.
                    </p>
                  ) : group.replenishmentCard ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Compra em destaque: {group.replenishmentCard.supplierName}.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Este SKU ainda nao entrou em compra, pedido ou financeiro recentemente.
                    </p>
                  )}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Nome interno</span>
                  <input
                    value={draft.internalName}
                    onChange={(event) => updateDraft(group.parentSku, { internalName: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Crítico padrão do produto</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.criticalStockThreshold}
                      onChange={(event) => updateDraft(group.parentSku, { criticalStockThreshold: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="0"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Baixo padrão do produto</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.lowStockThreshold}
                      onChange={(event) => updateDraft(group.parentSku, { lowStockThreshold: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="5"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Produto ativo</p>
                    <p className="text-xs text-slate-500">Quando inativo, o grupo deixa de aparecer para os fornecedores.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDraft(group.parentSku, { active: !draft.active })}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      draft.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {draft.active ? "Ativo" : "Inativo"}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Fornecedores vinculados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suppliers.map((supplier) => {
                      const active = draft.supplierIds.includes(supplier.id);
                      return (
                        <button
                          key={`${group.parentSku}-${supplier.id}`}
                          type="button"
                          onClick={() =>
                            updateDraft(group.parentSku, {
                              supplierIds: active
                                ? draft.supplierIds.filter((item) => item !== supplier.id)
                                : [...draft.supplierIds, supplier.id]
                            })
                          }
                          className={cn(
                            "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                            active
                              ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-[#f2b79a]"
                          )}
                        >
                          {supplier.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {expanded ? (
                <div className="mt-5 rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Grade cor x tamanho</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Deixe em branco para herdar o padrão do produto. Preencha apenas as variações com giro diferente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearVariantOverrides(group.parentSku, group.variants)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Usar padrão do produto em todas
                    </button>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[56rem] overflow-hidden rounded-[1.4rem] border border-[#f4d7c7]">
                      <div
                        className="grid bg-[#fff3ec] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        style={{ gridTemplateColumns: `1.05fr repeat(${sizes.length}, minmax(180px, 1fr))` }}
                      >
                        <div className="px-4 py-3">Cor</div>
                        {sizes.map((size) => (
                          <div key={size} className="px-4 py-3 text-center">
                            {size}
                          </div>
                        ))}
                      </div>

                      {matrix.map((row) => (
                        <div
                          key={row.color}
                          className="grid border-t border-[#f8e4d9] bg-white"
                          style={{ gridTemplateColumns: `1.05fr repeat(${sizes.length}, minmax(180px, 1fr))` }}
                        >
                          <div className="px-4 py-4 text-sm font-semibold text-slate-900">{row.color}</div>
                          {row.items.map((item, index) => {
                            if (!item) {
                              return (
                                <div key={`${row.color}-${sizes[index]}`} className="px-3 py-3">
                                  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-300">
                                    -
                                  </div>
                                </div>
                              );
                            }

                            const variantDraft = draft.variants[item.sku];
                            const hasOverride =
                              variantDraft?.criticalStockThreshold.trim() !== "" || variantDraft?.lowStockThreshold.trim() !== "";
                            const effectiveCriticalThreshold =
                              toNullableNumber(variantDraft?.criticalStockThreshold ?? "") ??
                              toNullableNumber(draft.criticalStockThreshold) ??
                              DEFAULT_STOCK_THRESHOLDS.critical;
                            const effectiveLowThreshold =
                              toNullableNumber(variantDraft?.lowStockThreshold ?? "") ??
                              toNullableNumber(draft.lowStockThreshold) ??
                              DEFAULT_STOCK_THRESHOLDS.low;
                            const previewBand = getStockBand(item.quantity, {
                              critical: effectiveCriticalThreshold,
                              low: effectiveLowThreshold
                            });
                            const previewLabel = getStockBandLabel(previewBand);

                            return (
                              <div key={item.sku} className="px-3 py-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                                      <p className="text-[11px] text-slate-500">{item.sku}</p>
                                    </div>
                                    <span
                                      className={cn(
                                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                        previewBand === "critical" && "bg-rose-50 text-rose-700",
                                        previewBand === "low" && "bg-amber-50 text-amber-700",
                                        previewBand === "ok" && "bg-emerald-50 text-emerald-700",
                                        previewBand === "unknown" && "bg-slate-100 text-slate-600"
                                      )}
                                    >
                                      {previewLabel}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-2">
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                        Crítico
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={variantDraft?.criticalStockThreshold ?? ""}
                                        onChange={(event) =>
                                          updateVariantDraft(group.parentSku, item.sku, "criticalStockThreshold", event.target.value)
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                        placeholder={`Pai: ${draft.criticalStockThreshold || 0}`}
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                        Baixo
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={variantDraft?.lowStockThreshold ?? ""}
                                        onChange={(event) =>
                                          updateVariantDraft(group.parentSku, item.sku, "lowStockThreshold", event.target.value)
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                        placeholder={`Pai: ${draft.lowStockThreshold || 5}`}
                                      />
                                    </label>
                                  </div>

                                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>{hasOverride ? "Override da variação" : "Herdando do produto"}</span>
                                    <span>
                                      efetivo {effectiveCriticalThreshold}/{effectiveLowThreshold}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-slate-500">Atualizado no sistema em {group.updatedAt}</p>
                <button
                  type="button"
                  onClick={() => startSaving(() => void saveGroup(group))}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
                >
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Salvar ajustes
                </button>
              </div>
            </article>
            );
          })}

        {filteredGroups.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            Nenhum produto encontrado com os filtros atuais.
          </div>
        ) : null}
      </div>
    </section>
  );
}
