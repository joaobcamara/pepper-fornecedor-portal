import { redirect } from "next/navigation";

import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { AdminWhatsAppLinksBoard } from "@/components/admin-whatsapp-links-board";
import { getCurrentSession } from "@/lib/session";
import { listAdminWhatsAppShareLinks } from "@/lib/whatsapp-share";

export default async function AdminWhatsAppPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/whatsapp");
  }

  const links = await listAdminWhatsAppShareLinks(session.userId);
  const changedCount = links.filter((link) => link.hasRecipientChanges).length;

  return (
    <AdminShell
      currentPath="/admin/whatsapp"
      pepperIaPageKey="messages"
      pepperIaAlertCount={changedCount}
      pepperIaHint={
        links.length > 0
          ? `${links.length} links compartilhados estao na central, ${changedCount} ja mostram alteracao desde a criacao e toda a leitura continua vindo da fundacao em tempo real.`
          : "Use esta central para acompanhar links compartilhados por WhatsApp sem misturar isso com o fluxo padrao de sugestao do fornecedor."
      }
      title="WhatsApp"
      description="Links portateis compartilhados pelo admin, com leitura viva da fundacao, aprovacao, recusa, fechamento e historico visual em cards."
    >
      <AdminWhatsAppLinksBoard links={links} />
    </AdminShell>
  );
}
