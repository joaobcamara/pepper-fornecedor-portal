# Checklist de Validacao Viva da Fundacao

Data base: 2026-04-16

## Objetivo

Validar a trilha real:

- Tiny
- webhook
- fundacao no Supabase
- reflexo no portal

Sem depender de achismo.

## Pre-requisitos

### Webhooks ativos

- `sales` nas 3 contas
- `orders` nas 3 contas
- `stock` nas 3 contas

### Regra oficial de estoque

- o saldo oficial do portal = `saldo multiempresa`
- qualquer webhook de estoque = reconciliacao do saldo atual
- se o Tiny ja reduziu o saldo por reserva de pedido aprovado, a fundacao deve refletir essa reducao

## Verificador oficial

Comando:

```bash
npm run foundation:live-check -- --sku=01-2504 --limit=10
```

Filtros opcionais:

```bash
npm run foundation:live-check -- --sku=01-2504 --account=pepper --limit=10
npm run foundation:live-check -- --sku=01-2504-22-01 --account=showlook --limit=15
npm run foundation:live-check -- --account=onshop --limit=20
```

O script mostra:

- `CatalogVariant` / `CatalogProduct`
- `CatalogInventory`
- `CatalogTinyMapping`
- `TinyWebhookLog`
- `SyncRun`
- `SalesOrder` / `SalesOrderItem`
- metricas diarias quando existirem

## Roteiro de teste

### 1. Pepper: estoque

Fazer uma mudanca pequena e reversivel em um SKU conhecido.

Exemplo:

- `01-2504`

Esperado:

- webhook `stock` recebido
- `CatalogInventory.availableMultiCompanyStock` atualizado
- `TinyWebhookLog` com `webhookType = stock`
- `processingStage` coerente com reconciliacao

## 2. Show Look: pedido/reserva

Criar ou atualizar um pedido real/teste com SKU compartilhado.

Esperado:

- entrada em `SalesOrder`
- item em `SalesOrderItem`
- webhook `sales/orders`
- se o Tiny reduzir o saldo multiempresa pela reserva, o proximo sinal de estoque deve atualizar a fundacao

## 3. On Shop: pedido/reserva

Repetir o mesmo teste da Show Look.

Esperado:

- mesma trilha de pedido
- mesma reflexao de saldo quando o Tiny publicar o novo saldo multiempresa

## Onde conferir no portal

- `/admin/sincronizacoes`
- `/admin/produtos`
- modal de produto/importacao quando o SKU existir na fundacao

## O que considerar sucesso

### Produto / estoque

- o SKU aparece em `Catalog*`
- o saldo oficial bate com o multiempresa do Tiny
- a variacao mostra `lastStockSyncAt`

### Pedido / vendas

- `SalesOrder` entra com `tinyOrderId` escopado por conta
- `SalesOrderItem` entra com SKU correto
- historico/status nao duplica de forma indevida

### Observabilidade

- `TinyWebhookLog` mostra conta, tipo, SKU e status
- `SyncRun` mostra a trilha da sincronizacao

## Quando algo falhar

### SKU nao existe na fundacao

- importar/consolidar primeiro pela Pepper
- depois repetir o teste

### Webhook chegou, mas saldo nao mudou

- rodar `foundation:live-check`
- confirmar `CatalogTinyMapping`
- conferir se o Tiny realmente alterou o `saldo multiempresa`

### Pedido entrou sem metrica

- conferir se a variante esta ligada a `CatalogVariant`
- conferir se o SKU do item veio exato

## Regra de ouro

- o Tiny decide o saldo multiempresa oficial
- a fundacao espelha esse saldo
- o portal consome a fundacao
