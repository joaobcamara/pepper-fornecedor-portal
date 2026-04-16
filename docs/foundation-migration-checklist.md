# Checklist Tecnico de Migracao para a Fundacao

Data base: 2026-04-16

## Objetivo

Transformar o portal atual de uma leitura mista para uma leitura padronizada da fundacao, com:

- `Catalog*` como fonte oficial de produto e estoque
- `Sales*` como fonte oficial de pedidos e metricas
- `TinyWebhookLog` e `SyncRun` como trilha obrigatoria de observabilidade

## Fonte oficial por dominio

### Produto e estoque

Ler de:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

Usar apenas como compatibilidade:

- `Product`
- `InventorySnapshot`

### Pedidos e metricas

Ler de:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

## Modulos que ainda leem `Product` hoje

### Prioridade alta

- `lib/dashboard-data.ts`
- `lib/supplier-dashboard-data.ts`
- `lib/supplier-orders-data.ts`
- `lib/foundation-product-inspection.ts`
- `lib/tiny-stock-events.ts`
- `lib/supplier-sync.ts`

### Prioridade media

- `lib/admin-data.ts`
- `app/api/admin/products/configure/route.ts`
- `app/api/admin/products/settings/route.ts`
- `app/api/supplier/replenishment-requests/route.ts`
- `lib/chat-shortcuts.ts`

### Observacao

Hoje alguns desses modulos ja cruzam `Product` com `CatalogVariant`, o que piora a consistencia.

Regra da migracao:

- onde houver leitura mista, a resposta final deve passar a nascer de `Catalog*`
- `Product` deve ser usado no maximo para compatibilidade e amarracao temporaria por `sourceProductId`

## Modulos ja mais alinhados com a fundacao

- `lib/admin-financial-data.ts`
- `lib/tiny-sales-events.ts`
- partes de `lib/admin-data.ts`
- partes de `lib/supplier-dashboard-data.ts`
- partes de `lib/supplier-orders-data.ts`

## Integracoes Tiny ativas no codigo

### APIs Tiny efetivamente usadas

- `produtos.pesquisa.php`
- `produto.obter.php`
- `produto.obter.estrutura.php`
- `produto.obter.estoque.php`
- `pedido.obter.php`
- `pedidos.pesquisa.php`
- `contato.obter.php`
- `produto.incluir.php` como capacidade tecnica

### Rotas do portal relacionadas

- `POST /api/admin/tiny/inspect`
- `POST /api/admin/tiny/import`
- `POST /api/tiny/webhooks/stock`
- `POST /api/tiny/webhooks/sales`
- `POST /api/internal/reconcile-stock`
- `POST /api/admin/sincronizacoes/reconcile`
- `POST /api/admin/sincronizacoes/reconcile-sales`
- `POST /api/supplier/sync`

## Ambientes e segredos obrigatorios

### Tiny

- `TINY_API_TOKEN`
- `TINY_SHOWLOOK_API_TOKEN`
- `TINY_ONSHOP_API_TOKEN`
- `TINY_WEBHOOK_SECRET`
- `TINY_API_BASE_URL`

### Fundacao / execucao

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## Checklist de ativacao real dos 3 Tiny

### 1. Cadastro / catalogo

- [ ] Confirmar Pepper como unica conta de importacao de catalogo
- [ ] Confirmar `CatalogTinyMapping.accountKey = pepper` para importacao de produto
- [ ] Confirmar `CatalogProduct` e `CatalogVariant` para SKUs reais alem de `01-2504`
- [ ] Backfill dos SKUs reais da Pepper para a fundacao

### 2. Estoque

- [ ] Confirmar webhook de estoque apontado para `/api/tiny/webhooks/stock`
- [ ] Confirmar segredo `TINY_WEBHOOK_SECRET` igual entre Tiny e portal
- [ ] Confirmar se os eventos estao registrando `TinyWebhookLog`
- [ ] Confirmar se reconciliacoes registram `SyncRun`
- [ ] Confirmar reflexo em `CatalogInventory.availableMultiCompanyStock`

### 3. Pedidos e metricas

- [ ] Confirmar backfill via `/api/admin/sincronizacoes/reconcile-sales`
- [ ] Confirmar busca dos 3 Tiny via `getConfiguredTinyAccounts()`
- [ ] Confirmar gravacao real em `SalesOrder` e `SalesOrderItem`
- [ ] Confirmar metricas em `VariantSalesMetricDaily`
- [ ] Confirmar metricas em `ProductSalesMetricDaily`
- [ ] Confirmar metricas em `SupplierSalesMetricDaily`
- [ ] Confirmar que os IDs reais enviados pelo negocio aparecem no Supabase

### 4. Observabilidade

- [ ] Toda ingestao externa deve gravar `TinyWebhookLog`
- [ ] Toda reconciliacao/importacao deve gravar `SyncRun`
- [ ] Criar painel admin de saude da fundacao

## Fases praticas de migracao

### Fase A. Produto e estoque

Objetivo:

- fazer o portal parar de depender de `Product` como leitura final

Entregas:

- trocar `dashboard-data`
- trocar `supplier-dashboard-data`
- trocar `supplier-orders-data`
- trocar `foundation-product-inspection`

### Fase B. Ingestao real de pedidos

Objetivo:

- alimentar `Sales*` e metricas

Entregas:

- backfill com IDs reais
- validacao dos 3 Tiny
- teste com pedidos reais do negocio

### Fase C. Observabilidade e operacao

Objetivo:

- garantir rastreabilidade de tudo

Entregas:

- log de webhook
- log de sync
- painel de saude

## Critério de aceite para cada migracao

Cada item so pode ser considerado concluido quando:

1. a rota/modulo funciona
2. a informacao chega na tabela oficial da fundacao
3. admin enxerga corretamente
4. fornecedor enxerga corretamente, quando aplicavel
5. o smoke automatizado passa
