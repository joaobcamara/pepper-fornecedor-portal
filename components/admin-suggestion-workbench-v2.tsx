"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, RotateCcw, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

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
};

type DraftState = {
  productName: string;
  price: string;
  material: string;
  modelDescription: string;
  supplierVisibleNote: string;
  internalReviewNote: string;
};

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
  switch (status) {
    case "APPROVED_FOR_CATALOG":
      return "bg-emerald-100 text-emerald-700";
    case "NEEDS_REVISION":
      return "bg-amber-100 text-amber-700";
    case "IMPORTED_BY_CATALOG":
      return "bg-sky-100 text-sky-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-[#fff1e7] text-[#a94b25]";
  }
}

export function AdminSuggestionWorkbenchV2({ suggestions }: { suggestions: SuggestionCard[] }) {
  const [items, setItems] = useState(suggestions);
  const [activeId, setActiveId] = useState<string | null>(suggestions[0]?.id ?? null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(
    Object.fromEntries(suggestions.map((item) => [item.id, buildDraft(item)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSuggestion = items.find((item) => item.id === activeId) ?? null;

  const summary = useMemo(() => ({
    pending: items.filter((item) => item.status === "NEW" || item.status === "REVIEWING").length,
    revision: items.filter((item) => item.status === "NEEDS_REVISION").length,
    approved: items.filter((item) => item.status === "APPROVED_FOR_CATALOG").length,
    imported: items.filter((item) => item.status === "IMPORTED_BY_CATALOG").length
  }), [items]);

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
    const draft = drafts[id];
    setMessage(null);
    setError(null);

    const response = await fetch("/api/admin/suggestions/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    const payload = (await response.json()) as { error?: string; status?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar a sugestao.");
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              statusLabel:
                status === "APPROVED_FOR_CATALOG"
                  ? "Aprovado para cadastro"
                  : status === "NEEDS_REVISION"
                    ? "Precisa de correcao"
                    : status === "REJECTED"
                      ? "Reprovado"
                      : "Em analise",
              productName: draft.productName,
              price: Number(draft.price),
              material: draft.material,
              modelDescription: draft.modelDescription,
              supplierVisibleNote: draft.supplierVisibleNote || null,
              internalReviewNote: draft.internalReviewNote || null,
              approvedAt: status === "APPROVED_FOR_CATALOG" ? "Agora" : item.approvedAt,
              approvedBy: status === "APPROVED_FOR_CATALOG" ? "admin" : item.approvedBy,
              onboardingItem:
                status === "APPROVED_FOR_CATALOG"
                  ? {
                      id: item.onboardingItem?.id ?? item.id,
                      status: "READY",
                      readyForCatalogAt: "Agora",
                      importedAt: null,
                      importedBy: null
                    }
                  : item.onboardingItem
            }
          : item
      )
    );

    setMessage(
      status === "APPROVED_FOR_CATALOG"
        ? "Sugestao aprovada e enviada para a fila de cadastro no Supabase."
        : status === "NEEDS_REVISION"
          ? "Sugestao devolvida ao fornecedor para correcao."
          : status === "REJECTED"
            ? "Sugestao reprovada e encerrada."
            : "Revisao salva com sucesso."
    );
    setModalId(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Triagem de novos produtos</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Analise, devolucao para correcao e aprovacao para cadastro</h2>
            <p className="mt-2 text-sm text-slate-500">
              Quando aprovada, a sugestao entra na fila de cadastro do Supabase para ser consumida pelo outro sistema da equipe.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <MetricCard label="Pendentes" value={summary.pending} tone="orange" />
            <MetricCard label="Correcao" value={summary.revision} tone="amber" />
            <MetricCard label="Aprovadas" value={summary.approved} tone="emerald" />
            <MetricCard label="Importadas" value={summary.imported} tone="sky" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {items.length > 0 ? items.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => {
                setActiveId(suggestion.id);
                setModalId(suggestion.id);
              }}
              className={cn(
                "rounded-[1.8rem] border p-4 text-left shadow-soft transition hover:-translate-y-1",
                activeId === suggestion.id ? "border-[#f2b79a] bg-[#fff7f1]" : "border-slate-100 bg-slate-50/80"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white bg-white">
                  <Image src={suggestion.frontImageUrl ?? "/brand/pepper-logo.png"} alt={suggestion.productName} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">{suggestion.productName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{suggestion.supplierName}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone(suggestion.status))}>
                      {suggestion.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-white px-2.5 py-1">R$ {suggestion.price.toFixed(2).replace('.', ',')}</span>
                    <span className="rounded-full bg-white px-2.5 py-1">{suggestion.sizes.length} tamanhos</span>
                    <span className="rounded-full bg-white px-2.5 py-1">{suggestion.colors.length} cores</span>
                    {suggestion.onboardingItem ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Na fila de cadastro</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>
          )) : (
            <div className="rounded-[1.8rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500 xl:col-span-3">
              Nenhuma sugestao recebida ainda.
            </div>
          )}
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {activeSuggestion ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Resumo para cadastro</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{activeSuggestion.productName}</h2>
                <p className="mt-2 text-sm text-slate-500">{activeSuggestion.supplierName} · enviada em {activeSuggestion.createdAt}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ReadField label="Material" value={activeSuggestion.material} />
                <ReadField label="Preco" value={`R$ ${activeSuggestion.price.toFixed(2).replace('.', ',')}`} />
                <ReadField className="md:col-span-2" label="Caracteristica / modelo" value={activeSuggestion.modelDescription} />
                <ReadField label="Tamanhos" value={activeSuggestion.sizes.join(', ')} />
                <ReadField label="Cores" value={activeSuggestion.colors.join(', ')} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ImageCard title="Foto frente" imageUrl={activeSuggestion.frontImageUrl} />
                <ImageCard title="Foto costas" imageUrl={activeSuggestion.backImageUrl} />
              </div>
              <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-5 text-sm text-slate-600">
                <p><strong>Status:</strong> {activeSuggestion.statusLabel}</p>
                <p className="mt-2"><strong>Revisoes:</strong> {activeSuggestion.revisionCount}</p>
                <p className="mt-2"><strong>Fila de cadastro:</strong> {activeSuggestion.onboardingItem ? activeSuggestion.onboardingItem.status : 'Ainda nao enviado'}</p>
                {activeSuggestion.supplierVisibleNote ? <p className="mt-2"><strong>Ultima observacao ao fornecedor:</strong> {activeSuggestion.supplierVisibleNote}</p> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {modalId ? (
        <SuggestionReviewModal
          suggestion={items.find((item) => item.id === modalId)!}
          draft={drafts[modalId]}
          onClose={() => setModalId(null)}
          onChange={updateDraft}
          onSubmit={(id, status) => startTransition(() => void submitReview(id, status))}
          isPending={isPending}
        />
      ) : null}
    </div>
  );
}

function SuggestionReviewModal({
  suggestion,
  draft,
  onClose,
  onChange,
  onSubmit,
  isPending
}: {
  suggestion: SuggestionCard;
  draft: DraftState;
  onClose: () => void;
  onChange: (id: string, patch: Partial<DraftState>) => void;
  onSubmit: (id: string, status: "REVIEWING" | "NEEDS_REVISION" | "APPROVED_FOR_CATALOG" | "REJECTED") => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#171717] p-6 text-slate-100 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#f3b89a]">Analise da sugestao</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{suggestion.productName}</h2>
            <p className="mt-2 text-sm text-slate-400">{suggestion.supplierName} · {suggestion.createdAt}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <ImageCard title="Foto frente" imageUrl={suggestion.frontImageUrl} />
            <ImageCard title="Foto costas" imageUrl={suggestion.backImageUrl} />
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Nome do produto" value={draft.productName} onChange={(value) => onChange(suggestion.id, { productName: value })} className="md:col-span-2" />
              <TextField label="Preco" value={draft.price} onChange={(value) => onChange(suggestion.id, { price: value })} />
              <TextField label="Material" value={draft.material} onChange={(value) => onChange(suggestion.id, { material: value })} />
              <TextAreaField label="Caracteristica / modelo" value={draft.modelDescription} onChange={(value) => onChange(suggestion.id, { modelDescription: value })} className="md:col-span-2" />
              <TextAreaField label="Observacao interna" value={draft.internalReviewNote} onChange={(value) => onChange(suggestion.id, { internalReviewNote: value })} className="md:col-span-2" />
              <TextAreaField label="Observacao para o fornecedor" value={draft.supplierVisibleNote} onChange={(value) => onChange(suggestion.id, { supplierVisibleNote: value })} className="md:col-span-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadField label="Tamanhos" value={suggestion.sizes.join(', ')} dark />
              <ReadField label="Cores" value={suggestion.colors.join(', ')} dark />
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Ao aprovar, o sistema cria um item na fila de cadastro do Supabase. Ao devolver, o fornecedor recebe a observacao e pode corrigir e reenviar.
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => onSubmit(suggestion.id, 'REVIEWING')} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
                {isPending ? 'Salvando...' : 'Salvar analise'}
              </button>
              <button type="button" onClick={() => onSubmit(suggestion.id, 'NEEDS_REVISION')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white">
                <RotateCcw className="h-4 w-4" />
                Devolver para correcao
              </button>
              <button type="button" onClick={() => onSubmit(suggestion.id, 'APPROVED_FOR_CATALOG')} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Aprovar para cadastro
              </button>
              <button type="button" onClick={() => onSubmit(suggestion.id, 'REJECTED')} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white">
                <XCircle className="h-4 w-4" />
                Reprovar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'orange' | 'amber' | 'emerald' | 'sky' }) {
  const toneClass =
    tone === 'orange'
      ? 'border-[#f1d5c4] bg-[#fff8f4] text-[#a94b25]'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-sky-200 bg-sky-50 text-sky-700';

  return (
    <div className={cn('rounded-[1.5rem] border p-4', toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cn('rounded-[1.4rem] border border-white/10 bg-white/5 p-4', className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white outline-none" />
    </label>
  );
}

function TextAreaField({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cn('rounded-[1.4rem] border border-white/10 bg-white/5 p-4', className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white outline-none" />
    </label>
  );
}

function ReadField({ label, value, className, dark = false }: { label: string; value: string; className?: string; dark?: boolean }) {
  return (
    <div className={cn('rounded-[1.4rem] border p-4', dark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/80', className)}>
      <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', dark ? 'text-slate-400' : 'text-slate-500')}>{label}</p>
      <p className={cn('mt-3 text-sm', dark ? 'text-white' : 'text-slate-800')}>{value}</p>
    </div>
  );
}

function ImageCard({ title, imageUrl }: { title: string; imageUrl: string | null }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="relative mt-3 h-52 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Image src={imageUrl ?? '/brand/pepper-logo.png'} alt={title} fill className="object-cover" />
      </div>
    </div>
  );
}
