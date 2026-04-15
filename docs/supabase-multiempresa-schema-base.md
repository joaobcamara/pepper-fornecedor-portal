# Supabase Multiempresa Schema Base

## Objetivo

Este documento traduz o plano mestre multiempresa em uma base de schema organizada por dominio para o Supabase.

Ele nao representa a implementacao final completa de todos os modulos, mas sim a fundacao estrutural correta para:

- Pepper como matriz
- Show Look e On Shop como dependentes
- catalogo central por SKU
- operacao por conta Tiny
- Atendimento IA e futuras IAs especializadas

---

## Dominio 1. Empresas e integracoes

### `companies`

Representa as empresas/contas do ecossistema.

Campos principais:

- `id uuid pk`
- `slug text unique`
- `name text`
- `legal_name text nullable`
- `type text`
  - `MATRIX`
  - `DEPENDENT`
- `is_primary boolean`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Exemplos:

- Pepper
- Show Look
- On Shop

### `company_api_accounts`

Guarda configuracao de integracao por conta.

Campos:

- `id uuid pk`
- `company_id uuid fk -> companies.id`
- `provider text`
- `account_label text`
- `base_url text nullable`
- `token_env_key text`
- `webhook_secret_env_key text nullable`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### `company_webhook_sources`

Controla origem de webhooks e validacao.

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `provider text`
- `event_type text`
- `endpoint_path text`
- `secret_env_key text nullable`
- `active boolean`
- `created_at timestamptz`

---

## Dominio 2. Catalogo mestre

### `catalog_products`

Produto pai logico compartilhado pelo grupo.

Campos:

- `id uuid pk`
- `sku_parent text unique`
- `base_code text nullable`
- `name text`
- `brand text nullable`
- `category_path text nullable`
- `material text nullable`
- `composition text nullable`
- `gender text nullable`
- `model text nullable`
- `style text nullable`
- `description_short text nullable`
- `description_long text nullable`
- `sales_context_ai text nullable`
- `search_text text nullable`
- `intent_tags jsonb nullable`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### `catalog_variants`

Variacao logica compartilhada por SKU.

Campos:

- `id uuid pk`
- `catalog_product_id uuid fk -> catalog_products.id`
- `sku text unique`
- `quantity_code text nullable`
- `size_code text nullable`
- `size_label text nullable`
- `color_code text nullable`
- `color_label text nullable`
- `active boolean`
- `sales_context_ai text nullable`
- `search_text text nullable`
- `intent_tags jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `catalog_variant_company_links`

Amarra a variacao logica a cada conta Tiny.

Campos:

- `id uuid pk`
- `catalog_variant_id uuid fk -> catalog_variants.id`
- `company_id uuid fk -> companies.id`
- `sku text`
- `tiny_product_id bigint nullable`
- `tiny_parent_id bigint nullable`
- `tiny_code text nullable`
- `last_sync_at timestamptz nullable`
- `sync_status text nullable`
- `raw_payload jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

Indice importante:

- unique(`catalog_variant_id`, `company_id`)

### `catalog_inventory_group`

Leitura principal do estoque do grupo.

Campos:

- `id uuid pk`
- `catalog_variant_id uuid fk -> catalog_variants.id`
- `available_multi_company_stock numeric(14,2)`
- `stock_status text nullable`
- `last_stock_sync_at timestamptz nullable`
- `inventory_sync_status text nullable`
- `source_company_id uuid nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `catalog_inventory_company_snapshots`

Snapshot de estoque por conta para apoio e auditoria.

Campos:

- `id uuid pk`
- `catalog_variant_id uuid fk`
- `company_id uuid fk`
- `tiny_product_id bigint nullable`
- `available_multi_company_stock numeric(14,2) nullable`
- `snapshot_at timestamptz`
- `payload jsonb nullable`

### `catalog_prices`

Preco base da variacao.

Campos:

- `id uuid pk`
- `catalog_variant_id uuid fk`
- `company_id uuid nullable fk`
- `price_sale numeric(14,2) nullable`
- `price_promotional numeric(14,2) nullable`
- `price_cost numeric(14,2) nullable`
- `currency text default 'BRL'`
- `source text nullable`
- `synced_at timestamptz nullable`

### `catalog_price_lists`

Listas de preco por empresa ou politica comercial.

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_price_list_id bigint nullable`
- `name text`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### `catalog_price_list_exceptions`

Excecoes por produto/variacao em listas de preco.

Campos:

- `id uuid pk`
- `price_list_id uuid fk -> catalog_price_lists.id`
- `catalog_product_id uuid nullable fk`
- `catalog_variant_id uuid nullable fk`
- `price_sale numeric(14,2) nullable`
- `price_promotional numeric(14,2) nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `catalog_categories`

Arvore de categorias consolidada.

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `tiny_category_id bigint nullable`
- `parent_id uuid nullable fk -> catalog_categories.id`
- `name text`
- `path text`
- `level int nullable`
- `active boolean`

### `catalog_tag_groups`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_tag_group_id bigint nullable`
- `name text`
- `active boolean`
- `created_at timestamptz`

### `catalog_tags`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tag_group_id uuid nullable fk -> catalog_tag_groups.id`
- `tiny_tag_id bigint nullable`
- `name text`
- `active boolean`
- `created_at timestamptz`

### `catalog_product_tags`

Relaciona tags com produto ou variacao.

Campos:

- `id uuid pk`
- `catalog_product_id uuid nullable fk`
- `catalog_variant_id uuid nullable fk`
- `catalog_tag_id uuid fk -> catalog_tags.id`
- `created_at timestamptz`

### `catalog_images`

Campos:

- `id uuid pk`
- `catalog_product_id uuid nullable fk`
- `catalog_variant_id uuid nullable fk`
- `company_id uuid nullable fk`
- `image_type text nullable`
- `url text`
- `is_primary boolean`
- `sort_order int nullable`
- `created_at timestamptz`

### `catalog_marketplace_listings`

Campos:

- `id uuid pk`
- `catalog_product_id uuid fk`
- `company_id uuid fk`
- `marketplace text`
- `listing_id text nullable`
- `listing_title text nullable`
- `listing_url text nullable`
- `status text nullable`
- `price numeric(14,2) nullable`
- `promotional_price numeric(14,2) nullable`
- `last_sync_at timestamptz nullable`
- `raw_payload jsonb nullable`

---

## Dominio 3. Contatos, clientes e fornecedores

### `contacts`

Cadastro operacional vindo do Tiny.

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_contact_id bigint nullable`
- `contact_type text nullable`
- `name text`
- `legal_name text nullable`
- `document_number text nullable`
- `email text nullable`
- `phone text nullable`
- `mobile_phone text nullable`
- `city text nullable`
- `state text nullable`
- `country text nullable`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### `customer_profiles`

Perfil consolidado do cliente.

Campos:

- `id uuid pk`
- `primary_contact_id uuid nullable fk -> contacts.id`
- `name text`
- `email text nullable`
- `phone text nullable`
- `mobile_phone text nullable`
- `document_number text nullable`
- `sales_context_ai text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `customer_company_links`

Relaciona o cliente com cada empresa.

Campos:

- `id uuid pk`
- `customer_profile_id uuid fk -> customer_profiles.id`
- `company_id uuid fk -> companies.id`
- `contact_id uuid nullable fk -> contacts.id`
- `is_crm_eligible boolean`
- `first_purchase_at timestamptz nullable`
- `last_purchase_at timestamptz nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `supplier_profiles`

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `contact_id uuid nullable fk`
- `name text`
- `email text nullable`
- `phone text nullable`
- `document_number text nullable`
- `active boolean`

### `vendors`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_vendor_id bigint nullable`
- `name text`
- `email text nullable`
- `phone text nullable`
- `active boolean`

---

## Dominio 4. CRM

### Regra

So deve existir pipeline de CRM se houver pelo menos:

- email
- telefone
- celular

Sem isso, nao cria entidade CRM.

### `crm_stages`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_stage_id bigint nullable`
- `name text`
- `sort_order int nullable`
- `active boolean`

### `crm_subjects`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `customer_profile_id uuid nullable fk`
- `contact_id uuid nullable fk`
- `vendor_id uuid nullable fk`
- `tiny_crm_subject_id bigint nullable`
- `crm_stage_id uuid nullable fk -> crm_stages.id`
- `subject text`
- `status text nullable`
- `priority text nullable`
- `source text nullable`
- `summary text nullable`
- `crm_context_ai text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `crm_actions`

Campos:

- `id uuid pk`
- `crm_subject_id uuid fk -> crm_subjects.id`
- `tiny_crm_action_id bigint nullable`
- `action_type text nullable`
- `description text`
- `status text nullable`
- `due_at timestamptz nullable`
- `completed_at timestamptz nullable`
- `created_at timestamptz`

---

## Dominio 5. Pedidos e comercial

### `sales_orders`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `customer_profile_id uuid nullable fk`
- `contact_id uuid nullable fk`
- `tiny_order_id bigint nullable`
- `order_number text`
- `channel text nullable`
- `status text nullable`
- `total_amount numeric(14,2) nullable`
- `discount_amount numeric(14,2) nullable`
- `shipping_amount numeric(14,2) nullable`
- `placed_at timestamptz nullable`
- `approved_at timestamptz nullable`
- `order_context_ai text nullable`
- `raw_payload jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `sales_order_items`

Campos:

- `id uuid pk`
- `sales_order_id uuid fk -> sales_orders.id`
- `catalog_product_id uuid nullable fk`
- `catalog_variant_id uuid nullable fk`
- `sku text nullable`
- `description text`
- `quantity numeric(14,2)`
- `unit_price numeric(14,2) nullable`
- `total_price numeric(14,2) nullable`
- `raw_payload jsonb nullable`

### `sales_order_status_history`

Campos:

- `id uuid pk`
- `sales_order_id uuid fk -> sales_orders.id`
- `from_status text nullable`
- `to_status text`
- `changed_at timestamptz`
- `note text nullable`

### `sales_order_markers`

Campos:

- `id uuid pk`
- `sales_order_id uuid fk -> sales_orders.id`
- `marker text`
- `created_at timestamptz`

---

## Dominio 6. Financeiro

### `payment_methods`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_payment_method_id bigint nullable`
- `name text`
- `active boolean`

### `accounts_receivable`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `customer_profile_id uuid nullable fk`
- `sales_order_id uuid nullable fk`
- `tiny_receivable_id bigint nullable`
- `document_number text nullable`
- `status text nullable`
- `amount numeric(14,2)`
- `balance_amount numeric(14,2) nullable`
- `due_date date nullable`
- `issued_at timestamptz nullable`
- `paid_at timestamptz nullable`
- `payment_method_id uuid nullable fk -> payment_methods.id`
- `financial_context_ai text nullable`
- `raw_payload jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `accounts_receivable_settlements`

Campos:

- `id uuid pk`
- `account_receivable_id uuid fk -> accounts_receivable.id`
- `amount numeric(14,2)`
- `settled_at timestamptz`
- `payment_method_id uuid nullable fk`
- `note text nullable`

### `invoices`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `sales_order_id uuid nullable fk`
- `customer_profile_id uuid nullable fk`
- `tiny_invoice_id bigint nullable`
- `invoice_number text nullable`
- `series text nullable`
- `status text nullable`
- `issued_at timestamptz nullable`
- `xml_url text nullable`
- `invoice_link text nullable`
- `raw_payload jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `invoice_markers`

Campos:

- `id uuid pk`
- `invoice_id uuid fk -> invoices.id`
- `marker text`
- `created_at timestamptz`

---

## Dominio 7. Logistica

### `shipments`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `sales_order_id uuid nullable fk`
- `invoice_id uuid nullable fk`
- `tiny_shipment_id bigint nullable`
- `status text nullable`
- `tracking_code text nullable`
- `shipping_method_id uuid nullable fk`
- `dispatched_at timestamptz nullable`
- `delivered_at timestamptz nullable`
- `logistics_context_ai text nullable`
- `raw_payload jsonb nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `shipment_groupings`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_grouping_id bigint nullable`
- `name text nullable`
- `status text nullable`
- `created_at timestamptz`

### `shipping_methods`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `tiny_shipping_method_id bigint nullable`
- `name text`
- `carrier_name text nullable`
- `active boolean`

### `freight_quotes`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `sales_order_id uuid nullable fk`
- `customer_profile_id uuid nullable fk`
- `destination_zip_code text nullable`
- `carrier_name text nullable`
- `service_name text nullable`
- `price numeric(14,2) nullable`
- `deadline_days int nullable`
- `raw_payload jsonb nullable`
- `quoted_at timestamptz`

### `picking_separations`

Campos:

- `id uuid pk`
- `company_id uuid fk`
- `sales_order_id uuid nullable fk`
- `tiny_separation_id bigint nullable`
- `status text nullable`
- `started_at timestamptz nullable`
- `finished_at timestamptz nullable`
- `raw_payload jsonb nullable`

### `tracking_events`

Campos:

- `id uuid pk`
- `shipment_id uuid fk -> shipments.id`
- `event_type text`
- `description text nullable`
- `event_at timestamptz`
- `raw_payload jsonb nullable`

---

## Dominio 8. Integracao e observabilidade

### `integration_sync_runs`

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `domain text`
- `resource_type text`
- `trigger_type text`
- `status text`
- `started_at timestamptz`
- `finished_at timestamptz nullable`
- `records_processed int default 0`
- `error_message text nullable`

### `integration_sync_errors`

Campos:

- `id uuid pk`
- `sync_run_id uuid nullable fk -> integration_sync_runs.id`
- `company_id uuid nullable fk`
- `domain text`
- `resource_type text`
- `external_id text nullable`
- `message text`
- `payload jsonb nullable`
- `created_at timestamptz`

### `integration_raw_payloads`

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `provider text`
- `domain text`
- `resource_type text`
- `external_id text nullable`
- `payload jsonb`
- `received_at timestamptz`

### `tiny_webhook_logs`

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `event_type text`
- `status text`
- `external_id text nullable`
- `payload jsonb`
- `error_message text nullable`
- `received_at timestamptz`
- `processed_at timestamptz nullable`

### `integration_reconcile_jobs`

Campos:

- `id uuid pk`
- `company_id uuid nullable fk`
- `domain text`
- `resource_type text`
- `status text`
- `started_at timestamptz`
- `finished_at timestamptz nullable`
- `note text nullable`

---

## Dominio 9. Views para IA

### `ai_product_catalog`

Uma linha por variacao.

Deve expor:

- empresa primaria e empresas relacionadas
- SKU
- nome
- cor
- tamanho
- estoque do grupo
- preco
- tags
- categoria
- imagem principal
- `sales_context_ai`

### `ai_customer_360`

Deve expor:

- cliente
- empresas onde compra
- ultimo pedido por empresa
- total de pedidos
- total comprado
- canais
- contexto textual para atendimento

### `ai_order_360`

Deve expor:

- pedido
- empresa
- cliente
- itens
- status
- nota
- rastreio
- contexto textual

### `ai_crm_360`

Deve expor:

- cliente
- empresa
- assunto
- estagio
- proxima acao
- vendedor

### `ai_financial_360`

Deve expor:

- cliente
- empresa
- titulos em aberto
- historico de pagamento
- proximos vencimentos

### `ai_logistics_360`

Deve expor:

- pedido
- empresa
- expedicao
- rastreio
- separacao
- forma de envio

---

## Regra de modelagem importante

Sempre que fizer sentido, preservar dois niveis:

### Nivel logico compartilhado

- `catalog_products`
- `catalog_variants`
- `customer_profiles`

### Nivel operacional por empresa

- `company_id`
- ids Tiny locais
- payload bruto
- logs
- snapshots

Isso garante:

- visao central do grupo
- rastreabilidade por empresa
- respostas corretas das IAs
- reutilizacao da base em projetos futuros
