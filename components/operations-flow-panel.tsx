"use client";

import { ArrowRight, Link2 } from "lucide-react";
import { cn } from "@/lib/cn";

type FlowModule = {
  label: string;
  tone?: string;
};

export function OperationsFlowPanel({
  originLabel,
  currentLabel,
  currentTone,
  nextLabel,
  nextDescription,
  modules = [],
  className
}: {
  originLabel: string;
  currentLabel: string;
  currentTone: string;
  nextLabel: string;
  nextDescription?: string | null;
  modules?: FlowModule[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4", className)}>
      <div className="grid gap-3 md:grid-cols-3">
        <FlowStep
          eyebrow="Origem"
          value={originLabel}
          tone="bg-white text-slate-700"
        />
        <FlowStep
          eyebrow="Etapa atual"
          value={currentLabel}
          tone={currentTone}
        />
        <FlowStep
          eyebrow="Proximo passo"
          value={nextLabel}
          tone="bg-[#fff8f4] text-[#a94b25]"
        />
      </div>

      {nextDescription ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-600">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#cf7145]" />
          <p>{nextDescription}</p>
        </div>
      ) : null}

      {modules.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Link2 className="h-3.5 w-3.5" />
            Modulos conectados
          </div>
          <div className="flex flex-wrap gap-2">
            {modules.map((module) => (
              <span
                key={module.label}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold",
                  module.tone ?? "bg-white text-slate-700"
                )}
              >
                {module.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlowStep({
  eyebrow,
  value,
  tone
}: {
  eyebrow: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={cn("rounded-2xl px-4 py-3 text-sm", tone)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">{eyebrow}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
