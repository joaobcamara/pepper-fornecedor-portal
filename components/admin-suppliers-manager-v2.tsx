"use client";

import Image from "next/image";
import { useState, useTransition, type ChangeEvent } from "react";
import { CheckCircle2, LoaderCircle, MapPin, Phone, PlusCircle, Upload, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
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
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
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

const EMPTY_DRAFT: Draft = {
  name: "",
  slug: "",
  logoUrl: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  active: true,
  canViewProductValues: false,
  canViewFinancialDashboard: false
};

export function AdminSuppliersManagerV2({ suppliers }: { suppliers: SupplierRow[] }) {
  const [rows, setRows] = useState<SupplierRow[]>(suppliers);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(
      suppliers.map((supplier) => [
        supplier.id,
        {
          name: supplier.name,
          slug: supplier.slug,
          logoUrl: supplier.logoUrl ?? "",
          contactName: supplier.contactName ?? "",
          contactPhone: supplier.contactPhone ?? "",
          contactEmail: supplier.contactEmail ?? "",
          address: supplier.address ?? "",
          active: supplier.active,
          canViewProductValues: supplier.canViewProductValues,
          canViewFinancialDashboard: supplier.canViewFinancialDashboard
        }
      ])
    )
  );
  const [newSupplier, setNewSupplier] = useState<Draft>(EMPTY_DRAFT);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch
      }
    }));
  }

  async function uploadLogo(file: File, target: "new" | string, slugHint: string) {
    setFeedback(null);
    setError(null);
    setUploadingTarget(target);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplierSlug", slugify(slugHint) || "fornecedor");

    try {
      const response = await fetch("/api/admin/suppliers/logo", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; fileUrl?: string };

      if (!response.ok || !payload.fileUrl) {
        setError(payload.error ?? "Nao foi possivel enviar a logo.");
        return;
      }

      if (target === "new") {
        setNewSupplier((current) => ({
          ...current,
          logoUrl: payload.fileUrl ?? ""
        }));
      } else {
        updateDraft(target, { logoUrl: payload.fileUrl ?? "" });
      }

      setFeedback("Logo do fornecedor enviada com sucesso.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar a logo.");
    } finally {
      setUploadingTarget(null);
    }
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
      contactName: newSupplier.contactName.trim() || null,
      contactPhone: newSupplier.contactPhone.trim() || null,
      contactEmail: newSupplier.contactEmail.trim() || null,
      address: newSupplier.address.trim() || null,
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
        contactName: created.contactName ?? "",
        contactPhone: created.contactPhone ?? "",
        contactEmail: created.contactEmail ?? "",
        address: created.address ?? "",
        active: created.active,
        canViewProductValues: created.canViewProductValues,
        canViewFinancialDashboard: created.canViewFinancialDashboard
      }
    }));
    setNewSupplier(EMPTY_DRAFT);
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
              contactName: draft.contactName.trim() || null,
              contactPhone: draft.contactPhone.trim() || null,
              contactEmail: draft.contactEmail.trim() || null,
              address: draft.address.trim() || null,
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
              Cadastre a empresa, envie a logo do dispositivo e mantenha contato e endereco organizados para futuras interacoes da fundacao Pepper.
            </p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">Base de fornecedores</span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <Field label="Nome">
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
          </Field>

          <Field label="Slug">
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
          </Field>

          <Field label="Contato / responsavel">
            <input
              value={newSupplier.contactName}
              onChange={(event) => setNewSupplier((current) => ({ ...current, contactName: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: Maria Souza"
            />
          </Field>

          <Field label="Telefone / WhatsApp">
            <input
              value={newSupplier.contactPhone}
              onChange={(event) => setNewSupplier((current) => ({ ...current, contactPhone: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="(85) 99999-9999"
            />
          </Field>

          <Field label="Email">
            <input
              value={newSupplier.contactEmail}
              onChange={(event) => setNewSupplier((current) => ({ ...current, contactEmail: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="contato@fornecedor.com.br"
            />
          </Field>

          <Field label="Endereco" className="xl:col-span-2">
            <input
              value={newSupplier.address}
              onChange={(event) => setNewSupplier((current) => ({ ...current, address: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Rua, numero, bairro, cidade e estado"
            />
          </Field>

          <SupplierLogoField
            inputId="new-supplier-logo"
            supplierName={newSupplier.name || "Fornecedor"}
            logoUrl={newSupplier.logoUrl}
            uploading={uploadingTarget === "new"}
            onFileChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadLogo(file, "new", newSupplier.slug || newSupplier.name);
              }
              event.target.value = "";
            }}
            onRemove={() => setNewSupplier((current) => ({ ...current, logoUrl: "" }))}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ToggleButton
            label="Status"
            active={newSupplier.active}
            activeLabel="Ativo"
            inactiveLabel="Inativo"
            onClick={() => setNewSupplier((current) => ({ ...current, active: !current.active }))}
          />
          <ToggleButton
            label="Valores nos cards"
            active={newSupplier.canViewProductValues}
            activeLabel="Liberado"
            inactiveLabel="Oculto"
            onClick={() =>
              setNewSupplier((current) => ({
                ...current,
                canViewProductValues: !current.canViewProductValues
              }))
            }
          />
          <ToggleButton
            label="Dashboard financeiro"
            active={newSupplier.canViewFinancialDashboard}
            activeLabel="Liberado"
            inactiveLabel="Oculto"
            onClick={() =>
              setNewSupplier((current) => ({
                ...current,
                canViewFinancialDashboard: !current.canViewFinancialDashboard
              }))
            }
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center gap-4">
            <SupplierLogoPreview logoUrl={newSupplier.logoUrl} supplierName={newSupplier.name || "Fornecedor"} compact />
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{newSupplier.name || "Fornecedor sem nome ainda"}</p>
              <p className="mt-1">Logo enviada do dispositivo, contato e endereco aparecem na lista abaixo.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startTransition(() => void handleCreate())}
            className="inline-flex h-fit items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Criar fornecedor
          </button>
        </div>
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lista de fornecedores</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cada fornecedor agora concentra identidade visual, contato, endereco e permissoes de visibilidade para o portal.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} fornecedores</span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {rows.map((supplier) => {
            const draft = drafts[supplier.id];

            return (
              <article key={supplier.id} className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <SupplierLogoPreview logoUrl={draft.logoUrl} supplierName={draft.name || supplier.name} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{supplier.slug}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{draft.name || supplier.name}</h3>
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

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <MetaChip icon={UserRound} label={draft.contactName || "Contato pendente"} />
                  <MetaChip icon={Phone} label={draft.contactPhone || "Telefone pendente"} />
                  <MetaChip icon={MapPin} label={draft.address || "Endereco pendente"} />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-4">
                  <Field label="Nome">
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft(supplier.id, { name: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Slug">
                    <input
                      value={draft.slug}
                      onChange={(event) => updateDraft(supplier.id, { slug: slugify(event.target.value) })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Contato / responsavel">
                    <input
                      value={draft.contactName}
                      onChange={(event) => updateDraft(supplier.id, { contactName: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Telefone / WhatsApp">
                    <input
                      value={draft.contactPhone}
                      onChange={(event) => updateDraft(supplier.id, { contactPhone: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      value={draft.contactEmail}
                      onChange={(event) => updateDraft(supplier.id, { contactEmail: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <Field label="Endereco" className="xl:col-span-2">
                    <input
                      value={draft.address}
                      onChange={(event) => updateDraft(supplier.id, { address: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </Field>

                  <SupplierLogoField
                    inputId={`supplier-logo-${supplier.id}`}
                    supplierName={draft.name || supplier.name}
                    logoUrl={draft.logoUrl}
                    uploading={uploadingTarget === supplier.id}
                    onFileChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadLogo(file, supplier.id, draft.slug || draft.name || supplier.slug);
                      }
                      event.target.value = "";
                    }}
                    onRemove={() => updateDraft(supplier.id, { logoUrl: "" })}
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ToggleButton
                    label="Status"
                    active={draft.active}
                    activeLabel="Ativo"
                    inactiveLabel="Inativo"
                    onClick={() => updateDraft(supplier.id, { active: !draft.active })}
                  />
                  <ToggleButton
                    label="Valores nos cards"
                    active={draft.canViewProductValues}
                    activeLabel="Liberado"
                    inactiveLabel="Oculto"
                    onClick={() =>
                      updateDraft(supplier.id, {
                        canViewProductValues: !draft.canViewProductValues
                      })
                    }
                  />
                  <ToggleButton
                    label="Dashboard financeiro"
                    active={draft.canViewFinancialDashboard}
                    activeLabel="Liberado"
                    inactiveLabel="Oculto"
                    onClick={() =>
                      updateDraft(supplier.id, {
                        canViewFinancialDashboard: !draft.canViewFinancialDashboard
                      })
                    }
                  />
                </div>

                <div className="mt-4 flex justify-end">
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

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToggleButton({
  label,
  active,
  activeLabel,
  inactiveLabel,
  onClick
}: {
  label: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
        active ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]" : "border-slate-200 bg-white text-slate-700"
      )}
    >
      <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="mt-2 block">{active ? activeLabel : inactiveLabel}</span>
    </button>
  );
}

function MetaChip({
  icon: Icon,
  label
}: {
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span>{label}</span>
    </span>
  );
}

function SupplierLogoField({
  inputId,
  supplierName,
  logoUrl,
  uploading,
  onFileChange,
  onRemove
}: {
  inputId: string;
  supplierName: string;
  logoUrl: string;
  uploading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 xl:col-span-1">
      <div className="flex items-start gap-4">
        <SupplierLogoPreview logoUrl={logoUrl} supplierName={supplierName} compact />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Foto ou logo do fornecedor</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Envie a imagem direto do computador ou celular. Ela aparece no portal do fornecedor.
          </p>
          <label
            htmlFor={inputId}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Enviando..." : "Selecionar arquivo"}
          </label>
          <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          {logoUrl ? (
            <button type="button" onClick={onRemove} className="mt-3 block text-xs font-semibold text-rose-600">
              Remover logo atual
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SupplierLogoPreview({
  logoUrl,
  supplierName,
  compact = false
}: {
  logoUrl: string | null;
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
