import { SalesOrderStatus } from "@prisma/client";
import { z } from "zod";

import {
  beginFoundationWebhookProcessing,
  createFoundationSyncRun,
  finalizeFoundationSyncRun,
  finalizeFoundationWebhookProcessing
} from "@/lib/foundation-event-orchestrator";
import { tryHydrateFoundationCatalogBySku } from "@/lib/foundation-catalog-hydration";
import { prisma } from "@/lib/prisma";
import { buildCustomerAiPackage, buildOrderContextAi, buildSalesItemContextAi } from "@/lib/sales-ai";
import { normalizeSku } from "@/lib/sku";
import {
  getConfiguredTinyAccounts,
  getTinyAccountLabel,
  type TinyAccountKey,
  getTinyContactById,
  getTinyOrderById,
  isTinyConfigured,
  searchTinyOrdersByDateRange,
  toNumberValue,
  toStringValue,
  unwrapTinyItem
} from "@/lib/tiny";

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

export type TinyCommercialWebhookKind = "sales" | "orders";

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function startOfNextDay(date: Date) {
  const day = startOfDay(date);
  day.setDate(day.getDate() + 1);
  return day;
}

function parseTinyDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const brDateMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brDateMatch) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = brDateMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoLike = normalized.includes("T") ? normalized : normalized.replace(" ", "T");
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildScopedTinyId(accountKey: TinyAccountKey, value?: string | null) {
  const normalized = toStringValue(value);
  return normalized ? `${accountKey}:${normalized}` : null;
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

async function upsertCustomerFromTiny(
  order: Record<string, unknown>,
  accountKey: TinyAccountKey,
  rawContactId?: string | null
) {
  const orderContact = unwrapTinyItem(order.cliente ?? order.contato ?? {});
  const rawTinyContactId =
    rawContactId ??
    toStringValue(orderContact.id) ??
    toStringValue(order.idContato) ??
    toStringValue(order.id_contato);
  const tinyContactId = buildScopedTinyId(accountKey, rawTinyContactId);

  let contact = orderContact;

  if (rawTinyContactId) {
    try {
      const fetched = await getTinyContactById(rawTinyContactId, accountKey);
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
  let catalogVariant = await prisma.catalogVariant.findUnique({
    where: { sku: normalized },
    include: {
      catalogProduct: {
        include: {
          supplierLinks: true
        }
      }
    }
  });

  if (!catalogVariant) {
    await tryHydrateFoundationCatalogBySku({
      sku: normalized,
      triggerType: "sales_webhook_catalog_hydration",
      reason: "missing_catalog_variant"
    });

    catalogVariant = await prisma.catalogVariant.findUnique({
      where: { sku: normalized },
      include: {
        catalogProduct: {
          include: {
            supplierLinks: true
          }
        }
      }
    });
  } else {
    await tryHydrateFoundationCatalogBySku({
      sku: normalized,
      triggerType: "sales_webhook_catalog_media",
      reason: "ensure_media"
    });
  }

  return catalogVariant;
}

type MetricAccumulator = {
  date: Date;
  unitsSold: number;
  grossRevenue: number;
  orderIds: Set<string>;
  lastOrderAt: Date | null;
};

async function rebuildSalesMetricsForDates(dates: Array<Date | null | undefined>) {
  const metricDates = Array.from(
    new Set(
      dates
        .filter((value): value is Date => Boolean(value))
        .map((value) => startOfDay(value).getTime())
    )
  ).map((time) => new Date(time));

  if (metricDates.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.variantSalesMetricDaily.deleteMany({
      where: {
        date: {
          in: metricDates
        }
      }
    }),
    prisma.productSalesMetricDaily.deleteMany({
      where: {
        date: {
          in: metricDates
        }
      }
    }),
    prisma.supplierSalesMetricDaily.deleteMany({
      where: {
        date: {
          in: metricDates
        }
      }
    })
  ]);

  const minDate = metricDates.reduce((earliest, current) => (current < earliest ? current : earliest), metricDates[0]);
  const maxDate = metricDates.reduce((latest, current) => (current > latest ? current : latest), metricDates[0]);
  const maxExclusive = startOfNextDay(maxDate);

  const orders = await prisma.salesOrder.findMany({
    where: {
      orderDate: {
        gte: minDate,
        lt: maxExclusive
      },
      status: {
        not: SalesOrderStatus.CANCELED
      }
    },
    select: {
      id: true,
      orderDate: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          variantId: true
        }
      }
    }
  });

  const variantIds = Array.from(
    new Set(
      orders.flatMap((order) => order.items.map((item) => item.variantId).filter(Boolean))
    )
  ) as string[];

  if (variantIds.length === 0) {
    return;
  }

  const variants = await prisma.catalogVariant.findMany({
    where: {
      id: {
        in: variantIds
      }
    },
    select: {
      id: true,
      catalogProductId: true,
      catalogProduct: {
        select: {
          supplierLinks: {
            where: {
              active: true
            },
            select: {
              supplierId: true
            }
          }
        }
      }
    }
  });

  const variantMap = new Map(
    variants.map((variant) => [
      variant.id,
      {
        catalogProductId: variant.catalogProductId,
        supplierIds: variant.catalogProduct.supplierLinks.map((link) => link.supplierId)
      }
    ])
  );

  const variantMetrics = new Map<
    string,
    MetricAccumulator & {
      variantId: string;
      productId: string;
      supplierId: string | null;
    }
  >();
  const productMetrics = new Map<
    string,
    MetricAccumulator & {
      catalogProductId: string;
      supplierId: string | null;
    }
  >();
  const supplierMetrics = new Map<
    string,
    MetricAccumulator & {
      supplierId: string;
    }
  >();

  for (const order of orders) {
    if (!order.orderDate) {
      continue;
    }

    const metricDate = startOfDay(order.orderDate);

    for (const item of order.items) {
      if (!item.variantId) {
        continue;
      }

      const variant = variantMap.get(item.variantId);
      if (!variant) {
        continue;
      }

      const grossRevenue = item.totalPrice ?? (item.unitPrice ?? 0) * item.quantity;
      const variantKey = `${metricDate.toISOString()}::${item.variantId}`;
      const currentVariantMetric =
        variantMetrics.get(variantKey) ??
        ({
          variantId: item.variantId,
          productId: variant.catalogProductId,
          supplierId: variant.supplierIds[0] ?? null,
          date: metricDate,
          unitsSold: 0,
          grossRevenue: 0,
          orderIds: new Set<string>(),
          lastOrderAt: null
        } satisfies MetricAccumulator & {
          variantId: string;
          productId: string;
          supplierId: string | null;
        });

      currentVariantMetric.unitsSold += item.quantity;
      currentVariantMetric.grossRevenue += grossRevenue;
      currentVariantMetric.orderIds.add(order.id);
      if (!currentVariantMetric.lastOrderAt || order.orderDate > currentVariantMetric.lastOrderAt) {
        currentVariantMetric.lastOrderAt = order.orderDate;
      }
      variantMetrics.set(variantKey, currentVariantMetric);

      const productKey = `${metricDate.toISOString()}::${variant.catalogProductId}`;
      const currentProductMetric =
        productMetrics.get(productKey) ??
        ({
          catalogProductId: variant.catalogProductId,
          supplierId: variant.supplierIds[0] ?? null,
          date: metricDate,
          unitsSold: 0,
          grossRevenue: 0,
          orderIds: new Set<string>(),
          lastOrderAt: null
        } satisfies MetricAccumulator & {
          catalogProductId: string;
          supplierId: string | null;
        });

      currentProductMetric.unitsSold += item.quantity;
      currentProductMetric.grossRevenue += grossRevenue;
      currentProductMetric.orderIds.add(order.id);
      if (!currentProductMetric.lastOrderAt || order.orderDate > currentProductMetric.lastOrderAt) {
        currentProductMetric.lastOrderAt = order.orderDate;
      }
      productMetrics.set(productKey, currentProductMetric);

      for (const supplierId of variant.supplierIds) {
        const supplierKey = `${metricDate.toISOString()}::${supplierId}`;
        const currentSupplierMetric =
          supplierMetrics.get(supplierKey) ??
          ({
            supplierId,
            date: metricDate,
            unitsSold: 0,
            grossRevenue: 0,
            orderIds: new Set<string>(),
            lastOrderAt: null
          } satisfies MetricAccumulator & { supplierId: string });

        currentSupplierMetric.unitsSold += item.quantity;
        currentSupplierMetric.grossRevenue += grossRevenue;
        currentSupplierMetric.orderIds.add(order.id);
        if (!currentSupplierMetric.lastOrderAt || order.orderDate > currentSupplierMetric.lastOrderAt) {
          currentSupplierMetric.lastOrderAt = order.orderDate;
        }
        supplierMetrics.set(supplierKey, currentSupplierMetric);
      }
    }
  }

  await prisma.$transaction([
    prisma.variantSalesMetricDaily.createMany({
      data: Array.from(variantMetrics.values()).map((metric) => ({
        date: metric.date,
        variantId: metric.variantId,
        productId: metric.productId,
        supplierId: metric.supplierId,
        unitsSold: metric.unitsSold,
        grossRevenue: metric.grossRevenue,
        orderCount: metric.orderIds.size,
        lastOrderAt: metric.lastOrderAt ?? undefined
      }))
    }),
    prisma.productSalesMetricDaily.createMany({
      data: Array.from(productMetrics.values()).map((metric) => ({
        date: metric.date,
        catalogProductId: metric.catalogProductId,
        supplierId: metric.supplierId,
        unitsSold: metric.unitsSold,
        grossRevenue: metric.grossRevenue,
        orderCount: metric.orderIds.size,
        lastOrderAt: metric.lastOrderAt ?? undefined
      }))
    }),
    prisma.supplierSalesMetricDaily.createMany({
      data: Array.from(supplierMetrics.values()).map((metric) => ({
        date: metric.date,
        supplierId: metric.supplierId,
        unitsSold: metric.unitsSold,
        grossRevenue: metric.grossRevenue,
        orderCount: metric.orderIds.size,
        lastOrderAt: metric.lastOrderAt ?? undefined
      }))
    })
  ]);
}

async function persistSalesOrder(order: Record<string, unknown>, rawPayload: unknown, eventType: string) {
  return persistSalesOrderFromAccount(order, rawPayload, eventType, "pepper");
}

async function persistSalesOrderFromAccount(
  order: Record<string, unknown>,
  rawPayload: unknown,
  eventType: string,
  accountKey: TinyAccountKey,
  options?: {
    skipMetricRebuild?: boolean;
  }
) {
  const rawTinyOrderId =
    toStringValue(order.id) ??
    toStringValue(order.idPedido) ??
    toStringValue(order.id_pedido);
  const tinyOrderId = buildScopedTinyId(accountKey, rawTinyOrderId);

  if (!tinyOrderId) {
    throw new Error("Pedido sem id Tiny.");
  }

  const existingOrder = await prisma.salesOrder.findUnique({
    where: {
      tinyOrderId
    },
    select: {
      id: true,
      orderDate: true,
      statusHistory: {
        orderBy: {
          changedAt: "desc"
        },
        take: 1
      }
    }
  });

  const customer = await upsertCustomerFromTiny(
    order,
    accountKey,
    toStringValue(order.idContato) ?? toStringValue(order.id_contato)
  );

  const orderDate =
    parseTinyDate(toStringValue(order.dataPedido)) ??
    parseTinyDate(toStringValue(order.data_pedido)) ??
    parseTinyDate(toStringValue(order.data));

  const itemEntries = extractArray(order, ["itens", "itensPedido", "produtos"]);
  const normalizedStatus = normalizeOrderStatus(toStringValue(order.situacao));
  const statusLabel = toStringValue(order.situacao);

  const itemSummaries: string[] = [];

  const salesOrder = await prisma.salesOrder.upsert({
    where: { tinyOrderId },
    update: {
      tinyContactId: customer.tinyContactId,
      number: toStringValue(order.numero) ?? toStringValue(order.numeroPedido),
      ecommerceNumber:
        toStringValue(order.numeroEcommerce) ??
        toStringValue(order.numero_ecommerce) ??
        toStringValue(order.numero_ordem_compra) ??
        toStringValue(unwrapTinyItem(order.ecommerce).numeroPedidoEcommerce),
      channel: toStringValue(order.canalVenda),
      marketplace:
        toStringValue(order.nomeEcommerce) ??
        toStringValue(unwrapTinyItem(order.ecommerce).nomeEcommerce) ??
        toStringValue(unwrapTinyItem(order.ecommerce).nome) ??
        toStringValue(order.ecommerce) ??
        getTinyAccountLabel(accountKey),
      status: normalizedStatus,
      statusLabel,
      orderDate,
      expectedDate: parseTinyDate(toStringValue(order.dataPrevista) ?? toStringValue(order.data_prevista)),
      invoicedAt: parseTinyDate(toStringValue(order.dataFaturamento) ?? toStringValue(order.data_faturamento)),
      shippedAt: parseTinyDate(
        toStringValue(order.dataExpedicao) ?? toStringValue(order.data_envio) ?? toStringValue(order.dataEnvio)
      ),
      deliveredAt: parseTinyDate(toStringValue(order.dataEntrega) ?? toStringValue(order.data_entrega)),
      canceledAt: parseTinyDate(toStringValue(order.dataCancelamento) ?? toStringValue(order.data_cancelamento)),
      totalAmount:
        toNumberValue(order.valorTotal) ??
        toNumberValue(order.total) ??
        toNumberValue(order.total_pedido) ??
        toNumberValue(order.valor),
      shippingAmount: toNumberValue(order.valorFrete) ?? toNumberValue(order.valor_frete),
      discountAmount: toNumberValue(order.desconto) ?? toNumberValue(order.valor_desconto),
      customerId: customer.id,
      customerContextAi: customer.customerContextAi,
      rawPayload: JSON.stringify(order)
    },
    create: {
      tinyOrderId,
      tinyContactId: customer.tinyContactId,
      number: toStringValue(order.numero) ?? toStringValue(order.numeroPedido),
      ecommerceNumber:
        toStringValue(order.numeroEcommerce) ??
        toStringValue(order.numero_ecommerce) ??
        toStringValue(order.numero_ordem_compra) ??
        toStringValue(unwrapTinyItem(order.ecommerce).numeroPedidoEcommerce),
      channel: toStringValue(order.canalVenda),
      marketplace:
        toStringValue(order.nomeEcommerce) ??
        toStringValue(unwrapTinyItem(order.ecommerce).nomeEcommerce) ??
        toStringValue(unwrapTinyItem(order.ecommerce).nome) ??
        toStringValue(order.ecommerce) ??
        getTinyAccountLabel(accountKey),
      status: normalizedStatus,
      statusLabel,
      orderDate,
      expectedDate: parseTinyDate(toStringValue(order.dataPrevista) ?? toStringValue(order.data_prevista)),
      invoicedAt: parseTinyDate(toStringValue(order.dataFaturamento) ?? toStringValue(order.data_faturamento)),
      shippedAt: parseTinyDate(
        toStringValue(order.dataExpedicao) ?? toStringValue(order.data_envio) ?? toStringValue(order.dataEnvio)
      ),
      deliveredAt: parseTinyDate(toStringValue(order.dataEntrega) ?? toStringValue(order.data_entrega)),
      canceledAt: parseTinyDate(toStringValue(order.dataCancelamento) ?? toStringValue(order.data_cancelamento)),
      totalAmount:
        toNumberValue(order.valorTotal) ??
        toNumberValue(order.total) ??
        toNumberValue(order.total_pedido) ??
        toNumberValue(order.valor),
      shippingAmount: toNumberValue(order.valorFrete) ?? toNumberValue(order.valor_frete),
      discountAmount: toNumberValue(order.desconto) ?? toNumberValue(order.valor_desconto),
      customerId: customer.id,
      customerContextAi: customer.customerContextAi,
      rawPayload: JSON.stringify(order)
    }
  });

  const latestStatusHistory = existingOrder?.statusHistory[0];
  if (!latestStatusHistory || latestStatusHistory.status !== normalizedStatus || latestStatusHistory.statusLabel !== statusLabel) {
    await prisma.salesOrderStatusHistory.create({
      data: {
        salesOrderId: salesOrder.id,
        status: normalizedStatus,
        statusLabel,
        source: eventType,
        rawPayload: JSON.stringify({
          accountKey,
          payload: rawPayload
        })
      }
    });
  }

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

  if (!options?.skipMetricRebuild) {
    await rebuildSalesMetricsForDates([existingOrder?.orderDate ?? null, orderDate]);
  }

  return {
    salesOrderId: salesOrder.id,
    tinyOrderId,
    rawTinyOrderId,
    accountKey,
    metricDates: [existingOrder?.orderDate ?? null, orderDate],
    itemCount: itemEntries.length,
    customerId: customer.id
  };
}

export async function handleTinySalesWebhook(
  rawPayload: unknown,
  accountKey: TinyAccountKey = "pepper",
  webhookType: TinyCommercialWebhookKind = "sales"
) {
  const webhookLabel = webhookType === "orders" ? "pedidos enviados" : "vendas";
  const parsed = salesWebhookSchema.safeParse(rawPayload);

  if (!parsed.success) {
    const received = await beginFoundationWebhookProcessing({
      webhookType,
      accountKey,
      eventType: "unknown",
      entityType: "sales_order",
      payload: {
        accountKey,
        payload: rawPayload
      }
    });

    if (!received.duplicate) {
      await finalizeFoundationWebhookProcessing({
        logId: received.logId,
        status: "invalid_payload",
        processingStage: "failed",
        errorMessage: `Payload de ${webhookLabel} invalido.`
      });
    }
    throw new Error(`Payload de ${webhookLabel} invalido.`);
  }

  const eventType = parsed.data.tipo?.trim() ?? webhookType;
  const orderId =
    parsed.data.dados?.idPedido ??
    parsed.data.dados?.idObjeto ??
    parsed.data.dados?.id ??
    parsed.data.id;
  const scopedOrderId = buildScopedTinyId(accountKey, toStringValue(orderId));
  const received = await beginFoundationWebhookProcessing({
    webhookType,
    accountKey,
    eventType,
    entityType: "sales_order",
    entityId: scopedOrderId,
    tinyProductId: scopedOrderId,
    payload: {
      accountKey,
      payload: rawPayload
    }
  });

  if (received.duplicate) {
    return {
      ok: true,
      duplicate: true,
      reason: "already_processed"
    };
  }

  if (!orderId) {
    await finalizeFoundationWebhookProcessing({
      logId: received.logId,
      status: "missing_order_id",
      processingStage: "failed",
      entityType: "sales_order",
      entityId: scopedOrderId,
      tinyProductId: scopedOrderId,
      errorMessage: "Webhook sem id de pedido."
    });
    throw new Error("Webhook sem id de pedido.");
  }

  const syncRun = await createFoundationSyncRun({
    triggerType: `${webhookType}_webhook`,
    scope: `tiny_${webhookType}`,
    status: "processing",
    accountKey,
    entityType: "sales_order",
    entityId: scopedOrderId
  });

  try {
    const order = await getTinyOrderById(String(orderId), accountKey);
    const result = await persistSalesOrderFromAccount(order, rawPayload, eventType, accountKey);
    const processedAt = new Date();

    await finalizeFoundationWebhookProcessing({
      logId: received.logId,
      status: "processed",
      processingStage: "persisted",
      processedAt,
      entityType: "sales_order",
      entityId: result.tinyOrderId,
      tinyProductId: result.tinyOrderId,
      payload: {
        accountKey,
        payload: rawPayload,
        derived: {
          salesOrderId: result.salesOrderId,
          customerId: result.customerId,
          itemCount: result.itemCount
        }
      }
    });
    await finalizeFoundationSyncRun({
      runId: syncRun.id,
      status: "success",
      metadata: {
        accountKey,
        salesOrderId: result.salesOrderId,
        tinyOrderId: result.tinyOrderId,
        itemCount: result.itemCount,
        metricDates: result.metricDates
      }
    });

    return {
      ok: true,
      ...result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Falha ao processar webhook de ${webhookLabel}.`;

    await finalizeFoundationWebhookProcessing({
      logId: received.logId,
      status: "failed",
      processingStage: "failed",
      entityType: "sales_order",
      entityId: scopedOrderId,
      tinyProductId: scopedOrderId,
      errorMessage: message
    });
    await finalizeFoundationSyncRun({
      runId: syncRun.id,
      status: "failed",
      errorMessage: message,
      metadata: {
        accountKey,
        scopedOrderId
      }
    });

    throw error;
  }
}

export async function reconcileTinySalesOrders(params: {
  days?: number;
  maxPages?: number;
  maxOrders?: number;
  requestedByUserId?: string | null;
}) {
  if (!isTinyConfigured()) {
    return {
      status: "skipped",
      reason: "Tiny nao configurado."
    };
  }

  const days = Math.min(Math.max(params.days ?? 30, 1), 180);
  const maxPages = Math.min(Math.max(params.maxPages ?? 6, 1), 50);
  const maxOrders = Math.min(Math.max(params.maxOrders ?? 200, 1), 2000);
  const endDate = new Date();
  const startDate = startOfDay(new Date());
  startDate.setDate(startDate.getDate() - (days - 1));

  const run = await prisma.syncRun.create({
    data: {
      triggerType: "sales_reconcile",
      status: "processing",
      requestedByUserId: params.requestedByUserId ?? null
    }
  });

  let processed = 0;
  let failed = 0;
  let pagesChecked = 0;
  let ordersFound = 0;
  let totalPages = 1;
  const seenOrderIds = new Set<string>();
  const errorMessages: string[] = [];
  const configuredAccounts = getConfiguredTinyAccounts();
  const maxOrdersPerAccount = Math.max(1, Math.ceil(maxOrders / Math.max(configuredAccounts.length, 1)));
  const processedByAccount: Array<{ accountKey: TinyAccountKey; label: string; processed: number; failed: number }> = [];
  const touchedMetricDates: Array<Date | null> = [];

  try {
    for (const account of configuredAccounts) {
      let accountProcessed = 0;
      let accountFailed = 0;
      totalPages = 1;

      for (let page = 1; page <= totalPages && page <= maxPages && accountProcessed + accountFailed < maxOrdersPerAccount; page += 1) {
        const result = await searchTinyOrdersByDateRange({
          startDate,
          endDate,
          page,
          accountKey: account.key
        });

        totalPages = result.totalPages;
        pagesChecked += 1;
        ordersFound += result.orders.length;

        for (const orderRef of result.orders) {
          const scopedOrderId = buildScopedTinyId(account.key, orderRef.id);
          if (!scopedOrderId || seenOrderIds.has(scopedOrderId) || accountProcessed + accountFailed >= maxOrdersPerAccount) {
            continue;
          }

          seenOrderIds.add(scopedOrderId);

          try {
            const order = await getTinyOrderById(orderRef.id, account.key);
            const persisted = await persistSalesOrderFromAccount(
              order,
              {
                source: "sales_reconcile",
                page,
                days,
                accountKey: account.key,
                tinyOrderId: orderRef.id
              },
              "sales_reconcile",
              account.key,
              {
                skipMetricRebuild: true
              }
            );
            processed += 1;
            accountProcessed += 1;
            touchedMetricDates.push(...persisted.metricDates);
          } catch (error) {
            failed += 1;
            accountFailed += 1;
            if (errorMessages.length < 5) {
              errorMessages.push(
                `${account.label} · ${orderRef.number ?? orderRef.id}: ${
                  error instanceof Error ? error.message : "Falha ao importar pedido."
                }`
              );
            }
          }
        }
      }

      processedByAccount.push({
        accountKey: account.key,
        label: account.label,
        processed: accountProcessed,
        failed: accountFailed
      });
    }

    await rebuildSalesMetricsForDates(touchedMetricDates);

    const status = failed > 0 ? (processed > 0 ? "partial" : "failed") : "completed";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        errorMessage: errorMessages.length > 0 ? errorMessages.join(" | ") : null
      }
    });

    return {
      status,
      days,
      processed,
      failed,
      checked: seenOrderIds.size,
      ordersFound,
      pagesChecked,
      totalPages,
      processedByAccount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao reconciliar vendas.";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message
      }
    });

    return {
      status: "failed",
      days,
      processed,
      failed: failed + 1,
      checked: seenOrderIds.size,
      ordersFound,
      pagesChecked,
      totalPages,
      reason: message,
      processedByAccount
    };
  }
}
