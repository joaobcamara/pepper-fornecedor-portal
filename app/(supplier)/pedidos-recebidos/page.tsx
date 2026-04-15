import { redirect } from "next/navigation";
import { SupplierPageShellV2 as SupplierPageShell } from "@/components/supplier-page-shell-v2";
import { SupplierReceivedOrdersPanelV2 } from "@/components/supplier-received-orders-panel-v2";
import { getSupplierUnreadCount } from "@/lib/chat-data";
import { getCurrentSession } from "@/lib/session";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getSupplierReceivedOrders } from "@/lib/supplier-orders-data";

export default async function SupplierReceivedOrdersPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    redirect("/login?next=/pedidos-recebidos");
  }

  const [unreadCount, supplierIdentity, orders] = await Promise.all([
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierIdentity(session.supplierId),
    getSupplierReceivedOrders(session.supplierId)
  ]);

  return (
    <SupplierPageShell
      unreadCount={unreadCount}
      supplierName={supplierIdentity.supplierName}
      supplierInitials={supplierIdentity.supplierInitials}
      supplierLogoUrl={supplierIdentity.supplierLogoUrl}
      title="Pedidos Recebidos"
      description="Responda os pedidos enviados pela Pepper, informe o que possui em estoque, anexe romaneio e acompanhe o historico."
      pepperIaPageKey="orders"
      pepperIaHint={
        orders.length > 0
          ? `Voce tem ${orders.filter((item) => item.workflowStage === "AWAITING_RESPONSE").length} pedidos aguardando resposta e ${orders.filter((item) => item.workflowStage === "SEPARATION_CONFIRMED").length} prontos para financeiro.`
          : "Assim que a Pepper enviar um pedido, ele aparece aqui para voce responder e anexar romaneio."
      }
    >
      <SupplierReceivedOrdersPanelV2 orders={orders} />
    </SupplierPageShell>
  );
}
