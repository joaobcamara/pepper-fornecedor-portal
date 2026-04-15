type CustomerAiContext = {
  name: string;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
};

type OrderAiContext = {
  orderNumber?: string | null;
  ecommerceNumber?: string | null;
  statusLabel?: string | null;
  marketplace?: string | null;
  customerName?: string | null;
  totalAmount?: number | null;
  itemSummary?: string | null;
};

function compact(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function buildCustomerAiPackage(context: CustomerAiContext) {
  const tags = [
    context.name,
    context.city,
    context.state,
    context.email,
    context.phone,
    context.document
  ].filter(Boolean);

  return {
    customerContextAi: compact([
      `Cliente ${context.name}.`,
      context.city || context.state ? `Localizacao ${[context.city, context.state].filter(Boolean).join(" - ")}.` : null,
      context.email ? `Email ${context.email}.` : null,
      context.phone ? `Telefone ${context.phone}.` : null,
      context.document ? `Documento ${context.document}.` : null
    ]),
    searchText: compact(tags).toLowerCase(),
    intentTags: JSON.stringify(tags)
  };
}

export function buildOrderContextAi(context: OrderAiContext) {
  return compact([
    context.orderNumber ? `Pedido ${context.orderNumber}.` : null,
    context.ecommerceNumber ? `Numero ecommerce ${context.ecommerceNumber}.` : null,
    context.statusLabel ? `Status ${context.statusLabel}.` : null,
    context.marketplace ? `Canal ${context.marketplace}.` : null,
    context.customerName ? `Cliente ${context.customerName}.` : null,
    formatCurrency(context.totalAmount) ? `Valor total ${formatCurrency(context.totalAmount)}.` : null,
    context.itemSummary ? `Itens: ${context.itemSummary}.` : null
  ]);
}

export function buildSalesItemContextAi(params: {
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice?: number | null;
}) {
  return compact([
    params.productName,
    params.sku ? `SKU ${params.sku}.` : null,
    `Quantidade ${params.quantity}.`,
    formatCurrency(params.unitPrice) ? `Preco unitario ${formatCurrency(params.unitPrice)}.` : null
  ]);
}
