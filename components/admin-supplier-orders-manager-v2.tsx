"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  LoaderCircle,
  PackagePlus,
  RotateCcw,
  ScrollText,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getSupplierFinancialStatusTone,
  getSupplierOrderLinkedModules,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowTone
} from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";
import { suggestPurchaseQuantity, summarizePurchaseSuggestions } from "@/lib/reorder-advisor";
import { SALES_PERIOD_OPTIONS, type SalesPeriodKey } from "@/lib/sales-metrics";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductOption = {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  variants: Array<{
    id: string;
    sku: string;
    color: string;
    size: string;
    unitCost: number;
    currentStock?: number | null;
    sales?: {
      "1d": number;
      "7d": number;
      "1m": number;
      "3m": number;
      "6m": number;
      "1a": number;
    };
  }>;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  status: string;
  statusLabel: string;
  workflowStage: string;
  workflowStageLabel: string;
  originType: string;
  originLabel: string;
  adminNote: string | null;
  supplierNote: string | null;
  supplierHasNoStock: boolean;
  createdAt: string;
  respondedAt: string | null;
  shippedAt: string | null;
  expectedShipDate: string | null;
  separationConfirmedAt: string | null;
  sentToFinancialAt: string | null;
  paidAt: string | null;
  estimatedTotalCost: number;
  estimatedTotalCostLabel: string;
  confirmedTotalCost: number;
  confirmedTotalCostLabel: string;
  createdBy: string;
  updatedBy: string | null;
  hasRomaneio: boolean;
  financialEntry: {
    id: string;
    status: string;
    statusLabel: string;
    amount: number;
    amountLabel: string;
  } | null;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    kind: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    toStatusLabel: string;
    note: string | null;
    createdAt: string;
  }>;
  workflowHistory: Array<{
    id: string;
    fromStage: string | null;
    toStage: string;
    toStageLabel: string;
    note: string | null;
    createdAt: string;
  }>;
  items: Array<{
    id: string;
    sku: string;
    color: string;
    size: string;
    productName: string;
    requestedQuantity: number;
    fulfilledQuantity: number;
    itemStatus: string;
    itemStatusLabel: string;
    unitCost: number;
    requestedTotalCost: number;
    confirmedUnitCost: number | null;
    confirmedTotalCost: number;
    supplierItemNote: string | null;
  }>;
};

function currency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function attachmentKindLabel(kind: string) {
  if (kind === "ROMANEIO") return "Romaneio";
  if (kind === "NOTA_FISCAL") return "Nota fiscal";
  return "Anexo";
}

function summaryTone(name: "awaiting" | "preparation" | "financial" | "shipped") {
  if (name === "preparation") return "bg-sky-50 text-sky-700";
  if (name === "financial") return "bg-indigo-50 text-indigo-700";
  if (name === "shipped") return "bg-emerald-50 text-emerald-700";
  return "bg-[#fff7ec] text-[#a94b25]";
}

function buildItemMap(items: OrderRow["items"]) {
  return new Map(items.map((item) => [`${item.color}::${item.size}`, item] as const));
}

const ORDER_CREATION_FLASH_KEY = "admin-supplier-orders:flash";

export function AdminSupplierOrdersManagerV2({
  suppliers,
  products,
  orders
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  orders: OrderRow[];
}) {
  const [rows] = useState(orders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activePeriod, setActivePeriod] = useState<SalesPeriodKey>("1m");
  const [modalNote, setModalNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "warning">("success");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "save-note" | "cancel-order" | null>(null);

  const availableProducts = useMemo(
    () => products.filter((product) => product.supplierId === selectedSupplierId),
    [products, selectedSupplierId]
  );

  const selectedProduct = useMemo(
    () => availableProducts.find((product) => product.id === selectedProductId) ?? null,
    [availableProducts, selectedProductId]
  );

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) ?? null;

  const estimatedTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.variants.reduce((sum, variant) => sum + (quantities[variant.sku] ?? 0) * variant.unitCost, 0);
  }, [quantities, selectedProduct]);

  const summary = useMemo(
    () => ({
      awaiting: rows.filter((row) => row.workflowStage === "AWAITING_RESPONSE").length,
      preparation: rows.filter((row) => ["IN_PREPARATION", "SEPARATION_CONFIRMED"].includes(row.workflowStage)).length,
      financial: rows.filter((row) =>
        ["READY_FOR_FINANCIAL", "IN_FINANCIAL_REVIEW", "PAYMENT_PENDING", "PAID"].includes(row.workflowStage)
      ).length,
      shipped: rows.filter((row) => row.workflowStage === "SHIPPED").length
    }),
    [rows]
  );

  const gradeView = useMemo(() => {
    if (!selectedOrder) return null;
    return {
      colors: uniq(selectedOrder.items.map((item) => item.color)),
      sizes: uniq(selectedOrder.items.map((item) => item.size)),
      itemMap: buildItemMap(selectedOrder.items)
    };
  }, [selectedOrder]);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(ORDER_CREATION_FLASH_KEY);

    if (flash) {
      setFeedback(flash);
      window.sessionStorage.removeItem(ORDER_CREATION_FLASH_KEY);
    }
  }, []);

  const createView = useMemo(() => {
    if (!selectedProduct) return null;
    const colors = uniq(selectedProduct.variants.map((item) => item.color));
    const sizes = uniq(selectedProduct.variants.map((item) => item.size));
    const itemMap = new Map(selectedProduct.variants.map((item) => [`${item.color}::${item.size}`, item] as const));

    return {
      colors,
      sizes,
      itemMap
    };
  }, [selectedProduct]);

  const pepperIaSummary = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    const results = selectedProduct.variants.map((variant) =>
      suggestPurchaseQuantity({
        currentStock: variant.currentStock,
        sales1d: variant.sales?.["1d"] ?? 0,
        sales7d: variant.sales?.["7d"] ?? 0,
        sales30d: variant.sales?.["1m"] ?? 0
      })
    );

    return summarizePurchaseSuggestions(results);
  }, [selectedProduct]);

  function resetCreateForm() {
    setSelectedProductId("");
    setAdminNote("");
    setQuantities({});
    setFeedback(null);
    setFeedbackTone("success");
    setError(null);
  }

  function openOrder(order: OrderRow) {
    setSelectedOrderId(order.id);
    setModalNote(order.adminNote ?? "");
    setFeedback(null);
    setFeedbackTone("success");
    setError(null);
  }

  function suggestWithPepperIa() {
    if (!selectedProduct || !pepperIaSummary) {
      setError("Selecione um produto para a Pepper IA sugerir a grade.");
      return;
    }

    const suggestedQuantities = Object.fromEntries(
      selectedProduct.variants.map((variant) => [
        variant.sku,
        suggestPurchaseQuantity({
          currentStock: variant.currentStock,
          sales1d: variant.sales?.["1d"] ?? 0,
          sales7d: variant.sales?.["7d"] ?? 0,
          sales30d: variant.sales?.["1m"] ?? 0
        }).suggestedQuantity
      ])
    );

    setQuantities(suggestedQuantities);
    setError(null);
    setFeedbackTone(pepperIaSummary.tone);
    setFeedback(pepperIaSummary.appliedMessage);
  }

  async function createOrder() {
    setFeedback(null);
    setError(null);
    setPendingAction("create");

    if (!selectedSupplierId || !selectedProduct) {
      setError("Selecione o fornecedor e o produto antes de criar o pedido.");
      setPendingAction(null);
      return;
    }

    const items = selectedProduct.variants
      .map((variant) => ({
        catalogVariantId: variant.id,
        sku: variant.sku,
        productName: selectedProduct.productName,
        color: variant.color,
        size: variant.size,
        requestedQuantity: Number(quantities[variant.sku] ?? 0),
        unitCost: variant.unitCost
      }))
      .filter((item) => item.requestedQuantity > 0);

    if (items.length === 0) {
      setError("Informe pelo menos uma quantidade para o pedido.");
      setPendingAction(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          productId: selectedProduct.id,
          productName: selectedProduct.productName,
          productSku: selectedProduct.productSku,
          imageUrl: selectedProduct.imageUrl,
          adminNote,
          items
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
        setError(payload.error ?? "Nao foi possivel criar o pedido agora.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation && payload.verification?.visibleForSupplier
          ? "Pedido criado, validado na fundacao e ja visivel para o fornecedor."
          : "Pedido criado com sucesso.";
      window.sessionStorage.setItem(ORDER_CREATION_FLASH_KEY, successMessage);
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o pedido agora.");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveAdminNote(status?: string) {
    if (!selectedOrder) return;

    setFeedback(null);
    setError(null);
    setPendingAction(status === "CANCELED" ? "cancel-order" : "save-note");

    try {
      const response = await fetch("/api/admin/supplier-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          status: status ?? selectedOrder.status,
          adminNote: modalNote
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o pedido.");
        return;
      }

      setFeedback(status === "CANCELED" ? "Pedido cancelado com sucesso." : "Observacao atualizada com sucesso.");
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o pedido.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Fluxo operacional</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Pedidos ao fornecedor</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card acompanha um produto individual, mostrando a etapa atual entre Pepper, fornecedor e financeiro.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            <PackagePlus className="h-4 w-4" />
            Novo pedido
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Aguardando resposta" value={summary.awaiting} tone={summaryTone("awaiting")} />
          <SummaryCard label="Em preparacao" value={summary.preparation} tone={summaryTone("preparation")} />
          <SummaryCard label="Financeiro" value={summary.financial} tone={summaryTone("financial")} />
          <SummaryCard label="Enviados" value={summary.shipped} tone={summaryTone("shipped")} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cards operacionais</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cada card mostra a origem, a etapa atual e o proximo passo esperado entre Pepper, fornecedor e financeiro.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} pedidos</span>
        </div>

        {feedback ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((row) => {
              const nextStep = getSupplierOrderNextStep(row.workflowStage as never, Boolean(row.financialEntry));

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openOrder(row)}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                        <Image
                          src={row.imageUrl ?? "/brand/pepper-logo.png"}
                          alt={row.productName}
                          fill
                          className="object-cover p-1.5"
                          sizes="56px"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.orderNumber}</p>
                        <p className="text-xs text-slate-500">{row.originLabel}</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierOrderWorkflowTone(row.workflowStage as never))}>
                      {row.workflowStageLabel}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-900">{row.productName}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Previsto {row.estimatedTotalCostLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Confirmado {row.confirmedTotalCostLabel}</div>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {getSupplierOrderLinkedModules(row.workflowStage as never, Boolean(row.financialEntry)).map((module) => (
                      <span key={module} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {module}
                      </span>
                    ))}
                    {row.financialEntry ? (
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", getSupplierFinancialStatusTone(row.financialEntry.status as never))}>
                        Financeiro {row.financialEntry.statusLabel}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhum pedido criado ainda.
            </div>
          )}
        </div>
      </section>

      {createModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Novo card operacional</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Criar pedido ao fornecedor</h3>
                <p className="mt-1 text-sm text-slate-500">Monte a grade por cor e tamanho e envie para o fornecedor responder.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.38fr_0.62fr]">
              <div className="space-y-4">
                {feedback ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
                  <select
                    value={selectedSupplierId}
                    onChange={(event) => {
                      setSelectedSupplierId(event.target.value);
                      setSelectedProductId("");
                      setQuantities({});
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Selecione</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Produto</span>
                  <select
                    value={selectedProductId}
                    onChange={(event) => {
                      setSelectedProductId(event.target.value);
                      setQuantities({});
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Selecione</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.productName} ({product.productSku})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do admin</span>
                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    placeholder="Ex.: priorizar a grade da vitrine e confirmar disponibilidade real."
                  />
                </label>

                <div className="flex flex-wrap gap-2">
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Valor estimado</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{currency(estimatedTotal)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Variacoes com qtd</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {Object.values(quantities).filter((value) => value > 0).length}
                    </p>
                  </div>
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={suggestWithPepperIa}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f2b79a] bg-[#fff1e7] px-4 py-3 text-sm font-semibold text-[#a94c25]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Pepper AI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuantities({});
                      setAdminNote("");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Limpar grade
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void createOrder()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                    {pendingAction === "create" ? "Criando..." : "Criar pedido"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-100 bg-slate-50/80 p-4">
                {selectedProduct ? (
                  <div>
                    <div className="flex items-start gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                        <Image src={selectedProduct.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedProduct.productName} fill className="object-contain p-2" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{selectedProduct.productName}</p>
                        <p className="text-xs text-slate-500">{selectedProduct.productSku}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {selectedProduct.variants.length} variacoes disponiveis para este pedido.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="rounded-xl bg-white px-3 py-2">
                            Estoque total: {selectedProduct.variants.reduce((sum, variant) => sum + (variant.currentStock ?? 0), 0)}
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2">
                            Vendas {activePeriod.toUpperCase()}: {selectedProduct.variants.reduce((sum, variant) => sum + (variant.sales?.[activePeriod] ?? 0), 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {feedback ? (
                      <div
                        className={cn(
                          "mt-4 rounded-2xl border px-4 py-3 text-sm",
                          feedbackTone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {feedback}
                      </div>
                    ) : null}

                    {createView ? (
                      <div className="mt-5 overflow-x-auto">
                        <div className="min-w-[58rem] overflow-hidden rounded-[1.4rem] border border-[#f4d7c7]">
                          <div
                            className="grid bg-[#fff3ec] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                            style={{ gridTemplateColumns: `1.05fr repeat(${createView.sizes.length}, minmax(200px, 1fr))` }}
                          >
                            <div className="px-4 py-3">Cor</div>
                            {createView.sizes.map((size) => (
                              <div key={size} className="px-4 py-3 text-center">
                                {size}
                              </div>
                            ))}
                          </div>

                          {createView.colors.map((color) => (
                            <div
                              key={color}
                              className="grid border-t border-[#f8e4d9] bg-white"
                              style={{ gridTemplateColumns: `1.05fr repeat(${createView.sizes.length}, minmax(200px, 1fr))` }}
                            >
                              <div className="px-4 py-4 text-sm font-semibold text-slate-900">{color}</div>
                              {createView.sizes.map((size) => {
                                const variant = createView.itemMap.get(`${color}::${size}`);

                                if (!variant) {
                                  return (
                                    <div key={`${color}-${size}`} className="px-3 py-3">
                                      <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-300">
                                        -
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={variant.sku} className="px-3 py-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                      <p className="text-[11px] text-slate-500">{variant.sku}</p>
                                      <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                        <div className="rounded-xl bg-white px-3 py-2">Estoque: {variant.currentStock ?? "-"}</div>
                                        <div className="rounded-xl bg-white px-3 py-2">Vendas {activePeriod.toUpperCase()}: {variant.sales?.[activePeriod] ?? 0}</div>
                                        <div className="rounded-xl bg-white px-3 py-2">Custo base: {currency(variant.unitCost)}</div>
                                      </div>
                                      <input
                                        type="number"
                                        min={0}
                                        value={quantities[variant.sku] ?? ""}
                                        onChange={(event) =>
                                          setQuantities((current) => ({
                                            ...current,
                                            [variant.sku]: Number(event.target.value || 0)
                                          }))
                                        }
                                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm outline-none"
                                        placeholder="Qtd."
                                      />
                                      <p className="mt-3 text-xs font-semibold text-slate-600">
                                        Total estimado: {currency((quantities[variant.sku] ?? 0) * variant.unitCost)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[18rem] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
                    Selecione fornecedor e produto para montar o pedido por variacao.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={() => setSelectedOrderId(null)}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo operacional</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrder.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedOrder.orderNumber} • {selectedOrder.supplierName} • {selectedOrder.originLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <DetailMetric label="Etapa" value={selectedOrder.workflowStageLabel} tone={getSupplierOrderWorkflowTone(selectedOrder.workflowStage as never)} />
              <DetailMetric label="Previsto" value={selectedOrder.estimatedTotalCostLabel} tone="bg-slate-50 text-slate-700" />
              <DetailMetric label="Confirmado" value={selectedOrder.confirmedTotalCostLabel} tone="bg-slate-50 text-slate-700" />
              <DetailMetric
                label="Financeiro"
                value={selectedOrder.financialEntry ? selectedOrder.financialEntry.statusLabel : "Ainda fora do financeiro"}
                tone={
                  selectedOrder.financialEntry
                    ? getSupplierFinancialStatusTone(selectedOrder.financialEntry.status as never)
                    : "bg-slate-50 text-slate-700"
                }
              />
            </div>

            <OperationsFlowPanel
              className="mt-5"
              originLabel={selectedOrder.originLabel}
              currentLabel={selectedOrder.workflowStageLabel}
              currentTone={getSupplierOrderWorkflowTone(selectedOrder.workflowStage as never)}
              nextLabel={getSupplierOrderNextStep(selectedOrder.workflowStage as never, Boolean(selectedOrder.financialEntry)).label}
              nextDescription={getSupplierOrderNextStep(selectedOrder.workflowStage as never, Boolean(selectedOrder.financialEntry)).description}
              modules={getSupplierOrderLinkedModules(selectedOrder.workflowStage as never, Boolean(selectedOrder.financialEntry)).map((module) => ({
                label: module,
                tone: module === "Financeiro" ? "bg-indigo-50 text-indigo-700" : module === "Envio" ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-700"
              }))}
            />

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                {feedback ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
                ) : null}

                <div className="flex items-start gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                    <Image src={selectedOrder.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedOrder.productName} fill className="object-contain p-2" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedOrder.productName}</p>
                      <p className="text-xs text-slate-500">{selectedOrder.productSku}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-white px-2.5 py-1">Criado em {selectedOrder.createdAt}</span>
                      {selectedOrder.expectedShipDate ? (
                        <span className="rounded-full bg-white px-2.5 py-1">Prev. envio {selectedOrder.expectedShipDate}</span>
                      ) : null}
                      {selectedOrder.financialEntry ? (
                        <span className="rounded-full bg-white px-2.5 py-1">{selectedOrder.financialEntry.amountLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {gradeView ? (
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Cor</th>
                          {gradeView.sizes.map((size) => (
                            <th key={size} className="px-4 py-3 text-left font-semibold">
                              {size}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gradeView.colors.map((color) => (
                          <tr key={color}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{color}</td>
                            {gradeView.sizes.map((size) => {
                              const item = gradeView.itemMap.get(`${color}::${size}`);
                              return (
                                <td key={`${color}-${size}`} className="px-4 py-3 align-top">
                                  {item ? (
                                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                      <p>Sol. {item.requestedQuantity}</p>
                                      <p>Sep. {item.fulfilledQuantity}</p>
                                      <p>{currency(item.confirmedTotalCost || item.requestedTotalCost)}</p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {selectedOrder.attachments.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Anexos</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedOrder.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          {attachmentKindLabel(attachment.kind)}: {attachment.fileName}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do admin</span>
                  <textarea
                    value={modalNote}
                    onChange={(event) => setModalNote(event.target.value)}
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void saveAdminNote()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "save-note" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                    {pendingAction === "save-note" ? "Salvando..." : "Salvar observacao"}
                  </button>

                  {selectedOrder.workflowStage !== "CANCELED" ? (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void saveAdminNote("CANCELED")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingAction === "cancel-order" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      {pendingAction === "cancel-order" ? "Cancelando..." : "Cancelar pedido"}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                      Pedido cancelado
                    </div>
                  )}
                </div>

                {selectedOrder.supplierNote ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Retorno do fornecedor</p>
                    <p className="mt-3">{selectedOrder.supplierNote}</p>
                  </div>
                ) : null}

                {selectedOrder.financialEntry ? (
                  <div className="rounded-[1.4rem] border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">Origem no financeiro</p>
                    <p className="mt-3">
                      Este card ja esta vinculado ao financeiro com status <strong>{selectedOrder.financialEntry.statusLabel}</strong> e valor{" "}
                      <strong>{selectedOrder.financialEntry.amountLabel}</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    O card ainda nao entrou no financeiro. Isso acontece depois que o fornecedor confirma a separacao e envia a cobranca.
                  </div>
                )}

                {selectedOrder.workflowHistory.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Historico operacional</p>
                    {selectedOrder.workflowHistory.map((entry) => (
                      <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <strong>{entry.toStageLabel}</strong> • {entry.createdAt}
                        {entry.note ? <p className="mt-1">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedOrder.history.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Historico de status</p>
                    {selectedOrder.history.map((entry) => (
                      <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <strong>{entry.toStatusLabel}</strong> • {entry.createdAt}
                        {entry.note ? <p className="mt-1">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-[1.6rem] border border-white/70 p-5 shadow-soft", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function DetailMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3 text-sm", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
