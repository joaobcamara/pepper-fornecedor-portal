"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Download, LoaderCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type RequestRow = {
  id: string;
  supplierName: string;
  createdBy: string;
  reviewedBy: string | null;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  htmlContent: string;
  createdAt: string;
  reviewedAt: string | null;
  requestedUnits: number;
  items: Array<{
    id: string;
    sku: string;
    size: string;
    color: string;
    currentStock: number | null;
    requestedQuantity: number;
  }>;
};

function statusLabel(status: RequestRow["status"]) {
  if (status === "APPROVED") return "Aprovada";
  if (status === "REJECTED") return "Recusada";
  return "Pendente";
}

export function AdminReplenishmentRequests({ requests }: { requests: RequestRow[] }) {
  const [rows, setRows] = useState(requests);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/replenishment-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel atualizar a solicitacao.");
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              reviewedAt: "Agora"
            }
          : row
      )
    );
    setFeedback(status === "APPROVED" ? "Solicitacao aprovada com sucesso." : "Solicitacao recusada com sucesso.");
  }

  function downloadHtml(request: RequestRow) {
    const blob = new Blob([request.htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `solicitacao-reposicao-${request.productSku.replaceAll("/", "-")}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Fila de aprovacao</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Revise as sugestoes de reposicao enviadas pelos fornecedores antes de transformar isso em compra real.
            </p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">
            {rows.filter((row) => row.status === "PENDING").length} pendentes
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {rows.length > 0 ? (
            rows.map((request) => (
              <article key={request.id} className="rounded-[1.7rem] border border-slate-100 bg-slate-50/80 p-5 shadow-soft">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-900">{request.productName}</h3>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          request.status === "PENDING" && "bg-amber-50 text-amber-700",
                          request.status === "APPROVED" && "bg-emerald-50 text-emerald-700",
                          request.status === "REJECTED" && "bg-rose-50 text-rose-700"
                        )}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {request.productSku} · {request.supplierName} · enviado por {request.createdBy}
                    </p>
                    <p className="text-xs text-slate-400">
                      Criado em {request.createdAt}
                      {request.reviewedAt ? ` · revisado em ${request.reviewedAt}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadHtml(request)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <Download className="h-4 w-4" />
                      Baixar HTML
                    </button>
                    <button
                      type="button"
                      disabled={isPending || request.status === "APPROVED"}
                      onClick={() => startTransition(() => void updateStatus(request.id, "APPROVED"))}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={isPending || request.status === "REJECTED"}
                      onClick={() => startTransition(() => void updateStatus(request.id, "REJECTED"))}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Recusar
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">Itens sugeridos: {request.items.length}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">Quantidade total: {request.requestedUnits}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">Status: {statusLabel(request.status)}</div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                    {request.reviewedBy ? `Revisado por ${request.reviewedBy}` : "Aguardando analise"}
                  </div>
                </div>

                {request.note ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <strong>Observacao:</strong> {request.note}
                  </div>
                ) : null}

                <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Cor</th>
                        <th className="px-4 py-3 text-left font-semibold">Tamanho</th>
                        <th className="px-4 py-3 text-left font-semibold">SKU</th>
                        <th className="px-4 py-3 text-left font-semibold">Estoque atual</th>
                        <th className="px-4 py-3 text-left font-semibold">Quantidade sugerida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {request.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">{item.color}</td>
                          <td className="px-4 py-3">{item.size}</td>
                          <td className="px-4 py-3">{item.sku}</td>
                          <td className="px-4 py-3">{item.currentStock ?? "-"}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{item.requestedQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              Nenhuma solicitacao de reposicao enviada ainda.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
