import { redirect } from "next/navigation";
import { SupplierMessagesPanel } from "@/components/supplier-messages-panel";
import { SupplierPageShellV2 as SupplierPageShell } from "@/components/supplier-page-shell-v2";
import { getSupplierConversationView, getSupplierUnreadCount } from "@/lib/chat-data";
import { getSupplierConversationShortcutGroups } from "@/lib/chat-shortcuts";
import { getSupplierIdentity } from "@/lib/supplier-identity";
import { getCurrentSession } from "@/lib/session";

export default async function SupplierMessagesPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPPLIER" || !session.supplierId) {
    redirect("/login?next=/mensagens");
  }

  const [unreadCount, conversation, supplierIdentity, shortcutGroups] = await Promise.all([
    getSupplierUnreadCount(session.userId, session.supplierId),
    getSupplierConversationView(session.userId, session.supplierId),
    getSupplierIdentity(session.supplierId),
    getSupplierConversationShortcutGroups(session.supplierId)
  ]);

  return (
    <SupplierPageShell
      unreadCount={unreadCount}
      supplierName={supplierIdentity.supplierName}
      supplierInitials={supplierIdentity.supplierInitials}
      supplierLogoUrl={supplierIdentity.supplierLogoUrl}
      title="Mensagens"
      description="Canal direto com a equipe Pepper para alinhamentos operacionais, estoque e retorno sobre pedidos."
      pepperIaPageKey="messages"
      pepperIaHint={
        unreadCount > 0
          ? `Voce tem ${unreadCount} mensagem${unreadCount > 1 ? "s" : ""} para acompanhar com a equipe Pepper.`
          : "Use este canal para alinhar pedidos, estoque e retornos operacionais com a Pepper."
      }
    >
      <SupplierMessagesPanel
        conversationId={conversation.conversationId}
        supplierName={conversation.supplierName}
        messages={conversation.messages}
        shortcutGroups={shortcutGroups}
      />
    </SupplierPageShell>
  );
}
