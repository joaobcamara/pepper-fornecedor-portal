do $$
begin
  create type "PepperTinyAccountRole" as enum ('MATRIX', 'DEPENDENT');
exception
  when duplicate_object then null;
end $$;

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

create index if not exists "PepperTinyAccountReference_active_sortOrder_idx"
  on "PepperTinyAccountReference" ("active", "sortOrder");

alter table "CatalogTinyMapping"
  add column if not exists "accountKey" text not null default 'pepper';

drop index if exists "CatalogTinyMapping_entityType_sku_key";

create unique index if not exists "CatalogTinyMapping_accountKey_entityType_sku_key"
  on "CatalogTinyMapping" ("accountKey", "entityType", "sku");

create index if not exists "CatalogTinyMapping_accountKey_tinyId_idx"
  on "CatalogTinyMapping" ("accountKey", "tinyId");

-- Depois de aplicar, execute:
-- npm run foundation:references:sync
