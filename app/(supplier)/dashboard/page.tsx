import { redirect } from "next/navigation";
import { SupplierInsightsDashboard } from "@/components/supplier-insights-dashboard";
import { SupplierPageShellV2 as SupplierPageShell } from "@/components/supplier-page-shell-v2";
import { getSupplierUnreadCount } from "@/lib/chat-data";
import { getSupplierDashboardDataFromDb } from "@/lib/supplier-dashboard-data";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getCurrentSession } from "@/lib/session";

export default async function SupplierDashboardPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    redirect("/login?next=/dashboard");
  }

  const [unreadCount, dashboardData, supplierIdentity] = await Promise.all([
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierDashboardDataFromDb(session.supplierId),
    getSupplierIdentity(session.supplierId)
  ]);

  return (
    <SupplierPageShell
      unreadCount={unreadCount}
      supplierName={supplierIdentity.supplierName}
      supplierInitials={supplierIdentity.supplierInitials}
      supplierLogoUrl={supplierIdentity.supplierLogoUrl}
      title="Dashboard"
      description="Visao executiva do giro do seu catalogo, risco de ruptura e prioridades de reposicao com base na camada analitica do Supabase."
      pepperIaPageKey="dashboard"
      pepperIaHint={`Nos ultimos 7 dias voce teve ${dashboardData.summary.totalSales7d} vendas, ${dashboardData.summary.criticalCount} itens criticos, ${dashboardData.summary.replenishmentPendingCount} sugestoes de compra pendentes, ${dashboardData.summary.orderCardsInProgress} cards em andamento e ${dashboardData.summary.orderCardsInFinancial} no financeiro.`}
    >
      <SupplierInsightsDashboard
        summary={dashboardData.summary}
        products={dashboardData.products}
        canViewFinancialDashboard={supplierIdentity.canViewFinancialDashboard}
      />
    </SupplierPageShell>
  );
}
