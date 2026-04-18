"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, PackageSearch, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierOrderRow = {
  id: string;
  orderNumber: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  status: string;
  statusLabel: string;
  adminNote: string | null;
  supplierNote: string | null;
  supplierHasNoStock: boolean;
  createdAt: string;
  respondedAt: string | null;
  shippedAt: string | null;
  expectedShipDate: string | null;
  estimatedTotalCost: number;
  estimatedTotalCostLabel: string;
  confirmedTotalCost: number;
  confirmedTotalCostLabel: string;
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

function statusClassName(status: string) {
  if (status === "SHIPPED") return "bg-emerald-100 text-emerald-700";
  if (status === "IN_PREPARATION") return "bg-sky-100 text-sky-700";
  if (status === "PARTIALLY_FULFILLED") return "bg-amber-100 text-amber-700";
  if (status === "NO_STOCK") return "bg-rose-100 text-rose-700";
  if (status === "SUPPLIER_REVIEWED") return "bg-violet-100 text-violet-700";
  return "bg-[#fff1e7] text-[#a94b25]";
}

function currency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function SupplierReceivedOrdersPanel({ orders }: { orders: SupplierOrderRow[] }) {
  const [rows, setRows] = useState(orders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [supplierNote, setSupplierNote] = useState("");
  const [expectedShipDate, setExpectedShipDate] = useState("");
  const [supplierHasNoStock, setSupplierHasNoStock] = useState(false);
  const [itemState, setItemState] = useState<Record<string, { fulfilledQuantity: number; itemStatus: string; supplierItemNote: string; confirmedUnitCost: number }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) ?? null;

  const summaryCards = useMemo(
    () => [
      { label: "Aguardando resposta", value: rows.filter((row) => row.status === "AWAITING_SUPPLIER").length, tone: "bg-[#fff7ec] text-[#a94b25]" },
      { label: "Em preparacao", value: rows.filter((row) => row.status === "IN_PREPARATION").length, tone: "bg-sky-50 text-sky-700" },
      { label: "Enviados", value: rows.filter((row) => row.status === "SHIPPED").length, tone: "bg-emerald-50 text-emerald-700" },
      { label: "Sem estoque", value: rows.filter((row) => row.status === "NO_STOCK").length, tone: "bg-rose-50 text-rose-700" }
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

  async function submitUpdate(nextStatus: "SUPPLIER_REVIEWED" | "IN_PREPARATION" | "SHIPPED" | "NO_STOCK") {
    if (!selectedOrder) return;

    setFeedback(null);
    setError(null);

    const formData = new FormData();
    formData.set("orderId", selectedOrder.id);
    formData.set("supplierNote", supplierNote);
    formData.set("expectedShipDate", expectedShipDate);
    formData.set("supplierHasNoStock", supplierHasNoStock || nextStatus === "NO_STOCK" ? "true" : "false");
    formData.set("status", nextStatus);
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

    const fileInput = document.getElementById("romaneio-upload") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (file) {
      formData.set("romaneio", file);
    }

    const response = await fetch("/api/supplier/supplier-orders", {
      method: "PATCH",
      body: formData
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar o pedido.");
      return;
    }

    setFeedback("Pedido atualizado com sucesso.");
    window.location.reload();
  }

  function openOrder(order: SupplierOrderRow) {
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
              Clique em um card para responder o pedido, informar estoque real, anexar romaneio e atualizar o andamento.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} pedidos</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openOrder(order)}
                className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                    <p className="text-xs text-slate-500">{order.createdAt}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", statusClassName(order.status))}>
                    {order.statusLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{order.productName}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Previsto {order.estimatedTotalCostLabel}</div>
                  <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Confirmado {order.confirmedTotalCostLabel}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.attachments.length > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Com romaneio</span>
                  ) : null}
                  {order.supplierHasNoStock ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">Sem estoque total</span>
                  ) : null}
                </div>
              </button>
            ))
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo do pedido</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrder.orderNumber}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedOrder.productName} • {selectedOrder.productSku}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrderId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Status: {selectedOrder.statusLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Previsto: {selectedOrder.estimatedTotalCostLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Confirmado: {currency(computedConfirmedTotal)}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedOrder.attachments.length > 0 ? "Romaneio anexado" : "Sem romaneio"}</div>
            </div>

            {selectedOrder.adminNote ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Observacao da Pepper:</strong> {selectedOrder.adminNote}
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Variacao</th>
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
                              <option value="AVAILABLE">Disponivel</option>
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
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do fornecedor</span>
                  <textarea
                    value={supplierNote}
                    onChange={(event) => setSupplierNote(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    placeholder="Ex.: consigo atender parte da grade agora e o restante em novo lote."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Previsao de envio</span>
                  <input
                    type="date"
                    value={expectedShipDate}
                    onChange={(event) => setExpectedShipDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={supplierHasNoStock}
                    onChange={(event) => setSupplierHasNoStock(event.target.checked)}
                  />
                  Nao possuo estoque de nenhum item solicitado
                </label>

                <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Romaneio / anexo</span>
                  <input id="romaneio-upload" type="file" className="block w-full text-sm text-slate-500" />
                </label>

                {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => startTransition(() => void submitUpdate("SUPPLIER_REVIEWED"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Enviar resposta
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void submitUpdate("IN_PREPARATION"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Em preparacao
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void submitUpdate("SHIPPED"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Marcar enviado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierHasNoStock(true);
                      startTransition(() => void submitUpdate("NO_STOCK"));
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Sem estoque total
                  </button>
                </div>
              </div>
            </div>

            {selectedOrder.attachments.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">Historico de romaneios</p>
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
                      {attachment.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedOrder.history.length > 0 ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Historico do pedido</p>
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
      ) : null}
    </section>
  );
}
