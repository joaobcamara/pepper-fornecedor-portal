"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MapPin,
  PencilLine,
  Phone,
  PlusCircle,
  Search,
  Settings2,
  Tag,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";

import { cn } from "@/lib/cn";

type SupplierProductLink = {
  id: string;
  catalogProductId: string;
  parentSku: string;
  name: string;
  imageUrl: string | null;
  active: boolean;
  supplierSalePrice: number | null;
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
};

type ProductOption = {
  id: string;
  parentSku: string;
  name: string;
  imageUrl: string | null;
};

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
  linkedProducts: SupplierProductLink[];
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function summarizeProductName(value: string, words = 4) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) {
    return value;
  }

  return `${parts.slice(0, words).join(" ")}...`;
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Sem preco";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function toNullableNumber(value: string) {
  const sanitized = value.replace(",", ".").trim();
  if (!sanitized) {
    return null;
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function toNullableInteger(value: string) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  return Math.max(0, Math.round(parsed));
}

function syncProductCount(linkedProducts: SupplierProductLink[]) {
  return linkedProducts.filter((link) => link.active).length;
}

function updateSupplierRow(rows: SupplierRow[], supplierId: string, updater: (row: SupplierRow) => SupplierRow) {
  return rows.map((row) => (row.id === supplierId ? updater(row) : row));
}

export function AdminSuppliersManagerV2({
  suppliers,
  productOptions
}: {
  suppliers: SupplierRow[];
  productOptions: ProductOption[];
}) {
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
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [linkingSupplierId, setLinkingSupplierId] = useState<string | null>(null);
  const [activeLinkRef, setActiveLinkRef] = useState<{ supplierId: string; linkId: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);

  const selectedSupplier = activeSupplierId ? rows.find((item) => item.id === activeSupplierId) ?? null : null;
  const selectedSupplierDraft = activeSupplierId ? drafts[activeSupplierId] ?? null : null;
  const editingSupplier = editingSupplierId ? rows.find((item) => item.id === editingSupplierId) ?? null : null;
  const editingSupplierDraft = editingSupplierId ? drafts[editingSupplierId] ?? null : null;
  const linkingSupplier = linkingSupplierId ? rows.find((item) => item.id === linkingSupplierId) ?? null : null;
  const activeLink =
    activeLinkRef && activeLinkRef.supplierId
      ? rows.find((item) => item.id === activeLinkRef.supplierId)?.linkedProducts.find((link) => link.id === activeLinkRef.linkId) ?? null
      : null;

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
    setBusyTarget("create");

    try {
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
        createdAt: "Agora",
        linkedProducts: []
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
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Nao foi possivel criar o fornecedor.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleSaveSupplier(supplier: SupplierRow) {
    const draft = drafts[supplier.id];

    setFeedback(null);
    setError(null);
    setBusyTarget(`save-supplier:${supplier.id}`);

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: supplier.id,
          ...draft
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o fornecedor.");
        return;
      }

      setRows((current) =>
        updateSupplierRow(current, supplier.id, (row) => ({
          ...row,
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
        }))
      );
      setFeedback(`Fornecedor ${draft.name.trim() || supplier.name} atualizado com sucesso.`);
      setEditingSupplierId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel atualizar o fornecedor.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleDeleteSupplier(supplier: SupplierRow) {
    if (!window.confirm(`Deseja excluir ou arquivar ${supplier.name}?`)) {
      return;
    }

    setFeedback(null);
    setError(null);
    setBusyTarget(`delete-supplier:${supplier.id}`);

    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: supplier.id })
      });

      const payload = (await response.json()) as { error?: string; mode?: "archived" | "deleted" };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel excluir o fornecedor.");
        return;
      }

      if (payload.mode === "archived") {
        setRows((current) =>
          updateSupplierRow(current, supplier.id, (row) => ({
            ...row,
            active: false,
            productCount: 0,
            linkedProducts: row.linkedProducts.map((link) => ({ ...link, active: false }))
          }))
        );
        setDrafts((current) => ({
          ...current,
          [supplier.id]: {
            ...current[supplier.id],
            active: false
          }
        }));
        setFeedback(`Fornecedor ${supplier.name} arquivado. Os vinculos de produto foram desativados.`);
      } else {
        setRows((current) => current.filter((row) => row.id !== supplier.id));
        setDrafts((current) => {
          const next = { ...current };
          delete next[supplier.id];
          return next;
        });
        setFeedback(`Fornecedor ${supplier.name} excluido com sucesso.`);
      }

      if (activeSupplierId === supplier.id) {
        setActiveSupplierId(null);
      }
      if (editingSupplierId === supplier.id) {
        setEditingSupplierId(null);
      }
      if (linkingSupplierId === supplier.id) {
        setLinkingSupplierId(null);
      }
      if (activeLinkRef?.supplierId === supplier.id) {
        setActiveLinkRef(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir o fornecedor.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleLinkProduct(supplier: SupplierRow, product: ProductOption) {
    setFeedback(null);
    setError(null);
    setBusyTarget(`link:${supplier.id}:${product.id}`);

    try {
      const response = await fetch("/api/admin/suppliers/product-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          catalogProductId: product.id
        })
      });

      const payload = (await response.json()) as { error?: string; linkId?: string };

      if (!response.ok || !payload.linkId) {
        setError(payload.error ?? "Nao foi possivel vincular o produto.");
        return;
      }

      const ensuredLinkId = payload.linkId;

      setRows((current) =>
        updateSupplierRow(current, supplier.id, (row) => {
          const existing = row.linkedProducts.find((link) => link.catalogProductId === product.id);
          const nextLinkedProducts = existing
            ? row.linkedProducts.map((link) =>
                link.catalogProductId === product.id
                  ? {
                      ...link,
                      id: ensuredLinkId,
                      active: true
                    }
                  : link
              )
            : [
                {
                  id: ensuredLinkId,
                  catalogProductId: product.id,
                  parentSku: product.parentSku,
                  name: product.name,
                  imageUrl: product.imageUrl,
                  active: true,
                  supplierSalePrice: null,
                  criticalStockThreshold: null,
                  lowStockThreshold: null
                },
                ...row.linkedProducts
              ];

          return {
            ...row,
            linkedProducts: nextLinkedProducts,
            productCount: syncProductCount(nextLinkedProducts)
          };
        })
      );

      setFeedback(`Produto ${product.parentSku} vinculado a ${supplier.name}.`);
      setLinkingSupplierId(null);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Nao foi possivel vincular o produto.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleSaveLink(
    supplier: SupplierRow,
    link: SupplierProductLink,
    patch: {
      active: boolean;
      supplierSalePrice: number | null;
      criticalStockThreshold: number | null;
      lowStockThreshold: number | null;
    }
  ) {
    setFeedback(null);
    setError(null);
    setBusyTarget(`save-link:${link.id}`);

    try {
      const response = await fetch("/api/admin/suppliers/product-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: link.id,
          ...patch
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel atualizar o vinculo.");
        return;
      }

      setRows((current) =>
        updateSupplierRow(current, supplier.id, (row) => {
          const nextLinkedProducts = row.linkedProducts.map((item) =>
            item.id === link.id
              ? {
                  ...item,
                  active: patch.active,
                  supplierSalePrice: patch.supplierSalePrice,
                  criticalStockThreshold: patch.criticalStockThreshold,
                  lowStockThreshold: patch.lowStockThreshold
                }
              : item
          );

          return {
            ...row,
            linkedProducts: nextLinkedProducts,
            productCount: syncProductCount(nextLinkedProducts)
          };
        })
      );

      setFeedback(`Vinculo ${link.parentSku} atualizado em ${supplier.name}.`);
      setActiveLinkRef(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel atualizar o vinculo.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function handleDeleteLink(supplier: SupplierRow, link: SupplierProductLink) {
    if (!window.confirm(`Deseja remover ${link.parentSku} de ${supplier.name}?`)) {
      return;
    }

    setFeedback(null);
    setError(null);
    setBusyTarget(`delete-link:${link.id}`);

    try {
      const response = await fetch("/api/admin/suppliers/product-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: link.id
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel remover o vinculo.");
        return;
      }

      setRows((current) =>
        updateSupplierRow(current, supplier.id, (row) => {
          const nextLinkedProducts = row.linkedProducts.filter((item) => item.id !== link.id);
          return {
            ...row,
            linkedProducts: nextLinkedProducts,
            productCount: syncProductCount(nextLinkedProducts)
          };
        })
      );

      setFeedback(`Vinculo ${link.parentSku} removido de ${supplier.name}.`);
      setActiveLinkRef(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel remover o vinculo.");
    } finally {
      setBusyTarget(null);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Novo fornecedor</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cadastre o fornecedor uma vez e depois gerencie todos os vinculos de produto dentro do modal dele, sem
              espalhar essa configuracao pelo portal.
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
              placeholder="Rua, numero e cidade"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              <p className="mt-1">Depois do cadastro, os produtos vinculados passam a ser gerenciados dentro do modal deste fornecedor.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SupplierLogoField
              inputId="supplier-logo-new"
              supplierName={newSupplier.name || "Fornecedor"}
              logoUrl={newSupplier.logoUrl}
              uploading={uploadingTarget === "new"}
              className="hidden"
              onFileChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadLogo(file, "new", newSupplier.slug || newSupplier.name || "fornecedor");
                }
                event.target.value = "";
              }}
              onRemove={() => setNewSupplier((current) => ({ ...current, logoUrl: "" }))}
            />
            <label
              htmlFor="supplier-logo-new"
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {uploadingTarget === "new" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Logo
            </label>
            <button
              type="button"
              disabled={busyTarget === "create"}
              onClick={() => void handleCreate()}
              className="inline-flex h-fit items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
            >
              {busyTarget === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Criar fornecedor
            </button>
          </div>
        </div>
      </section>

      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Lista de fornecedores</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cada card agora serve para abrir a gestao de produtos vinculados. O cadastro do fornecedor fica em um segundo modal.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} fornecedores</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((supplier) => {
            const draft = drafts[supplier.id];
            const activeLinkedProducts = supplier.linkedProducts.filter((link) => link.active);
            const statusClass = draft.active
              ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-600";

            return (
              <button
                key={supplier.id}
                type="button"
                onClick={() => setActiveSupplierId(supplier.id)}
                className="group rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <SupplierLogoPreview logoUrl={draft.logoUrl} supplierName={draft.name || supplier.name} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{supplier.slug}</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{draft.name || supplier.name}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {activeLinkedProducts.length} produtos ativos | {supplier.userCount} usuarios
                      </p>
                    </div>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusClass)}>{draft.active ? "Ativo" : "Inativo"}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <MetaChip icon={UserRound} label={draft.contactName || "Contato pendente"} />
                  <MetaChip icon={Phone} label={draft.contactPhone || "Telefone pendente"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <MetaChip icon={MapPin} label={draft.address || "Endereco pendente"} />
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500">Criado {supplier.createdAt}</span>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Produtos vinculados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeLinkedProducts.length > 0 ? (
                      activeLinkedProducts.slice(0, 3).map((link) => (
                        <span key={link.id} className="rounded-full border border-[#f2d7c7] bg-[#fff6ef] px-3 py-1 text-xs font-semibold text-[#a94c25]">
                          {link.parentSku}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">Nenhum produto vinculado</span>
                    )}
                    {activeLinkedProducts.length > 3 ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                        +{activeLinkedProducts.length - 3}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>Abrir produtos vinculados</span>
                  <span className="transition group-hover:translate-x-0.5">-&gt;</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSupplier && selectedSupplierDraft ? (
        <SupplierProductsModal
          supplier={selectedSupplier}
          draft={selectedSupplierDraft}
          busyTarget={busyTarget}
          onClose={() => setActiveSupplierId(null)}
          onOpenEdit={() => setEditingSupplierId(selectedSupplier.id)}
          onOpenLinkPicker={() => setLinkingSupplierId(selectedSupplier.id)}
          onOpenLink={(link) => setActiveLinkRef({ supplierId: selectedSupplier.id, linkId: link.id })}
        />
      ) : null}

      {editingSupplier && editingSupplierDraft ? (
        <SupplierEditModal
          supplier={editingSupplier}
          draft={editingSupplierDraft}
          uploading={uploadingTarget === editingSupplier.id}
          saving={busyTarget === `save-supplier:${editingSupplier.id}`}
          deleting={busyTarget === `delete-supplier:${editingSupplier.id}`}
          onClose={() => setEditingSupplierId(null)}
          onChange={(patch) => updateDraft(editingSupplier.id, patch)}
          onLogoChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadLogo(file, editingSupplier.id, editingSupplierDraft.slug || editingSupplierDraft.name || editingSupplier.slug);
            }
            event.target.value = "";
          }}
          onLogoRemove={() => updateDraft(editingSupplier.id, { logoUrl: "" })}
          onSave={() => void handleSaveSupplier(editingSupplier)}
          onDelete={() => void handleDeleteSupplier(editingSupplier)}
        />
      ) : null}

      {linkingSupplier ? (
        <ProductPickerModal
          supplier={linkingSupplier}
          productOptions={productOptions}
          busyTarget={busyTarget}
          onClose={() => setLinkingSupplierId(null)}
          onSelectProduct={(product) => void handleLinkProduct(linkingSupplier, product)}
        />
      ) : null}

      {activeLink && activeLinkRef ? (
        <SupplierProductLinkModal
          supplier={rows.find((item) => item.id === activeLinkRef.supplierId) ?? null}
          link={activeLink}
          saving={busyTarget === `save-link:${activeLink.id}`}
          deleting={busyTarget === `delete-link:${activeLink.id}`}
          onClose={() => setActiveLinkRef(null)}
          onSave={(patch) => {
            const supplier = rows.find((item) => item.id === activeLinkRef.supplierId);
            if (supplier) {
              void handleSaveLink(supplier, activeLink, patch);
            }
          }}
          onDelete={() => {
            const supplier = rows.find((item) => item.id === activeLinkRef.supplierId);
            if (supplier) {
              void handleDeleteLink(supplier, activeLink);
            }
          }}
        />
      ) : null}
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
  children: ReactNode;
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
  className,
  onFileChange,
  onRemove
}: {
  inputId: string;
  supplierName: string;
  logoUrl: string;
  uploading: boolean;
  className?: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn("rounded-[1.4rem] border border-slate-200 bg-white p-4", className)}>
      <div className="flex items-start gap-4">
        {logoUrl ? (
          <SupplierLogoPreview logoUrl={logoUrl} supplierName={supplierName} compact />
        ) : (
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-[#fff6ef] text-xs font-semibold text-slate-400">
            <Upload className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Foto ou logo do fornecedor</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {logoUrl
              ? "Envie uma nova imagem se quiser substituir a logo atual do fornecedor."
              : "Envie a imagem direto do computador ou celular. Ela aparece no portal do fornecedor."}
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
        <div className="flex h-full w-full items-center justify-center bg-[#fff6ef] text-xs font-semibold text-slate-400">Sem foto</div>
      )}
    </div>
  );
}

function ProductThumb({
  imageUrl,
  alt,
  className = ""
}: {
  imageUrl: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = !failed && imageUrl ? imageUrl : "/brand/pepper-logo.png";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-slate-200 bg-white", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("h-full w-full", src === "/brand/pepper-logo.png" ? "object-contain p-3" : "object-cover")}
      />
    </div>
  );
}

function SupplierProductsModal({
  supplier,
  draft,
  busyTarget,
  onClose,
  onOpenEdit,
  onOpenLinkPicker,
  onOpenLink
}: {
  supplier: SupplierRow;
  draft: Draft;
  busyTarget: string | null;
  onClose: () => void;
  onOpenEdit: () => void;
  onOpenLinkPicker: () => void;
  onOpenLink: (link: SupplierProductLink) => void;
}) {
  const orderedLinks = [...supplier.linkedProducts].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    return left.parentSku.localeCompare(right.parentSku, "pt-BR");
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <SupplierLogoPreview logoUrl={draft.logoUrl || supplier.logoUrl} supplierName={draft.name || supplier.name} compact />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a94c25]">Produtos do fornecedor</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{draft.name || supplier.name}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Este modal concentra o vinculo com produtos. Critica, preco e status do vinculo ficam aqui, junto do fornecedor certo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", draft.active ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600")}>
              {draft.active ? "Fornecedor ativo" : "Fornecedor inativo"}
            </span>
            <button
              type="button"
              onClick={onOpenEdit}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              <PencilLine className="h-4 w-4" />
              Editar fornecedor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <section className="space-y-4 rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-5">
            <div className="rounded-[1.4rem] border border-white/70 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo do fornecedor</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <MetaChip icon={UserRound} label={draft.contactName || "Contato pendente"} />
                <MetaChip icon={Phone} label={draft.contactPhone || "Telefone pendente"} />
                <MetaChip icon={MapPin} label={draft.address || "Endereco pendente"} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryTile label="Produtos ativos" value={String(supplier.linkedProducts.filter((link) => link.active).length)} />
              <SummaryTile label="Produtos inativos" value={String(supplier.linkedProducts.filter((link) => !link.active).length)} />
              <SummaryTile label="Usuarios" value={String(supplier.userCount)} />
              <SummaryTile label="Criado" value={supplier.createdAt} />
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-[#f4d7c7] bg-[#fffaf6] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Produtos vinculados</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Clique em um mini card para ajustar preco, critica e status do vinculo. O mesmo produto pode aparecer em fornecedores diferentes.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{supplier.linkedProducts.length} vinculos</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <button
                type="button"
                onClick={onOpenLinkPicker}
                className="flex min-h-[15rem] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-[#f2b79a] bg-white px-5 py-6 text-center transition hover:border-[#df8a60] hover:bg-[#fff6ef]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1e7] text-[#a94c25]">
                  <PlusCircle className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">Vincular produto</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Abra a busca, selecione um SKU pai e confirme para criar o card no portal do fornecedor.</p>
              </button>

              {orderedLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onOpenLink(link)}
                  className="rounded-[1.6rem] border border-slate-200 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <ProductThumb imageUrl={link.imageUrl} alt={link.name} className="h-24 w-24 flex-none" />
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        link.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {link.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{link.parentSku}</p>
                    <p className="line-clamp-2 text-base font-semibold text-slate-900">{summarizeProductName(link.name, 6)}</p>
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">Preco: {formatCurrency(link.supplierSalePrice)}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      Critico {link.criticalStockThreshold ?? "-"} | Baixo {link.lowStockThreshold ?? "-"}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-900">
                    <span>Ajustar vinculo</span>
                    <Settings2 className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>

            {busyTarget?.startsWith("link:") ? (
              <p className="mt-4 text-sm text-slate-500">Criando vinculo do produto selecionado...</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProductPickerModal({
  supplier,
  productOptions,
  busyTarget,
  onClose,
  onSelectProduct
}: {
  supplier: SupplierRow;
  productOptions: ProductOption[];
  busyTarget: string | null;
  onClose: () => void;
  onSelectProduct: (product: ProductOption) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return productOptions.filter((product) => {
      if (!search) {
        return true;
      }

      return `${product.parentSku} ${product.name}`.toLowerCase().includes(search);
    });
  }, [productOptions, query]);

  const linkByProductId = new Map(supplier.linkedProducts.map((link) => [link.catalogProductId, link]));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a94c25]">Vincular produto</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{supplier.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Busque pelo SKU pai ou pelo nome do produto e confirme o vinculo manualmente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por SKU pai ou nome"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOptions.map((product) => {
            const existingLink = linkByProductId.get(product.id) ?? null;
            const isLinked = Boolean(existingLink?.active);
            const isBusy = busyTarget === `link:${supplier.id}:${product.id}`;

            return (
              <div key={product.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-4">
                  <ProductThumb imageUrl={product.imageUrl} alt={product.name} className="h-20 w-20 flex-none" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{product.parentSku}</p>
                    <h4 className="mt-2 line-clamp-2 text-base font-semibold text-slate-900">{product.name}</h4>
                    <p className="mt-2 text-xs text-slate-500">
                      {isLinked ? "Produto ja ativo neste fornecedor." : existingLink ? "Vinculo inativo. Pode reativar." : "Disponivel para vincular."}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isLinked || isBusy}
                    onClick={() => onSelectProduct(product)}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                      isLinked
                        ? "cursor-not-allowed border border-slate-200 bg-white text-slate-400"
                        : "bg-slate-900 text-white"
                    )}
                  >
                    {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                    {isLinked ? "Ja vinculado" : existingLink ? "Reativar vinculo" : "Vincular produto"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SupplierEditModal({
  supplier,
  draft,
  uploading,
  saving,
  deleting,
  onClose,
  onChange,
  onLogoChange,
  onLogoRemove,
  onSave,
  onDelete
}: {
  supplier: SupplierRow | null;
  draft: Draft | null;
  uploading: boolean;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onChange: (patch: Partial<Draft>) => void;
  onLogoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (!supplier || !draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a94c25]">Edicao de fornecedor</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{draft.name || supplier.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Aqui ficam apenas foto, nome, contato, status, permissoes e exclusao do fornecedor.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <Field label="Nome">
                <input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>

              <Field label="Slug">
                <input value={draft.slug} onChange={(event) => onChange({ slug: slugify(event.target.value) })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>

              <Field label="Contato / responsavel">
                <input value={draft.contactName} onChange={(event) => onChange({ contactName: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>

              <Field label="Telefone / WhatsApp">
                <input value={draft.contactPhone} onChange={(event) => onChange({ contactPhone: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>

              <Field label="Email">
                <input value={draft.contactEmail} onChange={(event) => onChange({ contactEmail: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>

              <Field label="Endereco" className="xl:col-span-2">
                <input value={draft.address} onChange={(event) => onChange({ address: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ToggleButton label="Status" active={draft.active} activeLabel="Ativo" inactiveLabel="Inativo" onClick={() => onChange({ active: !draft.active })} />
              <ToggleButton
                label="Valores nos cards"
                active={draft.canViewProductValues}
                activeLabel="Liberado"
                inactiveLabel="Oculto"
                onClick={() => onChange({ canViewProductValues: !draft.canViewProductValues })}
              />
              <ToggleButton
                label="Dashboard financeiro"
                active={draft.canViewFinancialDashboard}
                activeLabel="Liberado"
                inactiveLabel="Oculto"
                onClick={() => onChange({ canViewFinancialDashboard: !draft.canViewFinancialDashboard })}
              />
            </div>
          </div>

          <div className="space-y-6">
            <SupplierLogoField
              inputId={`supplier-logo-modal-${supplier.id}`}
              supplierName={draft.name || supplier.name}
              logoUrl={draft.logoUrl}
              uploading={uploading}
              onFileChange={onLogoChange}
              onRemove={onLogoRemove}
            />

            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Resumo rapido</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <MetaChip icon={UserRound} label={draft.contactName || "Contato pendente"} />
                <MetaChip icon={Phone} label={draft.contactPhone || "Telefone pendente"} />
                <MetaChip icon={MapPin} label={draft.address || "Endereco pendente"} />
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {supplier.productCount} produtos ativos | {supplier.userCount} usuarios | criado {supplier.createdAt}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Processando..." : "Excluir fornecedor"}
          </button>

          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar ajustes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierProductLinkModal({
  supplier,
  link,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete
}: {
  supplier: SupplierRow | null;
  link: SupplierProductLink;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (patch: {
    active: boolean;
    supplierSalePrice: number | null;
    criticalStockThreshold: number | null;
    lowStockThreshold: number | null;
  }) => void;
  onDelete: () => void;
}) {
  const [active, setActive] = useState(link.active);
  const [priceInput, setPriceInput] = useState(link.supplierSalePrice === null ? "" : String(link.supplierSalePrice));
  const [criticalInput, setCriticalInput] = useState(link.criticalStockThreshold === null ? "" : String(link.criticalStockThreshold));
  const [lowInput, setLowInput] = useState(link.lowStockThreshold === null ? "" : String(link.lowStockThreshold));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setActive(link.active);
    setPriceInput(link.supplierSalePrice === null ? "" : String(link.supplierSalePrice));
    setCriticalInput(link.criticalStockThreshold === null ? "" : String(link.criticalStockThreshold));
    setLowInput(link.lowStockThreshold === null ? "" : String(link.lowStockThreshold));
    setFormError(null);
  }, [link.id, link.active, link.supplierSalePrice, link.criticalStockThreshold, link.lowStockThreshold]);

  function handleSubmit() {
    const critical = toNullableInteger(criticalInput);
    const low = toNullableInteger(lowInput);
    const price = toNullableNumber(priceInput);

    if (critical !== null && low !== null && low < critical) {
      setFormError("O limite baixo nao pode ser menor que o critico.");
      return;
    }

    setFormError(null);
    onSave({
      active,
      supplierSalePrice: price,
      criticalStockThreshold: critical,
      lowStockThreshold: low
    });
  }

  if (!supplier) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <ProductThumb imageUrl={link.imageUrl} alt={link.name} className="h-28 w-28 flex-none" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a94c25]">Configuracao do vinculo</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{summarizeProductName(link.name, 7)}</h3>
              <p className="mt-2 text-sm text-slate-500">
                {link.parentSku} em {supplier.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Status do vinculo</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Desative para tirar o produto do portal deste fornecedor sem remover o cadastro canonico nem perder o historico.
            </p>
            <button
              type="button"
              onClick={() => setActive((current) => !current)}
              className={cn(
                "mt-4 rounded-2xl px-4 py-3 text-sm font-semibold",
                active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              )}
            >
              {active ? "Vinculo ativo" : "Vinculo inativo"}
            </button>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Resumo rapido</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-xl bg-white px-3 py-2">Fornecedor: {supplier.name}</div>
              <div className="rounded-xl bg-white px-3 py-2">SKU pai: {link.parentSku}</div>
              <div className="rounded-xl bg-white px-3 py-2">Estado atual: {link.active ? "Ativo" : "Inativo"}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Field label="Preco para o fornecedor">
            <input
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              inputMode="decimal"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: 79,90"
            />
          </Field>
          <Field label="Critico do vinculo">
            <input
              value={criticalInput}
              onChange={(event) => setCriticalInput(event.target.value)}
              inputMode="numeric"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: 5"
            />
          </Field>
          <Field label="Baixo do vinculo">
            <input
              value={lowInput}
              onChange={(event) => setLowInput(event.target.value)}
              inputMode="numeric"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ex.: 10"
            />
          </Field>
        </div>

        {formError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div> : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Removendo..." : "Remover produto deste fornecedor"}
          </button>

          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar vinculo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
