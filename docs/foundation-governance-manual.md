# Manual de Governanca da Fundacao Grupo Pepper

Data base: 2026-04-16

## Objetivo

Evitar que futuros sistemas baguncem novamente a fundacao.

Este manual define como qualquer time deve extender a fundacao sem:

- duplicar dominio
- criar tabela paralela
- misturar camada operacional com camada de leitura
- escrever fora do fluxo de governanca

## Regra 1. Um dominio, uma lista oficial

Cada dominio deve ter uma lista oficial de leitura.

### Catalogo

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`

### Pedidos

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`

### Metricas

- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

### Referencias Pepper

- `PepperSizeReference`
- `PepperColorReference`
- `PepperTinyAccountReference`

## Regra 2. Nada de tabela paralela se o dominio ja existe

Se o dominio ja existe na fundacao:

- o sistema novo consome a fundacao
- nao cria sua propria tabela espelho
- nao cria seu proprio cadastro do mesmo conceito

## Regra 3. Tiny nao e interface principal

Tiny e:

- origem externa
- sincronizacao
- fallback controlado

Supabase e:

- base principal de leitura
- base central de reutilizacao

## Regra 4. Toda integracao nova precisa nascer com observabilidade

Obrigatorio:

- registrar em `TinyWebhookLog` quando vier por webhook
- registrar em `SyncRun` quando vier por importacao/reconciliacao

Sem isso:

- a integracao nao esta pronta para producao

## Regra 5. Toda API nova precisa ser encaixada em um bundle

Nao ligar endpoint Tiny isolado.

Antes de implementar, responder:

1. a qual bundle essa API pertence
2. qual lista oficial ela alimenta
3. qual IA ou modulo consome esse dominio
4. como validar persistencia e reflexo

## Regra 6. Produto incompleto se enriquece no catalogo

Quando o Tiny vier incompleto:

- completar no catalogo da fundacao
- nunca criar lista paralela externa
- nunca usar `Product` como destino final de enriquecimento

## Regra 7. Todo novo sistema deve entrar pela camada de consumo

O sistema novo deve ter:

- documento de dominios consumidos
- tabela oficial consumida
- campos lidos
- campos escritos
- fluxo de validacao

## Checklist obrigatorio para novo sistema

- [ ] dominio escolhido ja existe na fundacao?
- [ ] lista oficial do dominio foi respeitada?
- [ ] integracao Tiny foi agrupada no bundle certo?
- [ ] webhook/sync registram log?
- [ ] existe smoke automatizado?
- [ ] admin ve o reflexo?
- [ ] fornecedor ve o reflexo quando aplicavel?
- [ ] documentacao foi atualizada?
- [ ] `foundation-navigation-map.md` foi atualizado?

## Ordem de expansao recomendada

1. consolidar produto/estoque
2. consolidar pedidos e metricas
3. consolidar separacao/expedicao
4. consolidar contatos
5. consolidar financeiro e nota
6. consolidar CRM e listas de preco

## Resultado esperado

Se este manual for seguido:

- a fundacao cresce por camadas
- qualquer sistema futuro sabe onde plugar
- Tiny continua sendo origem externa
- Supabase continua sendo memoria viva do Grupo Pepper
