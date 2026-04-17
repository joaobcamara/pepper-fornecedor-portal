"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";
import { WhatsAppShareStatus } from "@prisma/client";

import type { WhatsAppShareLinkView } from "@/lib/whatsapp-share";

function statusTone(status: WhatsAppShareStatus) {
  switch (status) {
    case WhatsAppShareStatus.APPROVED:
      return "bg-emerald-100 text-emerald-700";
    case WhatsAppShareStatus.CHANGES_REQUESTED:
      return "bg-amber-100 text-amber-700";
    case WhatsAppShareStatus.REJECTED:
      return "bg-rose-100 text-rose-700";
    case WhatsAppShareStatus.CLOSED:
      return "bg-slate-200 text-slate-700";
    case WhatsAppShareStatus.OPEN:
    default:
      return "bg-sky-100 text-sky-700";
  }
}

function statusLabel(status: WhatsAppShareStatus) {
  switch (status) {
    case WhatsAppShareStatus.APPROVED:
      return "Aprovado";
    case WhatsAppShareStatus.CHANGES_REQUESTED:
      return "Pediu alteracao";
    case WhatsAppShareStatus.REJECTED:
      return "Recusado";
    case WhatsAppShareStatus.CLOSED:
      return "Fechado";
    case WhatsAppShareStatus.OPEN:
    default:
      return "Aberto";
  }
}

export function WhatsAppShareView({
  link
}: {
  link: WhatsAppShareLinkView;
}) {
  const [rows, setRows] = useState(link.items);
  const [note, setNote] = useState(link.note);
  const [statusNote, setStatusNote] = useState(link.statusNote);
  const [status, setStatus] = useState<WhatsAppShareStatus>(link.status);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const sizeLabels = useMemo(() => Array.from(new Set(rows.map((item) => item.sizeLabel))), [rows]);
  const colorLabels = useMemo(() => Array.from(new Set(rows.map((item) => item.colorLabel))), [rows]);
  const totalRequested = useMemo(
    () => rows.reduce((sum, item) => sum + item.requestedQuantity, 0),
    [rows]
  );
  const requestChangedCount = useMemo(
    () => rows.filter((item) => item.requestedQuantity !== item.originalRequestedQuantity).length,
    [rows]
  );
  const stockChangedCount = useMemo(
    () => rows.filter((item) => item.stockChanged).length,
    [rows]
  );
  const noteChanged = note.trim() !== link.originalNote.trim();
  const hasRecipientChanges = requestChangedCount > 0 || noteChanged;

  async function saveChanges(nextStatus?: WhatsAppShareStatus) {
    setError(null);
    setFeedback(null);
    setBusyAction(nextStatus ?? "SAVE");

    try {
      const response = await fetch(`/api/whatsapp-links/by-slug/${link.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          note,
          status: nextStatus,
          statusNote,
          items: rows.map((item) => ({
            sku: item.sku,
            requestedQuantity: item.requestedQuantity
          }))
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel atualizar o link.");
      }

      if (nextStatus) {
        setStatus(nextStatus);
        setFeedback("Status atualizado com sucesso.");
      } else {
        setFeedback("Alteracoes salvas no link.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7f2] px-3 py-4 text-slate-700 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-panel">
          <div className="bg-[linear-gradient(135deg,#1f2937_0%,#0f172a_45%,#ea580c_120%)] px-5 py-6 text-white sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-200">Compartilhamento Pepper</p>
                <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{link.productName}</h1>
                <p className="mt-2 text-sm text-slate-200">
                  {link.productSku}
                  {link.supplierName ? ` | ${link.supplierName}` : ""}
                </p>
              </div>
              <div className="relative h-20 w-20 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10">
                <Image src={link.imageUrl} alt={link.productName} fill className="object-cover" sizes="80px" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${statusTone(status)}`}>{statusLabel(status)}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-orange-100">{link.templateLabel}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-orange-100">
                Estoque real da fundacao: {link.totalCurrentStock}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-orange-100">
                Criado {link.createdAtLabel}
              </span>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-4 sm:px-6">
            <MetricCard label="Pedido" value={totalRequested.toString()} />
            <MetricCard label="Vendas 7d" value={link.metrics.sales7d.toString()} />
            <MetricCard label="Vendas 30d" value={link.metrics.sales30d.toString()} />
            <MetricCard
              label="Cobertura"
              value={link.metrics.coverageDays === null ? "Sem base" : `${link.metrics.coverageDays} dias`}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-4 text-xs sm:px-6">
            <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              {requestChangedCount} itens alterados
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              {stockChangedCount} estoques mudaram
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              Observacao {noteChanged ? "alterada" : "sem mudanca"}
            </span>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-panel sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Produto portatil</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Esta tela usa estoque real da fundacao. Os nomes de cor e tamanho aparecem maiores para facilitar o uso no celular.
              </p>
            </div>
            <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">
              Pepper IA no portal
            </span>
          </div>

          {hasRecipientChanges || stockChangedCount > 0 ? (
            <div className="mt-4 rounded-[1.6rem] border border-[#f3d0bd] bg-[#fff8f4] px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-[#a94b25]">Mudancas detectadas neste link</p>
              <p className="mt-2 leading-6">
                {requestChangedCount > 0 ? `${requestChangedCount} variacoes tiveram ajuste de pedido. ` : ""}
                {stockChangedCount > 0 ? `${stockChangedCount} variacoes mudaram de estoque desde a criacao. ` : ""}
                {noteChanged ? "A observacao tambem foi alterada." : "A observacao segue igual ao texto original."}
              </p>
            </div>
          ) : null}

          {link.template === "UNIQUE_COLOR_CARDS" ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {rows.map((item) => (
                <article key={item.id} className="rounded-[1.5rem] border border-[#f3d0bd] bg-[#fffaf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{item.colorLabel}</p>
                      <p className="mt-1 text-base font-semibold text-[#a94b25]">{item.sizeLabel}</p>
                    </div>
                    {item.requestChanged || item.stockChanged ? (
                      <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a94b25]">
                        Alterado
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricCard label="Estoque" value={String(item.currentStock ?? "-")} />
                    <MetricCard label="Pedido" value={String(item.requestedQuantity)} />
                  </div>
                  {item.requestedQuantity !== item.originalRequestedQuantity ? (
                    <p className="mt-3 text-sm font-semibold text-[#a94b25]">
                      Pedido original: {item.originalRequestedQuantity}
                    </p>
                  ) : null}
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Quantidade desta cor</span>
                    <input
                      type="number"
                      min={0}
                      value={item.requestedQuantity}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  requestedQuantity: Number(event.target.value || 0)
                                }
                              : row
                          )
                        )
                      }
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-lg font-semibold text-slate-900 outline-none"
                    />
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-slate-200">
              <div
                className="grid min-w-[640px] bg-slate-50 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                style={{ gridTemplateColumns: `1.15fr repeat(${sizeLabels.length}, minmax(0, 1fr))` }}
              >
                <div className="px-4 py-3">Cor</div>
                {sizeLabels.map((size) => (
                  <div key={size} className="px-4 py-3 text-center text-sm">
                    {size}
                  </div>
                ))}
              </div>
              {colorLabels.map((color) => (
                <div
                  key={color}
                  className="grid border-t border-slate-100 bg-white"
                  style={{ gridTemplateColumns: `1.15fr repeat(${sizeLabels.length}, minmax(0, 1fr))` }}
                >
                  <div className="px-4 py-4 text-lg font-semibold text-slate-900">{color}</div>
                  {sizeLabels.map((size) => {
                    const item = rows.find((row) => row.colorLabel === color && row.sizeLabel === size) ?? null;

                    return (
                      <div key={`${color}-${size}`} className="px-3 py-3">
                        {item ? (
                          <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-lg font-semibold text-slate-900">estoque {item.currentStock ?? "-"}</p>
                            {item.requestedQuantity !== item.originalRequestedQuantity ? (
                              <p className="mt-1 text-sm font-semibold text-[#a94b25]">
                                original {item.originalRequestedQuantity}
                              </p>
                            ) : null}
                            <input
                              type="number"
                              min={0}
                              value={item.requestedQuantity}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((row) =>
                                    row.id === item.id
                                      ? {
                                          ...row,
                                          requestedQuantity: Number(event.target.value || 0)
                                        }
                                      : row
                                  )
                                )
                              }
                              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-lg font-semibold text-slate-900 outline-none"
                            />
                          </div>
                        ) : (
                          <div className="rounded-[1.3rem] border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-300">
                            -
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-panel sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Observacao e retorno</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Aqui voce pode ajustar quantidades, deixar observacao e responder com aprovacao, pedido de alteracao ou recusa.
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: manter apenas as cores de maior giro nesta etapa."
            />
          </label>

          {noteChanged ? (
            <div className="mt-3 rounded-2xl border border-[#f3d0bd] bg-[#fff8f4] px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-[#a94b25]">Observacao original</p>
              <p className="mt-2 leading-6">{link.originalNote || "Sem observacao original."}</p>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Retorno</span>
            <textarea
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: aprovado sem ajuste ou pedir troca de tamanhos."
            />
          </label>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveChanges()}
              disabled={busyAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {busyAction === "SAVE" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Salvar alteracoes
            </button>
            <button
              type="button"
              onClick={() => void saveChanges("APPROVED")}
              disabled={busyAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => void saveChanges("CHANGES_REQUESTED")}
              disabled={busyAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-60"
            >
              <ShieldAlert className="h-4 w-4" />
              Pedir alteracao
            </button>
            <button
              type="button"
              onClick={() => void saveChanges("REJECTED")}
              disabled={busyAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Recusar
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
