import { redirect } from "next/navigation";
import { PepperIaBubbleSlot } from "@/components/pepper-ia-bubble-slot";
import { SupplierProductsPage } from "@/components/supplier-products-page";
import { getSupplierUnreadCount } from "@/lib/chat-data";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getCurrentSession } from "@/lib/session";
import { getSupplierDashboardDataFromDb } from "@/lib/supplier-dashboard-data";

export default async function SupplierProductsRoutePage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER") {
    redirect("/login?next=/produtos");
  }

  const [dashboardData, unreadCount, supplierIdentity] = await Promise.all([
    getSupplierDashboardDataFromDb(session.supplierId ?? ""),
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierIdentity(session.supplierId)
  ]);

  return (
    <>
      <SupplierProductsPage
        products={dashboardData.products}
        summary={dashboardData.summary}
        unreadCount={unreadCount}
        supplierName={supplierIdentity.supplierName}
        supplierInitials={supplierIdentity.supplierInitials}
        supplierLogoUrl={supplierIdentity.supplierLogoUrl}
        canViewProductValues={supplierIdentity.canViewProductValues}
        canViewFinancialDashboard={supplierIdentity.canViewFinancialDashboard}
      />
      <PepperIaBubbleSlot
        pageKey="products"
        pageHint={
          dashboardData.summary.topProductName
            ? `Seu produto com maior giro recente e ${dashboardData.summary.topProductName}, com ${dashboardData.summary.totalSales30d} vendas no periodo de 30 dias, ${dashboardData.summary.replenishmentLinkedCount} sugestoes de compra ja ligadas a pedido e ${dashboardData.summary.orderCardsInProgress} cards de produto em andamento.`
            : `Voce tem ${dashboardData.summary.productCount} produtos monitorados, ${dashboardData.summary.criticalCount} itens criticos, ${dashboardData.summary.replenishmentPendingCount} sugestoes de compra pendentes e ${dashboardData.summary.orderCardsInFinancial} cards no financeiro.`
        }
      />
    </>
  );
}
