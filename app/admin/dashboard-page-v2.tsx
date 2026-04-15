import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AdminNextStepsV2,
  AdminOperationalRadarV2,
  AdminOverviewCardsV2,
  AdminQuickLinksV2,
  AdminRankingsV2,
  AdminRecentImportsV2
} from "@/components/admin-dashboard-panels-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminPageData } from "@/lib/admin-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminDashboardPageV2() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin");
  }

  const { recentImports, dashboard, topSuppliers, topProducts, priorityProducts, workflowWatchlist } = await getAdminPageData();
  const pepperIaAlertCount = dashboard.replenishmentPendingCount + dashboard.financialReviewCount + dashboard.paymentPendingCount;

  return (
    <AdminShell
      currentPath="/admin"
      title="Dashboard Admin"
      description="Visao resumida do giro do catalogo, risco de ruptura e atalhos para os modulos operacionais."
      pepperIaPageKey="dashboard"
      pepperIaHint={`Hoje o painel mostra ${dashboard.totalSales7d} vendas nos ultimos 7 dias, ${dashboard.atRiskCount} itens em risco, ${dashboard.replenishmentPendingCount} compras pendentes, ${dashboard.financialReviewCount} cards em revisao financeira e ${workflowWatchlist.length} cards operacionais em acompanhamento.`}
      pepperIaAlertCount={pepperIaAlertCount}
    >
      <AdminOverviewCardsV2 dashboard={dashboard} />

      <AdminQuickLinksV2 />

      <AdminOperationalRadarV2 dashboard={dashboard} workflowWatchlist={workflowWatchlist} />

      <AdminRankingsV2
        topSuppliers={topSuppliers}
        topProducts={topProducts}
        priorityProducts={priorityProducts}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AdminRecentImportsV2 recentImports={recentImports} />
        <AdminNextStepsV2 />
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Leitura rapida da operacao</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Painel pensado para usar o Supabase como camada analitica e reduzir consultas diretas no Tiny.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Ver dashboard do fornecedor
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-[#fff7f1] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b85b2c]">Ritmo do catalogo</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              As vendas dos ultimos 7 e 30 dias ja conseguem alimentar ranking, cobertura estimada e alerta de ruptura.
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Webhooks ativos</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Estoque, vendas e clientes entram pela camada de webhook e ficam prontos para IA consultar sem bater no ERP.
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proxima camada</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              As mesmas metricas agora podem ser espalhadas para cards, filtros e respostas do AtendimentoIA.
            </p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
