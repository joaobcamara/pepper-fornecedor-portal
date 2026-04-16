"use client";

import { useState, type ReactNode } from "react";
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

type FoundationAccountHealth = {
  accountKey: string;
  label: string;
  orderCount: number;
  lastOrderAt: string | null;
};

type FoundationRecentSalesOrder = {
  id: string;
  accountLabel: string;
  number: string | null;
  ecommerceNumber: string | null;
  statusLabel: string | null;
  marketplace: string | null;
  totalAmount: number | null;
  orderDate: string | null;
  itemCount: number;
};

type FoundationHealth = {
  catalogProductCount: number;
  catalogVariantCount: number;
  inventoryVariantCount: number;
  salesOrderCount: number;
  salesItemCount: number;
  variantMetricCount: number;
  productMetricCount: number;
  supplierMetricCount: number;
  lastStockSyncAt: string | null;
  lastStockSku: string | null;
  lastStockProductName: string | null;
  lastSalesOrderAt: string | null;
  lastSalesOrderNumber: string | null;
  lastSalesOrderAccountLabel: string | null;
  lastMetricDate: string | null;
  lastMetricSku: string | null;
  lastMetricProductName: string | null;
  salesOrdersByAccount: FoundationAccountHealth[];
  recentSalesOrders: FoundationRecentSalesOrder[];
  note: string;
};

export function AdminSyncCenterV2({
  summary,
  syncRuns,
  webhookLogs,
  foundationHealth
}: {
  summary: SyncSummary;
  syncRuns: SyncRunRow[];
  webhookLogs: WebhookRow[];
  foundationHealth: FoundationHealth | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"inventory" | "sales" | null>(null);

  async function reconcileInventoryNow() {
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
      `Reconciliacao ${payload.status === "partial" ? "parcial" : "concluida"}: ${payload.updated ?? 0} variacoes atualizadas, ${payload.stale ?? 0} com fallback e ${payload.checked ?? 0} variacoes verificadas.`
    );
    router.refresh();
  }

  async function importSalesNow() {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/sincronizacoes/reconcile-sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        days: 30,
        maxPages: 8,
        maxOrders: 300
      })
    });

    const payload = (await response.json()) as {
      error?: string;
      reason?: string;
      status?: string;
      processed?: number;
      failed?: number;
      checked?: number;
      days?: number;
      processedByAccount?: Array<{
        label: string;
        processed: number;
        failed: number;
      }>;
    };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel importar as vendas agora.");
      return;
    }

    if (payload.status === "skipped") {
      setError(payload.reason ?? "Importacao de vendas ignorada.");
      return;
    }

    const accountSummary =
      payload.processedByAccount && payload.processedByAccount.length > 0
        ? ` (${payload.processedByAccount
            .map((account) => `${account.label}: ${account.processed} ok / ${account.failed} falhas`)
            .join(" · ")})`
        : "";

    setFeedback(
      `Importacao de vendas ${payload.status === "partial" ? "parcial" : "concluida"}: ${payload.processed ?? 0} pedidos processados, ${payload.failed ?? 0} falharam e ${payload.checked ?? 0} pedidos foram revisados nos ultimos ${payload.days ?? 30} dias.${accountSummary}`
    );
    router.refresh();
  }

  async function runInventoryReconciliation() {
    setActiveAction("inventory");
    try {
      await reconcileInventoryNow();
    } finally {
      setActiveAction(null);
    }
  }

  async function runSalesImport() {
    setActiveAction("sales");
    try {
      await importSalesNow();
    } finally {
      setActiveAction(null);
    }
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
              <h2 className="text-xl font-semibold text-slate-900">Sincronizacao manual</h2>
              <p className="text-sm text-slate-500">
                Corrija divergencias de estoque e puxe o historico real de pedidos de Pepper, Show Look e On Shop.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoBox label="Runs completos" value={summary.completedRuns.toString()} />
            <InfoBox label="Runs parciais" value={summary.partialRuns.toString()} />
            <InfoBox label="Ultimo webhook" value={summary.lastWebhookAt ?? "Sem registro"} />
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

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={activeAction !== null}
              onClick={() => void runInventoryReconciliation()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeAction === "inventory" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {activeAction === "inventory" ? "Reconciliando..." : "Executar reconciliacao de estoque"}
            </button>

            <button
              type="button"
              disabled={activeAction !== null}
              onClick={() => void runSalesImport()}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#f0d4c2] bg-[#fff8f3] px-5 py-3 text-sm font-semibold text-[#a94b25] shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeAction === "sales" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {activeAction === "sales" ? "Importando vendas..." : "Importar vendas 30 dias"}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Leitura operacional</h2>
              <p className="text-sm text-slate-500">
                O Tiny segue como origem operacional, e o Supabase continua como a camada confiavel de leitura.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <li>Webhook de estoque atualiza o saldo multiempresa de cada variacao.</li>
            <li>Webhook de vendas atualiza cliente, pedido, itens e metricas diarias.</li>
            <li>Importacao manual de 30 dias soma Pepper, Show Look e On Shop para o giro compartilhado do deposito.</li>
            <li>A reconciliacao continua como rede de seguranca para manter consistencia.</li>
          </ul>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Fundacao comercial</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Visao rapida do que ja esta consolidado na camada oficial de catalogo, estoque, pedidos e metricas.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Supabase-first</span>
          </div>

          {foundationHealth ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoBox label="Produtos de catalogo" value={foundationHealth.catalogProductCount.toString()} />
                <InfoBox label="Variacoes" value={foundationHealth.catalogVariantCount.toString()} />
                <InfoBox label="Estoque sincronizado" value={foundationHealth.inventoryVariantCount.toString()} />
                <InfoBox label="Pedidos comerciais" value={foundationHealth.salesOrderCount.toString()} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoBox label="Itens de pedido" value={foundationHealth.salesItemCount.toString()} />
                <InfoBox label="Metricas por variacao" value={foundationHealth.variantMetricCount.toString()} />
                <InfoBox
                  label="Metricas produto / fornecedor"
                  value={`${foundationHealth.productMetricCount} / ${foundationHealth.supplierMetricCount}`}
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <InfoBox
                  label="Ultimo estoque"
                  value={
                    foundationHealth.lastStockSyncAt
                      ? `${foundationHealth.lastStockSyncAt}${foundationHealth.lastStockSku ? ` · ${foundationHealth.lastStockSku}` : ""}`
                      : "Sem sincronizacao recente"
                  }
                />
                <InfoBox
                  label="Ultimo pedido"
                  value={
                    foundationHealth.lastSalesOrderAt
                      ? `${foundationHealth.lastSalesOrderAt}${foundationHealth.lastSalesOrderNumber ? ` · ${foundationHealth.lastSalesOrderNumber}` : ""}`
                      : "Sem pedido consolidado"
                  }
                />
                <InfoBox
                  label="Ultima metrica"
                  value={
                    foundationHealth.lastMetricDate
                      ? `${foundationHealth.lastMetricDate}${foundationHealth.lastMetricSku ? ` · ${foundationHealth.lastMetricSku}` : ""}`
                      : "Sem metrica diaria"
                  }
                />
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-[#f0d4c2] bg-[#fff8f3] px-4 py-4 text-sm leading-6 text-slate-600">
                {foundationHealth.note}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Contas Tiny</p>
                  <div className="mt-4 space-y-3">
                    {foundationHealth.salesOrdersByAccount.map((account) => (
                      <div key={account.accountKey} className="rounded-2xl border border-white bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{account.label}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {account.orderCount} pedidos
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {account.lastOrderAt ? `Ultimo pedido em ${account.lastOrderAt}` : "Sem pedido consolidado ainda"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pedidos recentes da fundacao</p>
                  <div className="mt-4 space-y-3">
                    {foundationHealth.recentSalesOrders.length > 0 ? (
                      foundationHealth.recentSalesOrders.map((order) => (
                        <div key={order.id} className="rounded-2xl border border-white bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {order.number ?? order.ecommerceNumber ?? "Pedido sem numero"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {order.accountLabel}
                                {order.marketplace ? ` · ${order.marketplace}` : ""}
                                {order.orderDate ? ` · ${order.orderDate}` : ""}
                              </p>
                            </div>
                            <StatusBadge status={order.statusLabel ? "processed" : "processing"}>
                              {order.statusLabel ?? "Sem status"}
                            </StatusBadge>
                          </div>
                          <p className="mt-3 text-xs text-slate-500">
                            {order.itemCount} itens
                            {order.totalAmount != null ? ` · Total R$ ${order.totalAmount.toFixed(2).replace(".", ",")}` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyState label="Nenhum pedido comercial consolidado ainda." />
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState label="Nao foi possivel carregar o resumo da fundacao agora." />
          )}
        </section>

        <section className="rounded-[2rem] border border-[#f0d4c2] bg-[#fff8f3] p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#c75f2d]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Como ler este painel</h2>
              <p className="text-sm text-slate-500">
                Use esta leitura para validar se a fundacao esta pronta para abastecer Pepper IA, operacao e sistemas futuros.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <li>Produtos e variacoes oficiais vivem em CatalogProduct, CatalogVariant, CatalogInventory e CatalogTinyMapping.</li>
            <li>Pedidos e metricas precisam crescer aqui para a Pepper IA deixar de depender de fallback e ganhar precisao real.</li>
            <li>Se houver estoque recente, mas nenhum pedido ou metrica, a fundacao esta boa para operacao, mas ainda fraca para inteligencia comercial.</li>
            <li>As tres contas Tiny devem aparecer refletidas por SKU e por pedidos; Pepper segue matriz, Show Look e On Shop alimentam vendas do grupo.</li>
          </ul>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Runs recentes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Historico dos disparos de sincronizacao e das importacoes operacionais.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Operacao</span>
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
              <EmptyState label="Nenhuma sincronizacao registrada ainda." />
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Webhooks recentes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Entradas do Tiny processadas pelo sistema com status e rastreio.
              </p>
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
                        {log.webhookType}
                        {log.eventType ? ` · ${log.eventType}` : ""}
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

function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
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
      {children ?? status}
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
