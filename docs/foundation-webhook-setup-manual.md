# Manual de Configuracao de Webhooks Tiny -> Fundacao

Data base: 2026-04-16

## Objetivo

Definir a configuracao correta dos webhooks das 3 contas Tiny para a fundacao Grupo Pepper sem criar:

- duplicidade de pedidos
- contaminacao de estoque
- historico contraditorio entre Pepper, Show Look e On Shop

## Regras oficiais da fundacao

- `Pepper` = matriz
- `Show Look` = dependente
- `On Shop` = dependente
- pedidos e vendas devem entrar das 3 contas
- saldo oficial consumido pelo portal = `saldo multiempresa`
- qualquer webhook de estoque das 3 contas deve virar reconciliacao do saldo multiempresa
- Pepper continua como matriz de governanca, balanco e operacao fisica principal
- notas fiscais entram depois para enriquecer dominio fiscal/logistico, nao para decidir sozinhas o saldo oficial

## Rotas oficiais atualmente disponiveis

- `POST /api/tiny/webhooks/sales`
- `POST /api/tiny/webhooks/orders`
- `POST /api/tiny/webhooks/stock`

## Rotas curtas por conta

Para contas que apresentarem instabilidade ao salvar URL longa com `account=...`,
usar as rotas curtas dedicadas por conta:

- `POST /api/tiny/webhooks/pepper/sales`
- `POST /api/tiny/webhooks/pepper/orders`
- `POST /api/tiny/webhooks/showlook/sales`
- `POST /api/tiny/webhooks/showlook/orders`
- `POST /api/tiny/webhooks/onshop/sales`
- `POST /api/tiny/webhooks/onshop/orders`

### Observacao

`/api/tiny/webhooks/orders` e um alias semantico da mesma camada de pedido/venda.  
Ele existe para facilitar a configuracao no Tiny quando o painel separar "vendas" de "pedidos enviados".

As rotas curtas acima existem para reduzir o tamanho da URL e evitar depender do
parametro `account` na query string.

## Host atual

Enquanto o dominio final nao estiver apontado, usar:

- `https://fornecedor-portal.onrender.com`

Quando o dominio final entrar, substituir apenas o host.

## Segredo

As rotas aceitam o segredo pelo parametro de query:

- `?secret=<TINY_WEBHOOK_SECRET>`

Como o painel do Tiny mostrado hoje trabalha com URL simples, este e o formato recomendado.

## Configuracao recomendada agora

### 1. Receber notificacoes de vendas

Configurar nas 3 contas:

- Pepper:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/pepper/sales?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/sales?account=pepper&secret=<TINY_WEBHOOK_SECRET>`
- Show Look:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/showlook/sales?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/sales?account=showlook&secret=<TINY_WEBHOOK_SECRET>`
- On Shop:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/onshop/sales?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/sales?account=onshop&secret=<TINY_WEBHOOK_SECRET>`

### 2. Receber notificacoes de pedidos enviados

Configurar nas 3 contas:

- Pepper:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/pepper/orders?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/orders?account=pepper&secret=<TINY_WEBHOOK_SECRET>`
- Show Look:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/showlook/orders?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/orders?account=showlook&secret=<TINY_WEBHOOK_SECRET>`
- On Shop:
  - preferencial curto:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/onshop/orders?secret=<TINY_WEBHOOK_SECRET>`
  - compatibilidade:
    - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/orders?account=onshop&secret=<TINY_WEBHOOK_SECRET>`

### 3. Receber notificacoes de lancamentos de estoque

Configurar nas 3 contas:

- Pepper:
  - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/stock?account=pepper&secret=<TINY_WEBHOOK_SECRET>`
- Show Look:
  - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/stock?account=showlook&secret=<TINY_WEBHOOK_SECRET>`
- On Shop:
  - `https://fornecedor-portal.onrender.com/api/tiny/webhooks/stock?account=onshop&secret=<TINY_WEBHOOK_SECRET>`

### Observacao avancada

A rota `/api/tiny/webhooks/stock` trata o payload como sinal de reconciliacao.

Isso significa:

- webhook de estoque nao aplica delta cego na fundacao
- a fundacao usa a conta de origem e o SKU/ID recebidos para reconsultar o saldo atualizado no Tiny
- o valor persistido em `CatalogInventory` passa a ser sempre o saldo multiempresa reconsultado
- se o evento vier de `Show Look` ou `On Shop` sem contexto comercial, ele continua sendo marcado como `anomalia`, mas a reconciliacao do saldo acontece do mesmo jeito

### 4. Receber notificacoes de notas fiscais autorizadas

Deixar desligado por enquanto.

Motivo:

- o dominio fiscal da fundacao ainda nao esta ativo
- a fundacao ja deve refletir o saldo multiempresa que o Tiny passou a mostrar quando a reserva do pedido foi criada
- quando esse dominio entrar, a NF vai enriquecer status fiscal/logistico e reversoes, nao substituir a reconciliacao oficial de estoque

## Por que essa e a forma correta

### Pedidos e vendas

As 3 contas devem alimentar a fundacao porque:

- Pepper vende
- Show Look vende
- On Shop vende

E todas essas vendas impactam:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- metricas de venda
- Pepper IA

### Estoque

O saldo oficial do portal deve refletir o `saldo multiempresa` mais recente do Tiny.

Por isso:

- Pepper, Show Look e On Shop devem notificar estoque
- o webhook funciona como gatilho de reconciliacao
- a fundacao persiste o saldo multiempresa reconsultado, e nao o delta bruto do evento

Pepper continua sendo a matriz porque:

- centraliza governanca fisica
- continua sendo a conta oficial para balanco real
- continua sendo a conta permitida para movimentacao manual operacional

Mas o saldo visivel do portal precisa acompanhar o ecossistema multiempresa, inclusive quando a reserva do pedido nasce em conta dependente.

## Como a fundacao evita duplicidade hoje

### Pedido/venda

O pedido e salvo com chave escopada por conta:

- `pepper:<idTiny>`
- `showlook:<idTiny>`
- `onshop:<idTiny>`

Entao:

- o mesmo numero/id em contas diferentes nao colide
- eventos repetidos fazem `upsert` no mesmo `SalesOrder`
- `SalesOrderStatusHistory` so cria nova linha quando o status realmente muda

### Estoque

O saldo atual e salvo por `catalogVariantId` em `CatalogInventory` com `upsert`.

Entao:

- o saldo final nao duplica
- a notificacao apenas dispara a reconciliacao
- o valor salvo e sempre o saldo multiempresa reconsultado

Observacao importante:

- `InventorySnapshot` hoje registra historico por evento processado
- se o Tiny reenviar exatamente o mesmo webhook de estoque, o saldo final continua certo
- e a nova trilha de fingerprint reduz o risco de reprocessamento indevido

## Estrategia recomendada de operacao

### Tempo real

Usar webhooks para:

- vendas nas 3 contas
- pedidos enviados nas 3 contas
- estoque nas 3 contas

### Reconciliacao

Manter as rotas de conciliacao como fallback:

- `POST /api/admin/sincronizacoes/reconcile`
- `POST /api/admin/sincronizacoes/reconcile-sales`

Assim a fundacao fica com:

- atualizacao continua via webhook
- correcao retroativa via reconcile

## Teste minimo depois da configuracao

### Pepper

Fazer um pequeno lancamento de estoque em um SKU conhecido.

Esperado:

- `CatalogInventory` atualizado com saldo multiempresa reconciliado
- `TinyWebhookLog` com `webhookType = stock`

### Show Look

Gerar ou atualizar um pedido real/teste.

Esperado:

- `SalesOrder` com `tinyAccountKey = showlook`
- `TinyWebhookLog` com `webhookType = sales`

### On Shop

Gerar ou atualizar um pedido real/teste.

Esperado:

- `SalesOrder` com `tinyAccountKey = onshop`
- `TinyWebhookLog` com `webhookType = sales`

## Resumo executivo

Ativar agora:

- vendas nas 3 contas
- pedidos enviados nas 3 contas
- estoque nas 3 contas

Nao ativar ainda:

- notas fiscais autorizadas

## Proxima blindagem recomendada

Depois de ativar os webhooks nas 3 contas, a proxima blindagem recomendada e continuar endurecendo a deduplicacao do historico em `InventorySnapshot` quando o Tiny reenviar sinais identicos.
