"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw, Webhook } from "lucide-react";
import { cn } from "@/lib/cn";

type SyncRunRow = {
  id: string;
  triggerType: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

type WebhookRow = {
  id: string;
  webhookType: string;
  eventType: string | null;
  sku: string | null;
  tinyProductId: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
};

type SyncSummary = {
  totalRuns: number;
  completedRuns: number;
  partialRuns: number;
  failedRuns: number;
  webhookProcessed: number;
  webhookErrors: number;
  lastWebhookAt: string | null;
};

export function AdminSyncCenter({
  summary,
  syncRuns,
  webhookLogs
}: {
  summary: SyncSummary;
  syncRuns: SyncRunRow[];
  webhookLogs: WebhookRow[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reconcileNow() {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/sincronizacoes/reconcile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        staleMinutes: 30,
        limit: 150
      })
    });

    const payload = (await response.json()) as {
      error?: string;
      status?: string;
      updated?: number;
      stale?: number;
      checked?: number;
      reason?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel reconciliar o estoque agora.");
      return;
    }

    if (payload.status === "skipped") {
      setError(payload.reason ?? "Reconciliacao ignorada.");
      return;
    }

    setFeedback(
      `Reconciliacao ${payload.status === "partial" ? "parcial" : "concluida"}: ${payload.updated ?? 0} variacoes atualizadas, ${payload.stale ?? 0} com fallback, ${payload.checked ?? 0} verificadas.`
    );
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sync runs" value={summary.totalRuns} tone="soft" />
        <MetricCard label="Falhas" value={summary.failedRuns} tone="critical" />
        <MetricCard label="Webhooks processados" value={summary.webhookProcessed} tone="info" />
        <MetricCard label="Erros de webhook" value={summary.webhookErrors} tone="critical" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#fff1e7] p-3 text-[#c75f2d]">
              <RefreshCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Reconciliação manual</h2>
              <p className="text-sm text-slate-500">Força nova leitura no Tiny para corrigir divergências do catálogo.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoBox label="Runs completos" value={summary.completedRuns.toString()} />
            <InfoBox label="Runs parciais" value={summary.partialRuns.toString()} />
            <InfoBox label="Último webhook" value={summary.lastWebhookAt ?? "Sem registro"} />
            <InfoBox label="Erros recentes" value={summary.webhookErrors.toString()} />
          </div>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <button
            type="button"
            onClick={() => startTransition(() => void reconcileNow())}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isPending ? "Reconciliando..." : "Executar reconciliação agora"}
          </button>
        </section>

        <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Leitura operacional</h2>
              <p className="text-sm text-slate-500">O Tiny alimenta webhooks e o Supabase serve como camada confiável de leitura.</p>
            </div>
          </div>

          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <li>Webhook de estoque atualiza o saldo multiempresa da variação.</li>
            <li>Webhook de vendas atualiza cliente, pedido, item e métricas diárias.</li>
            <li>A reconciliação existe como rede de segurança para manter consistência.</li>
            <li>Os dashboards passam a ler o Supabase, não o Tiny diretamente.</li>
          </ul>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Runs recentes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Histórico dos disparos de sincronização e reconciliação.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Operação</span>
          </div>

          <div className="mt-5 space-y-3">
            {syncRuns.length > 0 ? (
              syncRuns.map((run) => (
                <div key={run.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {run.triggerType} · {run.startedAt}
                      </p>
                      <p className="text-xs text-slate-500">
                        {run.finishedAt ? `Finalizada em ${run.finishedAt}` : "Ainda em processamento"}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>

                  {run.errorMessage ? (
                    <p className="mt-3 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-rose-700">
                      {run.errorMessage}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState label="Nenhuma sincronização registrada ainda." />
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Webhooks recentes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Entradas do Tiny processadas pelo sistema com status e rastreio.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">
              <Webhook className="h-3.5 w-3.5" />
              Tiny
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {webhookLogs.length > 0 ? (
              webhookLogs.map((log) => (
                <div key={log.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {log.webhookType} {log.eventType ? `· ${log.eventType}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {log.sku ? `${log.sku} · ` : ""}
                        {log.createdAt}
                      </p>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-500">
                    <p>{log.tinyProductId ? `Tiny ID: ${log.tinyProductId}` : "Sem Tiny ID no evento"}</p>
                    <p>{log.processedAt ? `Processado em ${log.processedAt}` : "Ainda sem processamento final"}</p>
                  </div>

                  {log.errorMessage ? (
                    <p className="mt-3 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-rose-700">
                      {log.errorMessage}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState label="Nenhum webhook recebido ainda." />
            )}
          </div>
        </section>
      </section>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "soft" | "critical" | "info" }) {
  const tones = {
    soft: "bg-white border-slate-200",
    critical: "bg-rose-50 border-rose-100",
    info: "bg-sky-50 border-sky-100"
  };

  return (
    <div className={cn("rounded-[1.7rem] border p-5 shadow-soft", tones[tone])}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        status === "completed" && "bg-emerald-50 text-emerald-700",
        status === "processed" && "bg-emerald-50 text-emerald-700",
        status === "partial" && "bg-amber-50 text-amber-700",
        status === "failed" && "bg-rose-50 text-rose-700",
        status === "error" && "bg-rose-50 text-rose-700",
        status === "processing" && "bg-sky-50 text-sky-700",
        status === "invalid_payload" && "bg-rose-50 text-rose-700",
        status === "variant_not_found" && "bg-amber-50 text-amber-700"
      )}
    >
      {status}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
