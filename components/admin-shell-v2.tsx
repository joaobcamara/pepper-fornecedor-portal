import Link from "next/link";
import { Boxes, Building2, DownloadCloud, LayoutDashboard, MessageCircle, PackageCheck, RefreshCcw, ShoppingCart, Sparkles, Users, Wallet } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { LogoMark } from "@/components/logo-mark";
import { PepperIaBubbleSlot, type PepperIaBubblePageKey } from "@/components/pepper-ia-bubble-slot";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
  { href: "/admin/produtos", label: "Produtos", icon: Boxes },
  { href: "/admin/importacao-tiny", label: "Importacao Tiny", icon: DownloadCloud },
  { href: "/admin/sugestoes-produto", label: "Sugestoes de Produto", icon: Sparkles },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/conversas", label: "Conversas", icon: MessageCircle },
  { href: "/admin/solicitacoes-reposicao", label: "Solicitacoes de reposicao", icon: ShoppingCart },
  { href: "/admin/pedidos-fornecedor", label: "Pedidos ao Fornecedor", icon: PackageCheck },
  { href: "/admin/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/sincronizacoes", label: "Sincronizacoes", icon: RefreshCcw }
];

export function AdminShellV2({
  currentPath,
  title,
  description,
  pepperIaPageKey,
  pepperIaHint,
  pepperIaAlertCount,
  children
}: {
  currentPath: string;
  title: string;
  description: string;
  pepperIaPageKey?: PepperIaBubblePageKey;
  pepperIaHint?: string | null;
  pepperIaAlertCount?: number;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-pepper-glow px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur">
          <LogoMark className="w-fit" />
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#d27a4f]">Admin Pepper</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Navegacao enxuta por modulo para manter o painel limpo e operacional.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const active = currentPath === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "border-[#f3b89a] bg-[#fff1e7] text-[#a94b25]"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <LogoutButton
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#f3b89a] hover:text-slate-900"
              label="Sair do admin"
            />
          </div>
        </aside>

        <section className="space-y-6">
          <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d27a4f]">Centro operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </header>

          {children}
        </section>
      </div>
      <PepperIaBubbleSlot pageKey={pepperIaPageKey} pageHint={pepperIaHint} alertCount={pepperIaAlertCount} />
    </main>
  );
}
