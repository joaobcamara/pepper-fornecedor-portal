"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Wallet, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type SupplierFinancialBoardEntry,
  type SupplierFinancialReadyOrder,
  getSupplierFinancialSummary
} from "@/lib/supplier-financial-shared";
import {
  getSupplierFinancialNextStep,
  getSupplierFinancialStatusTone,
  getSupplierOrderLinkedModules,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowTone
} from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";

function currency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const SUPPLIER_FINANCIAL_FLASH_KEY = "supplier-financial:flash";

export function SupplierFinancialOperationsBoard({
  readyOrders,
  entries
}: {
  readyOrders: SupplierFinancialReadyOrder[];
  entries: SupplierFinancialBoardEntry[];
}) {
  const [selectedReadyOrderId, setSelectedReadyOrderId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [supplierNote, setSupplierNote] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedReadyOrder = readyOrders.find((item) => item.id === selectedReadyOrderId) ?? null;
  const selectedEntry = entries.find((item) => item.id === selectedEntryId) ?? null;
  const summary = useMemo(() => getSupplierFinancialSummary(entries), [entries]);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(SUPPLIER_FINANCIAL_FLASH_KEY);

    if (flash) {
      setFeedback(flash);
      window.sessionStorage.removeItem(SUPPLIER_FINANCIAL_FLASH_KEY);
    }
  }, []);

  async function submitToFinancial() {
    if (!selectedReadyOrder) return;

    setFeedback(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("orderId", selectedReadyOrder.id);
      formData.set("dueDate", dueDate);
      formData.set("note", note);
      formData.set("supplierNote", supplierNote);
      formData.set("amount", amount || String(selectedReadyOrder.confirmedTotalCost));

      const romaneioInput = document.getElementById("financial-romaneio-upload") as HTMLInputElement | null;
      const notaInput = document.getElementById("financial-nota-upload") as HTMLInputElement | null;
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
          storedInFoundation: boolean;
          visibleForAdminFinancial: boolean;
          supplierWorkflowMoved: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel enviar para o financeiro.");
        return;
      }

      const successMessage =
        payload.verification?.storedInFoundation &&
        payload.verification?.visibleForAdminFinancial &&
        payload.verification?.supplierWorkflowMoved
          ? "Card enviado, validado na fundacao e pronto para revisao financeira do admin."
          : "Card enviado para revisao financeira.";
      window.sessionStorage.setItem(SUPPLIER_FINANCIAL_FLASH_KEY, successMessage);
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar para o financeiro.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.6rem] border border-white/70 bg-[#fff7ec] p-5 shadow-soft text-[#a94b25]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Prontos para financeiro</p>
          <p className="mt-3 text-3xl font-semibold">{readyOrders.length}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/70 bg-indigo-50 p-5 shadow-soft text-indigo-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Em revisão</p>
          <p className="mt-3 text-3xl font-semibold">{summary.inReview}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/70 bg-[#fff7ec] p-5 shadow-soft text-[#a94b25]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Pendentes</p>
          <p className="mt-3 text-3xl font-semibold">{summary.pending}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/70 bg-emerald-50 p-5 shadow-soft text-emerald-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Pagos</p>
          <p className="mt-3 text-3xl font-semibold">{summary.paid}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pedidos prontos para o financeiro</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Depois de confirmar a separacao, envie o card para revisao financeira com romaneio e nota fiscal.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{readyOrders.length} cards</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readyOrders.length > 0 ? (
            readyOrders.map((order) => {
              const nextStep = getSupplierOrderNextStep(order.workflowStage, false);

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedReadyOrderId(order.id);
                    setSelectedEntryId(null);
                    setDueDate("");
                    setNote("");
                    setSupplierNote("");
                    setAmount(String(order.confirmedTotalCost));
                  }}
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
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierOrderWorkflowTone(order.workflowStage))}>
                      {order.workflowStageLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{order.productName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Valor {order.confirmedTotalCostLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{order.items.length} variacoes</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhum pedido pronto para financeiro neste momento.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cards financeiros</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Acompanhe o que esta em revisao, pendente, pago ou recusado, sempre vinculado ao pedido de origem.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{entries.length} cards</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.length > 0 ? (
            entries.map((entry) => {
              const nextStep = getSupplierFinancialNextStep(entry.status);

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                    setSelectedReadyOrderId(null);
                  }}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                        <Image
                          src={entry.imageUrl ?? "/brand/pepper-logo.png"}
                          alt={entry.productName}
                          fill
                          className="object-cover p-1.5"
                          sizes="56px"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                        <p className="text-xs text-slate-500">{entry.originLabel}</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierFinancialStatusTone(entry.status))}>
                      {entry.statusLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{entry.productName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.amountLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.dueDate ? `Venc. ${entry.dueDate}` : "Sem vencimento"}</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhum lancamento financeiro enviado ainda.
            </div>
          )}
        </div>
      </section>

      {selectedReadyOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Origem do card</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedReadyOrder.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedReadyOrder.orderNumber} • {selectedReadyOrder.originLabel}</p>
              </div>
              <button type="button" onClick={() => setSelectedReadyOrderId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                    <Image src={selectedReadyOrder.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedReadyOrder.productName} fill className="object-contain p-2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedReadyOrder.productName}</p>
                    <p className="text-xs text-slate-500">{selectedReadyOrder.productSku}</p>
                    <p className="mt-2 text-xs text-slate-500">Valor confirmado: {selectedReadyOrder.confirmedTotalCostLabel}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Cor</th>
                        <th className="px-4 py-3 text-left font-semibold">Tamanho</th>
                        <th className="px-4 py-3 text-left font-semibold">Solicitado</th>
                        <th className="px-4 py-3 text-left font-semibold">Separado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReadyOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">{item.color}</td>
                          <td className="px-4 py-3">{item.size}</td>
                          <td className="px-4 py-3">{item.requestedQuantity}</td>
                          <td className="px-4 py-3">{item.fulfilledQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <OperationsFlowPanel
                  originLabel={selectedReadyOrder.originLabel}
                  currentLabel={selectedReadyOrder.workflowStageLabel}
                  currentTone={getSupplierOrderWorkflowTone(selectedReadyOrder.workflowStage)}
                  nextLabel={getSupplierOrderNextStep(selectedReadyOrder.workflowStage, false).label}
                  nextDescription={getSupplierOrderNextStep(selectedReadyOrder.workflowStage, false).description}
                  modules={getSupplierOrderLinkedModules(selectedReadyOrder.workflowStage, false).map((module) => ({
                    label: module,
                    tone: module === "Financeiro" ? "bg-indigo-50 text-indigo-700" : "bg-white text-slate-700"
                  }))}
                />

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Valor total</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Vencimento</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao financeira</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    placeholder="Ex.: cobranca referente ao pedido separado e pronto para pagamento."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do fornecedor</span>
                  <textarea
                    value={supplierNote}
                    onChange={(event) => setSupplierNote(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Anexar romaneio</span>
                  <input id="financial-romaneio-upload" type="file" className="block w-full text-sm text-slate-500" />
                </label>

                <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Adicionar nota fiscal</span>
                  <input id="financial-nota-upload" type="file" className="block w-full text-sm text-slate-500" />
                </label>

                {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void submitToFinancial()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {isSubmitting ? "Enviando..." : "Enviar para financeiro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Card financeiro</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedEntry.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedEntry.originLabel} • {selectedEntry.amountLabel}</p>
              </div>
              <button type="button" onClick={() => setSelectedEntryId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Status: {selectedEntry.statusLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Valor: {selectedEntry.amountLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedEntry.dueDate ? `Venc. ${selectedEntry.dueDate}` : "Sem vencimento"}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{selectedEntry.paidAt ? `Pago em ${selectedEntry.paidAt}` : "Aguardando andamento"}</div>
            </div>

            <OperationsFlowPanel
              className="mt-5"
              originLabel={`${selectedEntry.originLabel} • ${selectedEntry.orderNumber}`}
              currentLabel={selectedEntry.statusLabel}
              currentTone={getSupplierFinancialStatusTone(selectedEntry.status)}
              nextLabel={getSupplierFinancialNextStep(selectedEntry.status).label}
              nextDescription={getSupplierFinancialNextStep(selectedEntry.status).description}
              modules={[
                { label: "Pedido ao fornecedor", tone: "bg-white text-slate-700" },
                { label: "Financeiro", tone: "bg-indigo-50 text-indigo-700" },
                ...(selectedEntry.status === "PAID" ? [{ label: "Envio", tone: "bg-emerald-50 text-emerald-700" }] : [])
              ]}
            />

            <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Cor</th>
                    <th className="px-4 py-3 text-left font-semibold">Tamanho</th>
                    <th className="px-4 py-3 text-left font-semibold">Solicitado</th>
                    <th className="px-4 py-3 text-left font-semibold">Separado</th>
                    <th className="px-4 py-3 text-left font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEntry.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.color}</td>
                      <td className="px-4 py-3">{item.size}</td>
                      <td className="px-4 py-3">{item.requestedQuantity}</td>
                      <td className="px-4 py-3">{item.fulfilledQuantity}</td>
                      <td className="px-4 py-3">{currency(item.confirmedTotalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedEntry.attachments.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">Anexos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedEntry.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {attachment.kindLabel}: {attachment.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedEntry.history.length > 0 ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Historico financeiro</p>
                {selectedEntry.history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <strong>{entry.statusLabel}</strong> • {entry.createdAt}
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
