# Auditoria Tiny -> Fundacao Grupo Pepper

Data da auditoria: 2026-04-15

## Objetivo

Registrar o estado real da fundacao em producao para responder:

- quais tabelas o Tiny esta alimentando hoje
- quais listas o portal atual esta lendo
- quais APIs Tiny ja estao ativas no codigo
- quais APIs estao apenas previstas na fundacao multiempresa
- qual e o melhor caminho para consolidar a estrutura para outros sistemas

## Resumo executivo

Hoje o portal **nao esta lendo uma lista real ampla de produtos vindos do Tiny**.

O que existe de forma consistente na fundacao real e:

- uma familia de produto em `Product`: `01-2504`
- a mesma familia convertida para o catalogo IA em:
  - `CatalogProduct`
  - `CatalogVariant`
  - `CatalogInventory`
  - `CatalogTinyMapping`
- snapshots de estoque em `InventorySnapshot`

O que **nao esta alimentado hoje**:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`
- `TinyWebhookLog`
- `TinyImportBatch`
- `SyncRun`

Conclusao direta:

- a Pepper AI de 30 dias nao consegue ficar precisa porque **as tabelas de pedidos e metricas estao vazias**
- o problema principal nao e a formula da IA
- o problema principal e que **a fundacao ainda nao esta recebendo pedidos reais dos 3 Tiny e o portal ainda mistura camada operacional (`Product`) com camada de catalogo (`Catalog*`)**

## Tabelas reais encontradas em producao

As tabelas ativas encontradas por REST no Supabase foram as tabelas Prisma em `CamelCase`.

As tabelas antigas/documentadas em `snake_case` da proposta multiempresa **nao estao aplicadas** neste banco.

### Tabelas com dados

- `Product`
- `CatalogProduct`
- `CatalogVariant`
- `CatalogTinyMapping`
- `CatalogInventory`
- `InventorySnapshot`
- `PepperTinyAccountReference`

### Tabelas vazias

- `SalesOrder`
- `SalesOrderItem`
- `TinyWebhookLog`
- `TinyImportBatch`
- `SyncRun`

## Contagem real observada

### Camada operacional

- `Product`: 6
  - 1 pai
  - 5 filhas
- `InventorySnapshot`: 5

### Camada de catalogo/fundacao

- `CatalogProduct`: 1
- `CatalogVariant`: 5
- `CatalogInventory`: 5
- `CatalogTinyMapping`: 6

### Camada comercial e de ingestao

- `SalesOrder`: 0
- `SalesOrderItem`: 0
- `TinyWebhookLog`: 0
- `TinyImportBatch`: 0
- `SyncRun`: 0

## Produto real encontrado hoje

Familia encontrada:

- pai: `01-2504`
- nome: `Conjunto Fitness Aura`
- Tiny ID pai: `853906359`

Filhas encontradas:

- `01-2504-21-01`
- `01-2504-21-03`
- `01-2504-22-01`
- `01-2504-22-03`
- `01-2504-23-01`

Mapeamento Tiny salvo:

- `CatalogTinyMapping.accountKey = pepper`
- `entityType = product` para o pai
- `entityType = variant` para as filhas

Nao foram encontrados registros reais para:

- `01-1017`
- `01-1195`

em:

- `Product`
- `CatalogProduct`
- `CatalogVariant`
- `CatalogTinyMapping`

## Estoque real encontrado hoje

Os snapshots encontrados em `InventorySnapshot` vieram com `source = tiny`.

Ultimos saldos encontrados:

- `01-2504-22-03` = 6
- `01-2504-21-03` = 2
- `01-2504-23-01` = 0
- `01-2504-22-01` = 7
- `01-2504-21-01` = 3

Na camada de catalogo, isso ja esta refletido em `CatalogInventory.availableMultiCompanyStock`.

## Pedidos reais informados na auditoria

IDs fornecidos para consulta:

- Pepper
  - `256405`
  - `260415U7NP8H9V`
  - `050.138.545-20`
- Show Look
  - `112581`
  - `260415UUN0HT0V`
  - `094.218.518-89`
- On Shop
  - `23775`
  - `260415TSVVG0P0`
  - `260415SWDUNKN3`

Resultado da busca em `SalesOrder`:

- **nenhum registro encontrado**

Resultado da busca em `TinyWebhookLog`:

- **nenhum registro encontrado**

Leitura honesta:

- esses pedidos reais **nao chegaram** na estrutura atual que o portal esta usando para pedidos/vendas
- ou a ingestao nao esta rodando
- ou ela esta apontando para outra camada/sistema
- ou os webhooks/importacoes ainda nao foram efetivamente ativados para alimentar `SalesOrder`

## ID de separacao informado

ID informado:

- `902894857`

Resultado:

- nao existe hoje uma tabela ativa de expedicao/separacao no schema que o portal atual usa
- as tabelas previstas de `shipments`/expedicao aparecem apenas no plano/documentacao da fundacao multiempresa
- elas **nao estao ativas** no banco atual do portal

Conclusao:

- este ID de separacao ainda **nao tem destino ativo** dentro da estrutura real usada hoje pelo sistema

## APIs Tiny ativas no portal hoje

As chamadas Tiny efetivamente implementadas no codigo atual sao:

### Catalogo / produto

- `produtos.pesquisa.php`
- `produto.obter.php`
- `produto.obter.estrutura.php`
- `produto.obter.estoque.php`

### Pedidos / clientes

- `pedido.obter.php`
- `pedidos.pesquisa.php`
- `contato.obter.php`

### Cadastro enviado ao Tiny

- `produto.incluir.php`

Observacao:

- o envio direto de sugestao para Tiny pelo modulo admin foi descontinuado na rota publica do painel
- hoje o endpoint `/api/admin/suggestions/send-to-tiny` responde `410`
- o helper `lib/tiny-cadastro.ts` ainda existe como capacidade tecnica

## Endpoints internos do portal que alimentam a fundacao

### Estoque

- `POST /api/tiny/webhooks/stock`
- `POST /api/internal/reconcile-stock`
- `POST /api/admin/sincronizacoes/reconcile`
- `POST /api/supplier/sync`

Escrevem em:

- `Product`
- `InventorySnapshot`
- `CatalogInventory`
- `TinyWebhookLog`
- `SyncRun`

Observacao real do banco:

- apesar de a estrutura existir, `TinyWebhookLog` e `SyncRun` estao vazios hoje

### Pedidos / vendas

- `POST /api/tiny/webhooks/sales`
- `POST /api/admin/sincronizacoes/reconcile-sales`

Escrevem em:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `Customer`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`
- `TinyWebhookLog`
- `SyncRun`

Observacao real do banco:

- todas essas tabelas continuam vazias hoje

### Importacao / inspecao de produto

- `POST /api/admin/tiny/inspect`
- `POST /api/admin/tiny/import`

Fluxo atual:

1. consulta fundacao primeiro
2. se nao achar, cai para Tiny Pepper como fallback controlado
3. quando importa, trabalha sobre:
   - `Product`
   - `ProductSupplier`
   - `CatalogProduct`
   - `CatalogVariant`
   - `CatalogInventory`
   - `CatalogTinyMapping`

## APIs previstas na fundacao, mas nao ativadas neste portal

Pelo documento `docs/supabase-multiempresa-master-plan.md`, a fundacao foi pensada para comportar tambem:

- CRM
  - estagios
  - assuntos
  - acoes
- listas de preco
- contas a receber
- notas fiscais
- expedicao
- agrupamentos
- rastreio
- frete

Estado atual:

- estao **documentadas** e previstas na fundacao conceitual
- mas **nao ha tabelas ativas nem ingestao ativa** disso no schema real do portal hoje

## Regra multiempresa ativa na fundacao

A estrutura aplicada hoje em `PepperTinyAccountReference` esta coerente com as regras consolidadas:

- `pepper`
  - role = `MATRIX`
  - `handlesCatalogImport = true`
  - `handlesPhysicalStock = true`
- `showlook`
  - role = `DEPENDENT`
  - `readsAvailableMultiCompany = true`
  - `zeroBalanceOnCount = true`
- `onshop`
  - role = `DEPENDENT`
  - `readsAvailableMultiCompany = true`
  - `zeroBalanceOnCount = true`

Conclusao:

- a fundacao ja sabe quem e matriz e quem e dependente
- mas os dados reais ainda nao estao chegando na camada comercial/fiscal/logistica

## Qual lista o Tiny esta alimentando hoje

### Resposta curta

Hoje o Tiny esta alimentando **somente a camada operacional basica de produto/estoque** e, indiretamente, o catalogo IA dessa mesma familia.

### Fluxo real observado

1. Tiny alimenta / ou foi refletido em `Product`
2. Tiny alimenta / ou foi refletido em `InventorySnapshot`
3. `catalog-sync` replica isso para:
   - `CatalogProduct`
   - `CatalogVariant`
   - `CatalogInventory`
   - `CatalogTinyMapping`

### O que o Tiny nao esta alimentando hoje

- pedidos reais
- itens de pedido
- historico de status
- metricas de 30 dias
- logs de webhook
- logs de sincronizacao
- contas a receber
- nota fiscal
- expedicao

## Qual lista o portal atual esta usando

Hoje o portal mistura duas camadas:

### Camada operacional

- `Product`
- `ProductSupplier`
- `InventorySnapshot`

### Camada de catalogo/fundacao

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

Consequencia:

- alguns modulos leem `Product`
- outros leem `CatalogVariant`/`CatalogProduct`
- a Pepper AI e os modulos de decisao nao estao operando sobre uma fundacao unica e completa

## Melhor caminho para consolidar a fundacao

### 1. Definir uma fonte oficial unica para produto e estoque

Recomendacao:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

devem virar a **fonte oficial de leitura do portal**.

`Product` pode continuar temporariamente como:

- camada operacional de compatibilidade
- staging
- espelho de transicao

mas nao como fonte final para IA e modulos principais.

### 2. Fazer a ingestao real de pedidos dos 3 Tiny

Precisamos alimentar de verdade:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

Regra:

- Pepper, Show Look e On Shop entram nas vendas/pedidos
- Pepper continua sendo a matriz do cadastro e do estoque fisico

### 3. Tornar obrigatorio o registro de sync

Toda ingestao deveria deixar rastro em:

- `TinyWebhookLog`
- `SyncRun`

porque isso vira painel de saude da fundacao.

### 4. Abrir dominios novos da fundacao de forma explicita

Depois de produto/estoque/pedidos estarem consolidados, abrir em ordem:

1. contas a receber
2. notas fiscais
3. expedicao / separacao
4. CRM
5. listas de preco

### 5. Publicar um contrato de consumo para outros sistemas

Outros sistemas deveriam consumir a fundacao a partir destes dominios:

- `catalog`
  - produto pai
  - variante
  - estoque multiempresa
  - mapeamento Tiny por conta
- `sales`
  - pedido
  - item
  - status
  - metricas
- `foundation-references`
  - tamanhos Pepper
  - cores Pepper
  - contas Tiny oficiais

## Diagnostico final

O que esta faltando hoje nao e “mais IA”.

O que esta faltando e:

- **conectar o portal a uma fundacao unica e completa**
- **parar de misturar lista operacional parcial com catalogo parcial**
- **fazer os 3 Tiny alimentarem de verdade a camada de pedidos e metricas**

Enquanto isso nao acontecer:

- a Pepper AI de compra por 30 dias nao vai ficar precisa
- SKUs reais vao falhar ou parecer inexistentes
- o portal vai parecer desconectado da operacao real

## Recomendacao objetiva para a proxima fase

1. escolher `Catalog*` como camada oficial de leitura
2. vincular `Product` a `Catalog*` apenas como compatibilidade
3. ligar ingestao real de pedidos dos 3 Tiny
4. preencher metricas diarias
5. so depois recalibrar Pepper AI
