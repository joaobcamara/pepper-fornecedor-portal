"use client";

import Image from "next/image";
import { type Dispatch, type ReactNode, type RefObject, type SetStateAction, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, LoaderCircle, ScanSearch, SendHorizonal, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ExistingSuggestion = {
  id: string;
  productName: string;
  status: string;
  statusLabel: string;
  price: number;
  material: string;
  modelDescription: string;
  createdAt: string;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  sizes: string[];
  colors: string[];
  supplierVisibleNote: string | null;
  revisionCount: number;
  canResubmit: boolean;
  onboardingStatus: string | null;
};

type ValidationResult = {
  validationStatus: "ready" | "needs_revision";
  score: number;
  missingFields: string[];
  warnings: string[];
  fieldCorrections: string[];
  suggestedProductName: string;
  suggestedMaterial: string;
  suggestedDescription: string;
  suggestedAttributes: string[];
  normalizedSizes: string[];
  normalizedColors: string[];
};

type FormState = {
  productName: string;
  price: string;
  material: string;
  modelDescription: string;
  sizes: string;
  colors: string;
};

const LOCKED_SUPPLIER_STATUSES = new Set(["APPROVED_FOR_CATALOG", "IMPORTED_BY_CATALOG"]);

function createFormState(suggestion?: ExistingSuggestion | null): FormState {
  return {
    productName: suggestion?.productName ?? "",
    price: suggestion ? String(suggestion.price) : "",
    material: suggestion?.material ?? "",
    modelDescription: suggestion?.modelDescription ?? "",
    sizes: suggestion?.sizes.join(", ") ?? "",
    colors: suggestion?.colors.join(", ") ?? ""
  };
}

export function SupplierSuggestionForm({ suggestions }: { suggestions: ExistingSuggestion[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const frontImageRef = useRef<HTMLInputElement>(null);
  const backImageRef = useRef<HTMLInputElement>(null);
  const modalFrontImageRef = useRef<HTMLInputElement>(null);
  const modalBackImageRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createFormState());
  const [modalFormState, setModalFormState] = useState<FormState>(createFormState());
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const editingSuggestion = suggestions.find((item) => item.id === editingId) ?? null;
  const selectedSuggestion = suggestions.find((item) => item.id === selectedSuggestionId) ?? null;
  const selectedSuggestionLocked = Boolean(
    selectedSuggestion && (LOCKED_SUPPLIER_STATUSES.has(selectedSuggestion.status) || !selectedSuggestion.canResubmit)
  );

  useEffect(() => {
    setFormState(createFormState(editingSuggestion));
    setValidation(null);
  }, [editingSuggestion]);

  useEffect(() => {
    if (!selectedSuggestion) {
      setModalFormState(createFormState());
      return;
    }

    setModalFormState(createFormState(selectedSuggestion));
  }, [selectedSuggestion]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (editingId) {
        formData.set("suggestionId", editingId);
      }
      formData.set("productName", formState.productName);
      formData.set("price", formState.price);
      formData.set("material", formState.material);
      formData.set("modelDescription", formState.modelDescription);
      formData.set("sizes", formState.sizes);
      formData.set("colors", formState.colors);

      const frontFile = frontImageRef.current?.files?.[0];
      const backFile = backImageRef.current?.files?.[0];
      if (frontFile) formData.set("frontImage", frontFile);
      if (backFile) formData.set("backImage", backFile);

      const response = await fetch("/api/supplier/suggestions", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; mode?: "created" | "resubmitted" };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel enviar a sugestao.");
        return;
      }

      formRef.current?.reset();
      setEditingId(null);
      setFormState(createFormState());
      setValidation(null);
      setMessage(
        payload.mode === "resubmitted"
          ? "Sugestao corrigida e reenviada para nova analise."
          : "Sugestao enviada para a equipe de cadastro com sucesso."
      );
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar a sugestao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleModalSubmit() {
    if (!selectedSuggestion) {
      return;
    }

    if (selectedSuggestionLocked) {
      setError("Esta sugestao ja foi aprovada ou importada e ficou bloqueada para novas alteracoes.");
      return;
    }

    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("suggestionId", selectedSuggestion.id);
      formData.set("productName", modalFormState.productName);
      formData.set("price", modalFormState.price);
      formData.set("material", modalFormState.material);
      formData.set("modelDescription", modalFormState.modelDescription);
      formData.set("sizes", modalFormState.sizes);
      formData.set("colors", modalFormState.colors);

      const frontFile = modalFrontImageRef.current?.files?.[0];
      const backFile = modalBackImageRef.current?.files?.[0];
      if (frontFile) formData.set("frontImage", frontFile);
      if (backFile) formData.set("backImage", backFile);

      const response = await fetch("/api/supplier/suggestions", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; mode?: "created" | "resubmitted" };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel reenviar a sugestao.");
        return;
      }

      if (modalFrontImageRef.current) {
        modalFrontImageRef.current.value = "";
      }
      if (modalBackImageRef.current) {
        modalBackImageRef.current.value = "";
      }
      setSelectedSuggestionId(null);
      setModalFormState(createFormState());
      setMessage(
        payload.mode === "resubmitted"
          ? "Sugestao corrigida e reenviada para nova analise."
          : "Sugestao atualizada com sucesso."
      );
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel reenviar a sugestao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleValidate() {
    setMessage(null);
    setError(null);
    setIsValidating(true);

    const frontFile = frontImageRef.current?.files?.[0];
    const backFile = backImageRef.current?.files?.[0];

    if (!frontFile || !backFile) {
      setError("Anexe as fotos de frente e costas para a Pepper IA validar a sugestao com base nas imagens.");
      setIsValidating(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.set("productName", formState.productName);
      formData.set("price", formState.price || "0");
      formData.set("material", formState.material);
      formData.set("modelDescription", formState.modelDescription);
      formData.set("sizes", formState.sizes);
      formData.set("colors", formState.colors);
      formData.set("frontImage", frontFile);
      formData.set("backImage", backFile);

      const response = await fetch("/api/pepperia/validate-suggestion", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; result?: ValidationResult };

      if (!response.ok || !payload.result) {
        setError(payload.error ?? "Nao foi possivel validar a sugestao agora.");
        return;
      }

      setValidation(payload.result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel validar a sugestao agora.");
    } finally {
      setIsValidating(false);
    }
  }

  function applyValidationSuggestions() {
    if (!validation) {
      return;
    }

    setFormState((current) => ({
      ...current,
      productName: validation.suggestedProductName || current.productName,
      material: validation.suggestedMaterial || current.material,
      modelDescription: validation.suggestedDescription || current.modelDescription,
      sizes: validation.normalizedSizes.join(", ") || current.sizes,
      colors: validation.normalizedColors.join(", ") || current.colors
    }));
    setMessage("Melhorias da Pepper IA aplicadas no formulario.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#fff1e7] p-3 text-[#c75f2d]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {editingSuggestion ? "Corrigir sugestao devolvida" : "Enviar novo produto para analise"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use o botao <strong>Validar sugestao</strong> para a Pepper IA analisar primeiro as fotos, revisar a qualidade do cadastro e reorganizar informacoes digitadas no campo errado antes do envio.
            </p>
          </div>
        </div>

        {editingSuggestion?.supplierVisibleNote ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Observacao da Pepper:</strong> {editingSuggestion.supplierVisibleNote}
          </div>
        ) : null}

        <form ref={formRef} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nome do produto</span>
              <input value={formState.productName} onChange={(event) => updateField("productName", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="Ex.: Vestido midi canelado" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Valor / preco sugerido</span>
              <input value={formState.price} onChange={(event) => updateField("price", event.target.value)} type="number" min="0.01" step="0.01" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="79.90" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Material</span>
              <input value={formState.material} onChange={(event) => updateField("material", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="Viscolycra" required />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Caracteristica / modelo</span>
            <textarea value={formState.modelDescription} onChange={(event) => updateField("modelDescription", event.target.value)} className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="Modelagem, diferencial da peca, acabamento, caimento e qualquer detalhe util." required />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tamanhos</span>
              <input value={formState.sizes} onChange={(event) => updateField("sizes", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="P, M, G, GG" required />
              <span className="mt-2 block text-xs text-slate-400">Separe por virgula.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Cores</span>
              <input value={formState.colors} onChange={(event) => updateField("colors", event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" placeholder="Preto, Bege, Vermelho" required />
              <span className="mt-2 block text-xs text-slate-400">Separe por virgula.</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Foto frente {editingSuggestion ? '(opcional para trocar)' : ''}</span>
              <input ref={frontImageRef} name="frontImage" type="file" accept="image/*" required={!editingSuggestion} className="block w-full text-sm text-slate-500" />
            </label>
            <label className="block rounded-[1.6rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Foto costas {editingSuggestion ? '(opcional para trocar)' : ''}</span>
              <input ref={backImageRef} name="backImage" type="file" accept="image/*" required={!editingSuggestion} className="block w-full text-sm text-slate-500" />
            </label>
          </div>

          {validation ? (
            <div className={cn(
              "rounded-[1.8rem] border px-5 py-4",
              validation.validationStatus === "ready" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Validacao da Pepper IA</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {validation.validationStatus === "ready" ? "Sugestao pronta para envio." : "A Pepper IA encontrou pontos para revisar antes do envio."}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Score {validation.score}</span>
              </div>

              {validation.missingFields.length > 0 ? <div className="mt-4 text-sm text-slate-700"><strong>Campos faltando:</strong> {validation.missingFields.join(", ")}</div> : null}
              {validation.fieldCorrections.length > 0 ? (
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <strong>Correcoes aplicaveis:</strong>
                  {validation.fieldCorrections.map((item) => <p key={item}>{item}</p>)}
                </div>
              ) : null}
              {validation.warnings.length > 0 ? (
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <strong>Alertas:</strong>
                  {validation.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                  <strong>Titulo sugerido:</strong>
                  <p className="mt-2">{validation.suggestedProductName || "Sem ajuste de titulo."}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                  <strong>Material identificado:</strong>
                  <p className="mt-2">{validation.suggestedMaterial || "Sem ajuste de material."}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700">
                <strong>Descricao sugerida:</strong>
                <p className="mt-2 whitespace-pre-wrap">{validation.suggestedDescription || "Sem sugestao adicional."}</p>
              </div>
              {validation.suggestedAttributes.length > 0 ? (
                <div className="mt-4 text-sm text-slate-700">
                  <strong>Atributos sugeridos:</strong> {validation.suggestedAttributes.join(", ")}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={applyValidationSuggestions} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white sm:w-auto">
                  <CheckCircle2 className="h-4 w-4" />
                  Aplicar melhorias
                </button>
              </div>
            </div>
          ) : null}

          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" disabled={isValidating || isSubmitting} onClick={() => void handleValidate()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto disabled:cursor-not-allowed disabled:opacity-60">
              {isValidating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {isValidating ? "Validando..." : "Validar sugestao"}
            </button>
            <button type="button" disabled={isSubmitting || isValidating} onClick={() => void handleSubmit()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ec6232] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              {isSubmitting ? "Enviando..." : editingSuggestion ? "Corrigir e reenviar" : "Enviar sugestao"}
            </button>
            {editingSuggestion ? (
              <button type="button" onClick={() => setEditingId(null)} className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto">
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-panel backdrop-blur sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Sugestoes recentes</h2>
        <p className="mt-2 text-sm text-slate-500">Acompanhe o andamento e veja quando a Pepper pedir correcao ou aprovar para cadastro.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => setSelectedSuggestionId(suggestion.id)}
                className="group rounded-[1.8rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-soft"
              >
                <div className="relative overflow-hidden rounded-[1.4rem] border border-white bg-white">
                  <div className="relative aspect-[4/3]">
                    <Image src={suggestion.frontImageUrl ?? "/brand/pepper-logo.png"} alt={suggestion.productName} fill className="object-cover transition duration-300 group-hover:scale-105" />
                  </div>
                  <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 backdrop-blur">
                    {suggestion.statusLabel}
                  </div>
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{suggestion.productName}</h3>
                    <p className="mt-1 text-xs text-slate-500">{suggestion.createdAt}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">R$ {suggestion.price.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white px-2.5 py-1">{suggestion.sizes.length} tamanhos</span>
                  <span className="rounded-full bg-white px-2.5 py-1">{suggestion.colors.length} cores</span>
                  <span className="rounded-full bg-white px-2.5 py-1">Revisoes: {suggestion.revisionCount}</span>
                </div>
                {suggestion.supplierVisibleNote ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    <strong className="text-slate-700">Observacao:</strong> {suggestion.supplierVisibleNote}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">Clique para ver detalhes, fotos e status.</p>
                )}
              </button>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhuma sugestao enviada ainda.
            </div>
          )}
        </div>
      </section>

      {selectedSuggestion ? (
        <SupplierSuggestionModal
          suggestion={selectedSuggestion}
          draft={modalFormState}
          locked={selectedSuggestionLocked}
          onClose={() => setSelectedSuggestionId(null)}
          onChange={setModalFormState}
          onSubmit={() => void handleModalSubmit()}
          pending={isSubmitting}
          frontImageRef={modalFrontImageRef}
          backImageRef={modalBackImageRef}
        />
      ) : null}
    </div>
  );
}

function SupplierSuggestionModal({
  suggestion,
  draft,
  locked,
  onClose,
  onChange,
  onSubmit,
  pending,
  frontImageRef,
  backImageRef
}: {
  suggestion: ExistingSuggestion;
  draft: FormState;
  locked: boolean;
  onClose: () => void;
  onChange: Dispatch<SetStateAction<FormState>>;
  onSubmit: () => void;
  pending: boolean;
  frontImageRef: RefObject<HTMLInputElement | null>;
  backImageRef: RefObject<HTMLInputElement | null>;
}) {
  const statusTone = cn(
    "rounded-full px-3 py-1 text-xs font-semibold",
    suggestion.status === "APPROVED_FOR_CATALOG" && "bg-emerald-100 text-emerald-700",
    suggestion.status === "NEEDS_REVISION" && "bg-amber-100 text-amber-700",
    suggestion.status === "IMPORTED_BY_CATALOG" && "bg-sky-100 text-sky-700",
    suggestion.status === "REJECTED" && "bg-rose-100 text-rose-700",
    !["APPROVED_FOR_CATALOG", "NEEDS_REVISION", "IMPORTED_BY_CATALOG", "REJECTED"].includes(suggestion.status) && "bg-[#fff1e7] text-[#a94b25]"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white/96 p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d27a4f]">Sugestao do fornecedor</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{suggestion.productName}</h3>
            <p className="mt-1 text-sm text-slate-500">{suggestion.createdAt}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {locked ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Esta sugestao ja foi aprovada ou importada, entao o modal fica em modo de visualizacao apenas.
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <PreviewImageCard title="Foto frente" imageUrl={suggestion.frontImageUrl} />
              <PreviewImageCard title="Foto costas" imageUrl={suggestion.backImageUrl} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Status" value={suggestion.statusLabel} tone={statusTone} />
              <ReadOnlyField label="Preco" value={`R$ ${suggestion.price.toFixed(2).replace(".", ",")}`} />
              <ReadOnlyField label="Material" value={suggestion.material} />
              <ReadOnlyField label="Revisoes" value={String(suggestion.revisionCount)} />
              <ReadOnlyField className="md:col-span-2" label="Caracteristica / modelo" value={suggestion.modelDescription} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadList title="Tamanhos sugeridos" icon={<ClipboardList className="h-4 w-4" />} values={suggestion.sizes} />
              <ReadList title="Cores sugeridas" icon={<ClipboardList className="h-4 w-4" />} values={suggestion.colors} />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nome do produto</span>
              <input
                value={draft.productName}
                onChange={(event) => onChange((current) => ({ ...current, productName: event.target.value }))}
                disabled={locked}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preco</span>
                <input
                  value={draft.price}
                  onChange={(event) => onChange((current) => ({ ...current, price: event.target.value }))}
                  disabled={locked}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Material</span>
                <input
                  value={draft.material}
                  onChange={(event) => onChange((current) => ({ ...current, material: event.target.value }))}
                  disabled={locked}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
            </div>

            <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Caracteristica / modelo</span>
              <textarea
                value={draft.modelDescription}
                onChange={(event) => onChange((current) => ({ ...current, modelDescription: event.target.value }))}
                disabled={locked}
                className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tamanhos</span>
              <input
                value={draft.sizes}
                onChange={(event) => onChange((current) => ({ ...current, sizes: event.target.value }))}
                disabled={locked}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            <label className="block rounded-[1.4rem] border border-slate-200 bg-white p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cores</span>
              <input
                value={draft.colors}
                onChange={(event) => onChange((current) => ({ ...current, colors: event.target.value }))}
                disabled={locked}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block rounded-[1.4rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Atualizar foto frente</span>
                <input ref={frontImageRef} type="file" accept="image/*" disabled={locked} className="mt-3 block w-full text-sm text-slate-500 disabled:cursor-not-allowed" />
              </label>
              <label className="block rounded-[1.4rem] border border-dashed border-[#f1cdbb] bg-[#fffaf6] p-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Atualizar foto costas</span>
                <input ref={backImageRef} type="file" accept="image/*" disabled={locked} className="mt-3 block w-full text-sm text-slate-500 disabled:cursor-not-allowed" />
              </label>
            </div>

            {suggestion.supplierVisibleNote ? (
              <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <strong>Observacao da Pepper:</strong> {suggestion.supplierVisibleNote}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={locked || pending}
                onClick={onSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ec6232] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                {locked ? "Bloqueado" : pending ? "Enviando..." : "Corrigir e reenviar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewImageCard({ title, imageUrl }: { title: string; imageUrl: string | null }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="relative mt-3 h-52 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Image src={imageUrl ?? "/brand/pepper-logo.png"} alt={title} fill className="object-cover" />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, tone, className }: { label: string; value: string; tone?: string; className?: string }) {
  return (
    <div className={cn("rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4", tone, className)}>
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
        <span>{title}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <span key={`${title}-${value}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-400">Sem itens informados.</span>
        )}
      </div>
    </div>
  );
}
