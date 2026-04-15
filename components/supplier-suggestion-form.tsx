"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, ScanSearch, SendHorizonal, Sparkles } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createFormState());
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isValidating, startValidate] = useTransition();

  const editingSuggestion = suggestions.find((item) => item.id === editingId) ?? null;

  useEffect(() => {
    setFormState(createFormState(editingSuggestion));
    setValidation(null);
  }, [editingSuggestion]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleSubmit() {
    setMessage(null);
    setError(null);

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
  }

  async function handleValidate() {
    setMessage(null);
    setError(null);

    const frontFile = frontImageRef.current?.files?.[0];
    const backFile = backImageRef.current?.files?.[0];

    if (!frontFile || !backFile) {
      setError("Anexe as fotos de frente e costas para a Pepper IA validar a sugestao com base nas imagens.");
      return;
    }

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
            <button type="button" onClick={() => startValidate(() => void handleValidate())} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto">
              {isValidating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {isValidating ? "Validando..." : "Validar sugestao"}
            </button>
            <button type="button" onClick={() => startSubmit(() => void handleSubmit())} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ec6232] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb391] sm:w-auto">
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

        <div className="mt-5 space-y-4">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white bg-white">
                    <Image src={suggestion.frontImageUrl ?? "/brand/pepper-logo.png"} alt={suggestion.productName} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-base font-semibold text-slate-900">{suggestion.productName}</h3>
                      <span className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        suggestion.status === 'APPROVED_FOR_CATALOG' && 'bg-emerald-100 text-emerald-700',
                        suggestion.status === 'NEEDS_REVISION' && 'bg-amber-100 text-amber-700',
                        suggestion.status === 'IMPORTED_BY_CATALOG' && 'bg-sky-100 text-sky-700',
                        suggestion.status === 'REJECTED' && 'bg-rose-100 text-rose-700',
                        !['APPROVED_FOR_CATALOG','NEEDS_REVISION','IMPORTED_BY_CATALOG','REJECTED'].includes(suggestion.status) && 'bg-[#fff1e7] text-[#a94b25]'
                      )}>
                        {suggestion.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">R$ {suggestion.price.toFixed(2).replace('.', ',')}</p>
                    <p className="mt-2 text-xs text-slate-500">{suggestion.createdAt}</p>
                    <p className="mt-2 text-xs text-slate-400">Tamanhos: {suggestion.sizes.join(', ')} • Cores: {suggestion.colors.join(', ')}</p>
                    {suggestion.supplierVisibleNote ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <strong>Observacao:</strong> {suggestion.supplierVisibleNote}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-white px-2.5 py-1">Revisoes: {suggestion.revisionCount}</span>
                      {suggestion.onboardingStatus ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Fila: {suggestion.onboardingStatus}</span> : null}
                    </div>
                    {suggestion.canResubmit ? (
                      <button type="button" onClick={() => setEditingId(suggestion.id)} className="mt-3 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                        Corrigir e reenviar
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhuma sugestao enviada ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
