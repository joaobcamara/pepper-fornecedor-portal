# Matriz de Integracoes e Webhooks da Fundacao

Data base: 2026-04-15

## Objetivo

Registrar:

- o que ja esta ativo no codigo
- o que ja esta alimentando a fundacao de verdade
- o que existe so como rota/capacidade
- o que ainda esta apenas planejado

## Legenda de status

- `ATIVO`: implementado e alimentando a fundacao
- `IMPLEMENTADO_SEM_DADOS`: existe no codigo, mas a tabela esta vazia
- `ESTRUTURA_PADRONIZADA`: schema/documentacao preparados para receber o dominio, mesmo antes da ingestao real
- `PLANEJADO`: existe na arquitetura/documentacao, mas nao no fluxo real

## 1. Catalogo e produto

### Tiny APIs

- `produtos.pesquisa.php`
- `produto.obter.php`
- `produto.obter.estrutura.php`
- `produto.obter.estoque.php`

### Rotas internas

- `POST /api/admin/tiny/inspect`
- `POST /api/admin/tiny/import`

### Tabelas da fundacao

- `Product`
- `ProductSupplier`
- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

### Status

- codigo: `ATIVO`
- dados reais: `ATIVO`, mas hoje com volume muito pequeno

### Observacoes

- fluxo atual e foundation-first com fallback para Tiny Pepper
- hoje so a familia `01-2504` esta consistente no banco
- `Catalog*` deve virar a leitura oficial

## 2. Estoque

### Tiny APIs

- `produto.obter.estoque.php`

### Webhook/rotas

- `POST /api/tiny/webhooks/stock`
- `POST /api/internal/reconcile-stock`
- `POST /api/admin/sincronizacoes/reconcile`
- `POST /api/supplier/sync`

### Tabelas da fundacao

- `InventorySnapshot`
- `CatalogInventory`
- `TinyWebhookLog`
- `SyncRun`

### Status

- codigo: `ATIVO`
- dados reais:
  - `InventorySnapshot`: `ATIVO`
  - `CatalogInventory`: `ATIVO`
  - `TinyWebhookLog`: `IMPLEMENTADO_SEM_DADOS`
  - `SyncRun`: `IMPLEMENTADO_SEM_DADOS`

### Observacoes

- o saldo real hoje ja chega em `InventorySnapshot` e reflete em `CatalogInventory`
- a rastreabilidade de webhook/sync ainda nao esta sendo registrada na pratica

## 3. Pedidos e vendas

### Tiny APIs

- `pedido.obter.php`
- `pedidos.pesquisa.php`
- `contato.obter.php`

### Webhook/rotas

- `POST /api/tiny/webhooks/sales`
- `POST /api/admin/sincronizacoes/reconcile-sales`

### Tabelas da fundacao

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `Customer`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`
- `TinyWebhookLog`
- `SyncRun`

### Status

- codigo: `ATIVO`
- dados reais: `IMPLEMENTADO_SEM_DADOS`

### Observacoes

- a camada existe e foi programada
- os pedidos reais informados na auditoria ainda nao apareceram nessa estrutura
- este e hoje o principal bloqueador da Pepper IA de 30 dias

## 4. Cadastro enviado ao Tiny

### Tiny APIs

- `produto.incluir.php`

### Componentes

- helper: `lib/tiny-cadastro.ts`

### Rotas

- `POST /api/admin/suggestions/send-to-tiny`

### Status

- helper tecnico: `ATIVO`
- endpoint publico do portal: `descontinuado`
- resposta atual: `410`

### Observacoes

- o caminho oficial atual e aprovar na fila interna do Supabase
- o envio direto ao Tiny nao e mais o fluxo padrao do portal

## 5. CRM

### Tiny APIs previstas

- lista de estagio dos assuntos do CRM
- pesquisar assuntos do CRM
- obter assunto do CRM
- incluir assunto do CRM
- incluir acao no assunto do CRM
- alterar estagio do assunto do CRM
- alterar situacao da acao do assunto do CRM

### Tabelas previstas

- `FoundationContact`

### Status

- arquitetura: `ESTRUTURA_PADRONIZADA`
- codigo no portal atual: `PLANEJADO`
- dados na fundacao atual: `PLANEJADO`

## 6. Listas de preco

### Tiny APIs previstas

- pesquisar listas de precos
- excecoes das listas de precos
- atualizar precos dos produtos

### Tabelas previstas

- `CatalogPrice`
- `FoundationPriceList`
- `FoundationPriceListItem`

### Status

- arquitetura: `ESTRUTURA_PADRONIZADA`
- codigo real do portal: `PLANEJADO`
- dados na fundacao atual: `PLANEJADO`

## 7. Contas a receber

### Tiny APIs previstas

- incluir conta a receber
- alterar conta a receber
- obter conta a receber
- pesquisar contas a receber
- baixar conta a receber

### Tabelas previstas

- `FoundationInboundEvent`
- `Invoice`
- `InvoiceStatusHistory`

### Status

- arquitetura: `PLANEJADO`
- codigo real do portal: `PLANEJADO`

## 8. Notas fiscais

### Tiny APIs previstas

- pesquisar notas
- obter nota
- incluir nota
- obter xml
- obter link
- emitir nota
- lancar estoque da nota fiscal
- lancar contas da nota fiscal

### Tabelas previstas

- `Invoice`
- `InvoiceItem`
- `InvoiceStatusHistory`
- `FoundationAsset`

### Status

- arquitetura: `ESTRUTURA_PADRONIZADA`
- codigo real do portal: `PLANEJADO`

## 9. Expedicao, separacao e rastreio

### Tiny APIs previstas

- enviar objetos para expedicao
- pesquisar expedicoes
- pesquisar agrupamentos
- obter expedicao
- alterar expedicao
- pesquisar separacoes
- obter separacao
- alterar situacao de separacao

### Tabelas previstas

- `Shipment`
- `ShipmentGrouping`
- `PickingSeparation`
- `PickingSeparationItem`
- `PickingSeparationStatusHistory`
- `ShipmentPackage`
- `ShipmentStatusHistory`
- `FoundationAsset`

### Status

- arquitetura: `ESTRUTURA_PADRONIZADA`
- codigo real do portal: `PLANEJADO`

### Observacoes

- o ID de separacao `902894857` ainda nao tem destino em tabela ativa no banco atual

## 10. Referencias oficiais da fundacao

### Tabelas ativas

- `PepperSizeReference`
- `PepperColorReference`
- `PepperTinyAccountReference`

### Status

- `ATIVO`

### Observacoes

- esta camada ja esta pronta para orientar todos os sistemas consumidores

## 11. PrintNode

### Dominio

- impressao operacional
- agrupamentos
- etiquetas
- notas

### Papel na fundacao

- consumir `Shipment`
- consumir `ShipmentGrouping`
- consumir `PickingSeparation`
- consumir `Invoice`
- registrar jobs de impressao quando este dominio for ativado

### Status

- arquitetura: `PLANEJADO`
- credencial: `DISPONIVEL`
- codigo real do portal: `PLANEJADO`

## 12. SendPulse

### Dominio

- atendimento
- notificacoes
- conversas
- CRM operacional

### Papel na fundacao

- consumir `Conversation`
- consumir `Supplier`
- consumir `SalesOrder`
- consumir futuros dominios de CRM e expedicao

### Status

- arquitetura: `PLANEJADO`
- credencial: `DISPONIVEL`
- codigo real do portal: `PLANEJADO`

## 13. Marketplaces externos

### Plataformas

- Mercado Livre
- Shopee Brasil
- TikTok Shop
- Magalu Seller

### Dominio

- anuncios
- pedidos por canal
- preco por canal
- despacho por canal
- rastreio por canal

### Papel na fundacao

- consumir catalogo central
- consumir politica de preco
- alimentar pedidos por canal
- alimentar status logistico por canal

### Status

- Mercado Livre
  - arquitetura: `PLANEJADO`
  - credencial: `PARCIAL`
- Shopee Brasil
  - arquitetura: `PLANEJADO`
  - credencial: `PENDENTE`
- TikTok Shop
  - arquitetura: `PLANEJADO`
  - credencial: `PENDENTE`
- Magalu Seller
  - arquitetura: `PLANEJADO`
  - credencial: `PENDENTE`

## 14. Melhor Envio

### Dominio

- frete
- cotacao
- etiquetas
- rastreio
- impressao logistica

### Papel na fundacao

- consumir `Shipment`
- consumir `ShipmentGrouping`
- consumir `ShippingMethod`
- consumir `FreightQuote`
- consumir `TrackingEvent`

### Status

- arquitetura: `PLANEJADO`
- credencial: `PENDENTE`
- codigo real do portal: `PLANEJADO`

## 15. Mercado Pago

### Dominio

- pagamento
- cobranca
- recebimento
- baixa financeira

### Papel na fundacao

- consumir `AccountsReceivable`
- consumir `AccountsReceivableSettlement`
- consumir `SalesOrder`
- consumir `Invoice`

### Status

- arquitetura: `PLANEJADO`
- credencial: `PENDENTE`
- codigo real do portal: `PLANEJADO`

## Checklist operacional de consolidacao

### Ja pronto

- produto basico
- estoque basico
- referencias Pepper
- matriz/dependentes Tiny

### Precisa consolidar agora

- pedidos e metricas
- logs de webhook
- logs de sync
- fonte oficial unica de leitura por dominio

### Proxima ordem recomendada

1. consolidar `Catalog*` como leitura oficial
2. ativar ingestao real de `Sales*`
3. ativar observabilidade em `TinyWebhookLog` e `SyncRun`
4. abrir financeiro, NF e expedicao
