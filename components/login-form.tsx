"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LockKeyhole, UserRound } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = searchParams.get("next") ?? "/produtos";
  const isAdminIntent = nextPath.startsWith("/admin");

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
        next: nextPath
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Não foi possível entrar.");
      setIsPending(false);
      return;
    }

    const payload = (await response.json()) as { redirectTo: string };
    window.location.assign(payload.redirectTo);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void handleSubmit(formData);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-pepper-glow px-5 py-8">
      <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur lg:p-8">
        <LogoMark className="w-fit" />
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d3774c]">Acesso seguro</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {isAdminIntent ? "Entrar no admin" : "Entrar no portal"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Login simples com controle de acesso por perfil e preparação para subdomínios separados entre admin e
            fornecedor.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Usuário</span>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <UserRound className="h-4 w-4 text-slate-400" />
              <input
                name="username"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Seu usuário"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Senha</span>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              <input
                name="password"
                type="password"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Sua senha"
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/50 disabled:opacity-60"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-[#f1dfd2] bg-[#fff8f3] px-4 py-3 text-xs leading-6 text-slate-500">
          Use as credenciais liberadas para o seu perfil. Em producao, evite compartilhar acessos por texto ou print.
        </div>
      </div>
    </div>
  );
}
