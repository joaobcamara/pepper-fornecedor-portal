import { redirect } from "next/navigation";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { AdminSupplierOrdersManagerV2 as AdminSupplierOrdersManager } from "@/components/admin-supplier-orders-manager-v2";
import { getCurrentSession } from "@/lib/session";
import { getAdminSupplierOrderPageData } from "@/lib/supplier-orders-data";

export default async function AdminSupplierOrdersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/pedidos-fornecedor");
  }

  const data = await getAdminSupplierOrderPageData();
  const awaitingResponseCount = data.orders.filter((item) => item.workflowStage === "AWAITING_RESPONSE").length;
  const inPreparationCount = data.orders.filter((item) => item.workflowStage === "IN_PREPARATION").length;
  const readyForFinancialCount = data.orders.filter((item) => item.workflowStage === "SEPARATION_CONFIRMED").length;
  const financialReviewCount = data.orders.filter((item) => item.workflowStage === "IN_FINANCIAL_REVIEW").length;
  const pepperIaAlertCount = awaitingResponseCount + readyForFinancialCount + financialReviewCount;

  return (
    <AdminShell
      currentPath="/admin/pedidos-fornecedor"
      title="Pedidos ao Fornecedor"
      description="Crie pedidos para os fornecedores, acompanhe resposta, preparo, envio e romaneios em um unico fluxo operacional."
      pepperIaPageKey="orders"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        data.orders.length > 0
          ? `${awaitingResponseCount} cards aguardam resposta, ${inPreparationCount} seguem em preparacao, ${readyForFinancialCount} ja podem seguir para o financeiro e ${data.orders.filter((item) => item.financialEntry).length} ja chegaram ao financeiro.`
          : "Crie pedidos por produto e acompanhe o fluxo do fornecedor ate o financeiro e o envio."
      }
    >
      <AdminSupplierOrdersManager suppliers={data.suppliers} products={data.products} orders={data.orders} />
    </AdminShell>
  );
}
