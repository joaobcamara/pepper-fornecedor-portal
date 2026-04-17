import { PrismaClient } from "@prisma/client";

import {
  PEPPER_COLOR_REFERENCES,
  PEPPER_SIZE_REFERENCES
} from "../lib/pepper-reference-data";
import { PEPPER_TINY_ACCOUNT_REFERENCES } from "../lib/pepper-tiny-account-data";

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

const foundationStatements = [
  `
  do $$
  begin
    create type "PepperTinyAccountRole" as enum ('MATRIX', 'DEPENDENT');
  exception
    when duplicate_object then null;
  end $$;
  `,
  `
  create table if not exists "PepperSizeReference" (
    "code" text not null primary key,
    "label" text not null,
    "sortOrder" integer not null default 0,
    "active" boolean not null default true,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "PepperSizeReference_active_sortOrder_idx"
    on "PepperSizeReference" ("active", "sortOrder");
  `,
  `
  create table if not exists "PepperColorReference" (
    "code" text not null primary key,
    "label" text not null,
    "sortOrder" integer not null default 0,
    "active" boolean not null default true,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "PepperColorReference_active_sortOrder_idx"
    on "PepperColorReference" ("active", "sortOrder");
  `,
  `
  create table if not exists "PepperTinyAccountReference" (
    "key" text not null primary key,
    "label" text not null,
    "role" "PepperTinyAccountRole" not null,
    "sortOrder" integer not null default 0,
    "active" boolean not null default true,
    "sharesGroupStock" boolean not null default true,
    "readsAvailableMultiCompany" boolean not null default false,
    "handlesCatalogImport" boolean not null default false,
    "handlesPhysicalStock" boolean not null default false,
    "zeroBalanceOnCount" boolean not null default false,
    "salesAffectSharedStock" boolean not null default true,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "PepperTinyAccountReference_active_sortOrder_idx"
    on "PepperTinyAccountReference" ("active", "sortOrder");
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "accountKey" text;
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "entityType" text;
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "entityId" text;
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "fingerprint" text;
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "duplicateOfId" text;
  `,
  `
  alter table "TinyWebhookLog"
    add column if not exists "processingStage" text;
  `,
  `
  create index if not exists "TinyWebhookLog_webhookType_accountKey_createdAt_idx"
    on "TinyWebhookLog" ("webhookType", "accountKey", "createdAt");
  `,
  `
  create index if not exists "TinyWebhookLog_webhookType_accountKey_fingerprint_idx"
    on "TinyWebhookLog" ("webhookType", "accountKey", "fingerprint");
  `,
  `
  create index if not exists "TinyWebhookLog_entityType_entityId_idx"
    on "TinyWebhookLog" ("entityType", "entityId");
  `,
  `
  create index if not exists "TinyWebhookLog_duplicateOfId_idx"
    on "TinyWebhookLog" ("duplicateOfId");
  `,
  `
  alter table "SyncRun"
    add column if not exists "scope" text;
  `,
  `
  alter table "SyncRun"
    add column if not exists "accountKey" text;
  `,
  `
  alter table "SyncRun"
    add column if not exists "entityType" text;
  `,
  `
  alter table "SyncRun"
    add column if not exists "entityId" text;
  `,
  `
  alter table "SyncRun"
    add column if not exists "metadata" text;
  `,
  `
  create index if not exists "SyncRun_scope_startedAt_idx"
    on "SyncRun" ("scope", "startedAt");
  `,
  `
  create index if not exists "SyncRun_accountKey_startedAt_idx"
    on "SyncRun" ("accountKey", "startedAt");
  `,
  `
  create index if not exists "SyncRun_entityType_entityId_idx"
    on "SyncRun" ("entityType", "entityId");
  `,
  `
  alter table "CatalogTinyMapping"
    add column if not exists "accountKey" text not null default 'pepper';
  `,
  `
  drop index if exists "CatalogTinyMapping_entityType_sku_key";
  `,
  `
  create unique index if not exists "CatalogTinyMapping_accountKey_entityType_sku_key"
    on "CatalogTinyMapping" ("accountKey", "entityType", "sku");
  `,
  `
  create index if not exists "CatalogTinyMapping_accountKey_tinyId_idx"
    on "CatalogTinyMapping" ("accountKey", "tinyId");
  `,
  `
  alter table "Supplier"
    add column if not exists "tinyContactId" text;
  `,
  `
  alter table "Supplier"
    add column if not exists "foundationMetadataJson" text;
  `,
  `
  alter table "Supplier"
    add column if not exists "rawPayload" text;
  `,
  `
  create unique index if not exists "Supplier_tinyContactId_key"
    on "Supplier" ("tinyContactId");
  `,
  `
  alter table "CatalogProduct"
    add column if not exists "sourcePayloadJson" text;
  `,
  `
  alter table "CatalogProduct"
    add column if not exists "foundationMetadataJson" text;
  `,
  `
  alter table "CatalogVariant"
    add column if not exists "sourcePayloadJson" text;
  `,
  `
  alter table "CatalogVariant"
    add column if not exists "foundationMetadataJson" text;
  `,
  `
  alter table "CatalogInventory"
    add column if not exists "sourceAccountKey" text;
  `,
  `
  alter table "CatalogInventory"
    add column if not exists "lastReconciledTinyId" text;
  `,
  `
  alter table "CatalogInventory"
    add column if not exists "rawPayload" text;
  `,
  `
  alter table "CatalogPrice"
    add column if not exists "sourceAccountKey" text;
  `,
  `
  alter table "CatalogPrice"
    add column if not exists "priceListName" text;
  `,
  `
  alter table "CatalogPrice"
    add column if not exists "externalPriceListId" text;
  `,
  `
  alter table "CatalogPrice"
    add column if not exists "rawPayload" text;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "bucket" text;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "storagePath" text;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "checksumSha256" text;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "width" integer;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "height" integer;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "sourceAccountKey" text;
  `,
  `
  alter table "CatalogImage"
    add column if not exists "rawPayload" text;
  `,
  `
  create index if not exists "CatalogImage_sourceAccountKey_imageType_idx"
    on "CatalogImage" ("sourceAccountKey", "imageType");
  `,
  `
  create table if not exists "FoundationInboundEvent" (
    "id" text not null primary key,
    "integrationKey" text not null,
    "provider" text not null,
    "accountKey" text,
    "eventType" text not null,
    "entityType" text,
    "entityId" text,
    "sku" text,
    "externalId" text,
    "fingerprint" text,
    "status" text not null default 'received',
    "processingStage" text,
    "occurredAt" timestamp(3),
    "receivedAt" timestamp(3) not null default current_timestamp,
    "processedAt" timestamp(3),
    "headersJson" text,
    "payloadJson" text not null,
    "metadataJson" text,
    "errorMessage" text,
    "duplicateOfId" text
  );
  `,
  `
  create index if not exists "FoundationInboundEvent_integrationKey_receivedAt_idx"
    on "FoundationInboundEvent" ("integrationKey", "receivedAt");
  `,
  `
  create index if not exists "FoundationInboundEvent_provider_accountKey_eventType_receivedAt_idx"
    on "FoundationInboundEvent" ("provider", "accountKey", "eventType", "receivedAt");
  `,
  `
  create index if not exists "FoundationInboundEvent_entityType_entityId_idx"
    on "FoundationInboundEvent" ("entityType", "entityId");
  `,
  `
  create index if not exists "FoundationInboundEvent_sku_receivedAt_idx"
    on "FoundationInboundEvent" ("sku", "receivedAt");
  `,
  `
  create index if not exists "FoundationInboundEvent_externalId_idx"
    on "FoundationInboundEvent" ("externalId");
  `,
  `
  create index if not exists "FoundationInboundEvent_fingerprint_idx"
    on "FoundationInboundEvent" ("fingerprint");
  `,
  `
  create table if not exists "FoundationAsset" (
    "id" text not null primary key,
    "ownerDomain" text not null,
    "ownerEntityType" text,
    "ownerEntityId" text,
    "assetType" text not null,
    "provider" text,
    "sourceAccountKey" text,
    "bucket" text,
    "storagePath" text,
    "fileName" text,
    "extension" text,
    "mimeType" text,
    "sizeBytes" integer,
    "checksumSha256" text,
    "url" text not null,
    "previewUrl" text,
    "originalUrl" text,
    "width" integer,
    "height" integer,
    "durationSeconds" integer,
    "isPrimary" boolean not null default false,
    "sortOrder" integer not null default 0,
    "metadataJson" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "FoundationAsset_ownerDomain_ownerEntityType_ownerEntityId_idx"
    on "FoundationAsset" ("ownerDomain", "ownerEntityType", "ownerEntityId");
  `,
  `
  create index if not exists "FoundationAsset_sourceAccountKey_assetType_idx"
    on "FoundationAsset" ("sourceAccountKey", "assetType");
  `,
  `
  create table if not exists "CatalogVariantAccountState" (
    "id" text not null primary key,
    "catalogVariantId" text not null,
    "accountKey" text not null,
    "sku" text not null,
    "skuParent" text,
    "tinyProductId" text,
    "tinyParentId" text,
    "localPhysicalStock" integer,
    "localAvailableStock" integer,
    "reservedStock" integer,
    "availableMultiCompanyStock" integer,
    "inventorySyncStatus" "InventorySyncStatus" not null default 'STALE',
    "lastStockSyncAt" timestamp(3),
    "source" text not null default 'tiny',
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "CatalogVariantAccountState_catalogVariantId_accountKey_key"
    on "CatalogVariantAccountState" ("catalogVariantId", "accountKey");
  `,
  `
  create index if not exists "CatalogVariantAccountState_accountKey_sku_idx"
    on "CatalogVariantAccountState" ("accountKey", "sku");
  `,
  `
  create table if not exists "FoundationStockMovement" (
    "id" text not null primary key,
    "accountKey" text not null,
    "catalogVariantId" text,
    "sourceProductId" text,
    "sku" text not null,
    "skuParent" text,
    "movementType" text not null,
    "movementDirection" text,
    "quantityDelta" integer,
    "resultingPhysicalStock" integer,
    "resultingAvailableStock" integer,
    "resultingReservedStock" integer,
    "resultingMultiCompanyStock" integer,
    "sourceKind" text not null,
    "originReferenceType" text,
    "originReferenceId" text,
    "observation" text,
    "originatedBySystem" boolean not null default false,
    "occurredAt" timestamp(3) not null,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "FoundationStockMovement_accountKey_occurredAt_idx"
    on "FoundationStockMovement" ("accountKey", "occurredAt");
  `,
  `
  create index if not exists "FoundationStockMovement_sku_occurredAt_idx"
    on "FoundationStockMovement" ("sku", "occurredAt");
  `,
  `
  create index if not exists "FoundationStockMovement_originReferenceType_originReferenceId_idx"
    on "FoundationStockMovement" ("originReferenceType", "originReferenceId");
  `,
  `
  create table if not exists "FoundationContact" (
    "id" text not null primary key,
    "contactKind" text not null,
    "accountKey" text,
    "tinyContactId" text,
    "externalContactCode" text,
    "displayName" text not null,
    "legalName" text,
    "tradeName" text,
    "personType" text,
    "document" text,
    "stateRegistration" text,
    "email" text,
    "phone" text,
    "mobilePhone" text,
    "country" text,
    "state" text,
    "city" text,
    "district" text,
    "zipCode" text,
    "addressLine" text,
    "addressNumber" text,
    "addressComplement" text,
    "foundationMetadataJson" text,
    "rawPayload" text,
    "active" boolean not null default true,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "FoundationContact_accountKey_tinyContactId_key"
    on "FoundationContact" ("accountKey", "tinyContactId");
  `,
  `
  create index if not exists "FoundationContact_contactKind_active_idx"
    on "FoundationContact" ("contactKind", "active");
  `,
  `
  create index if not exists "FoundationContact_document_idx"
    on "FoundationContact" ("document");
  `,
  `
  create index if not exists "FoundationContact_email_idx"
    on "FoundationContact" ("email");
  `,
  `
  create index if not exists "FoundationContact_displayName_idx"
    on "FoundationContact" ("displayName");
  `,
  `
  create table if not exists "FoundationPriceList" (
    "id" text not null primary key,
    "accountKey" text,
    "source" text not null default 'tiny',
    "externalListId" text,
    "name" text not null,
    "currency" text not null default 'BRL',
    "active" boolean not null default true,
    "foundationMetadataJson" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "FoundationPriceList_accountKey_externalListId_key"
    on "FoundationPriceList" ("accountKey", "externalListId");
  `,
  `
  create index if not exists "FoundationPriceList_active_accountKey_idx"
    on "FoundationPriceList" ("active", "accountKey");
  `,
  `
  create table if not exists "FoundationPriceListItem" (
    "id" text not null primary key,
    "priceListId" text not null,
    "catalogProductId" text,
    "catalogVariantId" text,
    "sku" text,
    "externalItemId" text,
    "salePrice" double precision,
    "promotionalPrice" double precision,
    "costPrice" double precision,
    "minimumPrice" double precision,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "FoundationPriceListItem_priceListId_sku_key"
    on "FoundationPriceListItem" ("priceListId", "sku");
  `,
  `
  create index if not exists "FoundationPriceListItem_catalogProductId_idx"
    on "FoundationPriceListItem" ("catalogProductId");
  `,
  `
  create index if not exists "FoundationPriceListItem_catalogVariantId_idx"
    on "FoundationPriceListItem" ("catalogVariantId");
  `,
  `
  create table if not exists "PickingSeparation" (
    "id" text not null primary key,
    "accountKey" text,
    "salesOrderId" text,
    "externalSeparationId" text not null,
    "status" text not null,
    "statusLabel" text,
    "startedAt" timestamp(3),
    "finishedAt" timestamp(3),
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "PickingSeparation_accountKey_externalSeparationId_key"
    on "PickingSeparation" ("accountKey", "externalSeparationId");
  `,
  `
  create index if not exists "PickingSeparation_salesOrderId_idx"
    on "PickingSeparation" ("salesOrderId");
  `,
  `
  create index if not exists "PickingSeparation_status_updatedAt_idx"
    on "PickingSeparation" ("status", "updatedAt");
  `,
  `
  create table if not exists "PickingSeparationItem" (
    "id" text not null primary key,
    "pickingSeparationId" text not null,
    "catalogVariantId" text,
    "sku" text,
    "productName" text,
    "quantityRequested" integer,
    "quantitySeparated" integer,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "PickingSeparationItem_pickingSeparationId_idx"
    on "PickingSeparationItem" ("pickingSeparationId");
  `,
  `
  create index if not exists "PickingSeparationItem_catalogVariantId_idx"
    on "PickingSeparationItem" ("catalogVariantId");
  `,
  `
  create index if not exists "PickingSeparationItem_sku_idx"
    on "PickingSeparationItem" ("sku");
  `,
  `
  create table if not exists "PickingSeparationStatusHistory" (
    "id" text not null primary key,
    "pickingSeparationId" text not null,
    "fromStatus" text,
    "toStatus" text not null,
    "note" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "PickingSeparationStatusHistory_pickingSeparationId_createdAt_idx"
    on "PickingSeparationStatusHistory" ("pickingSeparationId", "createdAt");
  `,
  `
  create table if not exists "ShipmentGrouping" (
    "id" text not null primary key,
    "accountKey" text,
    "externalGroupingId" text not null,
    "status" text,
    "labelPrintUrl" text,
    "groupingPrintUrl" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "ShipmentGrouping_accountKey_externalGroupingId_key"
    on "ShipmentGrouping" ("accountKey", "externalGroupingId");
  `,
  `
  create index if not exists "ShipmentGrouping_status_updatedAt_idx"
    on "ShipmentGrouping" ("status", "updatedAt");
  `,
  `
  create table if not exists "Shipment" (
    "id" text not null primary key,
    "accountKey" text,
    "salesOrderId" text,
    "pickingSeparationId" text,
    "groupingId" text,
    "externalShipmentId" text not null,
    "shippingMethodName" text,
    "shippingMethodCode" text,
    "trackingNumber" text,
    "trackingUrl" text,
    "status" text not null,
    "statusLabel" text,
    "dispatchedAt" timestamp(3),
    "deliveredAt" timestamp(3),
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "Shipment_accountKey_externalShipmentId_key"
    on "Shipment" ("accountKey", "externalShipmentId");
  `,
  `
  create index if not exists "Shipment_salesOrderId_idx"
    on "Shipment" ("salesOrderId");
  `,
  `
  create index if not exists "Shipment_pickingSeparationId_idx"
    on "Shipment" ("pickingSeparationId");
  `,
  `
  create index if not exists "Shipment_groupingId_idx"
    on "Shipment" ("groupingId");
  `,
  `
  create index if not exists "Shipment_status_updatedAt_idx"
    on "Shipment" ("status", "updatedAt");
  `,
  `
  create table if not exists "ShipmentPackage" (
    "id" text not null primary key,
    "shipmentId" text not null,
    "labelUrl" text,
    "packageCode" text,
    "trackingNumber" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "ShipmentPackage_shipmentId_idx"
    on "ShipmentPackage" ("shipmentId");
  `,
  `
  create table if not exists "ShipmentStatusHistory" (
    "id" text not null primary key,
    "shipmentId" text not null,
    "fromStatus" text,
    "toStatus" text not null,
    "note" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "ShipmentStatusHistory_shipmentId_createdAt_idx"
    on "ShipmentStatusHistory" ("shipmentId", "createdAt");
  `,
  `
  create table if not exists "Invoice" (
    "id" text not null primary key,
    "accountKey" text,
    "salesOrderId" text,
    "externalInvoiceId" text not null,
    "invoiceNumber" text,
    "series" text,
    "status" text not null,
    "statusLabel" text,
    "issuedAt" timestamp(3),
    "authorizedAt" timestamp(3),
    "canceledAt" timestamp(3),
    "totalAmount" double precision,
    "xmlUrl" text,
    "danfeUrl" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create unique index if not exists "Invoice_accountKey_externalInvoiceId_key"
    on "Invoice" ("accountKey", "externalInvoiceId");
  `,
  `
  create index if not exists "Invoice_salesOrderId_idx"
    on "Invoice" ("salesOrderId");
  `,
  `
  create index if not exists "Invoice_status_updatedAt_idx"
    on "Invoice" ("status", "updatedAt");
  `,
  `
  create table if not exists "InvoiceItem" (
    "id" text not null primary key,
    "invoiceId" text not null,
    "catalogVariantId" text,
    "sku" text,
    "productName" text,
    "quantity" integer,
    "unitPrice" double precision,
    "totalPrice" double precision,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp,
    "updatedAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "InvoiceItem_invoiceId_idx"
    on "InvoiceItem" ("invoiceId");
  `,
  `
  create index if not exists "InvoiceItem_catalogVariantId_idx"
    on "InvoiceItem" ("catalogVariantId");
  `,
  `
  create index if not exists "InvoiceItem_sku_idx"
    on "InvoiceItem" ("sku");
  `,
  `
  create table if not exists "InvoiceStatusHistory" (
    "id" text not null primary key,
    "invoiceId" text not null,
    "fromStatus" text,
    "toStatus" text not null,
    "note" text,
    "rawPayload" text,
    "createdAt" timestamp(3) not null default current_timestamp
  );
  `,
  `
  create index if not exists "InvoiceStatusHistory_invoiceId_createdAt_idx"
    on "InvoiceStatusHistory" ("invoiceId", "createdAt");
  `
];

async function applyFoundationDdl() {
  for (const statement of foundationStatements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function syncReferenceRows() {
  for (const item of PEPPER_SIZE_REFERENCES) {
    await prisma.pepperSizeReference.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      },
      create: {
        code: item.code,
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      }
    });
  }

  for (const item of PEPPER_COLOR_REFERENCES) {
    await prisma.pepperColorReference.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      },
      create: {
        code: item.code,
        label: item.label,
        sortOrder: item.sortOrder,
        active: true
      }
    });
  }

  for (const item of PEPPER_TINY_ACCOUNT_REFERENCES) {
    await prisma.pepperTinyAccountReference.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        role: item.role,
        sortOrder: item.sortOrder,
        active: item.active,
        sharesGroupStock: item.sharesGroupStock,
        readsAvailableMultiCompany: item.readsAvailableMultiCompany,
        handlesCatalogImport: item.handlesCatalogImport,
        handlesPhysicalStock: item.handlesPhysicalStock,
        zeroBalanceOnCount: item.zeroBalanceOnCount,
        salesAffectSharedStock: item.salesAffectSharedStock
      },
      create: {
        key: item.key,
        label: item.label,
        role: item.role,
        sortOrder: item.sortOrder,
        active: item.active,
        sharesGroupStock: item.sharesGroupStock,
        readsAvailableMultiCompany: item.readsAvailableMultiCompany,
        handlesCatalogImport: item.handlesCatalogImport,
        handlesPhysicalStock: item.handlesPhysicalStock,
        zeroBalanceOnCount: item.zeroBalanceOnCount,
        salesAffectSharedStock: item.salesAffectSharedStock
      }
    });
  }
}

async function validateFoundationStructure() {
  const [sizeCount, colorCount, accountCount] = await Promise.all([
    prisma.pepperSizeReference.count(),
    prisma.pepperColorReference.count(),
    prisma.pepperTinyAccountReference.count()
  ]);

  const tablePresence = await prisma.$queryRawUnsafe<
    Array<{
      FoundationInboundEvent: string | null;
      FoundationAsset: string | null;
      CatalogVariantAccountState: string | null;
      FoundationStockMovement: string | null;
      FoundationContact: string | null;
      PickingSeparation: string | null;
      Shipment: string | null;
      Invoice: string | null;
    }>
  >(
    `select
      to_regclass('"FoundationInboundEvent"') as "FoundationInboundEvent",
      to_regclass('"FoundationAsset"') as "FoundationAsset",
      to_regclass('"CatalogVariantAccountState"') as "CatalogVariantAccountState",
      to_regclass('"FoundationStockMovement"') as "FoundationStockMovement",
      to_regclass('"FoundationContact"') as "FoundationContact",
      to_regclass('"PickingSeparation"') as "PickingSeparation",
      to_regclass('"Shipment"') as "Shipment",
      to_regclass('"Invoice"') as "Invoice"`
  );

  return { sizeCount, colorCount, accountCount, tablePresence: tablePresence[0] };
}

async function main() {
  console.log("[RUN] applying foundation structure");
  await applyFoundationDdl();

  console.log("[RUN] syncing foundation references");
  await syncReferenceRows();

  const result = await validateFoundationStructure();
  console.log(
    `[OK] foundation structure applied: ${result.sizeCount} tamanhos, ${result.colorCount} cores, ${result.accountCount} contas Tiny.`
  );
  console.log("[OK] canonical domains:", result.tablePresence);
}

main()
  .catch((error) => {
    console.error("[FAIL] apply-foundation-structure", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
