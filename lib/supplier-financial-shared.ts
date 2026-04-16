import { SupplierFinancialAttachmentKind, SupplierFinancialEntryStatus, SupplierOrderWorkflowStage } from "@prisma/client";

export type SupplierFinancialReadyOrder = {
  id: string;
  orderNumber: string;
  productName: string;
  productSku: string;
  imageUrl: string | null;
  workflowStage: SupplierOrderWorkflowStage;
  workflowStageLabel: string;
  originLabel: string;
  confirmedTotalCost: number;
  confirmedTotalCostLabel: string;
  expectedShipDate: string | null;
  attachments: Array<{
    id: string;
    kind: string;
    fileName: string;
    fileUrl: string;
  }>;
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

export type SupplierFinancialBoardEntry = {
  id: string;
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
  attachments: Array<{
    id: string;
    kind: SupplierFinancialAttachmentKind;
    kindLabel: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    status: SupplierFinancialEntryStatus;
    statusLabel: string;
    note: string | null;
    createdAt: string;
  }>;
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

export type AdminFinancialBoardEntry = SupplierFinancialBoardEntry & {
  supplierId: string;
  supplierName: string;
};

export function getSupplierFinancialSummary(entries: Array<{ status: SupplierFinancialEntryStatus }>) {
  return {
    inReview: entries.filter((entry) => entry.status === "IN_REVIEW").length,
    pending: entries.filter((entry) => entry.status === "PENDING_PAYMENT").length,
    paid: entries.filter((entry) => entry.status === "PAID").length,
    rejected: entries.filter((entry) => entry.status === "REJECTED").length
  };
}
