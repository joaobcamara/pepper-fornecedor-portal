import { redirect } from "next/navigation";
import { AdminProductThresholdManager } from "@/components/admin-product-threshold-manager";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminPageData } from "@/lib/admin-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminProductsPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/produtos");
  }

  const { suppliers, productGroups } = await getAdminPageData();
  const staleGroupCount = productGroups.filter((item) => item.staleCount > 0).length;
  const openReplenishmentCount = productGroups.filter((item) => item.replenishmentCard).length;
  const activeOperationalCount = productGroups.filter((item) => item.activeOrder).length;
  const pepperIaAlertCount = staleGroupCount + activeOperationalCount;

  return (
    <AdminShell
      currentPath="/admin/produtos"
      pepperIaPageKey="products"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        productGroups.length > 0
          ? `${productGroups.length} produtos pai estao no painel, ${staleGroupCount} grupos ainda pedem revisao de sincronizacao, ${openReplenishmentCount} SKUs estao com sugestao de compra aberta e ${activeOperationalCount} ja tem card operacional em andamento.`
          : "Use esta tela para localizar SKUs pai e filha, revisar vinculos e decidir o que aparece para o fornecedor."
      }
      title="Produtos"
      description="Gestão operacional dos produtos já importados, com edição do nome interno, status ativo e vínculos com fornecedores."
    >
      <AdminProductThresholdManager suppliers={suppliers} productGroups={productGroups} />
    </AdminShell>
  );
}
