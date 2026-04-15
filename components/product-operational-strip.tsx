"use client";

import { cn } from "@/lib/cn";
import {
  getReplenishmentNextStep,
  getSupplierFinancialStatusTone,
  getSupplierOrderNextStep,
  getSupplierOrderWorkflowTone
} from "@/lib/operations-workflow";

type ReplenishmentCardState = {
  requestId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusLabel: string;
  linkedOrderNumber: string | null;
  linkedFinancialStatusLabel: string | null;
  nextStepLabel: string;
};

type ActiveOrderState = {
  orderId: string;
  orderNumber: string;
  workflowStage: string;
  workflowStageLabel: string;
  financialStatus: string | null;
  financialStatusLabel: string | null;
};

function replenishmentTone(status: ReplenishmentCardState["status"]) {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-[#fff8f0] text-[#a94b25]";
}

export function ProductOperationalStrip({
  replenishmentCard,
  activeOrder,
  relatedOrderCount,
  compact = false
}: {
  replenishmentCard: ReplenishmentCardState | null;
  activeOrder: ActiveOrderState | null;
  relatedOrderCount: number;
  compact?: boolean;
}) {
  const nextStep = activeOrder
    ? getSupplierOrderNextStep(activeOrder.workflowStage as never, Boolean(activeOrder.financialStatus))
    : replenishmentCard
      ? getReplenishmentNextStep(replenishmentCard.status, replenishmentCard.linkedOrderNumber ? {
          orderNumber: replenishmentCard.linkedOrderNumber,
          hasFinancialEntry: Boolean(replenishmentCard.linkedFinancialStatusLabel)
        } : null)
      : {
          label: "Sem fluxo aberto",
          description: "Este produto ainda nao entrou em nenhum fluxo de compra, pedido ou financeiro."
        };

  const chips = [
    replenishmentCard
      ? {
          key: `replenishment-${replenishmentCard.requestId}`,
          label: replenishmentCard.linkedOrderNumber
            ? `Compra ${replenishmentCard.statusLabel}`
            : `Sugestao ${replenishmentCard.statusLabel}`,
          tone: replenishmentTone(replenishmentCard.status)
        }
      : null,
    activeOrder
      ? {
          key: `order-${activeOrder.orderId}`,
          label: `Pedido ${activeOrder.workflowStageLabel}`,
          tone: getSupplierOrderWorkflowTone(activeOrder.workflowStage as never)
        }
      : null,
    activeOrder?.financialStatusLabel
      ? {
          key: `financial-${activeOrder.orderId}`,
          label: `Financeiro ${activeOrder.financialStatusLabel}`,
          tone: getSupplierFinancialStatusTone(activeOrder.financialStatus as never)
        }
      : null,
    relatedOrderCount > 1
      ? {
          key: "linked-count",
          label: `${relatedOrderCount} cards`,
          tone: "bg-white text-slate-700"
        }
      : null
  ].filter(Boolean) as Array<{ key: string; label: string; tone: string }>;

  if (compact) {
    return (
      <div className="mt-3 space-y-2 rounded-[1.3rem] border border-slate-100 bg-white/80 px-3 py-3">
        <div className="flex flex-wrap gap-2 text-[11px]">
          {chips.length > 0 ? (
            chips.map((chip) => (
              <span key={chip.key} className={cn("rounded-full px-2.5 py-1 font-semibold", chip.tone)}>
                {chip.label}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Sem fluxo ativo</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Proximo: <span className="font-semibold text-slate-700">{nextStep.label}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Rastro operacional
        </span>
        {chips.length > 0 ? (
          chips.map((chip) => (
            <span key={chip.key} className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", chip.tone)}>
              {chip.label}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">Sem fluxo ativo</span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{nextStep.label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{nextStep.description}</p>
    </div>
  );
}
