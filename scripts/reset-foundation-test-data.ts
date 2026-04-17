import { PrismaClient } from "@prisma/client";

const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = datasourceUrl
  ? new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    })
  : new PrismaClient();

const tablesToTruncate = [
  `"InvoiceStatusHistory"`,
  `"InvoiceItem"`,
  `"Invoice"`,
  `"ShipmentStatusHistory"`,
  `"ShipmentPackage"`,
  `"Shipment"`,
  `"ShipmentGrouping"`,
  `"PickingSeparationStatusHistory"`,
  `"PickingSeparationItem"`,
  `"PickingSeparation"`,
  `"FoundationPriceListItem"`,
  `"FoundationPriceList"`,
  `"FoundationStockMovement"`,
  `"CatalogVariantAccountState"`,
  `"FoundationAsset"`,
  `"FoundationInboundEvent"`,
  `"SupplierFinancialStatusHistory"`,
  `"SupplierFinancialAttachment"`,
  `"SupplierFinancialEntry"`,
  `"SupplierOrderWorkflowHistory"`,
  `"SupplierOrderStatusHistory"`,
  `"SupplierOrderAttachment"`,
  `"SupplierOrderItem"`,
  `"SupplierOrder"`,
  `"ReplenishmentRequestItem"`,
  `"ReplenishmentRequest"`,
  `"CatalogOnboardingItem"`,
  `"ProductSuggestionStatusHistory"`,
  `"ProductSuggestionColor"`,
  `"ProductSuggestionSize"`,
  `"ProductSuggestionImage"`,
  `"ProductSuggestion"`,
  `"SuggestionValidationDraft"`,
  `"PepperIaMessage"`,
  `"PepperIaThread"`,
  `"MessageAttachment"`,
  `"Message"`,
  `"Conversation"`,
  `"AuditLog"`,
  `"SupplierSalesMetricDaily"`,
  `"ProductSalesMetricDaily"`,
  `"VariantSalesMetricDaily"`,
  `"SalesOrderStatusHistory"`,
  `"SalesOrderItem"`,
  `"SalesOrder"`,
  `"SyncRun"`,
  `"TinyWebhookLog"`,
  `"TinyImportItem"`,
  `"TinyImportBatch"`,
  `"CatalogProductSupplier"`,
  `"CatalogTinyMapping"`,
  `"CatalogAttribute"`,
  `"CatalogImage"`,
  `"CatalogPrice"`,
  `"CatalogInventory"`,
  `"CatalogVariant"`,
  `"CatalogProduct"`,
  `"InventorySnapshot"`,
  `"ProductSupplier"`,
  `"Product"`,
  `"FoundationContact"`,
  `"Customer"`
] as const;

async function main() {
  console.log("[RUN] resetting foundation test data");
  const truncateStatement = `TRUNCATE TABLE ${tablesToTruncate.join(", ")} RESTART IDENTITY CASCADE`;
  await prisma.$executeRawUnsafe(truncateStatement);
  console.log(`[OK] foundation test data reset across ${tablesToTruncate.length} tables.`);
}

main()
  .catch((error) => {
    console.error("[FAIL] reset-foundation-test-data", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
