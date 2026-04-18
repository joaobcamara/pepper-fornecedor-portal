"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, UploadCloud, Wallet, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getSupplierFinancialStatusTone,
  getSupplierOrderLinkedModules,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowTone
} from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";

export type SupplierReceivedOrderRowV2 = {
  id: string;
  orderNumber: string;
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

const SUPPLIER_FINANCIAL_FLASH_KEY = "supplier-financial:flash";

export function SupplierReceivedOrdersPanelV2({ orders }: { orders: SupplierReceivedOrderRowV2[] }) {
  const [rows] = useState(orders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [supplierNote, setSupplierNote] = useState("");
  const [expectedShipDate, setExpectedShipDate] = useState("");
  const [supplierHasNoStock, setSupplierHasNoStock] = useState(false);
  const [itemState, setItemState] = useState<Record<string, { fulfilledQuantity: number; itemStatus: string; supplierItemNote: string; confirmedUnitCost: number }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "save" | "prepare" | "confirm" | "financial" | "shipped" | "no-stock" | null
  >(null);

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) ?? null;

  const summaryCards = useMemo(
    () => [
      { label: "Aguardando resposta", value: rows.filter((row) => row.workflowStage === "AWAITING_RESPONSE").length, tone: "bg-[#fff7ec] text-[#a94b25]" },
      { label: "Em preparação", value: rows.filter((row) => row.workflowStage === "IN_PREPARATION").length, tone: "bg-sky-50 text-sky-700" },
      { label: "Financeiro", value: rows.filter((row) => ["IN_FINANCIAL_REVIEW", "PAYMENT_PENDING", "PAID"].includes(row.workflowStage)).length, tone: "bg-indigo-50 text-indigo-700" },
      { label: "Enviados", value: rows.filter((row) => row.workflowStage === "SHIPPED").length, tone: "bg-emerald-50 text-emerald-700" }
    ],
    [rows]
  );

  const computedConfirmedTotal = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.items.reduce((sum, item) => {
      const local = itemState[item.id];
      const fulfilledQuantity = local?.fulfilledQuantity ?? item.fulfilledQuantity;
      const confirmedUnitCost = local?.confirmedUnitCost ?? item.confirmedUnitCost ?? item.unitCost ?? 0;
      return sum + fulfilledQuantity * confirmedUnitCost;
    }, 0);
  }, [itemState, selectedOrder]);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(SUPPLIER_FINANCIAL_FLASH_KEY);

    if (flash) {
      setFeedback(flash);
      window.sessionStorage.removeItem(SUPPLIER_FINANCIAL_FLASH_KEY);
    }
  }, []);

  async function submitUpdate(
    nextStatus: "SUPPLIER_REVIEWED" | "IN_PREPARATION" | "SHIPPED" | "NO_STOCK",
    workflowAction?: "PREPARE_ORDER" | "CONFIRM_SEPARATION" | "MARK_SHIPPED" | "MARK_NO_STOCK"
  ) {
    if (!selectedOrder) return;

    setFeedback(null);
    setError(null);
    const action =
      workflowAction === "PREPARE_ORDER"
        ? "prepare"
        : workflowAction === "CONFIRM_SEPARATION"
          ? "confirm"
          : workflowAction === "MARK_SHIPPED"
            ? "shipped"
            : workflowAction === "MARK_NO_STOCK"
              ? "no-stock"
              : "save";
    setPendingAction(action);

    try {
      const formData = new FormData();
      formData.set("orderId", selectedOrder.id);
      formData.set("supplierNote", supplierNote);
      formData.set("expectedShipDate", expectedShipDate);
      formData.set("supplierHasNoStock", supplierHasNoStock || nextStatus === "NO_STOCK" ? "true" : "false");
      formData.set("status", nextStatus);
      if (workflowAction) formData.set("workflowAction", workflowAction);
      formData.set(
        "itemsJson",
        JSON.stringify(
          selectedOrder.items.map((item) => {
            const local = itemState[item.id];
            return {
              id: item.id,
              fulfilledQuantity: local?.fulfilledQuantity ?? item.fulfilledQuantity,
              itemStatus: (local?.itemStatus ?? item.itemStatus) as "PENDING" | "AVAILABLE" | "PARTIAL" | "NO_STOCK",
              supplierItemNote: local?.supplierItemNote ?? item.supplierItemNote ?? "",
              confirmedUnitCost: local?.confirmedUnitCost ?? item.confirmedUnitCost ?? item.unitCost
            };
          })
        )
      );

      const romaneioInput = document.getElementById("romaneio-upload-v2") as HTMLInputElement | null;
      const romaneio = romaneioInput?.files?.[0];
      if (romaneio) formData.set("romaneio", romaneio);

      const response = await fetch("/api/supplier/supplier-orders", {
        method: "PATCH",
        body: formData
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation: boolean;
          visibleForAdminFinancial: boolean;
          supplierWorkflowMoved: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o pedido.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation &&
        payload.verification?.visibleForAdminFinancial &&
        payload.verification?.supplierWorkflowMoved
          ? "Pedido atualizado, validado na fundacao e refletido no fluxo operacional."
          : "Pedido atualizado com sucesso.";
      setFeedback(successMessage);
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o pedido.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitToFinancial() {
    if (!selectedOrder) return;

    setFeedback(null);
    setError(null);
    setPendingAction("financial");

    try {
      const formData = new FormData();
      formData.set("orderId", selectedOrder.id);
      formData.set("amount", String(computedConfirmedTotal || selectedOrder.confirmedTotalCost));
      formData.set("note", supplierNote);
      formData.set("supplierNote", supplierNote);
      if (expectedShipDate) formData.set("dueDate", expectedShipDate);

      const romaneioInput = document.getElementById("romaneio-upload-v2") as HTMLInputElement | null;
      const notaInput = document.getElementById("nota-fiscal-upload-v2") as HTMLInputElement | null;
      const romaneio = romaneioInput?.files?.[0];
      const notaFiscal = notaInput?.files?.[0];

      if (romaneio) formData.set("romaneio", romaneio);
      if (notaFiscal) formData.set("notaFiscal", notaFiscal);

      const response = await fetch("/api/supplier/financial-entries", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation?: boolean;
          visibleForAdminFinancial?: boolean;
          supplierWorkflowMoved?: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel enviar o pedido para o financeiro.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation &&
        payload.verification?.visibleForAdminFinancial &&
        payload.verification?.supplierWorkflowMoved
          ? "Pedido enviado ao financeiro, validado na fundacao e ja visivel para o admin."
          : "Pedido enviado para revisao financeira.";
      window.sessionStorage.setItem(SUPPLIER_FINANCIAL_FLASH_KEY, successMessage);
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar o pedido para o financeiro.");
    } finally {
      setPendingAction(null);
    }
  }

  function openOrder(order: SupplierReceivedOrderRowV2) {
    setSelectedOrderId(order.id);
    setSupplierNote(order.supplierNote ?? "");
    setExpectedShipDate(order.expectedShipDate ? order.expectedShipDate.split("/").reverse().join("-") : "");
    setSupplierHasNoStock(order.supplierHasNoStock);
    setItemState(
      Object.fromEntries(
        order.items.map((item) => [
          item.id,
          {
            fulfilledQuantity: item.fulfilledQuantity,
            itemStatus: item.itemStatus,
            supplierItemNote: item.supplierItemNote ?? "",
            confirmedUnitCost: item.confirmedUnitCost ?? item.unitCost
          }
        ])
      )
    );
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={cn("rounded-[1.6rem] border border-white/70 p-5 shadow-soft", card.tone)}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pedidos recebidos</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cada card acompanha a etapa atual do produto, desde a resposta inicial até o envio para financeiro e expedição.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} pedidos</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((order) => {
              const nextStep = getSupplierOrderNextStep(order.workflowStage as never, Boolean(order.financialEntry));

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openOrder(order)}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                        <Image
                          src={order.imageUrl ?? "/brand/pepper-logo.png"}
                          alt={order.productName}
                          fill
                          className="object-cover p-1.5"
                          sizes="56px"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                        <p className="text-xs text-slate-500">{order.originLabel}</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierOrderWorkflowTone(order.workflowStage as never))}>
                      {order.workflowStageLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{order.productName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Previsto {order.estimatedTotalCostLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Confirmado {order.confirmedTotalCostLabel}</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getSupplierOrderLinkedModules(order.workflowStage as never, Boolean(order.financialEntry)).map((module) => (
                      <span key={module} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {module}
                      </span>
                    ))}
                    {order.financialEntry ? (
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", getSupplierFinancialStatusTone(order.financialEntry.status as never))}>
                        Financeiro {order.financialEntry.statusLabel}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhum pedido recebido ainda.
            </div>
          )}
        </div>
      </section>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={() => setSelectedOrderId(null)}>
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-white bg-white shadow-sm">
                  <Image
                    src={selectedOrder.imageUrl ?? "/brand/pepper-logo.png"}
                    alt={selectedOrder.productName}
                    fill
                    className="object-cover p-2"
                    sizes="80px"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo operacional</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrder.productName}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedOrder.orderNumber} • {selectedOrder.originLabel}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedOrderId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Etapa: {selectedOrder.workflowStageLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Previsto: {selectedOrder.estimatedTotalCostLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Confirmado: {currency(computedConfirmedTotal)}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {selectedOrder.financialEntry ? `Financeiro ${selectedOrder.financialEntry.statusLabel}` : "Ainda fora do financeiro"}
              </div>
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

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Variação</th>
                      <th className="px-4 py-3 text-left font-semibold">Solicitado</th>
                      <th className="px-4 py-3 text-left font-semibold">Atendido</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => {
                      const local = itemState[item.id];
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{item.color} - {item.size}</p>
                            <p className="text-[11px] text-slate-500">{item.sku}</p>
                          </td>
                          <td className="px-4 py-3">{item.requestedQuantity}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              value={local?.fulfilledQuantity ?? item.fulfilledQuantity}
                              onChange={(event) =>
                                setItemState((current) => ({
                                  ...current,
                                  [item.id]: {
                                    fulfilledQuantity: Number(event.target.value || 0),
                                    itemStatus: current[item.id]?.itemStatus ?? item.itemStatus,
                                    supplierItemNote: current[item.id]?.supplierItemNote ?? item.supplierItemNote ?? "",
                                    confirmedUnitCost: current[item.id]?.confirmedUnitCost ?? item.confirmedUnitCost ?? item.unitCost
                                  }
                                }))
                              }
                              className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={local?.itemStatus ?? item.itemStatus}
                              onChange={(event) =>
                                setItemState((current) => ({
                                  ...current,
                                  [item.id]: {
                                    fulfilledQuantity: current[item.id]?.fulfilledQuantity ?? item.fulfilledQuantity,
                                    itemStatus: event.target.value,
                                    supplierItemNote: current[item.id]?.supplierItemNote ?? item.supplierItemNote ?? "",
                                    confirmedUnitCost: current[item.id]?.confirmedUnitCost ?? item.confirmedUnitCost ?? item.unitCost
                                  }
                                }))
                              }
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                              <option value="PENDING">Pendente</option>
                              <option value="AVAILABLE">Disponível</option>
                              <option value="PARTIAL">Parcial</option>
                              <option value="NO_STOCK">Sem estoque</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observação do fornecedor</span>
                  <textarea
                    value={supplierNote}
                    onChange={(event) => setSupplierNote(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Previsão de envio / vencimento</span>
                  <input
                    type="date"
                    value={expectedShipDate}
                    onChange={(event) => setExpectedShipDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={supplierHasNoStock} onChange={(event) => setSupplierHasNoStock(event.target.checked)} />
                  Não possuo estoque de nenhum item solicitado
                </label>

                <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Anexar romaneio</span>
                  <input id="romaneio-upload-v2" type="file" className="block w-full text-sm text-slate-500" />
                </label>

                <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Adicionar nota fiscal</span>
                  <input id="nota-fiscal-upload-v2" type="file" className="block w-full text-sm text-slate-500" />
                </label>

                {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void submitUpdate("SUPPLIER_REVIEWED")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {pendingAction === "save" ? "Salvando..." : "Salvar ajustes"}
                  </button>

                  {(selectedOrder.workflowStage === "AWAITING_RESPONSE" || selectedOrder.workflowStage === "NO_STOCK") ? (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void submitUpdate("IN_PREPARATION", "PREPARE_ORDER")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingAction === "prepare" ? "Preparando..." : "Em preparação"}
                    </button>
                  ) : null}

                  {selectedOrder.workflowStage === "IN_PREPARATION" ? (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void submitUpdate("SUPPLIER_REVIEWED", "CONFIRM_SEPARATION")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingAction === "confirm" ? "Confirmando..." : "Confirmar separação"}
                    </button>
                  ) : null}

                  {selectedOrder.workflowStage === "SEPARATION_CONFIRMED" && !selectedOrder.financialEntry ? (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void submitToFinancial()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingAction === "financial" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                      {pendingAction === "financial" ? "Enviando..." : "Enviar para financeiro"}
                    </button>
                  ) : null}

                  {selectedOrder.workflowStage === "PAID" ? (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void submitUpdate("SHIPPED", "MARK_SHIPPED")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingAction === "shipped" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {pendingAction === "shipped" ? "Enviando..." : "Marcar enviado"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => {
                      setSupplierHasNoStock(true);
                      void submitUpdate("NO_STOCK", "MARK_NO_STOCK");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "no-stock" ? "Marcando..." : "Sem estoque total"}
                  </button>
                </div>
              </div>
            </div>

            {selectedOrder.workflowHistory.length > 0 ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Histórico operacional</p>
                {selectedOrder.workflowHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <strong>{entry.toStageLabel}</strong> • {entry.createdAt}
                    {entry.note ? <p className="mt-1">{entry.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}


