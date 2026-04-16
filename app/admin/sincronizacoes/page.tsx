import { redirect } from "next/navigation";
import { AdminSyncCenterV2 as AdminSyncCenter } from "@/components/admin-sync-center-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { getAdminSyncPageData } from "@/lib/admin-sync-data";
import { getCurrentSession } from "@/lib/session";

export default async function AdminSincronizacoesPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/sincronizacoes");
  }

  const pageData = await getAdminSyncPageData().catch(() => null);
  const summary = pageData?.summary ?? {
    totalRuns: 0,
    completedRuns: 0,
    partialRuns: 0,
    failedRuns: 0,
    webhookProcessed: 0,
    webhookErrors: 0,
    lastWebhookAt: null
  };
  const pepperIaAlertCount = pageData?.pepperIaAlertCount ?? summary.failedRuns + summary.partialRuns + summary.webhookErrors;

  return (
    <AdminShell
      currentPath="/admin/sincronizacoes"
      title="Sincronizacoes"
      description="Acompanhe reconciliacao, historico dos webhooks do Tiny e a saude geral da base que alimenta o portal."
      pepperIaPageKey="sync"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        pageData
          ? pageData.pepperIaHint
          : summary.totalRuns > 0
            ? `${summary.failedRuns} sincronizacoes falharam, ${summary.partialRuns} ficaram parciais e ${summary.webhookErrors} webhooks pedem revisao no momento.`
            : "Use este painel para monitorar reconciliacao, webhooks de estoque e eventos do Tiny antes que impactem o portal."
      }
    >
      <AdminSyncCenter
        summary={summary}
        syncRuns={pageData?.syncRuns ?? []}
        webhookLogs={pageData?.webhookLogs ?? []}
        foundationHealth={pageData?.foundationHealth ?? null}
      />
    </AdminShell>
  );
}
