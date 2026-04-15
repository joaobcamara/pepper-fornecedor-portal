"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, PackagePlus, X } from "lucide-react";
import { cn } from "@/lib/cn";

type SupplierOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductOption = {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  variants: Array<{
    id: string;
    sku: string;
    color: string;
    size: string;
    unitCost: number;
  }>;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  status: string;
  statusLabel: string;
  adminNote: string | null;
  supplierNote: string | null;
  supplierHasNoStock: boolean;
  createdAt: string;
  respondedAt: string | null;
  shippedAt: string | null;
  expectedShipDate: string | null;
  estimatedTotalCost: number;
  estimatedTotalCostLabel: string;
  confirmedTotalCost: number;
  confirmedTotalCostLabel: string;
  createdBy: string;
  updatedBy: string | null;
  hasRomaneio: boolean;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    kind: string;
    createdAt: string;
  }>;
  items: Array<{
    id: string;
    sku: string;
    color: string;
    size: string;
    productName: string;
    requestedQuantity: number;
    fulfilledQuantity: number;
    itemStatus: string;
    itemStatusLabel: string;
    unitCost: number;
    requestedTotalCost: number;
    confirmedUnitCost: number | null;
    confirmedTotalCost: number;
    supplierItemNote: string | null;
  }>;
};

function currency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function statusClassName(status: string) {
  if (status === "SHIPPED") return "bg-emerald-100 text-emerald-700";
  if (status === "IN_PREPARATION") return "bg-sky-100 text-sky-700";
  if (status === "PARTIALLY_FULFILLED") return "bg-amber-100 text-amber-700";
  if (status === "NO_STOCK") return "bg-rose-100 text-rose-700";
  if (status === "SUPPLIER_REVIEWED") return "bg-violet-100 text-violet-700";
  return "bg-[#fff1e7] text-[#a94b25]";
}

export function AdminSupplierOrdersManager({
  suppliers,
  products,
  orders
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
  orders: OrderRow[];
}) {
  const [rows, setRows] = useState(orders);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id ?? "");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  const availableProducts = useMemo(
    () => products.filter((product) => product.supplierId === selectedSupplierId),
    [products, selectedSupplierId]
  );

  const selectedProduct = useMemo(
    () => availableProducts.find((product) => product.id === selectedProductId) ?? null,
    [availableProducts, selectedProductId]
  );

  const estimatedTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.variants.reduce((sum, variant) => sum + (quantities[variant.sku] ?? 0) * variant.unitCost, 0);
  }, [quantities, selectedProduct]);

  const selectedOrder = rows.find((row) => row.id === selectedOrderId) ?? null;

  async function createOrder() {
    setFeedback(null);
    setError(null);

    if (!selectedSupplierId || !selectedProduct) {
      setError("Selecione o fornecedor e o produto antes de criar o pedido.");
      return;
    }

    const items = selectedProduct.variants
      .map((variant) => ({
        catalogVariantId: variant.id,
        sku: variant.sku,
        productName: selectedProduct.productName,
        color: variant.color,
        size: variant.size,
        requestedQuantity: Number(quantities[variant.sku] ?? 0),
        unitCost: variant.unitCost
      }))
      .filter((item) => item.requestedQuantity > 0);

    if (items.length === 0) {
      setError("Informe pelo menos uma quantidade antes de criar o pedido.");
      return;
    }

    const response = await fetch("/api/admin/supplier-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: selectedSupplierId,
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        productSku: selectedProduct.productSku,
        imageUrl: selectedProduct.imageUrl,
        adminNote,
        items
      })
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Nao foi possivel criar o pedido agora.");
      return;
    }

    setFeedback("Pedido ao fornecedor criado com sucesso.");
    setSelectedProductId("");
    setAdminNote("");
    setQuantities({});
    window.location.reload();
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Criar pedido ao fornecedor</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Monte o pedido por grade, acompanhe o valor estimado e envie para o fornecedor responder com estoque, preparo e romaneio.
            </p>
          </div>
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-semibold text-[#a94b25]">
            {rows.filter((item) => item.status === "AWAITING_SUPPLIER").length} aguardando resposta
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.34fr_0.66fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Fornecedor</span>
              <select
                value={selectedSupplierId}
                onChange={(event) => {
                  setSelectedSupplierId(event.target.value);
                  setSelectedProductId("");
                  setQuantities({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">Selecione</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Produto</span>
              <select
                value={selectedProductId}
                onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  setQuantities({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">Selecione</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName} ({product.productSku})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Observacao do admin</span>
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                placeholder="Ex.: priorizar grade da vitrine e informar disponibilidade real do que pode seguir primeiro."
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Valor estimado</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{currency(estimatedTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Itens com quantidade</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {Object.values(quantities).filter((value) => value > 0).length}
                </p>
              </div>
            </div>

            {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <button
              type="button"
              onClick={() => startTransition(() => void createOrder())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {isPending ? "Criando..." : "Criar pedido"}
            </button>
          </div>

          <div className="rounded-[1.8rem] border border-slate-100 bg-slate-50/80 p-4">
            {selectedProduct ? (
              <div>
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white bg-white">
                    <Image src={selectedProduct.imageUrl ?? "/brand/pepper-logo.png"} alt={selectedProduct.productName} fill className="object-contain p-2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedProduct.productName}</p>
                    <p className="text-xs text-slate-500">{selectedProduct.productSku}</p>
                    <p className="mt-2 text-xs text-slate-500">{selectedProduct.variants.length} variacoes disponiveis para o pedido.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selectedProduct.variants.map((variant) => (
                    <div key={variant.sku} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {variant.color} - {variant.size}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">{variant.sku}</p>
                      <p className="mt-3 text-xs text-slate-500">Custo base: {currency(variant.unitCost)}</p>
                      <input
                        type="number"
                        min={0}
                        value={quantities[variant.sku] ?? ""}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [variant.sku]: Number(event.target.value || 0)
                          }))
                        }
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm outline-none"
                        placeholder="Qtd."
                      />
                      <p className="mt-3 text-xs font-semibold text-slate-600">
                        Total estimado: {currency((quantities[variant.sku] ?? 0) * variant.unitCost)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[18rem] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
                Selecione fornecedor e produto para montar o pedido por variacao.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Pedidos anteriores</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Clique em um card para abrir o resumo com solicitado x atendido, observacoes e romaneio anexado.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{rows.length} pedidos</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className="rounded-[1.6rem] border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">{order.supplierName}</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", statusClassName(order.status))}>
                  {order.statusLabel}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{order.productName}</p>
              <p className="mt-1 text-xs text-slate-500">{order.createdAt}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Previsto {order.estimatedTotalCostLabel}</div>
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">Confirmado {order.confirmedTotalCostLabel}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d27a4f]">Resumo do pedido</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedOrder.orderNumber}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedOrder.supplierName} • {selectedOrder.productName}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrderId(null)} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Status: {selectedOrder.statusLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Previsto: {selectedOrder.estimatedTotalCostLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Confirmado: {selectedOrder.confirmedTotalCostLabel}</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {selectedOrder.expectedShipDate ? `Prev. envio ${selectedOrder.expectedShipDate}` : "Sem previsao"}
              </div>
            </div>

            {selectedOrder.adminNote ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Observacao do admin:</strong> {selectedOrder.adminNote}
              </div>
            ) : null}

            {selectedOrder.supplierNote ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Retorno do fornecedor:</strong> {selectedOrder.supplierNote}
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Cor</th>
                    <th className="px-4 py-3 text-left font-semibold">Tamanho</th>
                    <th className="px-4 py-3 text-left font-semibold">Solicitado</th>
                    <th className="px-4 py-3 text-left font-semibold">Atendido</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.color}</td>
                      <td className="px-4 py-3">{item.size}</td>
                      <td className="px-4 py-3">{item.requestedQuantity}</td>
                      <td className="px-4 py-3">{item.fulfilledQuantity}</td>
                      <td className="px-4 py-3">{item.itemStatusLabel}</td>
                      <td className="px-4 py-3">{currency(item.confirmedTotalCost || item.requestedTotalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedOrder.attachments.length > 0 ? (
              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Romaneios e anexos</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {attachment.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
