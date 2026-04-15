-- Supabase Multiempresa Schema Base
-- Fundacao inicial por dominio para Pepper (matriz), Show Look e On Shop.
-- Este arquivo e uma base de partida arquitetural. Nao representa o rollout final completo.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_type_enum') then
    create type company_type_enum as enum ('MATRIX', 'DEPENDENT');
  end if;

  if not exists (select 1 from pg_type where typname = 'sync_status_enum') then
    create type sync_status_enum as enum ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR');
  end if;

  if not exists (select 1 from pg_type where typname = 'catalog_queue_status_enum') then
    create type catalog_queue_status_enum as enum ('DRAFT', 'READY', 'IMPORTED', 'ERROR');
  end if;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  type company_type_enum not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_api_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  account_label text not null,
  base_url text,
  token_env_key text not null,
  webhook_secret_env_key text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  sku_parent text not null unique,
  base_code text,
  name text not null,
  brand text,
  category_path text,
  material text,
  composition text,
  gender text,
  model text,
  style text,
  description_short text,
  description_long text,
  sales_context_ai text,
  search_text text,
  intent_tags jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_variants (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references public.catalog_products(id) on delete cascade,
  sku text not null unique,
  quantity_code text,
  size_code text,
  size_label text,
  color_code text,
  color_label text,
  active boolean not null default true,
  sales_context_ai text,
  search_text text,
  intent_tags jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_variant_company_links (
  id uuid primary key default gen_random_uuid(),
  catalog_variant_id uuid not null references public.catalog_variants(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sku text not null,
  tiny_product_id bigint,
  tiny_parent_id bigint,
  tiny_code text,
  last_sync_at timestamptz,
  sync_status sync_status_enum default 'PENDING',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_variant_id, company_id)
);

create table if not exists public.catalog_inventory_group (
  id uuid primary key default gen_random_uuid(),
  catalog_variant_id uuid not null unique references public.catalog_variants(id) on delete cascade,
  available_multi_company_stock numeric(14,2) not null default 0,
  stock_status text,
  last_stock_sync_at timestamptz,
  inventory_sync_status sync_status_enum default 'PENDING',
  source_company_id uuid references public.companies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tiny_contact_id bigint,
  contact_type text,
  name text not null,
  legal_name text,
  document_number text,
  email text,
  phone text,
  mobile_phone text,
  city text,
  state text,
  country text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  primary_contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  email text,
  phone text,
  mobile_phone text,
  document_number text,
  sales_context_ai text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_company_links (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  is_crm_eligible boolean not null default false,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_profile_id, company_id)
);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tiny_stage_id bigint,
  name text not null,
  sort_order integer,
  active boolean not null default true
);

create table if not exists public.crm_subjects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  crm_stage_id uuid references public.crm_stages(id) on delete set null,
  tiny_crm_subject_id bigint,
  subject text not null,
  status text,
  priority text,
  source text,
  summary text,
  crm_context_ai text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  tiny_order_id bigint,
  order_number text not null,
  channel text,
  status text,
  total_amount numeric(14,2),
  discount_amount numeric(14,2),
  shipping_amount numeric(14,2),
  placed_at timestamptz,
  approved_at timestamptz,
  order_context_ai text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  catalog_variant_id uuid references public.catalog_variants(id) on delete set null,
  sku text,
  description text not null,
  quantity numeric(14,2) not null default 1,
  unit_price numeric(14,2),
  total_price numeric(14,2),
  raw_payload jsonb
);

create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  tiny_receivable_id bigint,
  document_number text,
  status text,
  amount numeric(14,2) not null,
  balance_amount numeric(14,2),
  due_date date,
  issued_at timestamptz,
  paid_at timestamptz,
  financial_context_ai text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  tiny_shipment_id bigint,
  status text,
  tracking_code text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  logistics_context_ai text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  domain text not null,
  resource_type text not null,
  trigger_type text not null,
  status sync_status_enum not null default 'PENDING',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed integer not null default 0,
  error_message text
);

create table if not exists public.tiny_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  event_type text not null,
  status text not null,
  external_id text,
  payload jsonb not null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_catalog_variant_company_links_company on public.catalog_variant_company_links(company_id);
create index if not exists idx_contacts_company on public.contacts(company_id);
create index if not exists idx_sales_orders_company on public.sales_orders(company_id);
create index if not exists idx_sales_orders_customer on public.sales_orders(customer_profile_id);
create index if not exists idx_accounts_receivable_company on public.accounts_receivable(company_id);
create index if not exists idx_shipments_company on public.shipments(company_id);
create index if not exists idx_tiny_webhook_logs_company on public.tiny_webhook_logs(company_id);
