import { SalesOrderStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { buildCustomerAiPackage, buildOrderContextAi, buildSalesItemContextAi } from "@/lib/sales-ai";
import { normalizeSku } from "@/lib/sku";
import { getTinyContactById, getTinyOrderById, toNumberValue, toStringValue, unwrapTinyItem } from "@/lib/tiny";

const salesWebhookSchema = z.object({
  tipo: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  dados: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      idPedido: z.union([z.string(), z.number()]).optional(),
      idObjeto: z.union([z.string(), z.number()]).optional(),
      numero: z.union([z.string(), z.number()]).optional(),
      numeroEcommerce: z.union([z.string(), z.number()]).optional(),
      idContato: z.union([z.string(), z.number()]).optional(),
      nome: z.string().optional(),
      situacao: z.string().optional(),
      valor: z.union([z.string(), z.number()]).optional(),
      idVendedor: z.union([z.string(), z.number()]).optional()
    })
    .optional()
});

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function parseTinyDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const isoLike = normalized.includes("T") ? normalized : normalized.replace(" ", "T");
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOrderStatus(value?: string | null): SalesOrderStatus {
  const status = value?.trim().toLowerCase();

  if (!status) {
    return SalesOrderStatus.UNKNOWN;
  }

  if (status.includes("cancel")) return SalesOrderStatus.CANCELED;
  if (status.includes("entreg")) return SalesOrderStatus.DELIVERED;
  if (status.includes("exped") || status.includes("envi")) return SalesOrderStatus.SHIPPED;
  if (status.includes("fatur")) return SalesOrderStatus.INVOICED;
  if (status.includes("aprov")) return SalesOrderStatus.APPROVED;
  if (status.includes("abert") || status.includes("pend")) return SalesOrderStatus.OPEN;

  return SalesOrderStatus.UNKNOWN;
}

function extractArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

async function upsertCustomerFromTiny(order: Record<string, unknown>, rawContactId?: string | null) {
  const orderContact = unwrapTinyItem(order.cliente ?? order.contato ?? {});
  const tinyContactId =
    rawContactId ??
    toStringValue(orderContact.id) ??
    toStringValue(order.idContato) ??
    toStringValue(order.id_contato);

  let contact = orderContact;

  if (tinyContactId) {
    try {
      const fetched = await getTinyContactById(tinyContactId);
      if (Object.keys(fetched).length > 0) {
        contact = fetched;
      }
    } catch {
      // segue com os dados do webhook/pedido
    }
  }

  const customerName =
    toStringValue(contact.nome) ??
    toStringValue(order.nomeCliente) ??
    toStringValue(order.nome) ??
    "Cliente sem nome";

  const customerAi = buildCustomerAiPackage({
    name: customerName,
    city: toStringValue(contact.cidade),
    state: toStringValue(contact.uf),
    email: toStringValue(contact.email),
    phone: toStringValue(contact.fone) ?? toStringValue(contact.telefone) ?? toStringValue(contact.celular),
    document: toStringValue(contact.cpf_cnpj) ?? toStringValue(contact.cpfCnpj)
  });

  return prisma.customer.upsert({
    where: {
      tinyContactId: tinyContactId ?? `local-${customerName.toLowerCase().replace(/\s+/g, "-")}`
    },
    update: {
      externalCode: toStringValue(contact.codigo),
      name: customerName,
      tradeName: toStringValue(contact.nomeFantasia),
      personType: toStringValue(contact.tipoPessoa),
      document: toStringValue(contact.cpf_cnpj) ?? toStringValue(contact.cpfCnpj),
      stateRegistration: toStringValue(contact.inscricaoEstadual),
      email: toStringValue(contact.email),
      phone: toStringValue(contact.fone) ?? toStringValue(contact.telefone),
      mobilePhone: toStringValue(contact.celular),
      city: toStringValue(contact.cidade),
      state: toStringValue(contact.uf),
      country: toStringValue(contact.pais),
      zipCode: toStringValue(contact.cep),
      addressLine: toStringValue(contact.endereco),
      addressNumber: toStringValue(contact.numero),
      addressComplement: toStringValue(contact.complemento),
      district: toStringValue(contact.bairro),
      customerContextAi: customerAi.customerContextAi,
      searchText: customerAi.searchText,
      intentTags: customerAi.intentTags,
      rawPayload: JSON.stringify(contact)
    },
    create: {
      tinyContactId: tinyContactId ?? undefined,
      externalCode: toStringValue(contact.codigo),
      name: customerName,
      tradeName: toStringValue(contact.nomeFantasia),
      personType: toStringValue(contact.tipoPessoa),
      document: toStringValue(contact.cpf_cnpj) ?? toStringValue(contact.cpfCnpj),
      stateRegistration: toStringValue(contact.inscricaoEstadual),
      email: toStringValue(contact.email),
      phone: toStringValue(contact.fone) ?? toStringValue(contact.telefone),
      mobilePhone: toStringValue(contact.celular),
      city: toStringValue(contact.cidade),
      state: toStringValue(contact.uf),
      country: toStringValue(contact.pais),
      zipCode: toStringValue(contact.cep),
      addressLine: toStringValue(contact.endereco),
      addressNumber: toStringValue(contact.numero),
      addressComplement: toStringValue(contact.complemento),
      district: toStringValue(contact.bairro),
      customerContextAi: customerAi.customerContextAi,
      searchText: customerAi.searchText,
      intentTags: customerAi.intentTags,
      rawPayload: JSON.stringify(contact)
    }
  });
}

async function resolveCatalogVariantBySku(sku?: string | null) {
  if (!sku) return null;

  const normalized = normalizeSku(sku);
  const catalogVariant = await prisma.catalogVariant.findUnique({
    where: { sku: normalized },
    include: {
      catalogProduct: {
        include: {
          supplierLinks: true
        }
      }
    }
  });

  return catalogVariant;
}

async function persistDailyMetrics(params: {
  date: Date;
  catalogVariantId: string;
  catalogProductId: string;
  supplierIds: string[];
  unitsSold: number;
  grossRevenue: number;
  orderDate: Date | null;
}) {
  const metricDate = startOfDay(params.date);

  await prisma.variantSalesMetricDaily.upsert({
    where: {
      date_variantId: {
        date: metricDate,
        variantId: params.catalogVariantId
      }
    },
    update: {
      unitsSold: { increment: params.unitsSold },
      grossRevenue: { increment: params.grossRevenue },
      orderCount: { increment: 1 },
      lastOrderAt: params.orderDate ?? undefined,
      productId: params.catalogProductId,
      supplierId: params.supplierIds[0] ?? null
    },
    create: {
      date: metricDate,
      variantId: params.catalogVariantId,
      productId: params.catalogProductId,
      supplierId: params.supplierIds[0] ?? null,
      unitsSold: params.unitsSold,
      grossRevenue: params.grossRevenue,
      orderCount: 1,
      lastOrderAt: params.orderDate ?? undefined
    }
  });

  await prisma.productSalesMetricDaily.upsert({
    where: {
      date_catalogProductId: {
        date: metricDate,
        catalogProductId: params.catalogProductId
      }
    },
    update: {
      unitsSold: { increment: params.unitsSold },
      grossRevenue: { increment: params.grossRevenue },
      orderCount: { increment: 1 },
      lastOrderAt: params.orderDate ?? undefined,
      supplierId: params.supplierIds[0] ?? null
    },
    create: {
      date: metricDate,
      catalogProductId: params.catalogProductId,
      supplierId: params.supplierIds[0] ?? null,
      unitsSold: params.unitsSold,
      grossRevenue: params.grossRevenue,
      orderCount: 1,
      lastOrderAt: params.orderDate ?? undefined
    }
  });

  for (const supplierId of params.supplierIds) {
    await prisma.supplierSalesMetricDaily.upsert({
      where: {
        date_supplierId: {
          date: metricDate,
          supplierId
        }
      },
      update: {
        unitsSold: { increment: params.unitsSold },
        grossRevenue: { increment: params.grossRevenue },
        orderCount: { increment: 1 },
        lastOrderAt: params.orderDate ?? undefined
      },
      create: {
        date: metricDate,
        supplierId,
        unitsSold: params.unitsSold,
        grossRevenue: params.grossRevenue,
        orderCount: 1,
        lastOrderAt: params.orderDate ?? undefined
      }
    });
  }
}

async function persistSalesOrder(order: Record<string, unknown>, rawPayload: unknown, eventType: string) {
  const tinyOrderId =
    toStringValue(order.id) ??
    toStringValue(order.idPedido) ??
    toStringValue(order.id_pedido);

  if (!tinyOrderId) {
    throw new Error("Pedido sem id Tiny.");
  }

  const customer = await upsertCustomerFromTiny(
    order,
    toStringValue(order.idContato) ?? toStringValue(order.id_contato)
  );

  const orderDate =
    parseTinyDate(toStringValue(order.dataPedido)) ??
    parseTinyDate(toStringValue(order.data_pedido)) ??
    parseTinyDate(toStringValue(order.data));

  const itemEntries = extractArray(order, ["itens", "itensPedido", "produtos"]);

  const itemSummaries: string[] = [];

  const salesOrder = await prisma.salesOrder.upsert({
    where: { tinyOrderId },
    update: {
      tinyContactId: customer.tinyContactId,
      number: toStringValue(order.numero) ?? toStringValue(order.numeroPedido),
      ecommerceNumber: toStringValue(order.numeroEcommerce),
      channel: toStringValue(order.canalVenda),
      marketplace: toStringValue(order.nomeEcommerce) ?? toStringValue(order.ecommerce),
      status: normalizeOrderStatus(toStringValue(order.situacao)),
      statusLabel: toStringValue(order.situacao),
      orderDate,
      expectedDate: parseTinyDate(toStringValue(order.dataPrevista)),
      invoicedAt: parseTinyDate(toStringValue(order.dataFaturamento)),
      shippedAt: parseTinyDate(toStringValue(order.dataExpedicao)),
      deliveredAt: parseTinyDate(toStringValue(order.dataEntrega)),
      canceledAt: parseTinyDate(toStringValue(order.dataCancelamento)),
      totalAmount: toNumberValue(order.valorTotal) ?? toNumberValue(order.total),
      shippingAmount: toNumberValue(order.valorFrete),
      discountAmount: toNumberValue(order.desconto),
      customerId: customer.id,
      customerContextAi: customer.customerContextAi,
      rawPayload: JSON.stringify(order)
    },
    create: {
      tinyOrderId,
      tinyContactId: customer.tinyContactId,
      number: toStringValue(order.numero) ?? toStringValue(order.numeroPedido),
      ecommerceNumber: toStringValue(order.numeroEcommerce),
      channel: toStringValue(order.canalVenda),
      marketplace: toStringValue(order.nomeEcommerce) ?? toStringValue(order.ecommerce),
      status: normalizeOrderStatus(toStringValue(order.situacao)),
      statusLabel: toStringValue(order.situacao),
      orderDate,
      expectedDate: parseTinyDate(toStringValue(order.dataPrevista)),
      invoicedAt: parseTinyDate(toStringValue(order.dataFaturamento)),
      shippedAt: parseTinyDate(toStringValue(order.dataExpedicao)),
      deliveredAt: parseTinyDate(toStringValue(order.dataEntrega)),
      canceledAt: parseTinyDate(toStringValue(order.dataCancelamento)),
      totalAmount: toNumberValue(order.valorTotal) ?? toNumberValue(order.total),
      shippingAmount: toNumberValue(order.valorFrete),
      discountAmount: toNumberValue(order.desconto),
      customerId: customer.id,
      customerContextAi: customer.customerContextAi,
      rawPayload: JSON.stringify(order)
    }
  });

  await prisma.salesOrderStatusHistory.create({
    data: {
      salesOrderId: salesOrder.id,
      status: normalizeOrderStatus(toStringValue(order.situacao)),
      statusLabel: toStringValue(order.situacao),
      source: eventType,
      rawPayload: JSON.stringify(rawPayload)
    }
  });

  await prisma.salesOrderItem.deleteMany({
    where: { salesOrderId: salesOrder.id }
  });

  for (const itemEntry of itemEntries) {
    const item = unwrapTinyItem(itemEntry);
    const sku = normalizeSku(
      toStringValue(item.codigo) ??
        toStringValue(item.sku) ??
        toStringValue(item.codigoSku) ??
        ""
    );
    const quantity = Number(toNumberValue(item.quantidade) ?? 0);
    const unitPrice = toNumberValue(item.valorUnitario) ?? toNumberValue(item.valor_unitario);
    const totalPrice = toNumberValue(item.valorTotal) ?? (unitPrice != null ? unitPrice * quantity : null);
    const discountAmount = toNumberValue(item.desconto);
    const productName = toStringValue(item.descricao) ?? toStringValue(item.nome) ?? "Item sem descricao";

    const catalogVariant = await resolveCatalogVariantBySku(sku);
    const productId = catalogVariant?.sourceProductId ?? null;
    const skuParent = catalogVariant?.catalogProduct.skuParent ?? null;
    const supplierIds = catalogVariant?.catalogProduct.supplierLinks.map((link) => link.supplierId) ?? [];

    itemSummaries.push(`${productName} x${quantity}`);

    await prisma.salesOrderItem.create({
      data: {
        salesOrderId: salesOrder.id,
        tinyOrderItemId: toStringValue(item.id),
        sku,
        skuParent,
        productName,
        quantity,
        unitPrice,
        totalPrice,
        discountAmount,
        variantId: catalogVariant?.id ?? null,
        productId,
        salesContextAi: buildSalesItemContextAi({
          productName,
          sku,
          quantity,
          unitPrice
        }),
        rawPayload: JSON.stringify(item)
      }
    });

    if (catalogVariant && quantity > 0) {
      await persistDailyMetrics({
        date: orderDate ?? new Date(),
        catalogVariantId: catalogVariant.id,
        catalogProductId: catalogVariant.catalogProductId,
        supplierIds,
        unitsSold: quantity,
        grossRevenue: totalPrice ?? 0,
        orderDate
      });
    }
  }

  const orderContextAi = buildOrderContextAi({
    orderNumber: salesOrder.number,
    ecommerceNumber: salesOrder.ecommerceNumber,
    statusLabel: salesOrder.statusLabel,
    marketplace: salesOrder.marketplace,
    customerName: customer.name,
    totalAmount: salesOrder.totalAmount,
    itemSummary: itemSummaries.join(", ")
  });

  await prisma.salesOrder.update({
    where: { id: salesOrder.id },
    data: {
      orderContextAi
    }
  });

  return {
    salesOrderId: salesOrder.id,
    tinyOrderId,
    itemCount: itemEntries.length,
    customerId: customer.id
  };
}

async function logSalesWebhook(params: {
  status: string;
  eventType: string;
  tinyOrderId?: string | null;
  payload: unknown;
  errorMessage?: string | null;
  processedAt?: Date | null;
}) {
  await prisma.tinyWebhookLog.create({
    data: {
      webhookType: "sales",
      eventType: params.eventType,
      tinyProductId: params.tinyOrderId ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      payload: JSON.stringify(params.payload),
      processedAt: params.processedAt ?? null
    }
  });
}

export async function handleTinySalesWebhook(rawPayload: unknown) {
  const parsed = salesWebhookSchema.safeParse(rawPayload);

  if (!parsed.success) {
    await logSalesWebhook({
      status: "invalid_payload",
      eventType: "unknown",
      payload: rawPayload,
      errorMessage: "Payload de vendas invalido."
    });
    throw new Error("Payload de vendas invalido.");
  }

  const eventType = parsed.data.tipo?.trim() ?? "sales";
  const orderId =
    parsed.data.dados?.idPedido ??
    parsed.data.dados?.idObjeto ??
    parsed.data.dados?.id ??
    parsed.data.id;

  if (!orderId) {
    await logSalesWebhook({
      status: "missing_order_id",
      eventType,
      payload: rawPayload,
      errorMessage: "Webhook sem id de pedido."
    });
    throw new Error("Webhook sem id de pedido.");
  }

  const order = await getTinyOrderById(String(orderId));
  const result = await persistSalesOrder(order, rawPayload, eventType);
  const processedAt = new Date();

  await logSalesWebhook({
    status: "processed",
    eventType,
    tinyOrderId: result.tinyOrderId,
    payload: rawPayload,
    processedAt
  });

  return {
    ok: true,
    ...result
  };
}
