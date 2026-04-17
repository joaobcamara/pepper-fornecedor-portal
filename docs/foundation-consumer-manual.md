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

## Regra oficial do portal do fornecedor

O portal do fornecedor nao e dono do cadastro do produto.

Ele deve funcionar assim:

- Tiny + fundacao = catalogo canonico
- portal = camada de visualizacao, operacao, pedidos, estoque e metricas
- cadastro e alteracao estrutural de produto acontecem em outro sistema do ecossistema

### O que o portal pode fazer

- exibir cards
- vincular fornecedores
- controlar visibilidade do card no portal
- consumir estoque, pedidos e metricas da fundacao

### O que o portal nao deve fazer

- editar o produto canonico
- alterar dados estruturais do catalogo
- apagar o produto da fundacao
- assumir que e dono do cadastro

### Como funciona excluir no portal

Quando um produto for removido do portal, a regra correta e:

- ocultar o card de visualizacao do portal
- manter o produto canonico intacto na fundacao
- manter o Tiny como origem externa do cadastro

### Camada de visualizacao do portal

A camada de visualizacao do portal deve viver como overlay na fundacao,
sem criar catalogo paralelo e sem apagar o produto-base.

Hoje essa camada e persistida em:

- `CatalogProduct.foundationMetadataJson`

Com a ideia de:

- `portalCatalogView.visible`
- `portalCatalogView.archivedAt`
- `portalCatalogView.hiddenReason`
- `portalCatalogView.managedByPortal`

### Regra de carregamento no portal

Quando o produto ja existe no portal, admin e fornecedor devem carregar:

- apenas pelo `Supabase`
- apenas pela fundacao
- sem nova consulta ao Tiny no fluxo normal da tela

Ou seja:

- telas de produto, estoque, pedido e metrica = `Supabase-first`
- consulta ao Tiny = apenas no fluxo de cadastro/importacao ou reconciliacao pontual

### Regra de busca e cadastro

No portal:

1. buscar primeiro no `Supabase`
2. se o SKU nao existir no portal, abrir o fluxo de importacao/cadastro
3. so nesse momento consultar o Tiny
4. gravar o produto completo na fundacao
5. responder ao portal a partir da fundacao

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

## Como importar produto corretamente do Tiny por SKU

### Regra estrutural

O fluxo oficial da fundacao para importacao pontual e:

1. consultar primeiro a fundacao pelo SKU
2. se o SKU nao existir ou estiver incompleto, consultar o Tiny da Pepper
3. localizar pelo SKU
4. validar `codigo` exato
5. capturar o `id` operacional do Tiny
6. buscar detalhes completos
7. buscar a estrutura pai/filhas quando for familia
8. buscar estoque por `id`
9. persistir na fundacao
10. deixar o portal consumir a fundacao

### Ordem oficial de chamadas Tiny

Para importacao pontual por SKU, usar nesta ordem:

1. `Pesquisar Produtos` com `pesquisa=<SKU>`
2. validar se `codigo` retornado e exatamente igual ao SKU procurado
3. `Obter Produto` com o `id` retornado
4. se o SKU for pai, `Obter Estrutura do Produto` com o `id` do pai
5. `Obter Estoque Produto` com o `id` de cada item operacional

### Regra de persistencia na fundacao

O retorno oficial do Tiny deve alimentar:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`
- `CatalogImage`
- `CatalogVariantAccountState` quando houver leitura por conta

### Regra oficial para familias grandes

Quando o SKU pai tiver muitas filhas, isso passa a ser tratado como
`importacao em etapas`.

Regra atual:

- ate `39` filhas = fluxo unico permitido
- `40` filhas ou mais = familia grande
- familia grande = hidratar por etapas

Exemplo conhecido:

- `01-1195` com `59` filhas

### Como a fundacao deve importar familia grande

1. localizar o pai
2. obter a estrutura inteira do pai
3. registrar o plano de importacao
4. importar as filhas em ondas curtas
5. consultar estoque por `id` em lote pequeno
6. persistir cada onda na fundacao
7. so ao final responder o catalogo consolidado ao portal

Lote recomendado hoje:

- `12` filhas por onda

Motivo:

- reduzir pressao na API do Tiny
- evitar timeout de fallback curto
- permitir retomada controlada se uma onda falhar
- manter observabilidade em `TinyImportBatch`, `TinyImportItem` e `SyncRun`

### Regras obrigatorias

- nunca operar estoque apenas com SKU quando a API exigir `id`
- nunca confiar em busca parcial; sempre validar `codigo` exato
- cadastro de produto vem da Pepper
- Show Look e On Shop nao sao fonte de cadastro de produto
- o saldo oficial persistido para o portal continua sendo o `availableMultiCompanyStock`
- importacao pontual por SKU e diferente de reconciliacao de webhook

### Regra operacional atual da fundacao

Nesta reta final de projeto, a estrategia oficial e:

- `webhook-first` para povoamento organico
- `Tiny manual` apenas para:
  - importacao pontual por SKU
  - inspecao por SKU
  - reconciliacao pontual

Ou seja:

- nao forcar backfill grande no Tiny
- nao tentar puxar catalogo inteiro de uma vez
- deixar pedidos, estoque e status povoarem a fundacao naturalmente
- usar importacao pontual so quando um SKU ainda nao existir ou estiver incompleto

### API incremental complementar

`Lista de Produtos Alterados` pode ser usada no futuro para reconciliacao incremental,
mas nao substitui o fluxo oficial de importacao pontual por SKU.

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

## Modulo WhatsApp do admin

O modulo `WhatsApp` do portal e um **overlay operacional do admin**, nao uma nova origem de produto.

Regra:

1. admin monta o card a partir do produto que ja existe na fundacao
2. o sistema cria um link compartilhavel proprio
3. o link le o estoque e as metricas reais da fundacao
4. alteracoes feitas no link ficam registradas no proprio modulo
5. excluir o link remove so o compartilhamento, nunca o produto canonico

Importante:

- fornecedor **nao** usa esse modulo para sugerir reposicao
- fornecedor continua usando o fluxo oficial de `Sugestao de compra`
- `Conversas` continua existindo como canal proprio
- `WhatsApp` do admin nao substitui o catalogo, nem o pedido, nem a sugestao

Estruturas oficiais:

- `WhatsAppShareLink`
- `WhatsAppShareLinkItem`

Essas estruturas servem para:

- gerar link portatil
- guardar snapshot inicial do pedido sugerido
- comparar com estoque atual da fundacao
- registrar aprovacao, recusa, pedido de alteracao e fechamento
