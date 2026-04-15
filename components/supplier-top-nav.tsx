"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, MessageCircle, Package2, PackageCheck, Sparkles, Wallet } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { LogoMark } from "@/components/logo-mark";
import { SupplierIdentityHero } from "@/components/supplier-identity-hero";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/produtos", label: "Produtos", icon: Package2 },
  { href: "/pedidos-recebidos", label: "Pedidos Recebidos", icon: PackageCheck },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/sugestao-produto", label: "Sugestao de Produto", icon: Sparkles },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle }
];

export function SupplierTopNav({
  unreadCount = 0,
  supplierName = "Fornecedor Pepper",
  supplierInitials = "PF",
  supplierLogoUrl = null,
  showSupplierIdentity = false
}: {
  unreadCount?: number;
  supplierName?: string;
  supplierInitials?: string;
  supplierLogoUrl?: string | null;
  showSupplierIdentity?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-panel backdrop-blur sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <LogoMark className="w-fit shrink-0 max-sm:max-w-full" />
              {showSupplierIdentity ? (
                <SupplierIdentityHero
                  supplierName={supplierName}
                  supplierInitials={supplierInitials}
                  supplierLogoUrl={supplierLogoUrl}
                  className="max-sm:w-full"
                />
              ) : null}
            </div>
          </div>

          <LogoutButton
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-[#f3b89a] hover:text-slate-900 md:hidden"
            label="Sair"
          />
        </div>

        <div className="mt-4 hidden items-center justify-between gap-4 md:flex">
          <nav className="flex flex-wrap gap-2 xl:flex-nowrap">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition xl:whitespace-nowrap",
                    active
                      ? "border-[#f3b89a] bg-[#fff1e7] text-[#a94b25]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#f3b89a] hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.href === "/mensagens" && unreadCount > 0 ? (
                    <span className="rounded-full bg-[#ec6232] px-2 py-0.5 text-xs text-white">{unreadCount}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <LogoutButton
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-[#f3b89a] hover:text-slate-900 xl:whitespace-nowrap"
            label="Sair"
          />
        </div>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-2 rounded-[1.8rem] border border-white/80 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[4.2rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-semibold leading-tight transition",
                active
                  ? "bg-[#fff1e7] text-[#a94b25]"
                  : "bg-white text-slate-500"
              )}
            >
              <div className="relative">
                <Icon className="h-4 w-4" />
                {item.href === "/mensagens" && unreadCount > 0 ? (
                  <span className="absolute -right-2 -top-2 rounded-full bg-[#ec6232] px-1.5 py-0.5 text-[9px] text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
