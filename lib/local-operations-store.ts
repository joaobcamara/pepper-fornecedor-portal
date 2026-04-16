import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ReplenishmentRequestStatus,
  SupplierFinancialEntryStatus,
  SupplierFinancialAttachmentKind,
  SupplierOrderItemStatus,
  SupplierOrderStatus,
  SupplierOrderWorkflowStage,
  UserRole
} from "@prisma/client";
import { getDemoAdminSupplierOrdersData } from "@/lib/demo-data";
import { demoUsers } from "@/lib/demo-data";
import {
  getOperationalOriginLabel,
  getSupplierFinancialStatusLabel,
  getSupplierOrderWorkflowLabel
} from "@/lib/operations-workflow";
import type { TinyInspectionResult } from "@/lib/tiny";

const LOCAL_DATA_DIR = path.join(process.cwd(), ".local-data");
const LOCAL_STORE_PATH = path.join(LOCAL_DATA_DIR, "operations-store.json");

export type LocalSupplierRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  active: boolean;
  canViewProductValues: boolean;
  canViewFinancialDashboard: boolean;
  productCount: number;
  userCount: number;
  createdAt: string;
};

export type LocalProductOption = {
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
    currentStock?: number | null;
    sales?: {
      "1d": number;
      "7d": number;
      "1m": number;
      "3m": number;
      "6m": number;
      "1a": number;
    };
  }>;
};

export type LocalUserRow = {
  id: string;
  username: string;
  role: UserRole;
  active: boolean;
  supplierId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type LocalReplenishmentRequest = {
  id: string;
  supplierId: string;
  supplierName: string;
  createdByUserId: string;
  createdByUsername: string;
  reviewedByUserId: string | null;
  reviewedByUsername: string | null;
  productId: string | null;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  note: string | null;
  htmlContent: string;
  status: ReplenishmentRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  linkedOrderId: string | null;
  items: Array<{
    id: string;
    sku: string;
    size: string;
    color: string;
    currentStock: number | null;
    requestedQuantity: number;
  }>;
};

export type LocalOrderAttachment = {
  id: string;
  kind: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
};

export type LocalOrderItem = {
  id: string;
  catalogVariantId: string | null;
  sku: string;
  productName: string;
  color: string;
  size: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  itemStatus: SupplierOrderItemStatus;
  itemStatusLabel: string;
  supplierItemNote: string | null;
  unitCost: number;
  confirmedUnitCost: number | null;
  requestedTotalCost: number;
  confirmedTotalCost: number;
};

export type LocalOrderHistoryItem = {
  id: string;
  fromStatus: SupplierOrderStatus | null;
  toStatus: SupplierOrderStatus;
  toStatusLabel: string;
  note: string | null;
  createdAt: string;
};

export type LocalOrderWorkflowHistoryItem = {
  id: string;
  fromStage: SupplierOrderWorkflowStage | null;
  toStage: SupplierOrderWorkflowStage;
  toStageLabel: string;
  note: string | null;
  createdAt: string;
};

export type LocalOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  productId: string | null;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  status: SupplierOrderStatus;
  statusLabel: string;
  workflowStage: SupplierOrderWorkflowStage;
  workflowStageLabel: string;
  originType: string;
  originLabel: string;
  originReferenceId?: string | null;
  adminNote: string | null;
  supplierNote: string | null;
  supplierHasNoStock: boolean;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  shippedAt: string | null;
  expectedShipDate: string | null;
  separationConfirmedAt: string | null;
  sentToFinancialAt: string | null;
  paidAt: string | null;
  estimatedTotalCost: number;
  estimatedTotalCostLabel: string;
  confirmedTotalCost: number;
  confirmedTotalCostLabel: string;
  createdBy: string;
  updatedBy: string;
  hasRomaneio: boolean;
  financialEntry: {
    id: string;
    status: SupplierFinancialEntryStatus;
    statusLabel: string;
    amount: number;
    amountLabel: string;
  } | null;
  attachments: LocalOrderAttachment[];
  history: LocalOrderHistoryItem[];
  workflowHistory: LocalOrderWorkflowHistoryItem[];
  items: LocalOrderItem[];
};

export type LocalFinancialAttachment = {
  id: string;
  kind: SupplierFinancialAttachmentKind;
  kindLabel: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
};

export type LocalFinancialHistoryItem = {
  id: string;
  status: SupplierFinancialEntryStatus;
  statusLabel: string;
  note: string | null;
  createdAt: string;
};

export type LocalFinancialEntry = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierOrderId: string;
  orderNumber: string;
  title: string;
  status: SupplierFinancialEntryStatus;
  statusLabel: string;
  originLabel: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  workflowStage: SupplierOrderWorkflowStage;
  workflowStageLabel: string;
  amount: number;
  amountLabel: string;
  dueDate: string | null;
  note: string | null;
  supplierNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  attachments: LocalFinancialAttachment[];
  history: LocalFinancialHistoryItem[];
  items: Array<{
    id: string;
    sku: string;
    color: string;
    size: string;
    requestedQuantity: number;
    fulfilledQuantity: number;
    confirmedTotalCost: number;
  }>;
};

type LocalOperationsStore = {
  suppliers: LocalSupplierRow[];
  users: LocalUserRow[];
  products: LocalProductOption[];
  replenishmentRequests: LocalReplenishmentRequest[];
  orders: LocalOrder[];
  financialEntries: LocalFinancialEntry[];
};

type UploadedLocalFile = {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

function formatCurrency(value: number | null | undefined) {
  return `R$ ${(value ?? 0).toFixed(2).replace(".", ",")}`;
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString("pt-BR");
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR");
}

function createOrderNumber() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PF-${parts}-${suffix}`;
}

function getSupplierOrderStatusLabel(status: SupplierOrderStatus) {
  switch (status) {
    case SupplierOrderStatus.AWAITING_SUPPLIER:
      return "Aguardando resposta";
    case SupplierOrderStatus.SUPPLIER_REVIEWED:
      return "Respondido";
    case SupplierOrderStatus.IN_PREPARATION:
      return "Em preparacao";
    case SupplierOrderStatus.PARTIALLY_FULFILLED:
      return "Atendido parcialmente";
    case SupplierOrderStatus.SHIPPED:
      return "Enviado";
    case SupplierOrderStatus.NO_STOCK:
      return "Sem estoque";
    case SupplierOrderStatus.CANCELED:
      return "Cancelado";
    default:
      return "Rascunho";
  }
}

function getAttachmentKindLabel(kind: SupplierFinancialAttachmentKind) {
  switch (kind) {
    case SupplierFinancialAttachmentKind.NOTA_FISCAL:
      return "Nota fiscal";
    case SupplierFinancialAttachmentKind.COMPROVANTE:
      return "Comprovante";
    default:
      return "Romaneio";
  }
}

function getSupplierOrderItemStatusLabel(status: SupplierOrderItemStatus) {
  switch (status) {
    case SupplierOrderItemStatus.AVAILABLE:
      return "Disponivel";
    case SupplierOrderItemStatus.PARTIAL:
      return "Parcial";
    case SupplierOrderItemStatus.NO_STOCK:
      return "Sem estoque";
    default:
      return "Pendente";
  }
}

function resolveOrderStatus(params: {
  requestedStatus?: string | null;
  supplierHasNoStock: boolean;
  anyNoStock: boolean;
  anyPartial: boolean;
}) {
  if (params.requestedStatus === SupplierOrderStatus.IN_PREPARATION) return SupplierOrderStatus.IN_PREPARATION;
  if (params.requestedStatus === SupplierOrderStatus.SHIPPED) return SupplierOrderStatus.SHIPPED;
  if (params.supplierHasNoStock) return SupplierOrderStatus.NO_STOCK;
  if (params.anyNoStock || params.anyPartial) return SupplierOrderStatus.PARTIALLY_FULFILLED;
  return SupplierOrderStatus.SUPPLIER_REVIEWED;
}

function resolveWorkflowStage(params: {
  currentStage: SupplierOrderWorkflowStage;
  workflowAction?: string | null;
  supplierHasNoStock: boolean;
  nextStatus: SupplierOrderStatus;
}) {
  if (params.workflowAction === "PREPARE_ORDER") return SupplierOrderWorkflowStage.IN_PREPARATION;
  if (params.workflowAction === "CONFIRM_SEPARATION") return SupplierOrderWorkflowStage.SEPARATION_CONFIRMED;
  if (params.workflowAction === "MARK_SHIPPED" || params.nextStatus === SupplierOrderStatus.SHIPPED) {
    return SupplierOrderWorkflowStage.SHIPPED;
  }
  if (
    params.workflowAction === "MARK_NO_STOCK" ||
    params.supplierHasNoStock ||
    params.nextStatus === SupplierOrderStatus.NO_STOCK
  ) {
    return SupplierOrderWorkflowStage.NO_STOCK;
  }
  return params.currentStage;
}

function resolveWorkflowStageFromFinancialStatus(status: SupplierFinancialEntryStatus) {
  switch (status) {
    case SupplierFinancialEntryStatus.PENDING_PAYMENT:
      return SupplierOrderWorkflowStage.PAYMENT_PENDING;
    case SupplierFinancialEntryStatus.PAID:
      return SupplierOrderWorkflowStage.PAID;
    case SupplierFinancialEntryStatus.REJECTED:
      return SupplierOrderWorkflowStage.READY_FOR_FINANCIAL;
    case SupplierFinancialEntryStatus.CANCELED:
      return SupplierOrderWorkflowStage.CANCELED;
    default:
      return SupplierOrderWorkflowStage.IN_FINANCIAL_REVIEW;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStore(raw: Partial<LocalOperationsStore> | null | undefined): LocalOperationsStore {
  const initial = buildInitialStore();

  return {
    suppliers: raw?.suppliers ?? initial.suppliers,
    users: raw?.users ?? initial.users,
    products: raw?.products ?? initial.products,
    replenishmentRequests: raw?.replenishmentRequests ?? initial.replenishmentRequests,
    orders: (raw?.orders ?? initial.orders).map((order) => ({
      ...order,
      originReferenceId: order.originReferenceId ?? null
    })),
    financialEntries: raw?.financialEntries ?? initial.financialEntries
  };
}

function buildInitialStore(): LocalOperationsStore {
  const demo = getDemoAdminSupplierOrdersData();

  return {
    suppliers: [
      {
        id: "demo-supplier-id",
        name: "Luna Têxtil",
        slug: "luna-textil",
        logoUrl: null,
        contactName: "Carol Aguiar",
        contactPhone: "(85) 99999-9999",
        contactEmail: "contato@lunatextil.com.br",
        address: "Rua das Industrias, 150 - Fortaleza/CE",
        active: true,
        canViewProductValues: false,
        canViewFinancialDashboard: true,
        productCount: 5,
        userCount: 1,
        createdAt: "15/04/2026"
      },
      {
        id: "demo-supplier-onshop",
        name: "Carol Aguiar",
        slug: "on-shopp",
        logoUrl: null,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        address: null,
        active: true,
        canViewProductValues: false,
        canViewFinancialDashboard: false,
        productCount: 0,
        userCount: 0,
        createdAt: "15/04/2026"
      }
    ],
    users: demoUsers.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      active: user.active,
      supplierId: user.supplierId ?? null,
      lastLoginAt: null,
      createdAt: "15/04/2026"
    })),
    products: demo.products.map((product) => ({
      ...clone(product),
      supplierName: product.supplierName === "Luna Textil" ? "Luna Têxtil" : product.supplierName
    })),
    replenishmentRequests: [],
    orders: demo.orders.map(
      (order): LocalOrder => ({
        ...clone(order),
        productId: null,
        originReferenceId: null,
        updatedAt: order.respondedAt ?? order.createdAt,
        supplierName: order.supplierName === "Luna Textil" ? "Luna Têxtil" : order.supplierName,
        status: order.status as SupplierOrderStatus,
        workflowStage: order.workflowStage as SupplierOrderWorkflowStage,
        financialEntry: null,
        history: order.history.map((item) => ({
          ...item,
          fromStatus: item.fromStatus as SupplierOrderStatus | null,
          toStatus: item.toStatus as SupplierOrderStatus
        })),
        workflowHistory: order.workflowHistory.map((item) => ({
          ...item,
          fromStage: item.fromStage as SupplierOrderWorkflowStage | null,
          toStage: item.toStage as SupplierOrderWorkflowStage
        })),
        items: order.items.map((item) => ({
          ...item,
          catalogVariantId: null,
          itemStatus: item.itemStatus as SupplierOrderItemStatus,
          itemStatusLabel: item.itemStatusLabel
        }))
      })
    ),
    financialEntries: []
  };
}

async function ensureLocalStoreFile() {
  await mkdir(LOCAL_DATA_DIR, { recursive: true });

  try {
    const contents = await readFile(LOCAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(contents) as Partial<LocalOperationsStore>;
    const normalized = normalizeStore(parsed);
    await writeFile(LOCAL_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    const initial = buildInitialStore();
    await writeFile(LOCAL_STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function readStore() {
  return clone(await ensureLocalStoreFile());
}

async function writeStore(store: LocalOperationsStore) {
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function updateStore<T>(updater: (store: LocalOperationsStore) => T | Promise<T>) {
  const store = await ensureLocalStoreFile();
  const result = await updater(store);
  await writeStore(store);
  return result;
}

function syncSupplierStats(store: LocalOperationsStore) {
  for (const supplier of store.suppliers) {
    supplier.userCount = store.users.filter((user) => user.supplierId === supplier.id).length;
    supplier.productCount = store.products.filter((product) => product.supplierId === supplier.id).length;
  }
}

export async function getLocalOperationsSnapshot() {
  return readStore();
}

export async function getLocalSupplierDirectory() {
  const store = await readStore();
  return store.suppliers;
}

export async function getLocalUsers() {
  const store = await readStore();
  return store.users.map((user) => ({
    ...user,
    supplierName: store.suppliers.find((supplier) => supplier.id === user.supplierId)?.name ?? null
  }));
}

export async function createLocalUser(input: {
  username: string;
  password?: string;
  role: UserRole;
  supplierId?: string | null;
  active: boolean;
}) {
  return updateStore((store) => {
    const username = input.username.trim().toLowerCase();

    if (store.users.some((user) => user.username === username)) {
      throw new Error("Ja existe um usuario com esse login.");
    }

    if (input.role === UserRole.SUPPLIER && !input.supplierId) {
      throw new Error("Usuario de fornecedor precisa estar vinculado a um fornecedor.");
    }

    const user: LocalUserRow = {
      id: randomUUID(),
      username,
      role: input.role,
      active: input.active,
      supplierId: input.role === UserRole.SUPPLIER ? input.supplierId ?? null : null,
      lastLoginAt: null,
      createdAt: "Agora"
    };

    store.users.unshift(user);
    syncSupplierStats(store);

    return clone(user);
  });
}

export async function updateLocalUser(input: {
  id: string;
  username: string;
  role: UserRole;
  supplierId?: string | null;
  active: boolean;
}) {
  return updateStore((store) => {
    const user = store.users.find((item) => item.id === input.id);

    if (!user) {
      throw new Error("Usuario nao encontrado.");
    }

    const username = input.username.trim().toLowerCase();
    if (store.users.some((item) => item.id !== input.id && item.username === username)) {
      throw new Error("Ja existe um usuario com esse login.");
    }

    if (input.role === UserRole.SUPPLIER && !input.supplierId) {
      throw new Error("Usuario de fornecedor precisa estar vinculado a um fornecedor.");
    }

    user.username = username;
    user.role = input.role;
    user.supplierId = input.role === UserRole.SUPPLIER ? input.supplierId ?? null : null;
    user.active = input.active;

    syncSupplierStats(store);
    return clone(user);
  });
}

export async function createLocalSupplier(input: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  active: boolean;
  canViewProductValues: boolean;
  canViewFinancialDashboard: boolean;
}) {
  return updateStore((store) => {
    const supplier: LocalSupplierRow = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      address: input.address ?? null,
      active: input.active,
      canViewProductValues: input.canViewProductValues,
      canViewFinancialDashboard: input.canViewFinancialDashboard,
      productCount: 0,
      userCount: 0,
      createdAt: "Agora"
    };

    store.suppliers.unshift(supplier);
    return clone(supplier);
  });
}

export async function updateLocalSupplier(input: {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  active: boolean;
  canViewProductValues: boolean;
  canViewFinancialDashboard: boolean;
}) {
  return updateStore((store) => {
    const supplier = store.suppliers.find((item) => item.id === input.id);

    if (!supplier) {
      throw new Error("Fornecedor nao encontrado.");
    }

    supplier.name = input.name;
    supplier.slug = input.slug;
    supplier.logoUrl = input.logoUrl ?? null;
    supplier.contactName = input.contactName ?? null;
    supplier.contactPhone = input.contactPhone ?? null;
    supplier.contactEmail = input.contactEmail ?? null;
    supplier.address = input.address ?? null;
    supplier.active = input.active;
    supplier.canViewProductValues = input.canViewProductValues;
    supplier.canViewFinancialDashboard = input.canViewFinancialDashboard;

    return clone(supplier);
  });
}

export async function getLocalSupplierIdentity(supplierId?: string | null) {
  const suppliers = await getLocalSupplierDirectory();
  const supplier = suppliers.find((item) => item.id === supplierId) ?? suppliers[0] ?? null;

  if (!supplier) {
    return {
      supplierName: "Fornecedor Pepper",
      supplierInitials: "PF",
      supplierLogoUrl: null as string | null,
      canViewProductValues: false,
      canViewFinancialDashboard: false
    };
  }

  const initials = supplier.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PF";

  return {
    supplierName: supplier.name,
    supplierInitials: initials,
    supplierLogoUrl: supplier.logoUrl ?? null,
    canViewProductValues: supplier.canViewProductValues,
    canViewFinancialDashboard: supplier.canViewFinancialDashboard
  };
}

export async function getLocalAdminSupplierOrderPageData() {
  const store = await readStore();
  return {
    suppliers: store.suppliers
      .filter((supplier) => supplier.active)
      .map((supplier) => ({ id: supplier.id, name: supplier.name, slug: supplier.slug })),
    products: store.products,
    orders: store.orders
  };
}

export async function importLocalTinyProduct(input: {
  inspection: TinyInspectionResult;
  supplierIds: string[];
}) {
  return updateStore((store) => {
    const primarySupplier = store.suppliers.find((supplier) => input.supplierIds.includes(supplier.id)) ?? store.suppliers[0];

    if (!primarySupplier) {
      throw new Error("Nenhum fornecedor ativo encontrado para concluir a importacao local.");
    }

    const parentSku = input.inspection.parent.sku;
    const existing = store.products.find((product) => product.productSku === parentSku);

    const variants = input.inspection.variants.map((variant) => ({
      id: existing?.variants.find((item) => item.sku === variant.sku)?.id ?? randomUUID(),
      sku: variant.sku,
      color: variant.colorCode ?? "",
      size: variant.sizeCode ?? "",
      unitCost: existing?.variants.find((item) => item.sku === variant.sku)?.unitCost ?? 0,
      currentStock: variant.quantity,
      sales: existing?.variants.find((item) => item.sku === variant.sku)?.sales ?? {
        "1d": 0,
        "7d": 0,
        "1m": 0,
        "3m": 0,
        "6m": 0,
        "1a": 0
      }
    }));

    const nextProduct: LocalProductOption = {
      id: existing?.id ?? input.inspection.parent.id,
      supplierId: primarySupplier.id,
      supplierName: primarySupplier.name,
      productName: existing?.productName ?? input.inspection.parent.name,
      productSku: parentSku,
      imageUrl: input.inspection.parent.imageUrl ?? existing?.imageUrl ?? "/brand/pepper-logo.png",
      variants
    };

    if (existing) {
      Object.assign(existing, nextProduct);
    } else {
      store.products.unshift(nextProduct);
    }

    syncSupplierStats(store);

    return {
      batchId: randomUUID(),
      importedVariants: variants.length,
      parentSku,
      verification: {
        storedInFoundation: true,
        visibleInAdminProducts: true
      }
    };
  });
}

export async function updateLocalProductConfiguration(input: {
  parentSku: string;
  internalName: string;
  active: boolean;
  supplierIds: string[];
  criticalStockThreshold: number | null;
  lowStockThreshold: number | null;
  variantThresholds: Array<{
    sku: string;
    criticalStockThreshold: number | null;
    lowStockThreshold: number | null;
  }>;
}) {
  return updateStore((store) => {
    const product = store.products.find((item) => item.productSku === input.parentSku);

    if (!product) {
      throw new Error("Produto pai nao encontrado.");
    }

    const supplier = store.suppliers.find((item) => input.supplierIds.includes(item.id)) ?? store.suppliers.find((item) => item.id === product.supplierId);

    product.productName = input.internalName;
    product.supplierId = supplier?.id ?? product.supplierId;
    product.supplierName = supplier?.name ?? product.supplierName;

    const thresholdMap = new Map(input.variantThresholds.map((variant) => [variant.sku, variant]));
    product.variants = product.variants.map((variant) => {
      const thresholds = thresholdMap.get(variant.sku);
      return {
        ...variant,
        sales: variant.sales ?? {
          "1d": 0,
          "7d": 0,
          "1m": 0,
          "3m": 0,
          "6m": 0,
          "1a": 0
        }
      };
    });

    syncSupplierStats(store);

    return clone(product);
  });
}

export async function getLocalSupplierReceivedOrders(supplierId: string) {
  const store = await readStore();
  return store.orders.filter((order) => order.supplierId === supplierId);
}

export async function getLocalReplenishmentRequests() {
  const store = await readStore();
  return store.replenishmentRequests;
}

export async function createLocalReplenishmentRequest(input: {
  supplierId: string;
  createdByUserId: string;
  createdByUsername: string;
  productId?: string | null;
  productName: string;
  productSku: string;
  imageUrl?: string | null;
  note?: string | null;
  htmlContent: string;
  items: Array<{
    sku: string;
    size: string;
    color: string;
    currentStock: number | null;
    requestedQuantity: number;
  }>;
}) {
  return updateStore((store) => {
    const supplier = store.suppliers.find((item) => item.id === input.supplierId);

    if (!supplier) {
      throw new Error("Fornecedor nao encontrado.");
    }

    const request: LocalReplenishmentRequest = {
      id: randomUUID(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      createdByUserId: input.createdByUserId,
      createdByUsername: input.createdByUsername,
      reviewedByUserId: null,
      reviewedByUsername: null,
      productId: input.productId?.trim() || null,
      productName: input.productName,
      productSku: input.productSku,
      imageUrl: input.imageUrl ?? null,
      note: input.note?.trim() || null,
      htmlContent: input.htmlContent,
      status: ReplenishmentRequestStatus.PENDING,
      createdAt: formatDateTime(),
      reviewedAt: null,
      linkedOrderId: null,
      items: input.items.map((item) => ({
        id: randomUUID(),
        sku: item.sku,
        size: item.size,
        color: item.color,
        currentStock: item.currentStock,
        requestedQuantity: item.requestedQuantity
      }))
    };

    store.replenishmentRequests.unshift(request);
    return clone(request);
  });
}

export async function updateLocalReplenishmentRequest(input: {
  requestId: string;
  status: ReplenishmentRequestStatus;
  reviewedByUserId: string;
  reviewedByUsername: string;
}) {
  return updateStore((store) => {
    const request = store.replenishmentRequests.find((item) => item.id === input.requestId);

    if (!request) {
      throw new Error("Solicitacao de reposicao nao encontrada.");
    }

    request.status = input.status;
    request.reviewedAt = formatDateTime();
    request.reviewedByUserId = input.reviewedByUserId;
    request.reviewedByUsername = input.reviewedByUsername;

    return clone(request);
  });
}

export async function createLocalAdminSupplierOrder(input: {
  supplierId: string;
  productId?: string | null;
  originReferenceId?: string | null;
  productName: string;
  productSku: string;
  imageUrl?: string | null;
  adminNote?: string | null;
  items: Array<{
    catalogVariantId?: string | null;
    sku: string;
    productName: string;
    color: string;
    size: string;
    requestedQuantity: number;
    unitCost?: number | null;
  }>;
  actorUsername: string;
}) {
  return updateStore((store) => {
    const supplier = store.suppliers.find((item) => item.id === input.supplierId);

    if (!supplier) {
      throw new Error("Fornecedor nao encontrado.");
    }

    const createdAt = formatDateTime();
    const estimatedTotalCost = input.items.reduce(
      (sum, item) => sum + Number(item.requestedQuantity) * Number(item.unitCost ?? 0),
      0
    );

    const order: LocalOrder = {
      id: randomUUID(),
      orderNumber: createOrderNumber(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      productId: input.productId?.trim() || null,
      productName: input.productName,
      productSku: input.productSku,
      imageUrl: input.imageUrl ?? null,
      status: SupplierOrderStatus.AWAITING_SUPPLIER,
      statusLabel: getSupplierOrderStatusLabel(SupplierOrderStatus.AWAITING_SUPPLIER),
      workflowStage: SupplierOrderWorkflowStage.AWAITING_RESPONSE,
      workflowStageLabel: getSupplierOrderWorkflowLabel(SupplierOrderWorkflowStage.AWAITING_RESPONSE),
      originType: "REPLENISHMENT_REQUEST",
      originLabel: getOperationalOriginLabel("REPLENISHMENT_REQUEST"),
      originReferenceId: input.originReferenceId?.trim() || null,
      adminNote: input.adminNote?.trim() || null,
      supplierNote: null,
      supplierHasNoStock: false,
      createdAt,
      updatedAt: createdAt,
      respondedAt: null,
      shippedAt: null,
      expectedShipDate: null,
      separationConfirmedAt: null,
      sentToFinancialAt: null,
      paidAt: null,
      estimatedTotalCost,
      estimatedTotalCostLabel: formatCurrency(estimatedTotalCost),
      confirmedTotalCost: 0,
      confirmedTotalCostLabel: formatCurrency(0),
      createdBy: input.actorUsername,
      updatedBy: input.actorUsername,
      hasRomaneio: false,
      financialEntry: null,
      attachments: [],
      history: [
        {
          id: randomUUID(),
          fromStatus: null,
          toStatus: SupplierOrderStatus.AWAITING_SUPPLIER,
          toStatusLabel: getSupplierOrderStatusLabel(SupplierOrderStatus.AWAITING_SUPPLIER),
          note: "Pedido enviado para o fornecedor.",
          createdAt
        }
      ],
      workflowHistory: [
        {
          id: randomUUID(),
          fromStage: null,
          toStage: SupplierOrderWorkflowStage.AWAITING_RESPONSE,
          toStageLabel: getSupplierOrderWorkflowLabel(SupplierOrderWorkflowStage.AWAITING_RESPONSE),
          note: "Card operacional criado pelo admin.",
          createdAt
        }
      ],
      items: input.items.map((item) => ({
        id: randomUUID(),
        catalogVariantId: item.catalogVariantId?.trim() || null,
        sku: item.sku,
        productName: item.productName,
        color: item.color,
        size: item.size,
        requestedQuantity: Number(item.requestedQuantity),
        fulfilledQuantity: 0,
        itemStatus: SupplierOrderItemStatus.PENDING,
        itemStatusLabel: getSupplierOrderItemStatusLabel(SupplierOrderItemStatus.PENDING),
        supplierItemNote: null,
        unitCost: Number(item.unitCost ?? 0),
        confirmedUnitCost: null,
        requestedTotalCost: Number(item.requestedQuantity) * Number(item.unitCost ?? 0),
        confirmedTotalCost: 0
      }))
    };

    store.orders.unshift(order);

    if (input.originReferenceId) {
      const replenishment = store.replenishmentRequests.find((item) => item.id === input.originReferenceId);
      if (replenishment) {
        replenishment.linkedOrderId = order.id;
      }
    }

    return clone(order);
  });
}

export async function updateLocalAdminSupplierOrder(input: {
  orderId: string;
  status: SupplierOrderStatus;
  adminNote?: string | null;
  actorUsername: string;
}) {
  return updateStore((store) => {
    const order = store.orders.find((item) => item.id === input.orderId);

    if (!order) {
      throw new Error("Pedido nao encontrado.");
    }

    const now = formatDateTime();
    const nextWorkflowStage =
      input.status === SupplierOrderStatus.CANCELED ? SupplierOrderWorkflowStage.CANCELED : order.workflowStage;

    if (order.status !== input.status) {
      order.history.unshift({
        id: randomUUID(),
        fromStatus: order.status,
        toStatus: input.status,
        toStatusLabel: getSupplierOrderStatusLabel(input.status),
        note: input.adminNote?.trim() || "Status atualizado pelo admin.",
        createdAt: now
      });
      order.status = input.status;
      order.statusLabel = getSupplierOrderStatusLabel(input.status);
    }

    if (order.workflowStage !== nextWorkflowStage) {
      order.workflowHistory.unshift({
        id: randomUUID(),
        fromStage: order.workflowStage,
        toStage: nextWorkflowStage,
        toStageLabel: getSupplierOrderWorkflowLabel(nextWorkflowStage),
        note: input.adminNote?.trim() || "Etapa operacional atualizada pelo admin.",
        createdAt: now
      });
      order.workflowStage = nextWorkflowStage;
      order.workflowStageLabel = getSupplierOrderWorkflowLabel(nextWorkflowStage);
    }

    order.adminNote = input.adminNote?.trim() || order.adminNote;
    order.updatedBy = input.actorUsername;
    order.updatedAt = now;

    return clone(order);
  });
}

export async function updateLocalSupplierOrder(input: {
  supplierId: string;
  orderId: string;
  supplierNote?: string | null;
  expectedShipDate?: string | null;
  requestedStatus?: string | null;
  workflowAction?: string | null;
  supplierHasNoStock: boolean;
  items: Array<{
    id: string;
    fulfilledQuantity?: number;
    itemStatus?: SupplierOrderItemStatus;
    supplierItemNote?: string | null;
    confirmedUnitCost?: number | null;
  }>;
  uploadedRomaneio?: UploadedLocalFile | null;
  actorUsername: string;
}) {
  return updateStore((store) => {
    const order = store.orders.find((item) => item.id === input.orderId && item.supplierId === input.supplierId);

    if (!order) {
      throw new Error("Pedido nao encontrado.");
    }

    const anyNoStock =
      input.supplierHasNoStock || input.items.some((item) => item.itemStatus === SupplierOrderItemStatus.NO_STOCK);
    const anyPartial = input.items.some((item) => item.itemStatus === SupplierOrderItemStatus.PARTIAL);
    const nextStatus = resolveOrderStatus({
      requestedStatus: input.requestedStatus,
      supplierHasNoStock: input.supplierHasNoStock,
      anyNoStock,
      anyPartial
    });
    const nextWorkflowStage = resolveWorkflowStage({
      currentStage: order.workflowStage,
      workflowAction: input.workflowAction,
      supplierHasNoStock: input.supplierHasNoStock,
      nextStatus
    });

    order.items = order.items.map((item) => {
      const update = input.items.find((entry) => entry.id === item.id);

      if (!update) {
        return item;
      }

      const fulfilledQuantity = Number(update.fulfilledQuantity ?? 0);
      const confirmedUnitCost =
        update.confirmedUnitCost === null || update.confirmedUnitCost === undefined || update.confirmedUnitCost === 0
          ? null
          : Number(update.confirmedUnitCost);

      return {
        ...item,
        fulfilledQuantity,
        itemStatus: update.itemStatus ?? SupplierOrderItemStatus.PENDING,
        itemStatusLabel: getSupplierOrderItemStatusLabel(update.itemStatus ?? SupplierOrderItemStatus.PENDING),
        supplierItemNote: update.supplierItemNote?.trim() || null,
        confirmedUnitCost,
        confirmedTotalCost: fulfilledQuantity * (confirmedUnitCost ?? 0)
      };
    });

    const now = formatDateTime();
    const confirmedTotalCost = order.items.reduce((sum, item) => sum + item.confirmedTotalCost, 0);

    order.supplierNote = input.supplierNote?.trim() || null;
    order.expectedShipDate = input.expectedShipDate || null;
    order.supplierHasNoStock = input.supplierHasNoStock;
    order.respondedAt = now;
    order.confirmedTotalCost = confirmedTotalCost;
    order.confirmedTotalCostLabel = formatCurrency(confirmedTotalCost);
    order.updatedBy = input.actorUsername;
    order.updatedAt = now;

    if (nextWorkflowStage === SupplierOrderWorkflowStage.SEPARATION_CONFIRMED) {
      order.separationConfirmedAt = now;
    }

    if (nextStatus === SupplierOrderStatus.SHIPPED) {
      order.shippedAt = now;
    }

    if (input.uploadedRomaneio) {
      order.attachments.unshift({
        id: randomUUID(),
        kind: "ROMANEIO",
        fileName: input.uploadedRomaneio.fileName,
        fileUrl: input.uploadedRomaneio.fileUrl,
        createdAt: now
      });
      order.hasRomaneio = true;
    }

    if (order.status !== nextStatus) {
      order.history.unshift({
        id: randomUUID(),
        fromStatus: order.status,
        toStatus: nextStatus,
        toStatusLabel: getSupplierOrderStatusLabel(nextStatus),
        note: order.supplierNote || "Fornecedor atualizou o pedido.",
        createdAt: now
      });
      order.status = nextStatus;
      order.statusLabel = getSupplierOrderStatusLabel(nextStatus);
    }

    if (order.workflowStage !== nextWorkflowStage) {
      order.workflowHistory.unshift({
        id: randomUUID(),
        fromStage: order.workflowStage,
        toStage: nextWorkflowStage,
        toStageLabel: getSupplierOrderWorkflowLabel(nextWorkflowStage),
        note: order.supplierNote || "Fornecedor atualizou a etapa operacional do pedido.",
        createdAt: now
      });
      order.workflowStage = nextWorkflowStage;
      order.workflowStageLabel = getSupplierOrderWorkflowLabel(nextWorkflowStage);
    }

    return clone(order);
  });
}

export async function getLocalSupplierFinancialBoardData(supplierId: string) {
  const store = await readStore();
  return {
    readyOrders: store.orders.filter(
      (order) =>
        order.supplierId === supplierId &&
        order.workflowStage === SupplierOrderWorkflowStage.SEPARATION_CONFIRMED &&
        !order.financialEntry
    ),
    entries: store.financialEntries.filter((entry) => entry.supplierId === supplierId)
  };
}

export async function getLocalAdminFinancialBoardData() {
  const store = await readStore();
  return store.financialEntries;
}

export async function createLocalFinancialEntry(input: {
  supplierId: string;
  orderId: string;
  note?: string | null;
  supplierNote?: string | null;
  dueDate?: string | null;
  amount?: number;
  uploadedRomaneio?: UploadedLocalFile | null;
  uploadedNotaFiscal?: UploadedLocalFile | null;
}) {
  return updateStore((store) => {
    const order = store.orders.find((item) => item.id === input.orderId && item.supplierId === input.supplierId);

    if (!order) {
      throw new Error("Pedido nao encontrado.");
    }

    if (order.financialEntry) {
      throw new Error("Este pedido ja foi enviado para o financeiro.");
    }

    const supplier = store.suppliers.find((item) => item.id === order.supplierId);
    const now = formatDateTime();
    const nextWorkflowStage = SupplierOrderWorkflowStage.IN_FINANCIAL_REVIEW;
    const amount = Number.isFinite(input.amount) && Number(input.amount) > 0 ? Number(input.amount) : order.confirmedTotalCost;
    const entryId = randomUUID();

    const attachments: LocalFinancialAttachment[] = [
      input.uploadedRomaneio
        ? {
            id: randomUUID(),
            kind: SupplierFinancialAttachmentKind.ROMANEIO,
            kindLabel: getAttachmentKindLabel(SupplierFinancialAttachmentKind.ROMANEIO),
            fileName: input.uploadedRomaneio.fileName,
            fileUrl: input.uploadedRomaneio.fileUrl,
            createdAt: now
          }
        : null,
      input.uploadedNotaFiscal
        ? {
            id: randomUUID(),
            kind: SupplierFinancialAttachmentKind.NOTA_FISCAL,
            kindLabel: getAttachmentKindLabel(SupplierFinancialAttachmentKind.NOTA_FISCAL),
            fileName: input.uploadedNotaFiscal.fileName,
            fileUrl: input.uploadedNotaFiscal.fileUrl,
            createdAt: now
          }
        : null
    ].filter(Boolean) as LocalFinancialAttachment[];

    const entry: LocalFinancialEntry = {
      id: entryId,
      supplierId: order.supplierId,
      supplierName: supplier?.name ?? order.supplierName,
      supplierOrderId: order.id,
      orderNumber: order.orderNumber,
      title: `${order.productName} • ${order.orderNumber}`,
      status: SupplierFinancialEntryStatus.IN_REVIEW,
      statusLabel: getSupplierFinancialStatusLabel(SupplierFinancialEntryStatus.IN_REVIEW),
      originLabel: order.originLabel,
      productName: order.productName,
      productSku: order.productSku,
      imageUrl: order.imageUrl,
      workflowStage: nextWorkflowStage,
      workflowStageLabel: getSupplierOrderWorkflowLabel(nextWorkflowStage),
      amount,
      amountLabel: formatCurrency(amount),
      dueDate: input.dueDate || null,
      note: input.note?.trim() || null,
      supplierNote: input.supplierNote?.trim() || null,
      submittedAt: now,
      reviewedAt: null,
      paidAt: null,
      attachments,
      history: [
        {
          id: randomUUID(),
          status: SupplierFinancialEntryStatus.IN_REVIEW,
          statusLabel: getSupplierFinancialStatusLabel(SupplierFinancialEntryStatus.IN_REVIEW),
          note: input.supplierNote?.trim() || input.note?.trim() || "Fornecedor enviou o pedido para revisao financeira.",
          createdAt: now
        }
      ],
      items: order.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        color: item.color,
        size: item.size,
        requestedQuantity: item.requestedQuantity,
        fulfilledQuantity: item.fulfilledQuantity,
        confirmedTotalCost: item.confirmedTotalCost
      }))
    };

    store.financialEntries.unshift(entry);

    order.financialEntry = {
      id: entryId,
      status: SupplierFinancialEntryStatus.IN_REVIEW,
      statusLabel: getSupplierFinancialStatusLabel(SupplierFinancialEntryStatus.IN_REVIEW),
      amount,
      amountLabel: formatCurrency(amount)
    };
    order.sentToFinancialAt = now;
    order.workflowHistory.unshift({
      id: randomUUID(),
      fromStage: order.workflowStage,
      toStage: nextWorkflowStage,
      toStageLabel: getSupplierOrderWorkflowLabel(nextWorkflowStage),
      note: "Pedido enviado pelo fornecedor para o financeiro.",
      createdAt: now
    });
    order.workflowStage = nextWorkflowStage;
    order.workflowStageLabel = getSupplierOrderWorkflowLabel(nextWorkflowStage);

    return clone(entry);
  });
}

export async function updateLocalFinancialEntry(input: {
  financialEntryId: string;
  status: SupplierFinancialEntryStatus;
  note?: string | null;
  dueDate?: string | null;
  uploadedComprovante?: UploadedLocalFile | null;
}) {
  return updateStore((store) => {
    const entry = store.financialEntries.find((item) => item.id === input.financialEntryId);

    if (!entry) {
      throw new Error("Conta financeira nao encontrada.");
    }

    const order = store.orders.find((item) => item.id === entry.supplierOrderId);

    if (!order) {
      throw new Error("Pedido financeiro nao encontrado.");
    }

    const now = formatDateTime();
    const nextWorkflowStage = resolveWorkflowStageFromFinancialStatus(input.status);

    entry.history.unshift({
      id: randomUUID(),
      status: input.status,
      statusLabel: getSupplierFinancialStatusLabel(input.status),
      note: input.note?.trim() || "Financeiro atualizado pelo admin.",
      createdAt: now
    });
    entry.status = input.status;
    entry.statusLabel = getSupplierFinancialStatusLabel(input.status);
    entry.note = input.note?.trim() || entry.note;
    entry.dueDate = input.dueDate || entry.dueDate;
    entry.reviewedAt = now;
    entry.paidAt = input.status === SupplierFinancialEntryStatus.PAID ? now : entry.paidAt;
    entry.workflowStage = nextWorkflowStage;
    entry.workflowStageLabel = getSupplierOrderWorkflowLabel(nextWorkflowStage);

    if (input.uploadedComprovante) {
      entry.attachments.unshift({
        id: randomUUID(),
        kind: SupplierFinancialAttachmentKind.COMPROVANTE,
        kindLabel: getAttachmentKindLabel(SupplierFinancialAttachmentKind.COMPROVANTE),
        fileName: input.uploadedComprovante.fileName,
        fileUrl: input.uploadedComprovante.fileUrl,
        createdAt: now
      });
    }

    order.workflowHistory.unshift({
      id: randomUUID(),
      fromStage: order.workflowStage,
      toStage: nextWorkflowStage,
      toStageLabel: getSupplierOrderWorkflowLabel(nextWorkflowStage),
      note: input.note?.trim() || "Financeiro atualizou a etapa do pedido.",
      createdAt: now
    });
    order.workflowStage = nextWorkflowStage;
    order.workflowStageLabel = getSupplierOrderWorkflowLabel(nextWorkflowStage);
    order.paidAt = input.status === SupplierFinancialEntryStatus.PAID ? now : order.paidAt;
    order.financialEntry = {
      id: entry.id,
      status: input.status,
      statusLabel: getSupplierFinancialStatusLabel(input.status),
      amount: entry.amount,
      amountLabel: formatCurrency(entry.amount)
    };

    return clone(entry);
  });
}
