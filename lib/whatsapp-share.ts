import { randomBytes } from "node:crypto";

import {
  WhatsAppShareOwnerRole,
  WhatsAppShareStatus,
  WhatsAppShareTemplate,
  type Prisma
} from "@prisma/client";

import { listFoundationCatalogProducts } from "@/lib/foundation-catalog";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";

type ShareCreationItemInput = {
  sku: string;
  size: string;
  color: string;
  currentStock: number | null;
  requestedQuantity: number;
};

type CreateWhatsAppShareLinkParams = {
  ownerUserId: string;
  ownerRole: WhatsAppShareOwnerRole;
  supplierId?: string | null;
  productSku: string;
  productName: string;
  imageUrl?: string | null;
  note?: string | null;
  items: ShareCreationItemInput[];
};

type RawShareLink = Prisma.WhatsAppShareLinkGetPayload<{
  include: {
    supplier: true;
    catalogProduct: true;
    items: {
      include: {
        catalogVariant: true;
      };
      orderBy: {
        sortOrder: "asc";
      };
    };
  };
}>;

type ProductMetricSummary = {
  salesToday: number;
  sales7d: number;
  sales30d: number;
  coverageDays: number | null;
};

export type WhatsAppShareItemView = {
  id: string;
  sku: string;
  sizeLabel: string;
  colorLabel: string;
  currentStockSnapshot: number | null;
  currentStock: number | null;
  requestedQuantity: number;
  originalRequestedQuantity: number;
  requestChanged: boolean;
  stockChanged: boolean;
};

export type WhatsAppShareLinkView = {
  id: string;
  slug: string;
  shareUrlPath: string;
  status: WhatsAppShareStatus;
  statusLabel: string;
  template: WhatsAppShareTemplate;
  templateLabel: string;
  ownerRole: WhatsAppShareOwnerRole;
  title: string;
  productName: string;
  productSku: string;
  imageUrl: string;
  supplierName: string | null;
  note: string;
  originalNote: string;
  statusNote: string;
  noteChanged: boolean;
  changedItemCount: number;
  requestChangedCount: number;
  stockChangedCount: number;
  hasRecipientChanges: boolean;
  createdAtLabel: string;
  updatedAtLabel: string;
  viewedAtLabel: string | null;
  metrics: ProductMetricSummary;
  totalRequested: number;
  totalCurrentStock: number;
  sizeLabels: string[];
  colorLabels: string[];
  items: WhatsAppShareItemView[];
  adminProductHref: string;
};

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString("pt-BR") : null;
}

function buildSlug() {
  return `wa-${randomBytes(6).toString("hex")}`;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveTemplate(items: ShareCreationItemInput[]) {
  const sizeCount = uniqueValues(items.map((item) => item.size)).length;
  return sizeCount <= 1 ? WhatsAppShareTemplate.UNIQUE_COLOR_CARDS : WhatsAppShareTemplate.SIZE_COLOR_GRID;
}

export function getWhatsAppShareStatusLabel(status: WhatsAppShareStatus) {
  switch (status) {
    case WhatsAppShareStatus.APPROVED:
      return "Aprovado";
    case WhatsAppShareStatus.CHANGES_REQUESTED:
      return "Pediu alteracao";
    case WhatsAppShareStatus.REJECTED:
      return "Recusado";
    case WhatsAppShareStatus.CLOSED:
      return "Fechado";
    case WhatsAppShareStatus.OPEN:
    default:
      return "Aberto";
  }
}

export function getWhatsAppShareTemplateLabel(template: WhatsAppShareTemplate) {
  switch (template) {
    case WhatsAppShareTemplate.UNIQUE_COLOR_CARDS:
      return "Tamanho unico";
    case WhatsAppShareTemplate.SIZE_COLOR_GRID:
    default:
      return "Grade cor x tamanho";
  }
}

export function buildWhatsAppShareText(params: {
  shareUrl: string;
  productName: string;
  productSku: string;
  supplierName?: string | null;
  note?: string | null;
}) {
  const lines = [
    "Pedido compartilhavel - Grupo Pepper",
    `Produto: ${params.productName}`,
    `SKU pai: ${params.productSku}`
  ];

  if (params.supplierName) {
    lines.push(`Fornecedor: ${params.supplierName}`);
  }

  if (params.note?.trim()) {
    lines.push(`Observacao: ${params.note.trim()}`);
  }

  lines.push("", "Abrir link:", params.shareUrl);

  return lines.join("\n");
}

async function loadMetricsMap(catalogProductIds: string[]) {
  if (catalogProductIds.length === 0) {
    return new Map<string, ProductMetricSummary>();
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const metrics = await prisma.productSalesMetricDaily.findMany({
    where: {
      catalogProductId: {
        in: catalogProductIds
      },
      date: {
        gte: thirtyDaysAgo
      }
    }
  });

  const map = new Map<string, ProductMetricSummary>();

  for (const metric of metrics) {
    const current = map.get(metric.catalogProductId) ?? {
      salesToday: 0,
      sales7d: 0,
      sales30d: 0,
      coverageDays: null
    };

    current.sales30d += metric.unitsSold;

    if (metric.date >= sevenDaysAgo) {
      current.sales7d += metric.unitsSold;
    }

    if (metric.date >= todayStart) {
      current.salesToday += metric.unitsSold;
    }

    map.set(metric.catalogProductId, current);
  }

  return map;
}

async function mapShareLinksToView(links: RawShareLink[]) {
  const foundationProducts = await listFoundationCatalogProducts({
    catalogProductIds: links.map((link) => link.catalogProductId),
    onlyPortalVisible: false
  });
  const foundationProductById = new Map(foundationProducts.map((product) => [product.id, product] as const));
  const metricsMap = await loadMetricsMap(links.map((link) => link.catalogProductId));

  return links.map<WhatsAppShareLinkView>((link) => {
    const foundationProduct = foundationProductById.get(link.catalogProductId) ?? null;
    const currentVariantBySku = new Map(
      foundationProduct?.variants.map((variant) => [variant.sku, variant] as const) ?? []
    );
    const items = link.items.map<WhatsAppShareItemView>((item) => {
      const currentVariant = currentVariantBySku.get(item.sku);
      const currentStock = currentVariant?.quantity ?? null;
      const requestChanged = item.requestedQuantity !== item.originalRequestedQuantity;
      const stockChanged = (item.currentStockSnapshot ?? null) !== currentStock;

      return {
        id: item.id,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        colorLabel: item.colorLabel,
        currentStockSnapshot: item.currentStockSnapshot ?? null,
        currentStock,
        requestedQuantity: item.requestedQuantity,
        originalRequestedQuantity: item.originalRequestedQuantity,
        requestChanged,
        stockChanged
      };
    });
    const metrics = metricsMap.get(link.catalogProductId) ?? {
      salesToday: 0,
      sales7d: 0,
      sales30d: 0,
      coverageDays: null
    };
    const totalCurrentStock = items.reduce((sum, item) => sum + (item.currentStock ?? 0), 0);
    const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const requestChangedCount = items.filter((item) => item.requestChanged).length;
    const stockChangedCount = items.filter((item) => item.stockChanged).length;
    const averageDailySales = metrics.sales30d > 0 ? metrics.sales30d / 30 : 0;
    const coverageDays = averageDailySales > 0 ? Math.round(totalCurrentStock / averageDailySales) : null;

    return {
      id: link.id,
      slug: link.slug,
      shareUrlPath: `/whatsapp/${link.slug}`,
      status: link.status,
      statusLabel: getWhatsAppShareStatusLabel(link.status),
      template: link.template,
      templateLabel: getWhatsAppShareTemplateLabel(link.template),
      ownerRole: link.ownerRole,
      title: link.title,
      productName: link.productName,
      productSku: link.productSku,
      imageUrl:
        link.imageUrl ??
        foundationProduct?.imageUrl ??
        link.catalogProduct.mainImageUrl ??
        "/brand/pepper-logo.png",
      supplierName: link.supplier?.name ?? null,
      note: link.note ?? "",
      originalNote: link.originalNote ?? "",
      statusNote: link.statusNote ?? "",
      noteChanged: (link.note ?? "") !== (link.originalNote ?? ""),
      changedItemCount: items.filter((item) => item.requestChanged || item.stockChanged).length,
      requestChangedCount,
      stockChangedCount,
      hasRecipientChanges:
        (link.note ?? "") !== (link.originalNote ?? "") || items.some((item) => item.requestChanged),
      createdAtLabel: formatDateTime(link.createdAt) ?? "",
      updatedAtLabel: formatDateTime(link.updatedAt) ?? "",
      viewedAtLabel: formatDateTime(link.viewedAt),
      metrics: {
        ...metrics,
        coverageDays
      },
      totalRequested,
      totalCurrentStock,
      sizeLabels: uniqueValues(items.map((item) => item.sizeLabel)),
      colorLabels: uniqueValues(items.map((item) => item.colorLabel)),
      items,
      adminProductHref: `/admin/produtos?sku=${encodeURIComponent(link.productSku)}`
    };
  });
}

export async function createWhatsAppShareLink(params: CreateWhatsAppShareLinkParams) {
  const normalizedParentSku = normalizeSku(params.productSku);
  const requestedItems = params.items.filter((item) => item.requestedQuantity > 0);

  if (requestedItems.length === 0) {
    throw new Error("Informe pelo menos uma quantidade para gerar o link.");
  }

  const catalogProduct = await prisma.catalogProduct.findUnique({
    where: {
      skuParent: normalizedParentSku
    },
    include: {
      supplierLinks: {
        where: {
          active: true
        },
        include: {
          supplier: true
        }
      },
      variants: {
        include: {
          inventory: true
        }
      }
    }
  });

  if (!catalogProduct) {
    throw new Error("Produto ainda nao existe na fundacao para gerar o link.");
  }

  const variantBySku = new Map(catalogProduct.variants.map((variant) => [variant.sku, variant] as const));
  const supplierName =
    catalogProduct.supplierLinks.find((link) => link.supplierId === params.supplierId)?.supplier.name ??
    catalogProduct.supplierLinks[0]?.supplier.name ??
    null;

  const shareLink = await prisma.whatsAppShareLink.create({
    data: {
      slug: buildSlug(),
      ownerRole: params.ownerRole,
      ownerUserId: params.ownerUserId,
      supplierId: params.supplierId ?? null,
      catalogProductId: catalogProduct.id,
      template: resolveTemplate(requestedItems),
      title: supplierName
        ? `${params.productName} • ${supplierName}`
        : `${params.productName} • compartilhamento Pepper`,
      productName: params.productName,
      productSku: normalizedParentSku,
      imageUrl: params.imageUrl ?? catalogProduct.mainImageUrl ?? null,
      note: params.note?.trim() || null,
      originalNote: params.note?.trim() || null,
      items: {
        create: requestedItems.map((item, index) => {
          const variant = variantBySku.get(item.sku);
          return {
            catalogVariantId: variant?.id ?? null,
            sku: item.sku,
            sizeLabel: item.size,
            colorLabel: item.color,
            currentStockSnapshot: variant?.inventory?.availableMultiCompanyStock ?? item.currentStock ?? null,
            requestedQuantity: item.requestedQuantity,
            originalRequestedQuantity: item.requestedQuantity,
            sortOrder: index
          };
        })
      }
    },
    include: {
      supplier: true,
      catalogProduct: true,
      items: {
        include: {
          catalogVariant: true
        },
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  const [view] = await mapShareLinksToView([shareLink]);
  return view;
}

export async function listAdminWhatsAppShareLinks(ownerUserId: string) {
  const links = await prisma.whatsAppShareLink.findMany({
    where: {
      ownerUserId,
      ownerRole: WhatsAppShareOwnerRole.ADMIN
    },
    include: {
      supplier: true,
      catalogProduct: true,
      items: {
        include: {
          catalogVariant: true
        },
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return mapShareLinksToView(links);
}

export async function getWhatsAppShareLinkBySlug(slug: string) {
  const link = await prisma.whatsAppShareLink.findUnique({
    where: {
      slug
    },
    include: {
      supplier: true,
      catalogProduct: true,
      items: {
        include: {
          catalogVariant: true
        },
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!link) {
    return null;
  }

  if (!link.viewedAt) {
    await prisma.whatsAppShareLink.update({
      where: {
        id: link.id
      },
      data: {
        viewedAt: new Date()
      }
    });

    link.viewedAt = new Date();
  }

  const [view] = await mapShareLinksToView([link]);
  return view;
}

export async function updateWhatsAppShareLinkAsOwner(params: {
  id: string;
  ownerUserId: string;
  note?: string;
  status?: WhatsAppShareStatus;
  statusNote?: string;
}) {
  await prisma.whatsAppShareLink.updateMany({
    where: {
      id: params.id,
      ownerUserId: params.ownerUserId
    },
    data: {
      ...(params.note !== undefined ? { note: params.note.trim() || null } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.statusNote !== undefined ? { statusNote: params.statusNote.trim() || null } : {})
    }
  });
}

export async function deleteWhatsAppShareLinkAsOwner(params: {
  id: string;
  ownerUserId: string;
}) {
  await prisma.whatsAppShareLink.deleteMany({
    where: {
      id: params.id,
      ownerUserId: params.ownerUserId
    }
  });
}

export async function updateWhatsAppShareLinkBySlug(params: {
  slug: string;
  note?: string;
  status?: WhatsAppShareStatus;
  statusNote?: string;
  items?: Array<{
    sku: string;
    requestedQuantity: number;
  }>;
}) {
  const link = await prisma.whatsAppShareLink.findUnique({
    where: {
      slug: params.slug
    },
    include: {
      items: true
    }
  });

  if (!link) {
    throw new Error("Link nao encontrado.");
  }

  await prisma.$transaction(async (tx) => {
    if (params.items && params.items.length > 0) {
      const requestedBySku = new Map(params.items.map((item) => [item.sku, item.requestedQuantity] as const));

      for (const item of link.items) {
        if (!requestedBySku.has(item.sku)) {
          continue;
        }

        await tx.whatsAppShareLinkItem.update({
          where: {
            id: item.id
          },
          data: {
            requestedQuantity: requestedBySku.get(item.sku) ?? item.requestedQuantity
          }
        });
      }
    }

    await tx.whatsAppShareLink.update({
      where: {
        id: link.id
      },
      data: {
        ...(params.note !== undefined ? { note: params.note.trim() || null } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.statusNote !== undefined ? { statusNote: params.statusNote.trim() || null } : {}),
        lastRecipientEditAt: new Date()
      }
    });
  });
}
