"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  LoaderCircle,
  PackagePlus,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { AdminImportConsole } from "@/components/admin-import-console";
import { ProductOperationalStrip } from "@/components/product-operational-strip";
import { cn } from "@/lib/cn";
import { suggestPurchaseQuantity, summarizePurchaseSuggestions } from "@/lib/reorder-advisor";
import { SALES_PERIOD_OPTIONS, type SalesPeriodKey, type SalesPeriodTotals } from "@/lib/sales-metrics";

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
  sales: SalesPeriodTotals;
  unitCost: number | null;
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
  totalEstimatedCost: number;
  staleCount: number;
  band: "critical" | "low" | "ok" | "unknown";
  bandLabel: string;
  sales: SalesPeriodTotals;
  coverageDays: number | null;
  movementBadge: string;
  topColorLabel: string | null;
  topSizeLabel: string | null;
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

type DashboardSummary = {
  productCount: number;
  staleCount: number;
  totalSalesToday: number;
  totalSales7d: number;
  totalSales30d: number;
  atRiskCount: number;
  replenishmentPendingCount: number;
  orderCardsInProgress: number;
  readyForFinancialCount: number;
  financialReviewCount: number;
  paymentPendingCount: number;
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

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function bandTone(band: ProductGroup["band"]) {
  if (band === "critical") return "border-rose-200 bg-rose-50/80";
  if (band === "low") return "border-amber-200 bg-amber-50/80";
  if (band === "ok") return "border-emerald-200 bg-emerald-50/70";
  return "border-slate-200 bg-white/80";
}

function bandBadgeTone(band: ProductGroup["band"] | VariantRow["band"]) {
  if (band === "critical") return "bg-rose-100 text-rose-700";
  if (band === "low") return "bg-amber-100 text-amber-700";
  if (band === "ok") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

const PRODUCT_ORDER_FLASH_KEY = "admin-product-inventory:flash";

export function AdminProductInventoryManager({
  suppliers,
  productGroups,
  dashboard,
  tinyConfigured
}: {
  suppliers: SupplierOption[];
  productGroups: ProductGroup[];
  dashboard: DashboardSummary;
  tinyConfigured: boolean;
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
  const [selectedSupplierId, setSelectedSupplierId] = useState("all");
  const [skuQuery, setSkuQuery] = useState("");
  const [activePeriod, setActivePeriod] = useState<SalesPeriodKey>("1m");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [orderSupplierId, setOrderSupplierId] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [orderFeedbackTone, setOrderFeedbackTone] = useState<"success" | "warning">("success");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(PRODUCT_ORDER_FLASH_KEY);

    if (flash) {
      setFeedback(flash);
      window.sessionStorage.removeItem(PRODUCT_ORDER_FLASH_KEY);
    }
  }, []);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = skuQuery.trim().toLowerCase();
    return productGroups.filter((group) => {
      const matchesSupplier = selectedSupplierId === "all" || group.supplierIds.includes(selectedSupplierId);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        group.parentSku.toLowerCase().includes(normalizedQuery) ||
        group.internalName.toLowerCase().includes(normalizedQuery) ||
        group.variants.some((variant) => variant.sku.toLowerCase().includes(normalizedQuery));
      return matchesSupplier && matchesQuery;
    });
  }, [productGroups, selectedSupplierId, skuQuery]);

  const selectedGroup = useMemo(
    () => productGroups.find((group) => group.parentSku === selectedSku) ?? null,
    [productGroups, selectedSku]
  );

  const selectedDraft = selectedGroup ? drafts[selectedGroup.parentSku] : null;

  const sizes = useMemo(
    () => (selectedGroup ? Array.from(new Set(selectedGroup.variants.map((variant) => variant.sizeLabel))) : []),
    [selectedGroup]
  );

  const matrix = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    const colors = Array.from(new Set(selectedGroup.variants.map((variant) => variant.colorLabel)));
    return colors.map((color) => ({
      color,
      items: sizes.map(
        (size) => selectedGroup.variants.find((variant) => variant.colorLabel === color && variant.sizeLabel === size) ?? null
      )
    }));
  }, [selectedGroup, sizes]);

  const selectableSuppliers = useMemo(() => {
    if (!selectedDraft || selectedDraft.supplierIds.length === 0) {
      return suppliers;
    }

    return suppliers.filter((supplier) => selectedDraft.supplierIds.includes(supplier.id));
  }, [selectedDraft, suppliers]);

  const estimatedOrderTotal = useMemo(() => {
    if (!selectedGroup) {
      return 0;
    }

    return selectedGroup.variants.reduce(
      (sum, variant) => sum + (orderQuantities[variant.sku] ?? 0) * (variant.unitCost ?? 0),
      0
    );
  }, [orderQuantities, selectedGroup]);

  const orderVariantCount = useMemo(
    () => Object.values(orderQuantities).filter((value) => value > 0).length,
    [orderQuantities]
  );

  const pepperIaSummary = useMemo(() => {
    if (!selectedGroup) {
      return null;
    }

    const results = selectedGroup.variants.map((variant) =>
      suggestPurchaseQuantity({
        currentStock: variant.quantity,
        sales1d: variant.sales["1d"],
        sales7d: variant.sales["7d"],
        sales30d: variant.sales["1m"],
        criticalStockThreshold:
          toNullableNumber(selectedDraft?.variants[variant.sku]?.criticalStockThreshold ?? "") ??
          toNullableNumber(selectedDraft?.criticalStockThreshold ?? "") ??
          variant.effectiveCriticalStockThreshold,
        lowStockThreshold:
          toNullableNumber(selectedDraft?.variants[variant.sku]?.lowStockThreshold ?? "") ??
          toNullableNumber(selectedDraft?.lowStockThreshold ?? "") ??
          variant.effectiveLowStockThreshold
      })
    );

    return summarizePurchaseSuggestions(results);
  }, [selectedDraft, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    setOrderSupplierId(selectedGroup.supplierIds[0] ?? suppliers[0]?.id ?? "");
    setOrderNote("");
    setOrderQuantities({});
    setOrderFeedback(null);
    setOrderFeedbackTone("success");
    setOrderError(null);
  }, [selectedGroup, suppliers]);

  function updateDraft(parentSku: string, patch: Partial<GroupDraft>) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        ...patch
      }
    }));
  }

  function updateVariantDraft(
    parentSku: string,
    sku: string,
    field: "criticalStockThreshold" | "lowStockThreshold",
    value: string
  ) {
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

  async function saveGroup(group: ProductGroup) {
    const draft = drafts[group.parentSku];
    setFeedback(null);
    setError(null);
    setSavingSku(group.parentSku);

    try {
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

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation: boolean;
          visibleForSupplier: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o produto.");
        return;
      }

      setFeedback(`Gestao do produto ${group.parentSku} salva com sucesso.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o produto.");
    } finally {
      setSavingSku(null);
    }
  }

  function suggestOrderWithPepperIa() {
    if (!selectedGroup || !pepperIaSummary) {
      return;
    }

    const suggestedQuantities = Object.fromEntries(
      selectedGroup.variants.map((variant) => [
        variant.sku,
        suggestPurchaseQuantity({
          currentStock: variant.quantity,
          sales1d: variant.sales["1d"],
          sales7d: variant.sales["7d"],
          sales30d: variant.sales["1m"],
          criticalStockThreshold:
            toNullableNumber(selectedDraft?.variants[variant.sku]?.criticalStockThreshold ?? "") ??
            toNullableNumber(selectedDraft?.criticalStockThreshold ?? "") ??
            variant.effectiveCriticalStockThreshold,
          lowStockThreshold:
            toNullableNumber(selectedDraft?.variants[variant.sku]?.lowStockThreshold ?? "") ??
            toNullableNumber(selectedDraft?.lowStockThreshold ?? "") ??
            variant.effectiveLowStockThreshold
        }).suggestedQuantity
      ])
    );

    setOrderQuantities(suggestedQuantities);
    setOrderError(null);
    setOrderFeedbackTone(pepperIaSummary.tone);
    setOrderFeedback(pepperIaSummary.appliedMessage);
  }

  async function createOrderFromProduct() {
    if (!selectedGroup) {
      return;
    }

    setOrderFeedback(null);
    setOrderError(null);
    setCreatingOrder(true);

    const items = selectedGroup.variants
      .map((variant) => ({
        catalogVariantId: variant.id,
        sku: variant.sku,
        productName: `${selectedGroup.internalName} ${variant.colorLabel} ${variant.sizeLabel}`,
        color: variant.colorLabel,
        size: variant.sizeLabel,
        requestedQuantity: Number(orderQuantities[variant.sku] ?? 0),
        unitCost: variant.unitCost ?? 0
      }))
      .filter((item) => item.requestedQuantity > 0);

    if (!orderSupplierId || items.length === 0) {
      setOrderError("Selecione o fornecedor e informe pelo menos uma quantidade.");
      setCreatingOrder(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: orderSupplierId,
          productId: selectedGroup.id,
          productName: selectedDraft?.internalName ?? selectedGroup.internalName,
          productSku: selectedGroup.parentSku,
          imageUrl: selectedGroup.imageUrl,
          adminNote: orderNote,
          items
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation?: boolean;
          visibleForSupplier?: boolean;
        };
      };

      if (!response.ok) {
        setOrderError(payload.error ?? "Nao foi possivel criar o pedido agora.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation && payload.verification?.visibleForSupplier
          ? "Pedido criado a partir do produto, validado na fundacao e liberado para o fornecedor."
          : "Pedido criado com sucesso e enviado para o fluxo operacional.";
      window.sessionStorage.setItem(PRODUCT_ORDER_FLASH_KEY, successMessage);
      setOrderQuantities({});
      setOrderNote("");
      window.location.reload();
    } catch (requestError) {
      setOrderError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o pedido agora.");
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Gestor geral de produto e estoque</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produtos, estoque critico e atalhos operacionais</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card resume saldo, giro, prioridade de compra e acesso rapido ao modal de gestao com grade cor x tamanho.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
                tinyConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {tinyConfigured ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {tinyConfigured ? "Tiny pronto para importar" : "Tiny ainda nao configurado"}
            </div>

            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
            >
              <DatabaseZap className="h-4 w-4" />
              Importacao Tiny
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Produtos monitorados" value={dashboard.productCount} tone="soft" />
          <MetricCard label="Criticos ou baixos" value={dashboard.atRiskCount} tone="critical" />
          <MetricCard label="Vendas 7d" value={dashboard.totalSales7d} tone="soft" />
          <MetricCard label="Vendas 30d" value={dashboard.totalSales30d} tone="low" />
          <MetricCard label="Pedidos em andamento" value={dashboard.orderCardsInProgress} tone="soft" />
          <MetricCard label="Pendencias de compra" value={dashboard.replenishmentPendingCount} tone="low" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Produtos desatualizados: {dashboard.staleCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Vendas hoje: {dashboard.totalSalesToday}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Prontos para financeiro: {dashboard.readyForFinancialCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Em revisao financeira: {dashboard.financialReviewCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
            Pagamentos pendentes: {dashboard.paymentPendingCount}
          </span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr_auto]">
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
                placeholder="Ex.: 01-2504 ou Conjunto Fitness Aura"
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
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {filteredGroups.length > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => (
            <button
              key={group.parentSku}
              type="button"
              onClick={() => setSelectedSku(group.parentSku)}
              className={cn(
                "rounded-[2rem] border p-5 text-left shadow-soft transition hover:-translate-y-0.5",
                bandTone(group.band)
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.25em] text-slate-400">{group.parentSku}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{group.internalName}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {group.variantCount} variacoes • estoque total {group.totalStock}
                  </p>
                </div>

                <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-inner">
                  <Image src={group.imageUrl} alt={group.internalName} fill className="object-contain p-2" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", bandBadgeTone(group.band))}>
                  {group.bandLabel}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">{group.movementBadge}</span>
                {group.staleCount > 0 ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700">
                    {group.staleCount} desatualizadas
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                <InfoBox label="Vendas 1D" value={String(group.sales["1d"])} />
                <InfoBox label="Vendas 7D" value={String(group.sales["7d"])} />
                <InfoBox label="Vendas 30D" value={String(group.sales["1m"])} />
                <InfoBox
                  label="Cobertura"
                  value={group.coverageDays === null ? "Sem base" : `${group.coverageDays} dias`}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {group.topColorLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                    Cor lider: {group.topColorLabel}
                  </span>
                ) : null}
                {group.topSizeLabel ? (
                  <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                    Tamanho lider: {group.topSizeLabel}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/80 px-3 py-2 font-semibold text-slate-700">
                  Custo em estoque: {formatCurrency(group.totalEstimatedCost)}
                </span>
              </div>

              <div className="mt-4">
                <ProductOperationalStrip
                  compact
                  replenishmentCard={group.replenishmentCard}
                  activeOrder={group.activeOrder}
                  relatedOrderCount={group.relatedOrderCount}
                />
              </div>

              <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                <PackagePlus className="h-4 w-4" />
                Abrir gestor do produto
              </div>
            </button>
          ))}
        </section>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          Nenhum produto encontrado com os filtros atuais.
        </div>
      )}

      {selectedGroup && selectedDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white shadow-inner">
                  <Image src={selectedGroup.imageUrl} alt={selectedGroup.internalName} fill className="object-contain p-2" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Gestor de produto e estoque</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedGroup.internalName}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedGroup.parentSku} • {selectedGroup.variantCount} variacoes • {selectedGroup.bandLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSku(null)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-5">
              <InfoMetric label="Estoque total" value={String(selectedGroup.totalStock)} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Vendas 30D" value={String(selectedGroup.sales["1m"])} tone="bg-slate-50 text-slate-700" />
              <InfoMetric
                label="Cobertura"
                value={selectedGroup.coverageDays === null ? "Sem base" : `${selectedGroup.coverageDays} dias`}
                tone="bg-slate-50 text-slate-700"
              />
              <InfoMetric label="Pedidos ligados" value={String(selectedGroup.relatedOrderCount)} tone="bg-slate-50 text-slate-700" />
              <InfoMetric label="Saude" value={selectedGroup.bandLabel} tone={bandBadgeTone(selectedGroup.band)} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {SALES_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActivePeriod(option.key)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    activePeriod === option.key
                      ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-5">
                <section className="rounded-[1.7rem] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Configuracao do produto</p>
                      <p className="mt-1 text-sm text-slate-500">Nome interno, fornecedores e limites padrao.</p>
                    </div>
                    <button
                      type="button"
                      disabled={savingSku !== null}
                      onClick={() => void saveGroup(selectedGroup)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingSku === selectedGroup.parentSku ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {savingSku === selectedGroup.parentSku ? "Salvando..." : "Salvar ajustes"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Nome interno</span>
                      <input
                        value={selectedDraft.internalName}
                        onChange={(event) => updateDraft(selectedGroup.parentSku, { internalName: event.target.value })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">Critico padrao</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedDraft.criticalStockThreshold}
                          onChange={(event) => updateDraft(selectedGroup.parentSku, { criticalStockThreshold: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">Baixo padrao</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedDraft.lowStockThreshold}
                          onChange={(event) => updateDraft(selectedGroup.parentSku, { lowStockThreshold: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Produto ativo</p>
                        <p className="text-xs text-slate-500">Quando inativo, o grupo sai da operacao do fornecedor.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateDraft(selectedGroup.parentSku, { active: !selectedDraft.active })}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          selectedDraft.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {selectedDraft.active ? "Ativo" : "Inativo"}
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-700">Fornecedores vinculados</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suppliers.map((supplier) => {
                          const active = selectedDraft.supplierIds.includes(supplier.id);
                          return (
                            <button
                              key={`${selectedGroup.parentSku}-${supplier.id}`}
                              type="button"
                              onClick={() =>
                                updateDraft(selectedGroup.parentSku, {
                                  supplierIds: active
                                    ? selectedDraft.supplierIds.filter((item) => item !== supplier.id)
                                    : [...selectedDraft.supplierIds, supplier.id]
                                })
                              }
                              className={cn(
                                "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                                active
                                  ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              {supplier.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-[#f2d7c7] bg-[#fff8f4] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pedido direto do produto</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Monte a compra a partir da grade e use a Pepper IA para preencher com base nas vendas dos ultimos 30 dias.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={suggestOrderWithPepperIa}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#a94c25]"
                    >
                      <Sparkles className="h-4 w-4" />
                      Pepper AI
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor do pedido</span>
                      <select
                        value={orderSupplierId}
                        onChange={(event) => setOrderSupplierId(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="">Selecione</option>
                        {selectableSuppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do admin</span>
                      <textarea
                        value={orderNote}
                        onChange={(event) => setOrderNote(event.target.value)}
                        className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                        placeholder="Ex.: priorizar grade da vitrine e confirmar disponibilidade."
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <InfoMetric label="Variacoes com qtd" value={String(orderVariantCount)} tone="bg-white text-slate-700" />
                      <InfoMetric label="Valor estimado" value={formatCurrency(estimatedOrderTotal)} tone="bg-white text-slate-700" />
                    </div>

                    {pepperIaSummary ? (
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm",
                          pepperIaSummary.tone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        <p className="font-semibold">{pepperIaSummary.confidenceLabel}</p>
                        <p className="mt-1">{pepperIaSummary.readinessMessage}</p>
                      </div>
                    ) : null}

                    {orderFeedback ? (
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm",
                          orderFeedbackTone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {orderFeedback}
                      </div>
                    ) : null}
                    {orderError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{orderError}</div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderQuantities({});
                          setOrderFeedback(null);
                          setOrderFeedbackTone("success");
                          setOrderError(null);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Limpar pedido
                      </button>
                      <button
                        type="button"
                        disabled={creatingOrder}
                        onClick={() => void createOrderFromProduct()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingOrder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                        {creatingOrder ? "Criando..." : "Criar pedido"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">Grade cor x tamanho</h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Ajuste estoque critico por variacao e monte o pedido usando a mesma grade.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Filtro de vendas ativo: {SALES_PERIOD_OPTIONS.find((option) => option.key === activePeriod)?.label}
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <div className="min-w-[64rem] overflow-hidden rounded-[1.4rem] border border-[#f4d7c7]">
                    <div
                      className="grid bg-[#fff3ec] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                      style={{ gridTemplateColumns: `1.05fr repeat(${sizes.length}, minmax(220px, 1fr))` }}
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
                        style={{ gridTemplateColumns: `1.05fr repeat(${sizes.length}, minmax(220px, 1fr))` }}
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

                          const variantDraft = selectedDraft.variants[item.sku];

                          return (
                            <div key={item.sku} className="px-3 py-3">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-lg font-semibold text-slate-900">{item.quantity ?? "-"}</p>
                                    <p className="text-[11px] text-slate-500">{item.sku}</p>
                                  </div>
                                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", bandBadgeTone(item.band))}>
                                    {item.band === "critical" ? "Critico" : item.band === "low" ? "Baixo" : item.band === "ok" ? "Saudavel" : "Sem leitura"}
                                  </span>
                                </div>

                                <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                  <div className="rounded-xl bg-white px-3 py-2">Vendas {activePeriod.toUpperCase()}: {item.sales[activePeriod]}</div>
                                  <div className="rounded-xl bg-white px-3 py-2">
                                    Custo base: {formatCurrency(item.unitCost ?? 0)}
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2">
                                  <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Critico</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={variantDraft?.criticalStockThreshold ?? ""}
                                      onChange={(event) =>
                                        updateVariantDraft(selectedGroup.parentSku, item.sku, "criticalStockThreshold", event.target.value)
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                      placeholder={`Padrao ${selectedDraft.criticalStockThreshold || item.effectiveCriticalStockThreshold}`}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Baixo</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={variantDraft?.lowStockThreshold ?? ""}
                                      onChange={(event) =>
                                        updateVariantDraft(selectedGroup.parentSku, item.sku, "lowStockThreshold", event.target.value)
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                      placeholder={`Padrao ${selectedDraft.lowStockThreshold || item.effectiveLowStockThreshold}`}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pedido</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={orderQuantities[item.sku] ?? ""}
                                      onChange={(event) =>
                                        setOrderQuantities((current) => ({
                                          ...current,
                                          [item.sku]: Number(event.target.value || 0)
                                        }))
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                      placeholder="Qtd"
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {importModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Importacao integrada</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Importar produto do Tiny dentro de Produtos</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Revise o SKU pai, confirme a grade e vincule o cadastro sem sair do gestor operacional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AdminImportConsole suppliers={suppliers} tinyConfigured={tinyConfigured} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "soft" | "critical" | "low" }) {
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("rounded-[1.3rem] px-4 py-3 text-sm", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
