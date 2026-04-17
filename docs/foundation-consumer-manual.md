# Manual de Consumo da Fundacao Grupo Pepper

Data base: 2026-04-15

## Objetivo

Este documento existe para que qualquer sistema futuro consiga:

- consumir a fundacao sem criar tabela paralela
- saber qual dominio ler
- saber o que e oficial e o que e apenas compatibilidade
- entender como usar SKU, Tiny ID e multiempresa

## Documentos que devem ser lidos juntos

Antes de conectar qualquer sistema novo, ler nesta ordem:

1. `foundation-canonical-schema.md`
2. `foundation-mental-map.md`
3. `foundation-standardization-plan.md`
4. este manual

## Regras obrigatorias para qualquer sistema novo

### 1. Nao criar um catalogo paralelo

Se a fundacao ja tiver o dominio, o sistema novo deve consumir a fundacao.

Nao deve:

- recriar tabela propria de produto
- recriar tabela propria de estoque
- manter SKU duplicado sem necessidade

### 2. Sempre usar o dominio oficial

Para cada necessidade:

- produto -> `CatalogProduct` / `CatalogVariant`
- estoque -> `CatalogInventory`
- mapeamento Tiny -> `CatalogTinyMapping`
- pedidos -> `SalesOrder` / `SalesOrderItem`
- metricas -> `*SalesMetricDaily`
- referencias Pepper -> `Pepper*Reference`

### 3. SKU e a chave logica

- `SKU` = identidade logica do grupo
- `Tiny ID` = identidade operacional local por conta

Logo:

- entre sistemas e contas, use SKU
- para operar no Tiny, use o Tiny ID da conta correspondente

### 4. Pepper e a matriz

- Pepper = matriz
- Show Look = dependente
- On Shop = dependente

Regras:

- cadastro de produto: Pepper
- governanca fisica principal: Pepper
- dependentes afetam o grupo pelas vendas
- leitura importante nas dependentes: `availableMultiCompanyStock`

## Qual lista de produtos usar

### Regra oficial

Todo sistema novo deve usar:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

### O que nao usar como lista principal

Nao usar `Product` como fonte principal de leitura para:

- IA
- dashboards novos
- apps futuros
- integracoes futuras

`Product` deve ser tratado apenas como:

- compatibilidade
- staging
- transicao

## Como ler produto corretamente

### Produto pai

Ler em `CatalogProduct`:

- `skuParent`
- `name`
- atributos principais
- vinculos de fornecedor

### Variacao

Ler em `CatalogVariant`:

- `sku`
- `sizeCode`
- `sizeLabel`
- `colorCode`
- `colorLabel`
- `tinyProductId`

### Estoque

Ler em `CatalogInventory`:

- `availableMultiCompanyStock`
- `inventorySyncStatus`
- `lastStockSyncAt`

### Tiny ID por conta

Ler em `CatalogTinyMapping`:

- `accountKey`
- `entityType`
- `sku`
- `tinyId`
- `tinyParentId`

## Como operar com Tiny

### Regra

1. usar SKU para localizar na fundacao
2. obter Tiny ID correto em `CatalogTinyMapping`
3. operar a API Tiny com o ID local da conta

### Exemplo

Se o sistema precisa do estoque de `01-2504-22-01`:

1. buscar a variante em `CatalogVariant`
2. buscar o mapeamento em `CatalogTinyMapping`
3. usar o `tinyId` da conta correta
4. persistir qualquer retorno oficial na fundacao

## Como ler estoque corretamente

### Estoque oficial

Usar:

- `CatalogInventory.availableMultiCompanyStock`

### Regra operacional atualizada

- webhook de estoque nunca deve ser tratado como delta cego
- qualquer evento de estoque deve disparar reconciliacao do saldo atual no Tiny
- o valor persistido na fundacao deve ser o saldo multiempresa reconsultado
- se um pedido aprovado ja gerou reserva no Tiny, a fundacao deve refletir essa reducao porque ela ja faz parte do saldo multiempresa oficial

Resumo:

- Pepper = matriz operacional
- Show Look e On Shop = dependentes que tambem afetam o saldo multiempresa
- saldo oficial do portal = saldo multiempresa

### Historico bruto

Usar:

- `InventorySnapshot`

### Regra multiempresa

- Pepper = referencia principal de estoque fisico
- Show Look e On Shop = dependentes
- vendas nas dependentes afetam o grupo

## Como ler pedidos corretamente

### Pedido

Usar:

- `SalesOrder`

### Item

Usar:

- `SalesOrderItem`

### Historico

Usar:

- `SalesOrderStatusHistory`

### Metricas

Usar:

- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

## Como validar se um fluxo esta correto

Todo sistema novo deve validar:

### 1. Persistencia

- chegou na tabela certa

### 2. Reflexo

- apareceu para o modulo consumidor

### 3. Observabilidade

- gerou log em `TinyWebhookLog` ou `SyncRun` quando for ingestao externa

## Como padronizar observacao de movimentacao automatica

Quando algum sistema do ecossistema Grupo Pepper fizer:

- entrada
- saida
- balanco
- ajuste automatico

deve preencher a observacao/OBS no Tiny com o padrao:

- `Origem: Pepper IA | Motivo: <motivo real> | Fluxo: Grupo Pepper | Referencia: <id interno>`

Helper oficial no projeto:

- `buildFoundationAutomatedStockObservation(...)` em `lib/foundation-stock-observation.ts`

## Contratos recomendados para novos sistemas

### Dominio `catalog`

Consumir:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`
- `CatalogProductSupplier`
- `CatalogVariantAccountState`
- `CatalogImage`

### Dominio `sales`

Consumir:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- metricas diarias

### Dominio `foundation-references`

Consumir:

- `PepperSizeReference`
- `PepperColorReference`
- `PepperTinyAccountReference`

### Dominios canonicos novos

Consumir quando o caso de uso pedir dado completo:

- `FoundationInboundEvent`
- `FoundationAsset`
- `FoundationStockMovement`
- `FoundationContact`
- `FoundationPriceList`
- `FoundationPriceListItem`
- `PickingSeparation`
- `Shipment`
- `Invoice`

## Regras para escrita

### Produtos

Sistema consumidor nao deve escrever direto no catalogo sem passar pela regra da fundacao.

Fluxo esperado:

1. consultar fundacao
2. se faltar, consultar Tiny Pepper
3. persistir na fundacao
4. so entao responder como oficial

### Quando o produto vier incompleto do Tiny

Se o cadastro importado vier sem informacao suficiente para operacao, atendimento ou IA:

- complementar na **camada de catalogo da fundacao**
- nunca criar uma lista paralela fora da fundacao
- nunca usar `Product` como lugar definitivo de enriquecimento

Regra pratica:

- identidade do item continua vindo do Tiny/SKU
- enriquecimento editorial, semantico ou operacional deve ficar em `CatalogProduct`, `CatalogVariant` e tabelas auxiliares do catalogo

Exemplos de enriquecimento permitido:

- nome comercial melhorado
- material/composicao
- categoria
- imagem principal e imagens complementares
- atributos extras
- tags
- vinculo de fornecedor

Exemplos de enriquecimento que precisam continuar respeitando Tiny como origem:

- Tiny ID
- SKU
- estrutura pai/filha
- relacao matriz/dependentes

### Estoque

Sistema consumidor nao deve inventar saldo.

Fluxo esperado:

1. Tiny / conferencias operacionais geram mudanca
2. fundacao recebe e persiste
3. sistemas leem a fundacao

Observacao:

- a fundacao nao precisa esperar nota fiscal para mostrar a reducao se o Tiny ja tiver abatido esse saldo na reserva do pedido
- o dominio fiscal entra depois para explicar melhor o ciclo do pedido, nao para inventar um saldo diferente do Tiny

### Pedidos

Portal de fornecedor/admin pode criar intencao operacional e workflow, mas pedido do portal nao vira estoque automaticamente.

## O que fazer quando a fundacao ainda nao tiver um dominio pronto

Se o dominio ainda nao estiver ativo:

1. consultar a matriz de integracoes
2. confirmar se o dominio esta:
   - `ATIVO`
   - `IMPLEMENTADO_SEM_DADOS`
   - `PLANEJADO`
3. se estiver `PLANEJADO`, abrir extensao da fundacao em vez de criar estrutura paralela

## Decisao final para produtos

Se houver duvida sobre qual lista usar:

- use sempre a lista importada e consolidada pelo Tiny no Supabase
- isto significa:
  - `CatalogProduct`
  - `CatalogVariant`
  - `CatalogInventory`
  - `CatalogTinyMapping`

Esta e a leitura oficial da fundacao.
