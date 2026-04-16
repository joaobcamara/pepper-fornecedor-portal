# Plano de Padronizacao da Fundacao Grupo Pepper

Data base: 2026-04-15

## Objetivo

Consolidar a fundacao Grupo Pepper para que:

- o portal atual funcione de forma confiavel
- outros sistemas possam se conectar sem reinventar estrutura
- Tiny alimente o que e operacional
- Supabase vire a base central padronizada de leitura
- Pepper IA passe a operar sobre dados reais e consistentes

## Problema atual

Hoje existe contaminacao entre:

- camada operacional parcial
- camada de catalogo parcial
- dominios previstos, mas ainda nao conectados

Na pratica:

- `Product` e `InventorySnapshot` estao sendo usados como lista operacional
- `CatalogProduct`, `CatalogVariant`, `CatalogInventory` e `CatalogTinyMapping` existem como fundacao de catalogo
- `SalesOrder`, `SalesOrderItem`, `TinyWebhookLog`, `SyncRun` e metricas estao vazios
- o portal mistura leitura de `Product` com leitura de `Catalog*`
- por isso IA, modulos de decisao e importacao ficam inconsistentes

## Principios oficiais da fundacao

### 1. Supabase-first

O sistema deve sempre:

1. consultar a fundacao no Supabase
2. usar Tiny apenas como origem externa, sincronizacao ou fallback controlado
3. persistir na fundacao antes de responder como dado oficial

### 2. Pepper matriz

- `Pepper` = matriz
- `Show Look` = dependente
- `On Shop` = dependente

Regras:

- cadastro de produto vem da Pepper
- estoque fisico principal vem da Pepper
- dependentes usam estoque compartilhado e afetam o grupo pelas vendas

### 3. SKU como identidade logica

- SKU = chave logica compartilhada entre contas e sistemas
- Tiny ID = chave operacional local por conta

### 4. Produto oficial da fundacao

Fonte oficial de produto deve ser:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

`Product` deve ser tratado como:

- camada de compatibilidade
- staging operacional
- apoio de transicao

Mas nao como lista final para IA ou para novos sistemas.

### 5. Estoque oficial da fundacao

Fonte oficial de estoque deve ser:

- `CatalogInventory.availableMultiCompanyStock`

Apoios:

- `InventorySnapshot` = trilha operacional / historico bruto
- `CatalogTinyMapping` = ligacao SKU <-> Tiny ID por conta

### 6. Pedidos oficiais da fundacao

Fonte oficial de pedidos deve ser:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`

Metricas oficiais:

- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

## Definicao oficial de fonte por dominio

### Catalogo

- pai: `CatalogProduct`
- filha: `CatalogVariant`
- vinculo Tiny: `CatalogTinyMapping`
- vinculo fornecedor: `CatalogProductSupplier`

### Estoque

- leitura oficial: `CatalogInventory.availableMultiCompanyStock`
- historico operacional: `InventorySnapshot`

### Pedidos

- pedido: `SalesOrder`
- item: `SalesOrderItem`
- historico: `SalesOrderStatusHistory`

### Metricas

- variacao: `VariantSalesMetricDaily`
- produto pai: `ProductSalesMetricDaily`
- fornecedor: `SupplierSalesMetricDaily`

### Referencias Pepper

- tamanhos: `PepperSizeReference`
- cores: `PepperColorReference`
- contas Tiny: `PepperTinyAccountReference`

### Observabilidade

- webhook/log: `TinyWebhookLog`
- execucao/sync: `SyncRun`

## Decisao oficial sobre lista de produtos

### Regra

Sempre que um sistema precisar ler produtos:

1. usar `CatalogProduct` e `CatalogVariant`
2. usar `CatalogInventory` para saldo
3. usar `CatalogTinyMapping` para operar com Tiny
4. usar `PepperSizeReference` e `PepperColorReference` para interpretar SKU

### Regra de importacao

Se o sistema receber um SKU:

1. procurar na fundacao
2. se existir, usar a fundacao
3. se nao existir, consultar Tiny Pepper
4. persistir na fundacao
5. responder ao sistema consumidor

## Estado atual por dominio

### Ativo hoje

- produto basico
- estoque basico
- mapeamento Tiny do catalogo
- regras multiempresa da fundacao
- referencias Pepper de cor/tamanho

### Implementado no codigo, mas nao alimentado de verdade

- pedidos
- itens de pedido
- historico de status
- metricas de venda
- logs de webhook
- logs de sincronizacao

### Previsto, mas nao conectado

- CRM
- listas de preco
- contas a receber
- notas fiscais
- expedicao
- separacao
- rastreio
- fretes

## Padrao de integracao por camada

### Camada 1. Ingestao Tiny

Responsavel por:

- consultar Tiny
- validar SKU/Tiny ID
- persistir payload relevante
- registrar webhook/sync

### Camada 2. Normalizacao da fundacao

Responsavel por:

- converter dados operacionais em estrutura oficial
- atualizar `Catalog*`, `Sales*`, metricas e referencias

### Camada 3. Consumo pelos sistemas

Responsavel por:

- ler a fundacao
- nunca reprocessar Tiny direto sem necessidade
- nunca criar tabela paralela se a fundacao ja tiver o dominio

## Fases de consolidacao

### Fase 1. Consolidacao de produto e estoque

Objetivo:

- tornar `Catalog*` a leitura oficial
- remover ambiguidade entre `Product` e `Catalog*`

Entregas:

- mapa de modulos que ainda leem `Product`
- migracao progressiva dessas leituras para `Catalog*`
- `Product` mantido apenas como compatibilidade

### Fase 2. Ingestao real de pedidos dos 3 Tiny

Objetivo:

- povoar `SalesOrder`, `SalesOrderItem` e metricas

Entregas:

- backfill de pedidos
- webhook/sync real de pedidos
- metricas 1d/7d/30d/3m/6m/1a

### Fase 3. Observabilidade obrigatoria

Objetivo:

- saber se a fundacao esta viva ou quebrada

Entregas:

- `TinyWebhookLog` obrigatorio em toda ingestao
- `SyncRun` obrigatorio em toda reconciliacao/importacao
- painel de saude da fundacao

### Fase 4. Dominios financeiros e logisticos

Objetivo:

- abrir a fundacao para contas a receber, notas e expedicao

Entregas:

- modelo oficial de contas a receber
- modelo oficial de NF
- modelo oficial de expedicao/separacao

### Fase 5. Manual de consumo e views

Objetivo:

- deixar outros sistemas plugarem na fundacao com baixo atrito

Entregas:

- manual de consumo
- contratos por dominio
- views prontas de leitura

## Regras de teste e validacao

Toda nova implementacao precisa validar 3 coisas:

1. funcionalidade
   - a rota funciona
   - o fluxo fecha

2. persistencia
   - chegou na tabela correta da fundacao

3. reflexo
   - apareceu no admin
   - apareceu no fornecedor
   - apareceu na leitura da IA quando for o caso

## Resultado esperado

Ao final da consolidacao:

- o portal atual passa a usar uma base unica e padronizada
- Tiny deixa de ser consulta principal da interface
- Pepper IA passa a operar sobre pedidos e metricas reais
- outros sistemas entram na fundacao sem criar estrutura paralela
- a fundacao vira o ecossistema central do Grupo Pepper
