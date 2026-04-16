"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  RotateCcw,
  X,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getProductSuggestionNextStep } from "@/lib/operations-workflow";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";

type SuggestionCard = {
  id: string;
  status: string;
  statusLabel: string;
  supplierName: string;
  productName: string;
  price: number;
  material: string;
  modelDescription: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  supplierVisibleNote: string | null;
  internalReviewNote: string | null;
  revisionCount: number;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  sizes: string[];
  colors: string[];
  onboardingItem: {
    id: string;
    status: string;
    readyForCatalogAt: string;
    importedAt: string | null;
    importedBy: string | null;
  } | null;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    toStatusLabel: string;
    note: string | null;
    visibleToSupplier: boolean;
    actorName: string | null;
    createdAt: string;
  }>;
};

type DraftState = {
  productName: string;
  price: string;
  material: string;
  modelDescription: string;
  supplierVisibleNote: string;
  internalReviewNote: string;
};

const LOCKED_ADMIN_STATUSES = new Set(["APPROVED_FOR_CATALOG", "IMPORTED_BY_CATALOG"]);
const ADMIN_SUGGESTION_FLASH_KEY = "admin-suggestions:flash";

function buildDraft(suggestion: SuggestionCard): DraftState {
  return {
    productName: suggestion.productName,
    price: String(suggestion.price),
    material: suggestion.material,
    modelDescription: suggestion.modelDescription,
    supplierVisibleNote: suggestion.supplierVisibleNote ?? "",
    internalReviewNote: suggestion.internalReviewNote ?? ""
  };
}

function tone(status: string) {
  if (status === "APPROVED_FOR_CATALOG") return "bg-emerald-100 text-emerald-700";
  if (status === "NEEDS_REVISION") return "bg-amber-100 text-amber-700";
  if (status === "IMPORTED_BY_CATALOG") return "bg-sky-100 text-sky-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-[#fff1e7] text-[#a94b25]";
}

function metricTone(name: "pending" | "revision" | "approved" | "imported") {
  if (name === "revision") return "bg-amber-50 text-amber-700";
  if (name === "approved") return "bg-emerald-50 text-emerald-700";
  if (name === "imported") return "bg-sky-50 text-sky-700";
  return "bg-[#fff8f4] text-[#a94b25]";
}

export function AdminSuggestionWorkbenchV3({ suggestions }: { suggestions: SuggestionCard[] }) {
  const [items, setItems] = useState(suggestions);
  const [modalId, setModalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(
    Object.fromEntries(suggestions.map((item) => [item.id, buildDraft(item)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"REVIEWING" | "NEEDS_REVISION" | "APPROVED_FOR_CATALOG" | "REJECTED" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(ADMIN_SUGGESTION_FLASH_KEY);

    if (!raw) return;

    window.sessionStorage.removeItem(ADMIN_SUGGESTION_FLASH_KEY);
    setMessage(raw);
  }, []);

  const summary = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "NEW" || item.status === "REVIEWING").length,
      revision: items.filter((item) => item.status === "NEEDS_REVISION").length,
      approved: items.filter((item) => item.status === "APPROVED_FOR_CATALOG").length,
      imported: items.filter((item) => item.status === "IMPORTED_BY_CATALOG").length
    }),
    [items]
  );

  const selectedSuggestion = items.find((item) => item.id === modalId) ?? null;
  const selectedSuggestionLocked = Boolean(selectedSuggestion && LOCKED_ADMIN_STATUSES.has(selectedSuggestion.status));

  function updateDraft(id: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch
      }
    }));
  }

  async function submitReview(id: string, status: "REVIEWING" | "NEEDS_REVISION" | "APPROVED_FOR_CATALOG" | "REJECTED") {
    const suggestion = items.find((item) => item.id === id);

    if (suggestion && LOCKED_ADMIN_STATUSES.has(suggestion.status)) {
      setError("Sugestoes aprovadas ou importadas ficam bloqueadas para novas alteracoes.");
      return;
    }

    const draft = drafts[id];
    setMessage(null);
    setError(null);
    setPendingStatus(status);

    try {
      const response = await fetch("/api/admin/suggestions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: id,
          productName: draft.productName,
          price: Number(draft.price),
          material: draft.material,
          modelDescription: draft.modelDescription,
          supplierVisibleNote: draft.supplierVisibleNote,
          internalReviewNote: draft.internalReviewNote,
          status
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        verification?: {
          storedInFoundation?: boolean;
          visibleForSupplier?: boolean;
          onboardingReady?: boolean;
        };
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar a sugestao.");
        return;
      }

      const persisted =
        payload.verification?.storedInFoundation &&
        payload.verification?.visibleForSupplier &&
        payload.verification?.onboardingReady;

      window.sessionStorage.setItem(
        ADMIN_SUGGESTION_FLASH_KEY,
        persisted
          ? status === "APPROVED_FOR_CATALOG"
            ? "Sugestao aprovada, validada na fundacao e enviada para a fila de cadastro."
            : status === "NEEDS_REVISION"
              ? "Sugestao devolvida e validada na fundacao para o fornecedor corrigir."
              : status === "REJECTED"
                ? "Sugestao reprovada e registrada na fundacao."
                : "Analise salva e validada na fundacao."
          : "Sugestao atualizada. A tela foi recarregada para validar o estado real na fundacao."
      );
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar a sugestao.");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Triagem operacional</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sugestoes de produto</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Cada card representa um produto sugerido pelo fornecedor e acompanha analise, correcao e fila de cadastro.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {items.length} cards no fluxo
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Pendentes" value={summary.pending} tone={metricTone("pending")} />
          <MetricCard label="Correcao" value={summary.revision} tone={metricTone("revision")} />
          <MetricCard label="Aprovadas" value={summary.approved} tone={metricTone("approved")} />
          <MetricCard label="Importadas" value={summary.imported} tone={metricTone("imported")} />
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cards da fila de analise</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Abra um card para revisar as fotos, ajustar o cadastro e decidir se ele segue para correcao ou fila de cadastro.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{items.length} sugestoes</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.length > 0 ? (
            items.map((suggestion) => {
              const nextStep = getProductSuggestionNextStep(suggestion.status, Boolean(suggestion.onboardingItem));

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => setModalId(suggestion.id)}
                  className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white bg-white">
                      <Image src={suggestion.frontImageUrl ?? "/brand/pepper-logo.png"} alt={suggestion.productName} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{suggestion.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">{suggestion.supplierName}</p>
                        </div>
                        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", tone(suggestion.status))}>
                          {suggestion.statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1">R$ {suggestion.price.toFixed(2).replace(".", ",")}</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{suggestion.createdAt}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1">{suggestion.sizes.length} tamanhos</span>
                        <span className="rounded-full bg-white px-2.5 py-1">{suggestion.colors.length} cores</span>
                        {suggestion.onboardingItem ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Fila de cadastro</span>
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
              Nenhuma sugestao recebida ainda.
            </div>
          )}
        </div>
      </section>

      {selectedSuggestion ? (
        <SuggestionOperationalModal
          suggestion={selectedSuggestion}
          draft={drafts[selectedSuggestion.id]}
          locked={selectedSuggestionLocked}
          onClose={() => setModalId(null)}
          onChange={updateDraft}
          onSubmit={(id, status) => void submitReview(id, status)}
          pendingStatus={pendingStatus}
        />
      ) : null}
    </section>
  );
}

function SuggestionOperationalModal({
  suggestion,
  draft,
  locked,
  onClose,
  onChange,
  onSubmit,
  pendingStatus
}: {
  suggestion: SuggestionCard;
  draft: DraftState;
  locked: boolean;
  onClose: () => void;
  onChange: (id: string, patch: Partial<DraftState>) => void;
  onSubmit: (id: string, status: "REVIEWING" | "NEEDS_REVISION" | "APPROVED_FOR_CATALOG" | "REJECTED") => void;
  pendingStatus: "REVIEWING" | "NEEDS_REVISION" | "APPROVED_FOR_CATALOG" | "REJECTED" | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo operacional</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{suggestion.productName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Sugestao do fornecedor • {suggestion.supplierName} • {suggestion.createdAt}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricValue label="Status" value={suggestion.statusLabel} tone={tone(suggestion.status)} />
          <MetricValue label="Preco sugerido" value={`R$ ${suggestion.price.toFixed(2).replace(".", ",")}`} tone="bg-slate-50 text-slate-700" />
          <MetricValue
            label="Fila de cadastro"
            value={suggestion.onboardingItem ? suggestion.onboardingItem.status : "Ainda nao enviado"}
            tone={suggestion.onboardingItem ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700"}
          />
          <MetricValue label="Revisoes" value={String(suggestion.revisionCount)} tone="bg-slate-50 text-slate-700" />
        </div>

        <OperationsFlowPanel
          className="mt-5"
          originLabel="Sugestao de produto"
          currentLabel={suggestion.statusLabel}
          currentTone={tone(suggestion.status)}
          nextLabel={getProductSuggestionNextStep(suggestion.status, Boolean(suggestion.onboardingItem)).label}
          nextDescription={getProductSuggestionNextStep(suggestion.status, Boolean(suggestion.onboardingItem)).description}
          modules={[
            { label: "Sugestao de produto", tone: "bg-white text-slate-700" },
            ...(suggestion.onboardingItem ? [{ label: "Fila de cadastro", tone: "bg-emerald-50 text-emerald-700" }] : [])
          ]}
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ImageCard title="Foto frente" imageUrl={suggestion.frontImageUrl} />
              <ImageCard title="Foto costas" imageUrl={suggestion.backImageUrl} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadField label="Material informado" value={suggestion.material} />
              <ReadField label="Aprovado por" value={suggestion.approvedBy ?? "Ainda sem aprovacao"} />
              <ReadField className="md:col-span-2" label="Caracteristica / modelo" value={suggestion.modelDescription} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadList title="Tamanhos sugeridos" icon={<ClipboardList className="h-4 w-4" />} values={suggestion.sizes} />
              <ReadList title="Cores sugeridas" icon={<ClipboardList className="h-4 w-4" />} values={suggestion.colors} />
            </div>

            {suggestion.statusHistory.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Historico do card</p>
                {suggestion.statusHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <strong>{entry.toStatusLabel}</strong> • {entry.createdAt}
                    {entry.actorName ? <span> • {entry.actorName}</span> : null}
                    {entry.note ? <p className="mt-1">{entry.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {locked ? <div className="rounded-[1.4rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">Card bloqueado: sugestoes aprovadas ou importadas ficam somente para visualizacao.</div> : null}
            <Field
              label="Nome do produto"
              value={draft.productName}
              onChange={(value) => onChange(suggestion.id, { productName: value })}
              disabled={locked}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Preco" value={draft.price} onChange={(value) => onChange(suggestion.id, { price: value })} disabled={locked} />
              <Field
                label="Material"
                value={draft.material}
                onChange={(value) => onChange(suggestion.id, { material: value })}
                disabled={locked}
              />
            </div>
            <TextArea
              label="Caracteristica / modelo"
              value={draft.modelDescription}
              onChange={(value) => onChange(suggestion.id, { modelDescription: value })}
              disabled={locked}
            />
            <TextArea
              label="Observacao interna"
              value={draft.internalReviewNote}
              onChange={(value) => onChange(suggestion.id, { internalReviewNote: value })}
              disabled={locked}
            />
            <TextArea
              label="Observacao para o fornecedor"
              value={draft.supplierVisibleNote}
              onChange={(value) => onChange(suggestion.id, { supplierVisibleNote: value })}
              disabled={locked}
            />

            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              Ao aprovar, este card segue para a fila de cadastro no Supabase. Ao devolver, o fornecedor recebe a observacao e pode corrigir e reenviar.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={pendingStatus !== null || locked}
                onClick={() => onSubmit(suggestion.id, "REVIEWING")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingStatus === "REVIEWING" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {pendingStatus === "REVIEWING" ? "Salvando..." : "Salvar analise"}
              </button>
              <button
                type="button"
                disabled={pendingStatus !== null || locked}
                onClick={() => onSubmit(suggestion.id, "NEEDS_REVISION")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingStatus === "NEEDS_REVISION" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {pendingStatus === "NEEDS_REVISION" ? "Devolvendo..." : "Devolver para correcao"}
              </button>
              <button
                type="button"
                disabled={pendingStatus !== null || locked}
                onClick={() => onSubmit(suggestion.id, "APPROVED_FOR_CATALOG")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingStatus === "APPROVED_FOR_CATALOG" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {pendingStatus === "APPROVED_FOR_CATALOG" ? "Aprovando..." : "Aprovar para cadastro"}
              </button>
              <button
                type="button"
                disabled={pendingStatus !== null || locked}
                onClick={() => onSubmit(suggestion.id, "REJECTED")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingStatus === "REJECTED" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {pendingStatus === "REJECTED" ? "Reprovando..." : "Reprovar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100" />
    </label>
  );
}

function TextArea({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100" />
    </label>
  );
}

function ReadField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function ReadList({ title, icon, values }: { title: string; icon: ReactNode; values: string[] }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span key={value} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">Nao informado.</span>
        )}
      </div>
    </div>
  );
}

function ImageCard({ title, imageUrl }: { title: string; imageUrl: string | null }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="relative mt-3 h-52 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={imageUrl ?? "/brand/pepper-logo.png"} alt={title} fill className="object-cover" />
      </div>
    </div>
  );
}
