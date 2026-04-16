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

  return { sizeCount, colorCount, accountCount };
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
}

main()
  .catch((error) => {
    console.error("[FAIL] apply-foundation-structure", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
