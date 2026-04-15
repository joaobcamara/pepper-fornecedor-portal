import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, Boxes, DownloadCloud, MessageCircle, RefreshCcw, ShoppingCart, Sparkles } from "lucide-react";
import { OperationsFlowPanel } from "@/components/operations-flow-panel";
import { StatusPill } from "@/components/status-pill";
import {
  getSupplierFinancialStatusTone,
  getSupplierOrderLinkedModules,
  getSupplierOrderWorkflowTone
} from "@/lib/operations-workflow";
import type { StockBand } from "@/lib/stock";

export function AdminOverviewCardsV2({
  dashboard
}: {
  dashboard: {
    supplierCount: number;
    importCount: number;
    productCount: number;
    staleCount: number;
    syncCount: number;
    totalSalesToday: number;
    totalSales7d: number;
    totalSales30d: number;
    atRiskCount: number;
    replenishmentPendingCount: number;
    orderCardsInProgress: number;
    readyForFinancialCount: number;
    financialReviewCount: number;
    paymentPendingCount: number;
  };
}) {
  const cards = [
    { label: "Fornecedores ativos", value: dashboard.supplierCount, tone: "bg-white border-slate-200" },
    { label: "Produtos pai", value: dashboard.productCount, tone: "bg-white border-slate-200" },
    { label: "Vendas 7 dias", value: dashboard.totalSales7d, tone: "bg-sky-50 border-sky-100" },
    { label: "Ruptura iminente", value: dashboard.atRiskCount, tone: "bg-amber-50 border-amber-100" },
    { label: "Compras pendentes", value: dashboard.replenishmentPendingCount, tone: "bg-[#fff5ef] border-[#f4d6c6]" },
    { label: "Cards em andamento", value: dashboard.orderCardsInProgress, tone: "bg-[#eef8f7] border-[#d3ece8]" },
    { label: "Prontos p/ financeiro", value: dashboard.readyForFinancialCount, tone: "bg-violet-50 border-violet-100" },
    { label: "Pagamento pendente", value: dashboard.paymentPendingCount, tone: "bg-slate-50 border-slate-200" }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-[1.7rem] border p-5 shadow-soft ${card.tone}`}>
          <p className="text-xs font-medium text-slate-500">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
        </div>
      ))}
    </section>
  );
}

export function AdminQuickLinksV2() {
  const links = [
    {
      href: "/admin/importacao-tiny",
      title: "Importar do Tiny",
      description: "Buscar SKU, revisar pai e filhas e salvar no sistema.",
      icon: DownloadCloud
    },
    {
      href: "/admin/produtos",
      title: "Gerenciar produtos",
      description: "Editar nome interno, status ativo e vinculos com fornecedores.",
      icon: Boxes
    },
    {
      href: "/admin/sincronizacoes",
      title: "Ver sincronizacoes",
      description: "Acompanhar falhas, parciais e ultimas atualizacoes.",
      icon: RefreshCcw
    },
    {
      href: "/admin/sugestoes-produto",
      title: "Sugestoes dos fornecedores",
      description: "Receber novos produtos e preparar uma ficha de cadastro estilo Tiny.",
      icon: Sparkles
    },
    {
      href: "/admin/conversas",
      title: "Conversas",
      description: "Centralizar mensagens e anexos enviados pelos fornecedores.",
      icon: MessageCircle
    },
    {
      href: "/admin/solicitacoes-reposicao",
      title: "Solicitacoes de reposicao",
      description: "Aprovar ou recusar as sugestoes de compra enviadas pelos fornecedores.",
      icon: ShoppingCart
    }
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-6">
      {links.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[1.8rem] border border-white/70 bg-white/88 p-5 shadow-soft transition hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#fff2e9] p-3 text-[#c75f2d]">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#c75f2d]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
          </Link>
        );
      })}
    </section>
  );
}

export function AdminOperationalRadarV2({
  dashboard,
  workflowWatchlist
}: {
  dashboard: {
    replenishmentPendingCount: number;
    orderCardsInProgress: number;
    readyForFinancialCount: number;
    financialReviewCount: number;
    paymentPendingCount: number;
  };
  workflowWatchlist: Array<{
    id: string;
    supplierName: string;
    productName: string;
    productSku: string;
    orderNumber: string;
    workflowStage: string;
    workflowStageLabel: string;
    originLabel: string;
    financialStatusLabel: string | null;
    nextStepLabel: string;
  }>;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Radar operacional</h2>
            <p className="text-sm text-slate-500">Leitura rapida dos pontos que ainda pedem acao entre compra, pedido, financeiro e envio.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <SummaryChip label="Compras pendentes" value={dashboard.replenishmentPendingCount} tone="bg-white text-[#a94b25]" />
          <SummaryChip label="Pedidos em andamento" value={dashboard.orderCardsInProgress} tone="bg-white text-slate-700" />
          <SummaryChip label="Em revisao financeira" value={dashboard.financialReviewCount} tone="bg-white text-indigo-700" />
          <SummaryChip label="Pagamento pendente" value={dashboard.paymentPendingCount} tone="bg-white text-emerald-700" />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cards para acompanhar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Itens recentes com proximo passo definido para o time Pepper.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {workflowWatchlist.length} cards
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {workflowWatchlist.length > 0 ? (
            workflowWatchlist.map((item) => (
              <Link
                key={item.id}
                href={`/admin/pedidos-fornecedor?order=${item.id}`}
                className="block rounded-[1.5rem] border border-slate-100 bg-slate-50/85 p-4 transition hover:border-[#f2b79a] hover:bg-[#fffaf7]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.productSku} - {item.supplierName} - {item.orderNumber}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${getSupplierOrderWorkflowTone(item.workflowStage as never)}`}>
                      {item.workflowStageLabel}
                    </span>
                    {item.financialStatusLabel ? (
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${resolveFinancialTone(item.financialStatusLabel)}`}>
                        Financeiro {item.financialStatusLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                <OperationsFlowPanel
                  className="mt-4"
                  originLabel={item.originLabel}
                  currentLabel={item.workflowStageLabel}
                  currentTone={getSupplierOrderWorkflowTone(item.workflowStage as never)}
                  nextLabel={item.nextStepLabel}
                  modules={getSupplierOrderLinkedModules(item.workflowStage as never, Boolean(item.financialStatusLabel)).map((module) => ({
                    label: module,
                    tone: "bg-white text-slate-700"
                  }))}
                />
              </Link>
            ))
          ) : (
            <EmptyState label="Nenhum card operacional pede acompanhamento agora." />
          )}
        </div>
      </section>
    </section>
  );
}

export function AdminRankingsV2({
  topSuppliers,
  topProducts,
  priorityProducts
}: {
  topSuppliers: Array<{
    id: string;
    name: string;
    unitsSold: number;
    revenue: number;
    lastOrderAt: string | null;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    imageUrl: string;
    unitsSold: number;
    revenue: number;
    stock: number;
    band: StockBand;
    bandLabel: string;
    coverageDays: number | null;
  }>;
  priorityProducts: Array<{
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    imageUrl: string;
    unitsSold: number;
    revenue: number;
    stock: number;
    band: StockBand;
    bandLabel: string;
    coverageDays: number | null;
  }>;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr_1fr]">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Ranking de fornecedores</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Giro consolidado dos ultimos 7 dias.</p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">7 dias</span>
        </div>

        <div className="mt-5 space-y-3">
          {topSuppliers.length > 0 ? (
            topSuppliers.map((supplier, index) => (
              <div key={supplier.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">#{index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{supplier.name}</p>
                    <p className="text-xs text-slate-500">
                      {supplier.lastOrderAt ? `Ultima venda ${supplier.lastOrderAt}` : "Sem venda recente"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">{supplier.unitsSold}</p>
                    <p className="text-xs text-slate-500">
                      {supplier.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="Ainda nao ha vendas suficientes para ranquear fornecedores." />
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Produtos com maior giro</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Produtos que mais drenaram estoque na semana.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Top 6</span>
        </div>

        <div className="mt-5 space-y-3">
          {topProducts.length > 0 ? (
            topProducts.map((product) => (
              <ProductInsightRow key={product.id} product={product} />
            ))
          ) : (
            <EmptyState label="Assim que os webhooks de venda alimentarem a base, os campeoes aparecem aqui." />
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Reposicao prioritaria</h2>
            <p className="text-sm text-slate-500">Produtos com pouco saldo e giro relevante.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {priorityProducts.length > 0 ? (
            priorityProducts.map((product) => (
              <div key={product.id} className="rounded-[1.4rem] border border-white bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.sku} · {product.supplierName}
                    </p>
                  </div>
                  <StatusPill band={product.band} label={product.bandLabel} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">Vendas 7d: {product.unitsSold}</div>
                  <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">Saldo: {product.stock}</div>
                  <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">
                    Cobertura: {product.coverageDays === null ? "Sem base" : `${product.coverageDays} dias`}
                  </div>
                  <div className="rounded-2xl bg-[#fff7f1] px-3 py-2">
                    Receita: {product.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="Nenhum produto entrou em zona de reposicao prioritaria." />
          )}
        </div>
      </section>
    </section>
  );
}

export function AdminRecentImportsV2({
  recentImports
}: {
  recentImports: Array<{
    id: string;
    status: string;
    startedAt: string;
    notes: string | null;
    itemCount: number;
  }>;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Importacoes recentes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Historico rapido do que entrou no cadastro interno.</p>
        </div>
        <Link href="/produtos" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Ver area do fornecedor
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {recentImports.length > 0 ? (
          recentImports.map((batch) => (
            <div key={batch.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{batch.notes ?? "Importacao Tiny"}</p>
                  <p className="text-xs text-slate-500">{batch.startedAt}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {batch.itemCount} itens
                </span>
              </div>
              <div className="mt-3 inline-flex rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#ac5327]">
                {batch.status}
              </div>
            </div>
          ))
        ) : (
          <EmptyState label="Nenhuma importacao registrada ainda." />
        )}
      </div>
    </section>
  );
}

export function AdminNextStepsV2() {
  return (
    <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Base pronta para IA e estoque</h2>
          <p className="text-sm text-slate-500">SKU, pai/filha, vendas e contexto do cliente seguem amarrados no Supabase.</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
        <li>SKU continua como chave logica da operacao.</li>
        <li>ID do Tiny fica reservado para consultar e operar estoque.</li>
        <li>Webhooks alimentam estoque, pedidos e cliente sem sobrecarregar o Tiny.</li>
        <li>Fornecedor so enxerga produtos vinculados ao seu escopo.</li>
      </ul>
    </section>
  );
}

function ProductInsightRow({
  product
}: {
  product: {
    id: string;
    name: string;
    sku: string;
    supplierName: string;
    imageUrl: string;
    unitsSold: number;
    revenue: number;
    stock: number;
    band: StockBand;
    bandLabel: string;
    coverageDays: number | null;
  };
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-3xl border border-white bg-white">
          <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">
                {product.sku} · {product.supplierName}
              </p>
            </div>
            <StatusPill band={product.band} label={product.bandLabel} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="rounded-2xl bg-white px-3 py-2">Vendas 7d: {product.unitsSold}</div>
            <div className="rounded-2xl bg-white px-3 py-2">Saldo: {product.stock}</div>
            <div className="rounded-2xl bg-white px-3 py-2">
              Cobertura: {product.coverageDays === null ? "Sem base" : `${product.coverageDays} dias`}
            </div>
            <div className="rounded-2xl bg-white px-3 py-2">
              {product.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-[1.4rem] border border-white/70 px-4 py-4 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function resolveFinancialTone(label: string) {
  if (label === "Em revisão") {
    return getSupplierFinancialStatusTone("IN_REVIEW");
  }

  if (label === "Pendente") {
    return getSupplierFinancialStatusTone("PENDING_PAYMENT");
  }

  if (label === "Pago") {
    return getSupplierFinancialStatusTone("PAID");
  }

  if (label === "Recusado") {
    return getSupplierFinancialStatusTone("REJECTED");
  }

  return getSupplierFinancialStatusTone("CANCELED");
}


