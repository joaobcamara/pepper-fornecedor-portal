import { redirect } from "next/navigation";
import { AdminFinancialDashboard } from "@/components/admin-financial-dashboard";
import { AdminFinancialOperationsBoard } from "@/components/admin-financial-operations-board";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminFinancialData } from "@/lib/admin-financial-data";
import { parseFinancialPeriod } from "@/lib/financial-period";
import { getAdminFinancialBoardData } from "@/lib/supplier-financial-entries";
import { getCurrentSession } from "@/lib/session";

export default async function AdminFinancialPage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/financeiro");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedPeriod = parseFinancialPeriod(params?.period);
  const [financialData, boardData] = await Promise.all([
    getAdminFinancialData(selectedPeriod),
    getAdminFinancialBoardData()
  ]);
  const reviewCount = boardData.filter((item) => item.status === "IN_REVIEW").length;
  const pendingCount = boardData.filter((item) => item.status === "PENDING_PAYMENT").length;
  const pepperIaAlertCount = reviewCount + pendingCount;

  return (
    <AdminShell
      currentPath="/admin/financeiro"
      title="Financeiro"
      description="Leitura consolidada de faturamento, valor em estoque e produtos de maior impacto financeiro no grupo Pepper."
      pepperIaPageKey="finance"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        boardData.length > 0
          ? `${pendingCount} cards aguardam pagamento, ${reviewCount} estao em revisao e ${boardData.filter((item) => item.status === "PAID").length} ja foram pagos.`
          : `No periodo de ${financialData.period.label.toLowerCase()} o painel consolidou ${financialData.metrics.periodUnitsSold} unidades e ${financialData.metrics.periodRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em movimentacao.`
      }
    >
      <AdminFinancialDashboard data={financialData} selectedPeriod={selectedPeriod} />
      <AdminFinancialOperationsBoard entries={boardData} />
    </AdminShell>
  );
}
