import { redirect } from "next/navigation";
import { AdminReplenishmentRequestsV2 as AdminReplenishmentRequests } from "@/components/admin-replenishment-requests-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminReplenishmentRequests } from "@/lib/replenishment-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminReplenishmentRequestsPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/solicitacoes-reposicao");
  }

  const requests = await getAdminReplenishmentRequests();
  const pendingCount = requests.filter((item) => item.status === "PENDING").length;
  const approvedCount = requests.filter((item) => item.status === "APPROVED").length;
  const linkedToOrderCount = requests.filter((item) => item.linkedOrder).length;
  const pepperIaAlertCount = pendingCount + approvedCount;

  return (
    <AdminShell
      currentPath="/admin/solicitacoes-reposicao"
      title="Solicitacoes de reposicao"
      description="Aprove ou recuse as sugestoes enviadas pelos fornecedores antes de seguir para a compra."
      pepperIaPageKey="orders"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        requests.length > 0
          ? `${pendingCount} cards aguardam aprovacao, ${approvedCount} ja foram aprovados e ${linkedToOrderCount} ja viraram pedido operacional.`
          : "As sugestoes de compra aprovadas viram pedidos ao fornecedor e depois podem seguir para o financeiro."
      }
    >
      <AdminReplenishmentRequests requests={requests} />
    </AdminShell>
  );
}
