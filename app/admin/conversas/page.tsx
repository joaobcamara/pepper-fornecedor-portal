import { redirect } from "next/navigation";
import { AdminConversationsPanel } from "@/components/admin-conversations-panel";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminConversationList, getAdminConversationView } from "@/lib/chat-data";
import { getAdminConversationShortcutGroups } from "@/lib/chat-shortcuts";
import { getCurrentSession } from "@/lib/session";

export default async function AdminConversationsPage({
  searchParams
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/conversas");
  }

  const params = await searchParams;
  const [conversations, shortcutGroups] = await Promise.all([
    getAdminConversationList(),
    getAdminConversationShortcutGroups()
  ]);
  const selectedConversationId = params.conversation ?? conversations[0]?.id ?? null;
  const conversation = selectedConversationId ? await getAdminConversationView(selectedConversationId) : null;
  const unreadCount = conversations.filter((item) => item.unreadCount > 0).length;
  const conversationAlertCount = Math.min(
    conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    9
  );

  return (
    <AdminShell
      currentPath="/admin/conversas"
      title="Conversas"
      description="Canal interno entre a equipe Pepper e os fornecedores, com anexos e historico por conversa principal."
      pepperIaPageKey="messages"
      pepperIaAlertCount={conversationAlertCount}
      pepperIaHint={
        conversations.length > 0
          ? `${conversations.length} conversas estao no inbox, ${unreadCount} pedem retorno agora e ${shortcutGroups.reduce((sum, group) => sum + group.items.length, 0)} atalhos operacionais estao disponiveis para contextualizar a troca.`
          : "Use as conversas para alinhar produtos, pedidos, reposicao e cards financeiros com contexto compartilhado."
      }
    >
      <AdminConversationsPanel
        conversations={conversations}
        initialConversation={conversation}
        shortcutGroups={shortcutGroups}
      />
    </AdminShell>
  );
}

