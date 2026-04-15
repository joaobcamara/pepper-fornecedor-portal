"use client";

import Link from "next/link";
import { Layers3, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { FINANCIAL_PERIOD_OPTIONS, type FinancialPeriodKey } from "@/lib/financial-period";
import type { SupplierFinancialData } from "@/lib/supplier-financial-data";

export function SupplierFinancialDashboard({
  data,
  selectedPeriod,
  canViewFinancialDashboard
}: {
  data: SupplierFinancialData;
  selectedPeriod: FinancialPeriodKey;
  canViewFinancialDashboard: boolean;
}) {
  if (!canViewFinancialDashboard) {
    return (
      <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#c76534]">Financeiro</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">Visao financeira ainda bloqueada</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          O admin ainda nao liberou a exibicao de valores para este fornecedor. Quando a permissao for ativada, esta tela
          passa a mostrar valor dos produtos, custo estimado em estoque e leitura financeira por periodo.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d27a4f]">Movimentacao</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Leitura financeira do periodo de {data.period.label.toLowerCase()}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {FINANCIAL_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.key}
                href={`/financeiro?period=${option.key}`}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  selectedPeriod === option.key
                    ? "border-[#f3b89a] bg-[#fff1e7] text-[#a94b25]"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="Faturamento do periodo" value={formatCurrency(data.metrics.periodRevenue)} />
        <MetricCard icon={Layers3} label="Valor total dos produtos" value={formatCurrency(data.metrics.totalInventorySaleValue)} />
        <MetricCard icon={Trophy} label="Maior valor em estoque" value={formatCurrency(data.metrics.topInventoryProductValue)} />
        <MetricCard icon={Wallet} label="Ticket medio estimado" value={formatCurrency(data.metrics.averageTicket)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <h3 className="text-xl font-semibold text-slate-900">Resumo do periodo</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoBox label="Unidades vendidas" value={data.metrics.periodUnitsSold.toString()} />
            <InfoBox label="Custo estimado" value={formatCurrency(data.metrics.totalInventoryCostValue)} />
            <InfoBox label="Produto de maior valor" value={data.metrics.topInventoryProductName ?? "Sem destaque"} />
            <InfoBox label="Produto com mais vendas" value={data.metrics.topSalesProductName ?? "Sem destaque"} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Produtos de maior impacto</h3>
              <p className="mt-2 text-sm text-slate-500">Cards com valor em estoque e vendas do periodo.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Top 6</span>
          </div>

          <div className="mt-5 space-y-3">
            {data.productHighlights.map((product) => (
              <div key={product.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.sku}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {formatCurrency(product.inventorySaleValue)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="rounded-2xl bg-white px-3 py-2">Vendas: {product.salesInPeriod}</div>
                  <div className="rounded-2xl bg-white px-3 py-2">30d: {product.sales30d}</div>
                  <div className="rounded-2xl bg-white px-3 py-2">Custo: {formatCurrency(product.inventoryCostValue)}</div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    {product.lastSaleAt ? `Ultima venda ${product.lastSaleAt}` : "Sem venda recente"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-[1.7rem] border border-white bg-white/85 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
