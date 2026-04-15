"use client";

import Image from "next/image";
import type { ComponentType } from "react";
import { AlertTriangle, ArrowDownWideNarrow, Gauge, Layers3 } from "lucide-react";
import { ProductOperationalStrip } from "@/components/product-operational-strip";
import { StatusPill } from "@/components/status-pill";
import type { StockBand } from "@/lib/stock";

type ProductCard = {
  id: string;
  supplier: string;
  name: string;
  sku: string;
  imageUrl: string;
  lastUpdated: string;
  syncState: "fresh" | "stale";
  total: number;
  band: StockBand;
  bandLabel: string;
  priceFrom: number | null;
  priceTo: number | null;
  inventorySaleValue: number;
  inventoryCostValue: number;
  salesToday: number;
  sales7d: number;
  sales30d: number;
  lastSaleAt: string | null;
  coverageDays: number | null;
  movementBadge: string;
  topColorLabel: string | null;
  topSizeLabel: string | null;
  relatedOrderCount: number;
  replenishmentCard: {
    requestId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    statusLabel: string;
    linkedOrderNumber: string | null;
    linkedFinancialStatusLabel: string | null;
    nextStepLabel: string;
  } | null;
  activeOrder: {
    orderId: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    financialStatus: string | null;
    financialStatusLabel: string | null;
  } | null;
  matrix: Array<{
    color: string;
    items: Array<{
      id: string;
      sku: string;
      size: string;
      colorLabel: string;
      quantity: number | null;
      status: string;
      band: StockBand;
      criticalStockThreshold: number;
      lowStockThreshold: number;
      salesToday: number;
      sales7d: number;
      sales30d: number;
      lastSaleAt: string | null;
    }>;
  }>;
};

type ProductSummary = {
  productCount: number;
  criticalCount: number;
  lowCount: number;
  staleCount: number;
  totalSalesToday: number;
  totalSales7d: number;
  totalSales30d: number;
  totalInventorySaleValue: number;
  totalInventoryCostValue: number;
  topProductName: string | null;
  topInventoryProductName: string | null;
  topInventoryProductValue: number;
  topColor: string | null;
  topSize: string | null;
  replenishmentPendingCount: number;
  replenishmentApprovedCount: number;
  replenishmentLinkedCount: number;
  orderCardsInProgress: number;
  orderCardsInFinancial: number;
  orderCardsShipped: number;
};

export function SupplierInsightsDashboard({
  summary,
  products,
  canViewFinancialDashboard = false
}: {
  summary: ProductSummary;
  products: ProductCard[];
  canViewFinancialDashboard?: boolean;
}) {
  const topProducts = [...products].sort((a, b) => b.sales7d - a.sales7d).slice(0, 4);
  const atRiskProducts = [...products]
    .filter((product) => product.band !== "ok" || (product.coverageDays !== null && product.coverageDays <= 15))
    .sort((a, b) => {
      const aScore = (a.band === "critical" ? 100 : a.band === "low" ? 50 : 0) + a.sales7d;
      const bScore = (b.band === "critical" ? 100 : b.band === "low" ? 50 : 0) + b.sales7d;
      return bScore - aScore;
    })
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ArrowDownWideNarrow} label="Vendas hoje" value={summary.totalSalesToday.toString()} tone="soft" />
        <MetricCard icon={Gauge} label="Vendas 7 dias" value={summary.totalSales7d.toString()} tone="info" />
        <MetricCard icon={Layers3} label="Vendas 30 dias" value={summary.totalSales30d.toString()} tone="info" />
        <MetricCard icon={AlertTriangle} label="Itens criticos" value={summary.criticalCount.toString()} tone="critical" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Layers3} label="Pedidos em andamento" value={summary.orderCardsInProgress.toString()} tone="soft" />
        <MetricCard icon={Gauge} label="No financeiro" value={summary.orderCardsInFinancial.toString()} tone="info" />
        <MetricCard icon={ArrowDownWideNarrow} label="Enviados" value={summary.orderCardsShipped.toString()} tone="soft" />
      </section>

      {canViewFinancialDashboard ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={Layers3} label="Valor total dos produtos" value={formatCurrency(summary.totalInventorySaleValue)} tone="soft" />
          <MetricCard icon={Gauge} label="Custo estimado em estoque" value={formatCurrency(summary.totalInventoryCostValue)} tone="info" />
          <MetricCard
            icon={ArrowDownWideNarrow}
            label={summary.topInventoryProductName ? `Maior valor: ${summary.topInventoryProductName}` : "Maior valor em estoque"}
            value={formatCurrency(summary.topInventoryProductValue)}
            tone="info"
          />
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Leitura executiva</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                O painel resume o que mais esta drenando estoque e onde a grade precisa de atencao.
              </p>
            </div>
            <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">Dashboard</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoBox label="Produto campeao" value={summary.topProductName ?? "Sem lider"} />
            <InfoBox label="Cor campea" value={summary.topColor ?? "Sem lider"} />
            <InfoBox label="Tamanho campeao" value={summary.topSize ?? "Sem lider"} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoBox label="Produtos ativos" value={summary.productCount.toString()} />
            <InfoBox label="Baixo estoque" value={summary.lowCount.toString()} />
            <InfoBox label="Dados desatualizados" value={summary.staleCount.toString()} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoBox label="Compras pendentes" value={summary.replenishmentPendingCount.toString()} />
            <InfoBox label="Aprovadas para pedido" value={summary.replenishmentApprovedCount.toString()} />
            <InfoBox label="Ligadas a pedidos" value={summary.replenishmentLinkedCount.toString()} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoBox label="Cards em andamento" value={summary.orderCardsInProgress.toString()} />
            <InfoBox label="Cards no financeiro" value={summary.orderCardsInFinancial.toString()} />
            <InfoBox label="Cards enviados" value={summary.orderCardsShipped.toString()} />
          </div>

          {canViewFinancialDashboard ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoBox label="Valor em estoque" value={formatCurrency(summary.totalInventorySaleValue)} />
              <InfoBox label="Custo estimado" value={formatCurrency(summary.totalInventoryCostValue)} />
              <InfoBox label="Produto de maior valor" value={summary.topInventoryProductName ?? "Sem lider"} />
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-5 shadow-soft sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Reposicao prioritaria</h2>
              <p className="text-sm text-slate-500">Itens com baixo saldo e maior giro recente.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {atRiskProducts.length > 0 ? (
              atRiskProducts.map((product) => (
                <PriorityRow key={product.id} product={product} />
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-[#e9cbb8] px-4 py-8 text-center text-sm text-slate-500">
                Nenhum produto pede reposicao imediata agora.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Produtos com maior giro</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Ranking rapido das ultimas vendas registradas.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Top 4</span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {topProducts.length > 0 ? (
            topProducts.map((product) => <TopProductCard key={product.id} product={product} />)
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 xl:col-span-2">
              Assim que as vendas entrarem pelos webhooks, o ranking aparece aqui.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "soft" | "critical" | "info";
}) {
  const tones = {
    soft: "border-white bg-white/80",
    critical: "border-rose-100 bg-rose-50",
    info: "border-sky-100 bg-sky-50"
  };

  return (
    <div className={`rounded-[1.7rem] border p-5 shadow-soft ${tones[tone]}`}>
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

function PriorityRow({ product }: { product: ProductCard }) {
  return (
    <div className="rounded-[1.4rem] border border-white bg-white/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{product.name}</p>
          <p className="text-xs text-slate-500">
            {product.sku} | {product.lastSaleAt ? `Ultima venda ${product.lastSaleAt}` : "Sem venda recente"}
          </p>
        </div>
        <StatusPill band={product.band} label={product.bandLabel} />
      </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">Vendas 7d: {product.sales7d}</div>
          <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">Saldo: {product.total}</div>
          <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">
            Cobertura: {product.coverageDays === null ? "Sem base" : `${product.coverageDays} dias`}
          </div>
          <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">Valor: {formatCurrency(product.inventorySaleValue)}</div>
        </div>
      <ProductOperationalStrip
        compact
        replenishmentCard={product.replenishmentCard}
        activeOrder={product.activeOrder}
        relatedOrderCount={product.relatedOrderCount}
      />
      </div>
  );
}

function TopProductCard({ product }: { product: ProductCard }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white bg-white sm:h-18 sm:w-18">
          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">{product.sku}</p>
            </div>
            <StatusPill band={product.band} label={product.bandLabel} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="rounded-2xl bg-white px-3 py-2">Hoje: {product.salesToday}</div>
            <div className="rounded-2xl bg-white px-3 py-2">7d: {product.sales7d}</div>
            <div className="rounded-2xl bg-white px-3 py-2">30d: {product.sales30d}</div>
            <div className="rounded-2xl bg-white px-3 py-2">Valor: {formatCurrency(product.inventorySaleValue)}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {product.topColorLabel ? (
              <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">
                Cor lider: {product.topColorLabel}
              </span>
            ) : null}
            {product.topSizeLabel ? (
              <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">
                Tamanho lider: {product.topSizeLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700">{product.movementBadge}</span>
            {product.activeOrder ? (
              <span className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">
                {product.activeOrder.workflowStageLabel}
              </span>
            ) : null}
          </div>
          <ProductOperationalStrip
            compact
            replenishmentCard={product.replenishmentCard}
            activeOrder={product.activeOrder}
            relatedOrderCount={product.relatedOrderCount}
          />
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
