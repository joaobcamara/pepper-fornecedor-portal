import { InventorySyncStatus } from "@prisma/client";

type InventoryLike = {
  availableMultiCompanyStock?: number | null;
  inventorySyncStatus?: InventorySyncStatus | null;
  sourceAccountKey?: string | null;
  lastReconciledTinyId?: string | null;
  rawPayload?: string | null;
  lastStockSyncAt?: Date | null;
};

export function isTrustedFoundationInventory(inventory?: InventoryLike | null) {
  if (!inventory) {
    return false;
  }

  return Boolean(
    inventory.sourceAccountKey?.trim() ||
      inventory.lastReconciledTinyId?.trim() ||
      inventory.rawPayload?.trim()
  );
}

export function getTrustedFoundationInventoryQuantity(inventory?: InventoryLike | null) {
  return isTrustedFoundationInventory(inventory) ? inventory?.availableMultiCompanyStock ?? null : null;
}

export function getTrustedFoundationInventorySyncStatus(
  inventory?: InventoryLike | null,
  fallback: InventorySyncStatus = InventorySyncStatus.STALE
) {
  if (!inventory || !isTrustedFoundationInventory(inventory)) {
    return InventorySyncStatus.STALE;
  }

  return inventory.inventorySyncStatus ?? fallback;
}

export function getTrustedFoundationInventoryLastSyncAt(inventory?: InventoryLike | null) {
  return isTrustedFoundationInventory(inventory) ? inventory?.lastStockSyncAt ?? null : null;
}
