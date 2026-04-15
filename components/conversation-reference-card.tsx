"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, Building2, MessageSquareQuote, PackageCheck, ShoppingCart, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

export type ConversationReference = {
  type: string;
  id: string;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  badge?: string | null;
  metaJson?: string | null;
};

type ReferenceMeta = {
  originLabel?: string | null;
  currentLabel?: string | null;
  nextStepLabel?: string | null;
  modules?: string[] | null;
  helperLabel?: string | null;
};

function getReferenceIcon(type: string) {
  switch (type) {
    case "PRODUCT":
      return Boxes;
    case "PRODUCT_SUGGESTION":
      return Sparkles;
    case "REPLENISHMENT_REQUEST":
      return ShoppingCart;
    case "SUPPLIER_ORDER":
      return PackageCheck;
    case "SUPPLIER":
      return Building2;
    case "USER":
      return UserRound;
    default:
      return MessageSquareQuote;
  }
}

function parseReferenceMeta(metaJson?: string | null): ReferenceMeta | null {
  if (!metaJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metaJson) as ReferenceMeta;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function ConversationReferenceCard({
  reference,
  selected = false,
  onClick,
  className
}: {
  reference: ConversationReference;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = getReferenceIcon(reference.type);
  const meta = parseReferenceMeta(reference.metaJson);
  const content = (
    <div
      className={cn(
        "rounded-[1.4rem] border bg-white/90 p-3 shadow-sm transition",
        selected ? "border-[#f2b79a] bg-[#fff6f0]" : "border-slate-200/80",
        onClick ? "hover:border-[#f2b79a] hover:bg-[#fff6f0]" : null,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1e7] text-[#cf7145]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{reference.title}</p>
            {reference.subtitle ? <p className="mt-1 text-xs text-slate-500">{reference.subtitle}</p> : null}
            {meta?.helperLabel ? <p className="mt-1 text-[11px] font-medium text-slate-400">{meta.helperLabel}</p> : null}
          </div>
        </div>
        {reference.badge ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {reference.badge}
          </span>
        ) : null}
      </div>
      {meta ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2 text-[11px]">
            {meta.originLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                Origem {meta.originLabel}
              </span>
            ) : null}
            {meta.currentLabel ? (
              <span className="rounded-full bg-[#fff1e7] px-2.5 py-1 font-semibold text-[#a94b25]">
                Atual {meta.currentLabel}
              </span>
            ) : null}
            {meta.modules?.slice(0, 3).map((module) => (
              <span key={module} className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">
                {module}
              </span>
            ))}
          </div>
          {meta.nextStepLabel ? (
            <p className="text-[11px] leading-5 text-slate-500">
              Proximo passo: <span className="font-semibold text-slate-700">{meta.nextStepLabel}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {reference.href ? (
        <div className="mt-3 flex justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#a94b25]">
            Abrir contexto
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  if (reference.href) {
    return (
      <Link href={reference.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
