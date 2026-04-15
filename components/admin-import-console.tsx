"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, LoaderCircle, Search } from "lucide-react";
import { formatVariantLabel, getColorLabel, getSizeLabel } from "@/lib/sku";
import { cn } from "@/lib/cn";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type InspectionResult = {
  searchedSku: string;
  parent: {
    id: string;
    sku: string;
    name: string;
    imageUrl?: string | null;
  };
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    sizeCode?: string | null;
    colorCode?: string | null;
    quantity: number | null;
    stockStatus: "ok" | "low" | "critical" | "unknown";
  }>;
  suggestions: Array<{
    id: string;
    sku: string;
    name: string;
  }>;
};

type ImportResult = {
  batchId: string;
  importedVariants: number;
  parentSku: string;
};

export function AdminImportConsole({
  suppliers,
  tinyConfigured
}: {
  suppliers: SupplierOption[];
  tinyConfigured: boolean;
}) {
  const [sku, setSku] = useState("01-2504");
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(suppliers[0] ? [suppliers[0].id] : []);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInspecting, startInspectTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();

  const groupedRows = useMemo(() => {
    if (!inspection) {
      return [];
    }

    const groups = new Map<
      string,
      Array<{
        sku: string;
        sizeLabel: string;
        quantity: number | null;
        stockStatus: "ok" | "low" | "critical" | "unknown";
      }>
    >();

    for (const variant of inspection.variants) {
      const colorLabel = getColorLabel(variant.colorCode);
      const row = groups.get(colorLabel) ?? [];
      row.push({
        sku: variant.sku,
        sizeLabel: getSizeLabel(variant.sizeCode),
        quantity: variant.quantity,
        stockStatus: variant.stockStatus
      });
      groups.set(colorLabel, row);
    }

    return Array.from(groups.entries()).map(([color, items]) => ({
      color,
      items: items.sort((left, right) => left.sizeLabel.localeCompare(right.sizeLabel, "pt-BR"))
    }));
  }, [inspection]);

  async function inspectSku() {
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/tiny/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sku })
    });

    const payload = (await response.json()) as InspectionResult & { error?: string };

    if (!response.ok) {
      setInspection(null);
      setError(payload.error ?? "Falha ao consultar o Tiny.");
      return;
    }

    setInspection(payload);
    setFeedback("Produto inspecionado com sucesso. Revise as filhas antes de importar.");
  }

  async function importSku() {
    if (!inspection) {
      return;
    }

    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/tiny/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sku: inspection.parent.sku,
        supplierIds: selectedSuppliers
      })
    });

    const payload = (await response.json()) as ImportResult & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Falha ao importar o produto.");
      return;
    }

    setFeedback(`Importação concluída. ${payload.importedVariants} variações vinculadas ao SKU ${payload.parentSku}.`);
  }

  function toggleSupplier(supplierId: string) {
    setSelectedSuppliers((current) =>
      current.includes(supplierId) ? current.filter((item) => item !== supplierId) : [...current, supplierId]
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d27a4f]">Importação Tiny</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Buscar por SKU e revisar pai + filhas</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            A busca prioriza SKU completo, valida o match exato, resolve a hierarquia pai/filha e já traz a grade cor x
            tamanho pronta para revisão.
          </p>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
            tinyConfigured
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {tinyConfigured ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {tinyConfigured ? "Tiny configurado no .env" : "TINY_API_TOKEN ainda não configurado"}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="rounded-[1.7rem] border border-[#f3d8c7] bg-[#fff9f5] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <label className="flex-1">
                <span className="mb-2 block text-sm font-semibold text-slate-700">SKU para importar</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Ex.: 01-2504 ou 01-2504-22-01"
                  />
                </div>
              </label>

              <button
                type="button"
                disabled={isInspecting || !tinyConfigured}
                onClick={() => startInspectTransition(() => void inspectSku())}
                className="inline-flex h-fit items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInspecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
                Inspecionar no Tiny
              </button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-700">Vincular a fornecedores</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suppliers.map((supplier) => {
                  const active = selectedSuppliers.includes(supplier.id);
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => toggleSupplier(supplier.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                        active
                          ? "border-[#f2b79a] bg-[#fff1e7] text-[#a94c25]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#f2b79a]"
                      )}
                    >
                      {supplier.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {feedback ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedback}
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}
          </div>

          {inspection ? (
            <div className="rounded-[1.7rem] border border-white/70 bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Produto pai</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{inspection.parent.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{inspection.parent.sku}</p>
                </div>

                <button
                  type="button"
                  disabled={isImporting || !tinyConfigured}
                  onClick={() => startImportTransition(() => void importSku())}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#eb6232] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ffb290] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isImporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Importar para o sistema
                </button>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-[#f4ddd0]">
                <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.9fr] bg-[#fff8f4] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <div className="px-4 py-3">Variação</div>
                  <div className="px-4 py-3">Cor - tamanho</div>
                  <div className="px-4 py-3 text-center">Estoque</div>
                  <div className="px-4 py-3 text-center">Status</div>
                </div>
                {inspection.variants.map((variant) => (
                  <div key={variant.id} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.9fr] border-t border-[#f8e7dc] bg-white">
                    <div className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{variant.sku}</p>
                      <p className="text-sm text-slate-500">{variant.name}</p>
                    </div>
                    <div className="px-4 py-3 text-sm text-slate-600">
                      <span className="inline-block whitespace-nowrap">
                        {formatVariantLabel(getColorLabel(variant.colorCode), getSizeLabel(variant.sizeCode))}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-center text-sm font-semibold text-slate-900">
                      {variant.quantity === null ? "Não importado" : variant.quantity}
                    </div>
                    <div className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          variant.stockStatus === "critical" && "bg-rose-50 text-rose-700",
                          variant.stockStatus === "low" && "bg-amber-50 text-amber-700",
                          variant.stockStatus === "ok" && "bg-emerald-50 text-emerald-700",
                          variant.stockStatus === "unknown" && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {variant.stockStatus === "critical"
                          ? "Crítico"
                          : variant.stockStatus === "low"
                            ? "Baixo"
                            : variant.stockStatus === "ok"
                              ? "OK"
                              : "Sem leitura"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.7rem] border border-white/70 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold text-slate-900">Grade cor x tamanho</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ao localizar o pai e suas filhas, organizamos a leitura por grade para facilitar revisão e preparar a
              ordem de compra futura.
            </p>

            <div className="mt-5 space-y-3">
              {groupedRows.length > 0 ? (
                groupedRows.map((row) => (
                  <div key={row.color} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{row.color}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.items.map((item) => (
                        <div key={item.sku} className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">
                          <span className="font-semibold text-slate-900">{item.sizeLabel}</span>
                          <span className="ml-2 text-slate-500">
                            {item.quantity === null ? "sem leitura" : item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm leading-6 text-slate-500">
                  Assim que você inspecionar um SKU, a grade aparece aqui com a hierarquia pai/filha preservada.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-[#f2d7c7] bg-[#fff8f4] p-5 shadow-soft">
            <p className="text-sm font-semibold text-slate-900">Boas práticas já aplicadas</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>SKU é usado para localizar e o ID do Tiny fica reservado para operação de estoque.</li>
              <li>Match exato por SKU é obrigatório antes da importação para evitar ambiguidade.</li>
              <li>Estoque ausente não vira zero automaticamente; permanece como leitura não importada.</li>
              <li>Pai e filhas entram juntos no sistema para manter a grade consistente desde o cadastro.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
