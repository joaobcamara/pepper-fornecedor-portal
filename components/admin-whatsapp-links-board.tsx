"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  PencilLine,
  ShieldAlert,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { WhatsAppShareStatus } from "@prisma/client";

import { cn } from "@/lib/cn";
import type { WhatsAppShareLinkView } from "@/lib/whatsapp-share";

type LinkFilter = "ALL" | "OPEN" | "APPROVED" | "CHANGES" | "CLOSED";

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

function templateTone(template: WhatsAppShareLinkView["template"]) {
  return template === "UNIQUE_COLOR_CARDS"
    ? "bg-[#fff2e8] text-[#a94b25]"
    : "bg-slate-100 text-slate-700";
}

function PreviewMatrix({
  link,
  compact = false
}: {
  link: WhatsAppShareLinkView;
  compact?: boolean;
}) {
  if (link.template === "UNIQUE_COLOR_CARDS") {
    return (
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {link.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-[1.4rem] border bg-white",
              item.requestChanged || item.stockChanged ? "border-[#f3c8b2]" : "border-slate-200",
              compact ? "p-3" : "p-4"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn("font-semibold text-slate-900", compact ? "text-sm" : "text-lg")}>{item.colorLabel}</p>
                <p className={cn("font-semibold text-[#a94b25]", compact ? "text-xs" : "text-base")}>{item.sizeLabel}</p>
              </div>
              {item.requestChanged || item.stockChanged ? (
                <span className="rounded-full bg-[#fff1e7] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a94b25]">
                  Alterado
                </span>
              ) : null}
            </div>

            <div className={cn("mt-3 grid grid-cols-2 gap-2", compact ? "text-[11px]" : "text-sm")}>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="text-slate-400">Estoque</p>
                <p className="mt-1 font-semibold text-slate-900">{item.currentStock ?? "-"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="text-slate-400">Pedido</p>
                <p className="mt-1 font-semibold text-slate-900">{item.requestedQuantity}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const groupedRowsByColor = link.colorLabels.map((color) => ({
    color,
    items: link.sizeLabels
      .map((size) => link.items.find((entry) => entry.colorLabel === color && entry.sizeLabel === size) ?? null)
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }));

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {groupedRowsByColor.map((group) => (
          <section key={group.color} className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{group.color}</p>
                <p className="mt-1 text-xs text-slate-500">{group.items.length} tamanhos nesta cor</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Grade
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[1.2rem] border p-3",
                    item.requestChanged || item.stockChanged ? "border-[#f3c8b2] bg-[#fff8f4]" : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#a94b25]">{item.sizeLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.sku}</p>
                    </div>
                    {item.requestChanged || item.stockChanged ? (
                      <span className="rounded-full bg-[#fff1e7] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a94b25]">
                        Alterado
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <p className="text-slate-400">Estoque</p>
                      <p className="mt-1 font-semibold text-slate-900">{item.currentStock ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2">
                      <p className="text-slate-400">Pedido</p>
                      <p className="mt-1 font-semibold text-slate-900">{item.requestedQuantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white sm:block">
        <div
          className="grid min-w-[640px] bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
          style={{ gridTemplateColumns: `1.2fr repeat(${link.sizeLabels.length}, minmax(0, 1fr))` }}
        >
          <div className="px-4 py-3">Cor</div>
          {link.sizeLabels.map((size) => (
            <div key={size} className={cn("px-4 py-3 text-center", compact ? "text-xs" : "")}>
              {size}
            </div>
          ))}
        </div>

        {link.colorLabels.map((color) => (
          <div
            key={color}
            className="grid border-t border-slate-100"
            style={{ gridTemplateColumns: `1.2fr repeat(${link.sizeLabels.length}, minmax(0, 1fr))` }}
          >
            <div className={cn("px-4 py-4 font-semibold text-slate-900", compact ? "text-sm" : "text-base")}>{color}</div>
            {link.sizeLabels.map((size) => {
              const item = link.items.find((entry) => entry.colorLabel === color && entry.sizeLabel === size) ?? null;

              return (
                <div key={`${color}-${size}`} className="px-3 py-3">
                  {item ? (
                    <div
                      className={cn(
                        "rounded-[1.2rem] border px-3 py-3 text-center",
                        item.requestChanged || item.stockChanged ? "border-[#f3c8b2] bg-[#fff8f4]" : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <p className={cn("font-semibold text-slate-900", compact ? "text-base" : "text-lg")}>
                        {item.requestedQuantity}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">estoque {item.currentStock ?? "-"}</p>
                      {item.requestChanged ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#a94b25]">era {item.originalRequestedQuantity}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-300">
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export function AdminWhatsAppLinksBoard({
  links
}: {
  links: WhatsAppShareLinkView[];
}) {
  const [rows, setRows] = useState(links);
  const [selectedId, setSelectedId] = useState<string | null>(links[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LinkFilter>("ALL");
  const [noteDraft, setNoteDraft] = useState("");
  const [statusNoteDraft, setStatusNoteDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((item) => item.id === selectedId) ?? null,
    [rows, selectedId]
  );
  const selectedNoteChanged = selected ? noteDraft.trim() !== selected.originalNote.trim() : false;
  const selectedHasRecipientChanges = selected ? selected.changedItemCount > 0 || selectedNoteChanged : false;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    return rows.filter((item) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "OPEN"
            ? item.status === WhatsAppShareStatus.OPEN
            : filter === "APPROVED"
              ? item.status === WhatsAppShareStatus.APPROVED
              : filter === "CHANGES"
                ? item.hasRecipientChanges || item.stockChangedCount > 0
                : item.status === WhatsAppShareStatus.CLOSED;

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [item.productName, item.productSku, item.supplierName ?? "", item.statusLabel]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, rows]);

  useEffect(() => {
    if (!selected) {
      setNoteDraft("");
      setStatusNoteDraft("");
      return;
    }

    setNoteDraft(selected.note);
    setStatusNoteDraft(selected.statusNote);
  }, [selected]);

  async function patchLink(id: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/whatsapp-links/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Nao foi possivel atualizar o link.");
    }
  }

  async function saveEdits() {
    if (!selected) {
      return;
    }

    setError(null);
    setFeedback(null);
    setBusyAction("save");

    try {
      await patchLink(selected.id, {
        note: noteDraft,
        statusNote: statusNoteDraft
      });

      setRows((current) =>
        current.map((row) =>
          row.id === selected.id
            ? {
                ...row,
                note: noteDraft,
                statusNote: statusNoteDraft,
                noteChanged: noteDraft !== row.originalNote,
                hasRecipientChanges:
                  noteDraft !== row.originalNote || row.changedItemCount > 0
              }
            : row
        )
      );
      setFeedback("Link atualizado na fundacao.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateStatus(status: WhatsAppShareStatus) {
    if (!selected) {
      return;
    }

    setError(null);
    setFeedback(null);
    setBusyAction(status);

    try {
      await patchLink(selected.id, {
        note: noteDraft,
        status,
        statusNote: statusNoteDraft
      });

      setRows((current) =>
        current.map((row) =>
          row.id === selected.id
            ? {
                ...row,
                note: noteDraft,
                status,
                statusLabel:
                  status === "APPROVED"
                    ? "Aprovado"
                    : status === "CHANGES_REQUESTED"
                      ? "Pediu alteracao"
                      : status === "REJECTED"
                        ? "Recusado"
                        : status === "CLOSED"
                          ? "Fechado"
                          : "Aberto",
                statusNote: statusNoteDraft,
                noteChanged: noteDraft !== row.originalNote,
                hasRecipientChanges:
                  noteDraft !== row.originalNote || row.changedItemCount > 0
              }
            : row
        )
      );
      setFeedback("Status do link atualizado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o status.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteLink(id: string) {
    setError(null);
    setFeedback(null);
    setBusyAction("delete");

    try {
      const response = await fetch(`/api/whatsapp-links/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel apagar o link.");
      }

      setRows((current) => current.filter((row) => row.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      setFeedback("Link apagado e removido do painel.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel apagar o link.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyLink(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setFeedback("Link copiado.");
    } catch {
      setError("Nao foi possivel copiar o link.");
    }
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Links ativos" value={rows.filter((item) => item.status !== "CLOSED").length.toString()} tone="soft" />
        <MetricCard label="Com alteracao" value={rows.filter((item) => item.hasRecipientChanges).length.toString()} tone="alert" />
        <MetricCard label="Aprovados" value={rows.filter((item) => item.status === "APPROVED").length.toString()} tone="success" />
        <MetricCard label="Fechados" value={rows.filter((item) => item.status === "CLOSED").length.toString()} tone="neutral" />
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Central WhatsApp</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Links compartilhados pelo admin</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card guarda o link ativo, mostra se houve alteracao desde a criacao e abre um modal com aprovacao, recusa, fechamento e exclusao.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} links</span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Buscar por produto, sku ou fornecedor
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: 01-1215, Carol, bermuda..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Filtro rapido
            </span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as LinkFilter)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
            >
              <option value="ALL">Todos</option>
              <option value="OPEN">Abertos</option>
              <option value="APPROVED">Aprovados</option>
              <option value="CHANGES">Com alteracao</option>
              <option value="CLOSED">Fechados</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
            {filteredRows.length} exibidos
          </span>
          {query.trim() ? (
            <span className="rounded-full bg-[#fff2e8] px-2.5 py-1 font-semibold text-[#a94b25]">
              busca: {query.trim()}
            </span>
          ) : null}
          {filter !== "ALL" ? (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">
              filtro aplicado
            </span>
          ) : null}
        </div>

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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.length > 0 ? (
            filteredRows.map((link) => (
              <article
                key={link.id}
                className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-4 shadow-soft transition hover:-translate-y-0.5"
              >
                <button type="button" onClick={() => setSelectedId(link.id)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 overflow-hidden rounded-[1.2rem] border border-white bg-white">
                        <Image src={link.imageUrl} alt={link.productName} fill className="object-cover" sizes="64px" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{link.productName}</p>
                        <p className="mt-1 text-xs text-slate-500">{link.productSku}</p>
                        {link.supplierName ? <p className="mt-1 text-xs text-slate-500">{link.supplierName}</p> : null}
                      </div>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone(link.status))}>
                      {link.statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                    <span className={cn("rounded-full px-2.5 py-1 font-semibold", templateTone(link.template))}>
                      {link.templateLabel}
                    </span>
                    {link.requestChangedCount > 0 ? (
                      <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 font-semibold text-[#a94b25]">
                        {link.requestChangedCount} itens editados
                      </span>
                    ) : null}
                    {link.stockChangedCount > 0 ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                        {link.stockChangedCount} estoques mudaram
                      </span>
                    ) : null}
                    {link.noteChanged ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Obs alterada
                      </span>
                    ) : null}
                    {link.hasRecipientChanges ? (
                      <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 font-semibold text-[#a94b25]">
                        Alterado
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                        Sem mudanca
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-white px-3 py-2 text-slate-600">Pedido {link.totalRequested}</div>
                    <div className="rounded-2xl bg-white px-3 py-2 text-slate-600">Estoque {link.totalCurrentStock}</div>
                    <div className="rounded-2xl bg-white px-3 py-2 text-slate-600">Vendas 30d {link.metrics.sales30d}</div>
                    <div className="rounded-2xl bg-white px-3 py-2 text-slate-600">
                      {link.metrics.coverageDays === null ? "Sem cobertura" : `${link.metrics.coverageDays} dias`}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>Criado {link.createdAtLabel}</span>
                    <span>Atualizado {link.updatedAtLabel}</span>
                    {link.viewedAtLabel ? <span>Visto {link.viewedAtLabel}</span> : null}
                  </div>

                  {link.statusNote ? (
                    <p className="mt-3 line-clamp-2 rounded-2xl bg-white px-3 py-3 text-xs leading-5 text-slate-600">
                      {link.statusNote}
                    </p>
                  ) : null}
                </button>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={link.shareUrlPath}
                    target="_blank"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir link
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteLink(link.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:w-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.7rem] border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500 xl:col-span-3">
              {rows.length === 0
                ? "Nenhum link de WhatsApp foi gerado ainda. Use o modal de produto para criar o primeiro."
                : "Nenhum card bateu com a busca ou filtro atual."}
            </div>
          )}
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/60 bg-white/95 p-4 shadow-panel sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white">
                  <Image src={selected.imageUrl} alt={selected.productName} fill className="object-cover" sizes="80px" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Link WhatsApp</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{selected.productName}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selected.productSku}
                    {selected.supplierName ? ` | ${selected.supplierName}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className={cn("rounded-full px-2.5 py-1 font-semibold", statusTone(selected.status))}>
                      {selected.statusLabel}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 font-semibold", templateTone(selected.template))}>
                      {selected.templateLabel}
                    </span>
                    {selectedHasRecipientChanges ? (
                      <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 font-semibold text-[#a94b25]">
                        Editado pelo link
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => setSelectedId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void copyLink(selected.shareUrlPath)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                Copiar link
              </button>
              <Link
                href={selected.shareUrlPath}
                target="_blank"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir visualizacao
              </Link>
              <Link
                href={selected.adminProductHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f3d0bd] bg-[#fff5ef] px-4 py-3 text-sm font-semibold text-[#a94b25] sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir no produto
              </Link>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <section className="rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MetricCard label="Pedido" value={selected.totalRequested.toString()} tone="soft" />
                    <MetricCard label="Estoque" value={selected.totalCurrentStock.toString()} tone="neutral" />
                    <MetricCard label="Vendas 30d" value={selected.metrics.sales30d.toString()} tone="soft" />
                    <MetricCard
                      label="Cobertura"
                      value={selected.metrics.coverageDays === null ? "Sem base" : `${selected.metrics.coverageDays} dias`}
                      tone="alert"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">
                      {selected.requestChangedCount} itens editados
                    </span>
                    <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">
                      {selected.stockChangedCount} estoques mudaram
                    </span>
                    <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">
                      Observacao {selectedNoteChanged ? "alterada" : "sem mudanca"}
                    </span>
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Preview compartilhado</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        O card abaixo compara estoque atual da fundacao com o que foi pedido no link.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {selected.changedItemCount} linhas alteradas
                    </span>
                  </div>

                  <div className="mt-5">
                    <PreviewMatrix link={selected} />
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-[1.7rem] border border-[#f2d8ca] bg-[#fffaf7] p-5">
                  <h4 className="text-lg font-semibold text-slate-900">Observacoes e aprovacao</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Aqui voce enxerga se o link foi alterado e consegue aprovar, pedir ajuste, recusar, fechar ou apagar.
                  </p>

                  <label className="mt-5 block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do card</span>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="Ex.: enviar so tamanhos M e G desta grade."
                    />
                    {selectedNoteChanged ? (
                      <p className="mt-2 text-xs font-semibold text-[#a94b25]">A observacao atual ja difere do texto original.</p>
                    ) : null}
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Nota de retorno</span>
                    <textarea
                      value={statusNoteDraft}
                      onChange={(event) => setStatusNoteDraft(event.target.value)}
                      className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="Ex.: aprovado sem ajuste, ou informar o motivo da recusa."
                    />
                  </label>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void saveEdits()}
                      disabled={busyAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                    >
                      <PencilLine className="h-4 w-4" />
                      Salvar alteracoes
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus("APPROVED")}
                      disabled={busyAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus("CHANGES_REQUESTED")}
                      disabled={busyAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-60"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Pedir alteracao
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus("REJECTED")}
                      disabled={busyAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus("CLOSED")}
                      disabled={busyAction !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60 sm:col-span-2"
                    >
                      Fechar link
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deleteLink(selected.id)}
                    disabled={busyAction !== null}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar link
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "soft" | "success" | "alert" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "alert"
        ? "border-[#f3d0bd] bg-[#fff5ef] text-[#a94b25]"
        : tone === "neutral"
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-sky-100 bg-sky-50 text-sky-700";

  return (
    <div className={cn("rounded-[1.5rem] border p-5 shadow-soft", toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}
