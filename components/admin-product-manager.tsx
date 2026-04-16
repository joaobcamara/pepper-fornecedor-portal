"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductGroup = {
  id: string;
  parentSku: string;
  internalName: string;
  imageUrl: string;
  active: boolean;
  variantCount: number;
  totalStock: number;
  staleCount: number;
  supplierIds: string[];
  suppliers: Array<{
    id: string;
    name: string;
  }>;
  updatedAt: string;
};

export function AdminProductManager({
  suppliers,
  productGroups
}: {
  suppliers: SupplierOption[];
  productGroups: ProductGroup[];
}) {
  const [drafts, setDrafts] = useState<Record<string, { internalName: string; active: boolean; supplierIds: string[] }>>(
    () =>
      Object.fromEntries(
        productGroups.map((group) => [
          group.parentSku,
          {
            internalName: group.internalName,
            active: group.active,
            supplierIds: group.supplierIds
          }
        ])
      )
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingSku, setSavingSku] = useState<string | null>(null);

  function updateDraft(parentSku: string, data: Partial<{ internalName: string; active: boolean; supplierIds: string[] }>) {
    setDrafts((current) => ({
      ...current,
      [parentSku]: {
        ...current[parentSku],
        ...data
      }
    }));
  }

  async function saveGroup(parentSku: string) {
    setFeedback(null);
    setError(null);
    setSavingSku(parentSku);

    const draft = drafts[parentSku];

    try {
      const response = await fetch("/api/admin/products/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentSku,
          ...draft
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o produto.");
        return;
      }

      setFeedback(`Produto ${parentSku} atualizado com sucesso.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o produto.");
    } finally {
      setSavingSku(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Gestão interna</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Produtos, vínculos e status ativos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Aqui você ajusta o nome interno do produto, ativa ou desativa o grupo e controla quais fornecedores enxergam
            cada conjunto de variações.
          </p>
        </div>
        <div className="rounded-2xl border border-[#f2d4c3] bg-[#fff8f3] px-4 py-3 text-sm text-slate-600">
          Tudo é aplicado em lote para o pai e todas as filhas vinculadas.
        </div>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {productGroups.map((group) => {
          const draft = drafts[group.parentSku];

          return (
            <article key={group.parentSku} className="rounded-[1.8rem] border border-slate-100 bg-slate-50/70 p-5 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white bg-white shadow-inner">
                    <Image src={group.imageUrl} alt={group.internalName} fill className="object-contain p-2" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{group.parentSku}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{group.internalName}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {group.variantCount} variações • estoque total {group.totalStock}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    group.staleCount > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  {group.staleCount > 0 ? `${group.staleCount} desatualizadas` : "Sincronizado"}
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Nome interno</span>
                  <input
                    value={draft.internalName}
                    onChange={(event) => updateDraft(group.parentSku, { internalName: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Produto ativo</p>
                    <p className="text-xs text-slate-500">Quando inativo, o grupo deixa de aparecer para os fornecedores.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDraft(group.parentSku, { active: !draft.active })}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      draft.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {draft.active ? "Ativo" : "Inativo"}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-700">Fornecedores vinculados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suppliers.map((supplier) => {
                      const active = draft.supplierIds.includes(supplier.id);
                      return (
                        <button
                          key={`${group.parentSku}-${supplier.id}`}
                          type="button"
                          onClick={() =>
                            updateDraft(group.parentSku, {
                              supplierIds: active
                                ? draft.supplierIds.filter((item) => item !== supplier.id)
                                : [...draft.supplierIds, supplier.id]
                            })
                          }
                          className={cn(
                            "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                            active
                              ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-[#f2b79a]"
                          )}
                        >
                          {supplier.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-slate-500">Atualizado no sistema em {group.updatedAt}</p>
                <button
                  type="button"
                  disabled={savingSku !== null}
                  onClick={() => void saveGroup(group.parentSku)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSku === group.parentSku ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {savingSku === group.parentSku ? "Salvando..." : "Salvar ajustes"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AdminSyncRuns({
  syncRuns
}: {
  syncRuns: Array<{
    id: string;
    triggerType: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  }>;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Sincronizações recentes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Leitura rápida dos últimos disparos para entender saúde da integração e fallback.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <RefreshCcw className="mr-2 inline h-4 w-4" />
          Tiny → SQLite
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {syncRuns.length > 0 ? (
          syncRuns.map((run) => (
            <div key={run.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {run.triggerType} • {run.startedAt}
                  </p>
                  <p className="text-xs text-slate-500">
                    {run.finishedAt ? `Finalizada em ${run.finishedAt}` : "Ainda em processamento"}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    run.status === "completed" && "bg-emerald-50 text-emerald-700",
                    run.status === "partial" && "bg-amber-50 text-amber-700",
                    run.status === "failed" && "bg-rose-50 text-rose-700",
                    run.status === "processing" && "bg-sky-50 text-sky-700"
                  )}
                >
                  {run.status}
                </span>
              </div>
              {run.errorMessage ? (
                <p className="mt-3 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-rose-700">
                  {run.errorMessage}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Nenhuma sincronização registrada ainda.
          </div>
        )}
      </div>
    </section>
  );
}
