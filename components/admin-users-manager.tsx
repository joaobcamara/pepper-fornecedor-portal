"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, PlusCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierOption = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "SUPPLIER";
  active: boolean;
  supplierId: string | null;
  supplierName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type UserDraft = {
  username: string;
  role: "ADMIN" | "SUPPLIER";
  supplierId: string;
  active: boolean;
  password: string;
};

export function AdminUsersManager({
  users,
  suppliers
}: {
  users: UserRow[];
  suppliers: SupplierOption[];
}) {
  const [rows, setRows] = useState(users);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>(
    Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          username: user.username,
          role: user.role,
          supplierId: user.supplierId ?? "",
          active: user.active,
          password: ""
        }
      ])
    )
  );
  const [newUser, setNewUser] = useState<UserDraft>({
    username: "",
    role: "SUPPLIER",
    supplierId: suppliers[0]?.id ?? "",
    active: true,
    password: ""
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraft(id: string, patch: Partial<UserDraft>) {
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

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        supplierId: newUser.role === "SUPPLIER" ? newUser.supplierId || null : null,
        active: newUser.active
      })
    });

    const payload = (await response.json()) as { error?: string; userId?: string };

    if (!response.ok || !payload.userId) {
      setError(payload.error ?? "Nao foi possivel criar o usuario.");
      return;
    }

    const supplierName = suppliers.find((supplier) => supplier.id === newUser.supplierId)?.name ?? null;
    const created: UserRow = {
      id: payload.userId,
      username: newUser.username.trim().toLowerCase(),
      role: newUser.role,
      active: newUser.active,
      supplierId: newUser.role === "SUPPLIER" ? newUser.supplierId : null,
      supplierName: newUser.role === "SUPPLIER" ? supplierName : null,
      lastLoginAt: null,
      createdAt: "Agora"
    };

    setRows((current) => [created, ...current]);
    setDrafts((current) => ({
      ...current,
      [created.id]: {
        username: created.username,
        role: created.role,
        supplierId: created.supplierId ?? "",
        active: created.active,
        password: ""
      }
    }));
    setNewUser({
      username: "",
      role: "SUPPLIER",
      supplierId: suppliers[0]?.id ?? "",
      active: true,
      password: ""
    });
    setFeedback(`Usuario ${created.username} criado com sucesso.`);
  }

  async function handleSave(row: UserRow) {
    setFeedback(null);
    setError(null);
    const draft = drafts[row.id];

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        username: draft.username,
        password: draft.password || undefined,
        role: draft.role,
        supplierId: draft.role === "SUPPLIER" ? draft.supplierId || null : null,
        active: draft.active
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar o usuario.");
      return;
    }

    const supplierName = suppliers.find((supplier) => supplier.id === draft.supplierId)?.name ?? null;
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              username: draft.username.trim().toLowerCase(),
              role: draft.role,
              active: draft.active,
              supplierId: draft.role === "SUPPLIER" ? draft.supplierId || null : null,
              supplierName: draft.role === "SUPPLIER" ? supplierName : null
            }
          : item
      )
    );
    setDrafts((current) => ({
      ...current,
      [row.id]: {
        ...current[row.id],
        password: ""
      }
    }));
    setFeedback(`Usuario ${draft.username} atualizado com sucesso.`);
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Novo usuario</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Crie logins para fornecedores ou administradores e vincule o acesso ao escopo correto.
            </p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">Sessao propria</span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr_1fr_0.8fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Usuario</span>
            <input
              value={newUser.username}
              onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="ex.: luna"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Perfil</span>
            <select
              value={newUser.role}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  role: event.target.value as "ADMIN" | "SUPPLIER"
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="SUPPLIER">Fornecedor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor vinculado</span>
            <select
              value={newUser.supplierId}
              onChange={(event) => setNewUser((current) => ({ ...current, supplierId: event.target.value }))}
              disabled={newUser.role !== "SUPPLIER"}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-100"
            >
              <option value="">Selecione</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Senha inicial</span>
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              placeholder="min. 6 caracteres"
            />
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
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="space-y-4">
          {rows.map((user) => {
            const draft = drafts[user.id];

            return (
              <article key={user.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{user.username}</h3>
                    <p className="text-sm text-slate-500">
                      {draft.role === "ADMIN" ? "Administrador" : user.supplierName ?? "Fornecedor nao vinculado"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {user.lastLoginAt ? `Ultimo login ${user.lastLoginAt}` : "Nunca acessou"} · criado {user.createdAt}
                    </p>
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

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Usuario</span>
                    <input
                      value={draft.username}
                      onChange={(event) => updateDraft(user.id, { username: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Perfil</span>
                    <select
                      value={draft.role}
                      onChange={(event) =>
                        updateDraft(user.id, { role: event.target.value as "ADMIN" | "SUPPLIER" })
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="SUPPLIER">Fornecedor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor vinculado</span>
                    <select
                      value={draft.supplierId}
                      onChange={(event) => updateDraft(user.id, { supplierId: event.target.value })}
                      disabled={draft.role !== "SUPPLIER"}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-100"
                    >
                      <option value="">Selecione</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Nova senha</span>
                    <input
                      type="password"
                      value={draft.password}
                      onChange={(event) => updateDraft(user.id, { password: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      placeholder="preencha apenas se quiser trocar"
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => updateDraft(user.id, { active: !draft.active })}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  >
                    Marcar como {draft.active ? "inativo" : "ativo"}
                  </button>

                  <button
                    type="button"
                    onClick={() => startTransition(() => void handleSave(user))}
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
