"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, Building2, LayoutDashboard, Menu, MessageCircle, PackageCheck, RefreshCcw, Send, ShoppingCart, Sparkles, Users, Wallet, Warehouse, X } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
  { href: "/admin/estoque", label: "Estoque", icon: Warehouse },
  { href: "/admin/produtos", label: "Produtos", icon: Boxes },
  { href: "/admin/sugestoes-produto", label: "Sugestoes de Produto", icon: Sparkles },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: Send },
  { href: "/admin/conversas", label: "Conversas", icon: MessageCircle },
  { href: "/admin/solicitacoes-reposicao", label: "Solicitacoes de reposicao", icon: ShoppingCart },
  { href: "/admin/pedidos-fornecedor", label: "Pedidos ao Fornecedor", icon: PackageCheck },
  { href: "/admin/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/sincronizacoes", label: "Sincronizacoes", icon: RefreshCcw }
];

export function AdminShellLayoutClient({
  currentPath,
  title,
  description,
  children
}: {
  currentPath: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const navVisible = navOpen || navExpanded;

  function toggleNav() {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setNavExpanded((current) => !current);
      return;
    }

    setNavOpen((current) => !current);
  }

  function collapseNav() {
    setNavOpen(false);
    setNavExpanded(false);
  }

  return (
    <div className={cn("mx-auto grid max-w-7xl gap-6", navExpanded ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[88px_1fr]")}>
      {navOpen ? (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "rounded-[2rem] border border-white/70 bg-white/85 shadow-panel backdrop-blur",
          "fixed inset-y-4 left-4 z-40 w-[18.5rem] max-w-[calc(100vw-2rem)] overflow-y-auto px-5 py-5 transition lg:static lg:max-w-none lg:translate-x-0",
          navExpanded ? "lg:w-[17.5rem] lg:px-5" : "lg:w-[5.5rem] lg:px-3",
          navOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"
        )}
      >
        <div className={cn("flex items-center justify-between gap-3", !navVisible && "lg:flex-col")}>
          <LogoMark compact={!navVisible} className={cn("w-fit", !navVisible && "lg:w-full")} />
          <button
            type="button"
            onClick={toggleNav}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:border-[#f3b89a] hover:text-slate-900"
            aria-label={navVisible ? "Recolher menu lateral" : "Expandir menu lateral"}
            title={navVisible ? "Recolher menu" : "Expandir menu"}
          >
            {navVisible ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("mt-6", !navVisible && "lg:hidden")}>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#d27a4f]">Admin Pepper</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Navegacao enxuta por modulo para manter o painel limpo e operacional.
          </p>
        </div>

        <nav className="mt-8 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
          {navItems.map((item) => {
            const active = currentPath === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={collapseNav}
                className={cn(
                  "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl border px-4 py-3 text-sm font-semibold transition lg:whitespace-normal",
                  !navVisible && "lg:justify-center lg:px-0",
                  active
                    ? "border-[#f3b89a] bg-[#fff1e7] text-[#a94b25]"
                    : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
                )}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
                <span className={cn("block", !navVisible && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-slate-200 pt-5">
          <LogoutButton
            className={cn(
              "inline-flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900",
              navVisible ? "justify-center px-4" : "justify-center px-0"
            )}
            label={navVisible ? "Sair do admin" : ""}
          />
        </div>
      </aside>

      <section className="space-y-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d27a4f]">Centro operacional</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
            </div>
            <button
              type="button"
              onClick={toggleNav}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600"
              aria-label={navVisible ? "Recolher menu lateral" : "Expandir menu lateral"}
            >
              {navVisible ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {children}
      </section>
    </div>
  );
}
