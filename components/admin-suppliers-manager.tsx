"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, PlusCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  active: boolean;
  canViewProductValues: boolean;
  canViewFinancialDashboard: boolean;
  productCount: number;
  userCount: number;
  createdAt: string;
};

type Draft = {
  name: string;
  slug: string;
  logoUrl: string;
  active: boolean;
  canViewProductValues: boolean;
  canViewFinancialDashboard: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminSuppliersManager({ suppliers }: { suppliers: SupplierRow[] }) {
  const [rows, setRows] = useState<SupplierRow[]>(suppliers);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(
      suppliers.map((supplier) => [
        supplier.id,
        {
          name: supplier.name,
          slug: supplier.slug,
          logoUrl: supplier.logoUrl ?? "",
          active: supplier.active,
          canViewProductValues: supplier.canViewProductValues,
          canViewFinancialDashboard: supplier.canViewFinancialDashboard
        }
      ])
    )
  );
  const [newSupplier, setNewSupplier] = useState<Draft>({
    name: "",
    slug: "",
    logoUrl: "",
    active: true,
    canViewProductValues: false,
    canViewFinancialDashboard: false
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch
      }
    }));
  }

  async function handleCreate() {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSupplier)
    });

    const payload = (await response.json()) as { error?: string; supplierId?: string };

    if (!response.ok || !payload.supplierId) {
      setError(payload.error ?? "Nao foi possivel criar o fornecedor.");
      return;
    }

    const created: SupplierRow = {
      id: payload.supplierId,
      name: newSupplier.name.trim(),
      slug: slugify(newSupplier.slug),
      logoUrl: newSupplier.logoUrl.trim() || null,
      active: newSupplier.active,
      canViewProductValues: newSupplier.canViewProductValues,
      canViewFinancialDashboard: newSupplier.canViewFinancialDashboard,
      productCount: 0,
      userCount: 0,
      createdAt: "Agora"
    };

    setRows((current) => [created, ...current]);
    setDrafts((current) => ({
      ...current,
      [created.id]: {
        name: created.name,
        slug: created.slug,
        logoUrl: created.logoUrl ?? "",
        active: created.active,
        canViewProductValues: created.canViewProductValues,
        canViewFinancialDashboard: created.canViewFinancialDashboard
      }
    }));
    setNewSupplier({
      name: "",
      slug: "",
      logoUrl: "",
      active: true,
      canViewProductValues: false,
      canViewFinancialDashboard: false
    });
    setFeedback(`Fornecedor ${created.name} criado com sucesso.`);
  }

  async function handleSave(row: SupplierRow) {
    setFeedback(null);
    setError(null);
    const draft = drafts[row.id];

    const response = await fetch("/api/admin/suppliers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        ...draft
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar o fornecedor.");
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              name: draft.name.trim(),
              slug: slugify(draft.slug),
              logoUrl: draft.logoUrl.trim() || null,
              active: draft.active,
              canViewProductValues: draft.canViewProductValues,
              canViewFinancialDashboard: draft.canViewFinancialDashboard
            }
          : item
      )
    );
    setFeedback(`Fornecedor ${draft.name} atualizado com sucesso.`);
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Novo fornecedor</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cadastre a empresa que vai ganhar acesso ao portal e prepare o vinculo com usuarios e produtos.
            </p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">CRUD inicial</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.8fr_1fr_0.55fr_0.65fr_0.75fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Nome</span>
            <input
              value={newSupplier.name}
              onChange={(event) =>
                setNewSupplier((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: current.slug || slugify(event.target.value)
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: Luna Textil"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Slug</span>
            <input
              value={newSupplier.slug}
              onChange={(event) =>
                setNewSupplier((current) => ({
                  ...current,
                  slug: slugify(event.target.value)
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="luna-textil"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Foto ou logo do fornecedor</span>
            <input
              value={newSupplier.logoUrl}
              onChange={(event) =>
                setNewSupplier((current) => ({
                  ...current,
                  logoUrl: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="https://..."
            />
            <p className="mt-2 text-xs text-slate-500">Essa imagem aparece no cabeçalho das páginas do fornecedor.</p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Status</span>
            <button
              type="button"
              onClick={() => setNewSupplier((current) => ({ ...current, active: !current.active }))}
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                newSupplier.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              )}
            >
              {newSupplier.active ? "Ativo" : "Inativo"}
            </button>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Valores nos cards</span>
            <button
              type="button"
              onClick={() =>
                setNewSupplier((current) => ({
                  ...current,
                  canViewProductValues: !current.canViewProductValues
                }))
              }
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                newSupplier.canViewProductValues ? "bg-[#fff1e7] text-[#a94b25]" : "bg-slate-100 text-slate-600"
              )}
            >
              {newSupplier.canViewProductValues ? "Liberado" : "Oculto"}
            </button>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Dashboard financeiro</span>
            <button
              type="button"
              onClick={() =>
                setNewSupplier((current) => ({
                  ...current,
                  canViewFinancialDashboard: !current.canViewFinancialDashboard
                }))
              }
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                newSupplier.canViewFinancialDashboard ? "bg-[#fff1e7] text-[#a94b25]" : "bg-slate-100 text-slate-600"
              )}
            >
              {newSupplier.canViewFinancialDashboard ? "Liberado" : "Oculto"}
            </button>
          </label>

          <button
            type="button"
            onClick={() => startTransition(() => void handleCreate())}
            className="mt-7 inline-flex h-fit items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Criar
          </button>
        </div>

        <div className="mt-4">
          <SupplierLogoPreview
            logoUrl={newSupplier.logoUrl}
            supplierName={newSupplier.name || "Fornecedor"}
            compact
          />
        </div>
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((supplier) => {
            const draft = drafts[supplier.id];

            return (
              <article key={supplier.id} className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <SupplierLogoPreview logoUrl={draft.logoUrl} supplierName={draft.name || supplier.name} />
                    <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{supplier.slug}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{supplier.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {supplier.productCount} produtos | {supplier.userCount} usuarios | criado {supplier.createdAt}
                    </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      draft.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {draft.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Nome</span>
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft(supplier.id, { name: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Slug</span>
                    <input
                      value={draft.slug}
                      onChange={(event) => updateDraft(supplier.id, { slug: slugify(event.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Foto ou logo do fornecedor</span>
                    <input
                      value={draft.logoUrl}
                      onChange={(event) => updateDraft(supplier.id, { logoUrl: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => updateDraft(supplier.id, { active: !draft.active })}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Marcar como {draft.active ? "inativo" : "ativo"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateDraft(supplier.id, {
                        canViewProductValues: !draft.canViewProductValues
                      })
                    }
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold",
                      draft.canViewProductValues
                        ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    Valores nos cards: {draft.canViewProductValues ? "liberado" : "oculto"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateDraft(supplier.id, {
                        canViewFinancialDashboard: !draft.canViewFinancialDashboard
                      })
                    }
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold",
                      draft.canViewFinancialDashboard
                        ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    Dashboard financeiro: {draft.canViewFinancialDashboard ? "liberado" : "oculto"}
                  </button>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => startTransition(() => void handleSave(supplier))}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Salvar ajustes
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function SupplierLogoPreview({
  logoUrl,
  supplierName,
  compact = false
}: {
  logoUrl: string;
  supplierName: string;
  compact?: boolean;
}) {
  const size = compact ? "h-16 w-16" : "h-14 w-14";

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft", size)}>
      {logoUrl ? (
        <div className="relative h-full w-full">
          <Image src={logoUrl} alt={supplierName} fill className="object-contain p-2" />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#fff6ef] text-xs font-semibold text-slate-400">
          Sem foto
        </div>
      )}
    </div>
  );
}
