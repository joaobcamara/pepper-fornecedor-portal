import { redirect } from "next/navigation";
import { AdminSyncCenterV2 as AdminSyncCenter } from "@/components/admin-sync-center-v2";
import { AdminShellV2 as AdminShell } from "@/components/admin-shell-v2";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export default async function AdminSincronizacoesPage() {
  const session = await getCurrentSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin/sincronizacoes");
  }

  const [syncRuns, webhookLogs] = await Promise.all([
    prisma.syncRun
      .findMany({
        take: 12,
        orderBy: {
          startedAt: "desc"
        }
      })
      .catch(() => []),
    prisma.tinyWebhookLog
      .findMany({
        take: 16,
        orderBy: {
          createdAt: "desc"
        }
      })
      .catch(() => [])
  ]);

  const summary = {
    totalRuns: syncRuns.length,
    completedRuns: syncRuns.filter((run) => run.status === "completed").length,
    partialRuns: syncRuns.filter((run) => run.status === "partial").length,
    failedRuns: syncRuns.filter((run) => run.status === "failed").length,
    webhookProcessed: webhookLogs.filter((log) => log.status === "processed").length,
    webhookErrors: webhookLogs.filter((log) => ["error", "invalid_payload", "variant_not_found"].includes(log.status)).length,
    lastWebhookAt: webhookLogs[0]?.createdAt ? webhookLogs[0].createdAt.toLocaleString("pt-BR") : null
  };
  const pepperIaAlertCount = summary.failedRuns + summary.partialRuns + summary.webhookErrors;

  return (
    <AdminShell
      currentPath="/admin/sincronizacoes"
      title="Sincronizacoes"
      description="Acompanhe reconciliacao, historico dos webhooks do Tiny e a saude geral da base que alimenta o portal."
      pepperIaPageKey="sync"
      pepperIaAlertCount={pepperIaAlertCount}
      pepperIaHint={
        summary.totalRuns > 0 || webhookLogs.length > 0
          ? `${summary.failedRuns} sincronizacoes falharam, ${summary.partialRuns} ficaram parciais e ${summary.webhookErrors} webhooks pedem revisao no momento.`
          : "Use este painel para monitorar reconciliacao, webhooks de estoque e eventos do Tiny antes que impactem o portal."
      }
    >
      <AdminSyncCenter
        summary={summary}
        syncRuns={syncRuns.map((run) => ({
          id: run.id,
          triggerType: run.triggerType,
          status: run.status,
          startedAt: run.startedAt.toLocaleString("pt-BR"),
          finishedAt: run.finishedAt ? run.finishedAt.toLocaleString("pt-BR") : null,
          errorMessage: run.errorMessage
        }))}
        webhookLogs={webhookLogs.map((log) => ({
          id: log.id,
          webhookType: log.webhookType,
          eventType: log.eventType,
          sku: log.sku,
          tinyProductId: log.tinyProductId,
          status: log.status,
          errorMessage: log.errorMessage,
          processedAt: log.processedAt ? log.processedAt.toLocaleString("pt-BR") : null,
          createdAt: log.createdAt.toLocaleString("pt-BR")
        }))}
      />
    </AdminShell>
  );
}
