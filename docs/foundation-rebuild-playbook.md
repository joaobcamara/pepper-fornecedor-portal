# Playbook de Reconstrucao da Fundacao

Data base: 2026-04-16

## Objetivo

Reconstruir a fundacao sem manter contaminacao de estruturas antigas.

Este playbook existe para:

- limpar dados de teste quando necessario
- consolidar a leitura oficial
- migrar o que presta
- apagar o que for paralelo ou inutil
- deixar outros sistemas entrarem sem repetir o problema

## Regra de decisao

Antes de apagar qualquer coisa, classificar cada tabela/lista em um destes grupos:

### 1. Oficial

Manter e evoluir.

Exemplos:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`
- `SalesOrder`
- `TinyWebhookLog`
- `SyncRun`

### 2. Compatibilidade

Manter temporariamente, mas com plano de saida.

Exemplos:

- `Product`
- `ProductSupplier`
- `InventorySnapshot`

### 3. Estrutura nova canonica

Criar e passar a usar para dados completos.

Exemplos:

- `FoundationInboundEvent`
- `FoundationAsset`
- `CatalogVariantAccountState`
- `FoundationStockMovement`
- `FoundationContact`
- `FoundationPriceList`
- `PickingSeparation`
- `Shipment`
- `Invoice`

### 4. Paralelo/contaminado

Migrar o que prestar e apagar/arquivar.

Regra:

- nao pode continuar servindo como fonte oficial

## Ordem profissional da reconstrucao

### Fase 1. Congelar a regra oficial

Documentos obrigatorios:

- `foundation-canonical-schema.md`
- `foundation-consumer-manual.md`
- `foundation-mental-map.md`

Objetivo:

- toda equipe saber qual tabela usar

### Fase 2. Criar dominios canonicos novos

Aplicar:

- contatos
- eventos brutos
- midia
- leitura por conta
- movimentacao
- preco
- separacao
- expedicao
- fiscal

Objetivo:

- receber o dado completo sem improvisar campo depois

### Fase 3. Limpar dados de teste

Quando o ambiente contiver apenas dados de teste:

1. limpar eventos brutos antigos
2. limpar snapshots de estoque de teste
3. limpar catalogo de teste
4. limpar pedidos de teste
5. manter referencias Pepper

Regra:

- nao apagar `PepperSizeReference`
- nao apagar `PepperColorReference`
- nao apagar `PepperTinyAccountReference`

### Fase 4. Reimportar pela regra nova

1. importar catalogo oficial
2. sincronizar estoque multiempresa
3. capturar webhooks
4. reconciliar vendas/pedidos
5. validar admin/fornecedor/IA

### Fase 5. Desligar leitura legado

1. migrar dashboards e IA para `Catalog*`
2. reduzir `Product` a compatibilidade
3. remover dependencias do legado

## Quando alterar ou apagar

### Pode apagar

- dados de Tiny usados apenas para teste
- snapshots de reconciliacao descartaveis
- listas antigas que nao sao mais lidas pelo portal

### Pode alterar

- schemas
- colunas
- naming
- indices

### Deve evitar apagar sem migrar

- qualquer tabela ainda usada pelo portal vivo
- qualquer tabela que ja seja fonte oficial

## Manual de reconexao para sistemas futuros

Sistema novo deve seguir:

1. ler `foundation-canonical-schema.md`
2. escolher o dominio oficial
3. usar `foundation-mental-map.md` para entender o fluxo
4. so depois implementar a integracao

## Checklist de reconstruicao segura

- identificar o que e oficial
- identificar o que e compatibilidade
- identificar o que e teste
- fazer backup/export se houver qualquer duvida
- limpar testes
- reimportar catalogo
- reativar webhooks
- reconciliar estoque
- reconciliar pedidos
- validar reflexo no portal

## Resultado esperado

Ao final:

- a fundacao fica organizada
- o Tiny passa a alimentar dominios certos
- fotos, payloads e documentos ficam guardados
- o estoque multiempresa fica claro
- qualquer sistema futuro consegue se conectar sem reinventar estrutura
