# Manual de Importacao em Etapas para Familias Grandes

Data base: 2026-04-17

## Objetivo

Definir a regra oficial da fundacao para SKU pai com muitas filhas,
evitando timeout curto, pressao desnecessaria na API do Tiny e importacoes
grandes presas em um unico fluxo.

## Quando esta regra entra

Regra atual da fundacao:

- ate `39` filhas = fluxo unico permitido
- `40` filhas ou mais = familia grande

Exemplo real:

- `01-1195` com `59` filhas

## Regra oficial

Familia grande nao deve ser tratada como:

- inspect curto comum
- fallback rapido de 4,5s
- importacao unica sem ondas

Familia grande deve ser tratada como:

1. localizar o pai
2. obter a estrutura completa
3. montar um plano de importacao
4. hidratar filhas em ondas curtas
5. consultar estoque por `id` em lote pequeno
6. persistir cada onda antes de seguir
7. finalizar sincronizacao do catalogo

## Lote padrao da fundacao

- `12` filhas por onda

## Timeout recomendado

Para importacao em etapas:

- timeout recomendado = `90000ms`

Para inspect curto:

- continua valendo a janela curta de fallback

## Dominios impactados

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`
- `CatalogImage`
- `CatalogVariantAccountState`
- `TinyImportBatch`
- `TinyImportItem`
- `SyncRun`

## O que o portal deve fazer

- portal continua `Supabase-first`
- portal nao deve tentar hidratar familia grande no carregamento normal da tela
- se faltar o produto, a importacao deve acontecer no fluxo de cadastro/importacao
- a tela normal continua lendo so a fundacao

## O que outros sistemas devem fazer

- consultar a fundacao primeiro
- respeitar o plano em ondas quando a familia for grande
- nao disparar 50+ leituras de estoque em fluxo interativo curto
- nao assumir que `inspect` rapido resolve catalogo com dezenas de filhas

## Resumo pratico

- familia pequena = fluxo unico ok
- familia grande = importacao em etapas
- `40+` filhas = ligar alerta de familia grande
- lote atual = `12`
- o plano deve ficar auditavel na fundacao
