import { redirect } from "next/navigation";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { AdminStockDashboard } from "@/components/admin-stock-dashboard";
import { getAdminPageData } from "@/lib/admin-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminStockPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/estoque");
  }

  const { productGroups } = await getAdminPageData();

  const stockProducts = productGroups.map((group) => ({
    id: group.id,
    name: group.internalName,
    sku: group.parentSku,
    imageUrl: group.imageUrl,
    supplierName: group.suppliers[0]?.name ?? "Sem fornecedor",
    variantCount: group.variantCount,
    totalStock: group.totalStock,
    totalEstimatedCost: group.totalEstimatedCost,
    band: group.band,
    bandLabel: group.bandLabel,
    coverageDays: group.coverageDays,
    movementBadge: group.movementBadge,
    staleCount: group.staleCount,
    salesToday: group.sales["1d"],
    sales7d: group.sales["7d"],
    sales30d: group.sales["1m"],
    topColorLabel: group.topColorLabel,
    topSizeLabel: group.topSizeLabel,
    sales: group.sales
  }));

  const summary = {
    productCount: stockProducts.length,
    variantCount: productGroups.reduce((total, group) => total + group.variantCount, 0),
    totalStock: stockProducts.reduce((total, product) => total + product.totalStock, 0),
    totalEstimatedCost: stockProducts.reduce((total, product) => total + product.totalEstimatedCost, 0),
    criticalCount: stockProducts.filter((product) => product.band === "critical").length,
    lowCount: stockProducts.filter((product) => product.band === "low").length,
    staleCount: stockProducts.filter((product) => product.staleCount > 0).length
  };

  return (
    <AdminShell
      currentPath="/admin/estoque"
      title="Estoque"
      description="Dashboard exclusivo de estoque para a fundação. Aqui entram giro, criticidade, cobertura e sincronização, sempre lendo primeiro do Supabase."
      pepperIaPageKey="dashboard"
      pepperIaHint={
        stockProducts.length > 0
          ? `${summary.productCount} produtos monitorados, ${summary.criticalCount} em faixa critica, ${summary.lowCount} em alerta baixo e ${summary.staleCount} ainda pedindo reconciliacao.`
          : "Assim que os produtos forem vinculados ao portal, o dashboard de estoque passa a ler a fundação instantaneamente."
      }
      pepperIaAlertCount={summary.criticalCount + summary.staleCount}
    >
      <AdminStockDashboard
        summary={summary}
        products={stockProducts}
      />
    </AdminShell>
  );
}
