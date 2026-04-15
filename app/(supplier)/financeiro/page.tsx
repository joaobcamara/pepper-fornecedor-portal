import { redirect } from "next/navigation";
import { SupplierFinancialDashboard } from "@/components/supplier-financial-dashboard";
import { SupplierFinancialOperationsBoard } from "@/components/supplier-financial-operations-board";
import { SupplierPageShellV2 as SupplierPageShell } from "@/components/supplier-page-shell-v2";
import { getSupplierUnreadCount } from "@/lib/chat-data";
import { getSupplierFinancialBoardData } from "@/lib/supplier-financial-entries";
import { parseFinancialPeriod } from "@/lib/financial-period";
import { getSupplierFinancialData } from "@/lib/supplier-financial-data";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getCurrentSession } from "@/lib/session";

export default async function SupplierFinancialPage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    redirect("/login?next=/financeiro");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedPeriod = parseFinancialPeriod(params?.period);

  const [unreadCount, supplierIdentity, financialData, boardData] = await Promise.all([
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierIdentity(session.supplierId),
    getSupplierFinancialData(session.supplierId, selectedPeriod),
    getSupplierFinancialBoardData(session.supplierId)
  ]);

  return (
    <SupplierPageShell
      unreadCount={unreadCount}
      supplierName={supplierIdentity.supplierName}
      supplierInitials={supplierIdentity.supplierInitials}
      supplierLogoUrl={supplierIdentity.supplierLogoUrl}
      title="Financeiro"
      description="Valor total dos produtos, custo estimado em estoque e leitura financeira por periodo para apoiar suas decisoes."
      pepperIaPageKey="finance"
      pepperIaHint={`No periodo de ${financialData.period.label.toLowerCase()} o painel consolidou ${financialData.metrics.periodUnitsSold} unidades e ${financialData.metrics.periodRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em movimentacao.`}
    >
      <SupplierFinancialDashboard
        data={financialData}
        selectedPeriod={selectedPeriod}
        canViewFinancialDashboard={supplierIdentity.canViewFinancialDashboard}
      />
      {supplierIdentity.canViewFinancialDashboard ? (
        <SupplierFinancialOperationsBoard readyOrders={boardData.readyOrders} entries={boardData.entries} />
      ) : null}
    </SupplierPageShell>
  );
}
