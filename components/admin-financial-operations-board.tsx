"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, Wallet, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AdminFinancialBoardEntry } from "@/lib/supplier-financial-entries";
import { getSupplierFinancialNextStep, getSupplierFinancialStatusTone } from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";

function currency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function AdminFinancialOperationsBoard({ entries }: { entries: AdminFinancialBoardEntry[] }) {
  const [rows] = useState(entries);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEntry = rows.find((item) => item.id === selectedEntryId) ?? null;

  const summary = useMemo(
    () => ({
      inReview: rows.filter((entry) => entry.status === "IN_REVIEW").length,
      pending: rows.filter((entry) => entry.status === "PENDING_PAYMENT").length,
      paid: rows.filter((entry) => entry.status === "PAID").length,
      rejected: rows.filter((entry) => entry.status === "REJECTED").length
    }),
    [rows]
  );

  async function updateFinancial(status: "IN_REVIEW" | "PENDING_PAYMENT" | "PAID" | "REJECTED") {
    if (!selectedEntry) return;

    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/financial-entries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financialEntryId: selectedEntry.id,
        status,
        note,
        dueDate: dueDate || null
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar o financeiro.");
      return;
    }

    setFeedback("Card financeiro atualizado com sucesso.");
    window.location.reload();
  }

  function openEntry(entry: AdminFinancialBoardEntry) {
    setSelectedEntryId(entry.id);
    setNote(entry.note ?? entry.supplierNote ?? "");
    setDueDate(entry.dueDate ? entry.dueDate.split("/").reverse().join("-") : "");
    setFeedback(null);
    setError(null);
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <div className="rounded-[1.6rem] border border-white/70 bg-rose-50 p-5 shadow-soft text-rose-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Recusados</p>
          <p className="mt-3 text-3xl font-semibold">{summary.rejected}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cards financeiros em andamento</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cada card nasce vinculado ao pedido e ao produto de origem, mantendo revisao, pagamento e historico centralizados.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} cards</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.length > 0 ? (
            rows.map((entry) => {
              const nextStep = getSupplierFinancialNextStep(entry.status);

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openEntry(entry)}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.productName}</p>
                      <p className="text-xs text-slate-500">{entry.supplierName}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", getSupplierFinancialStatusTone(entry.status))}>
                      {entry.statusLabel}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.amountLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.originLabel}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.dueDate ? `Venc. ${entry.dueDate}` : "Sem vencimento"}</div>
                    <div className="rounded-xl bg-white px-3 py-2 text-slate-600">{entry.attachments.length} anexos</div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhum card financeiro criado ainda.
            </div>
          )}
        </div>
      </section>

      {selectedEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Origem da cobranca</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedEntry.productName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedEntry.originLabel} • {selectedEntry.supplierName}</p>
              </div>
              <button type="button" onClick={() => setSelectedEntryId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                    <Image src={selectedEntry.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedEntry.productName} fill className="object-contain p-2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedEntry.productName}</p>
                    <p className="text-xs text-slate-500">{selectedEntry.productSku}</p>
                    <p className="mt-2 text-xs text-slate-500">Valor {selectedEntry.amountLabel}</p>
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
                  <div>
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
              </div>

              <div className="space-y-4">
                <OperationsFlowPanel
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

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao da revisao</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
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

                {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => startTransition(() => void updateFinancial("IN_REVIEW"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Em revisão
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void updateFinancial("PENDING_PAYMENT"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f3a266] px-4 py-3 text-sm font-semibold text-white"
                  >
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void updateFinancial("PAID"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar pago
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void updateFinancial("REJECTED"))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Recusar
                  </button>
                </div>

                {selectedEntry.history.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Historico</p>
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
