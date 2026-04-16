"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, ShoppingCart, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { getReplenishmentNextStep, getSupplierOrderWorkflowTone } from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";

type RequestRow = {
  id: string;
  supplierName: string;
  createdBy: string;
  reviewedBy: string | null;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusLabel: string;
  htmlContent: string;
  createdAt: string;
  reviewedAt: string | null;
  requestedUnits: number;
  linkedOrder: {
    id: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    hasFinancialEntry: boolean;
  } | null;
  items: Array<{
    id: string;
    sku: string;
    size: string;
    color: string;
    currentStock: number | null;
    requestedQuantity: number;
  }>;
};

function requestTone(status: RequestRow["status"]) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-[#fff1e7] text-[#a94b25]";
}

function metricTone(name: "pending" | "approved" | "linked" | "rejected") {
  if (name === "approved") return "bg-emerald-50 text-emerald-700";
  if (name === "linked") return "bg-sky-50 text-sky-700";
  if (name === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-[#fff8f4] text-[#a94b25]";
}

export function AdminReplenishmentRequestsV2({ requests }: { requests: RequestRow[] }) {
  const [rows] = useState(requests);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"APPROVED" | "REJECTED" | null>(null);

  const summary = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "PENDING").length,
      approved: rows.filter((row) => row.status === "APPROVED").length,
      linked: rows.filter((row) => row.linkedOrder).length,
      rejected: rows.filter((row) => row.status === "REJECTED").length
    }),
    [rows]
  );

  const selectedRequest = rows.find((row) => row.id === selectedRequestId) ?? null;

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
    setFeedback(null);
    setError(null);
    setPendingStatus(status);

    try {
      const response = await fetch("/api/admin/replenishment-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar a solicitacao.");
        return;
      }

      setFeedback(
        status === "APPROVED"
          ? "Sugestao de compra aprovada. O card ja pode seguir para pedido ao fornecedor."
          : "Sugestao de compra recusada com sucesso."
      );
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar a solicitacao.");
    } finally {
      setPendingStatus(null);
    }
  }

  function downloadHtml(request: RequestRow) {
    const blob = new Blob([request.htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `solicitacao-reposicao-${request.productSku.replaceAll("/", "-")}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Fluxo de compra</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Solicitacoes de reposicao</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card representa uma sugestao de compra do fornecedor. Ao aprovar, o sistema pode gerar automaticamente o pedido operacional.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {rows.length} cards no fluxo
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Pendentes" value={summary.pending} tone={metricTone("pending")} />
          <MetricCard label="Aprovadas" value={summary.approved} tone={metricTone("approved")} />
          <MetricCard label="Com pedido gerado" value={summary.linked} tone={metricTone("linked")} />
          <MetricCard label="Recusadas" value={summary.rejected} tone={metricTone("rejected")} />
        </div>
      </section>

      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cards da fila de aprovacao</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Abra um card para ver a grade cor x tamanho, a observacao do fornecedor e se a aprovacao ja virou pedido operacional.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} solicitacoes</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((request) => {
              const nextStep = getReplenishmentNextStep(request.status, request.linkedOrder);

              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedRequestId(request.id)}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white bg-white">
                      <Image src={request.imageUrl ?? "/brand/pepper-logo.png"} alt={request.productName} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{request.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{request.supplierName}</p>
                        </div>
                        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", requestTone(request.status))}>
                          {request.statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1">{request.productSku}</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{request.createdAt}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1">{request.items.length} variacoes</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{request.requestedUnits} unidades</span>
                        {request.linkedOrder ? (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                            Pedido {request.linkedOrder.orderNumber}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhuma solicitacao de reposicao enviada ainda.
            </div>
          )}
        </div>
      </section>

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo operacional</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRequest.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Sugestao de compra • {selectedRequest.supplierName} • {selectedRequest.createdAt}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedRequestId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MetricValue label="Status" value={selectedRequest.statusLabel} tone={requestTone(selectedRequest.status)} />
              <MetricValue label="SKU principal" value={selectedRequest.productSku} tone="bg-slate-50 text-slate-700" />
              <MetricValue label="Variacoes" value={String(selectedRequest.items.length)} tone="bg-slate-50 text-slate-700" />
              <MetricValue label="Qtd. sugerida" value={String(selectedRequest.requestedUnits)} tone="bg-slate-50 text-slate-700" />
            </div>

            <OperationsFlowPanel
              className="mt-5"
              originLabel="Sugestao de compra"
              currentLabel={selectedRequest.statusLabel}
              currentTone={requestTone(selectedRequest.status)}
              nextLabel={getReplenishmentNextStep(selectedRequest.status, selectedRequest.linkedOrder).label}
              nextDescription={getReplenishmentNextStep(selectedRequest.status, selectedRequest.linkedOrder).description}
              modules={[
                { label: "Sugestao de compra", tone: "bg-white text-slate-700" },
                ...(selectedRequest.linkedOrder ? [{ label: "Pedido ao fornecedor", tone: "bg-sky-50 text-sky-700" }] : []),
                ...(selectedRequest.linkedOrder?.hasFinancialEntry ? [{ label: "Financeiro", tone: "bg-indigo-50 text-indigo-700" }] : [])
              ]}
            />

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                    <Image src={selectedRequest.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedRequest.productName} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedRequest.productName}</p>
                    <p className="text-xs text-slate-500">{selectedRequest.productSku}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Enviado por {selectedRequest.createdBy}
                      {selectedRequest.reviewedBy ? ` • revisado por ${selectedRequest.reviewedBy}` : ""}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Cor</th>
                        <th className="px-4 py-3 text-left font-semibold">Tamanho</th>
                        <th className="px-4 py-3 text-left font-semibold">SKU</th>
                        <th className="px-4 py-3 text-left font-semibold">Estoque atual</th>
                        <th className="px-4 py-3 text-left font-semibold">Qtd. sugerida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRequest.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">{item.color}</td>
                          <td className="px-4 py-3">{item.size}</td>
                          <td className="px-4 py-3">{item.sku}</td>
                          <td className="px-4 py-3">{item.currentStock ?? "-"}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{item.requestedQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedRequest.note ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Observacao do fornecedor</p>
                    <p className="mt-3 leading-6">{selectedRequest.note}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShoppingCart className="h-4 w-4" />
                    Proximo modulo
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    {selectedRequest.linkedOrder ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="font-semibold text-slate-900">{selectedRequest.linkedOrder.orderNumber}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierOrderWorkflowTone(selectedRequest.linkedOrder.workflowStage as never))}>
                            {selectedRequest.linkedOrder.workflowStageLabel}
                          </span>
                          {selectedRequest.linkedOrder.hasFinancialEntry ? (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                              Financeiro ativo
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        Ao aprovar, este card pode gerar automaticamente um pedido ao fornecedor.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadHtml(selectedRequest)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    Baixar HTML
                  </button>

                  {selectedRequest.status !== "APPROVED" ? (
                    <button
                      type="button"
                      disabled={pendingStatus !== null}
                      onClick={() => void updateStatus(selectedRequest.id, "APPROVED")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingStatus === "APPROVED" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {pendingStatus === "APPROVED" ? "Aprovando..." : "Aprovar"}
                    </button>
                  ) : null}

                  {selectedRequest.status !== "REJECTED" ? (
                    <button
                      type="button"
                      disabled={pendingStatus !== null}
                      onClick={() => void updateStatus(selectedRequest.id, "REJECTED")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingStatus === "REJECTED" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      {pendingStatus === "REJECTED" ? "Recusando..." : "Recusar"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-[1.6rem] border border-white/70 p-5 shadow-soft", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function MetricValue({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3 text-sm", tone)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
