# Regras Operacionais de SKU Pepper + Tiny

Este documento consolida a regra oficial para localizar produto pai e filha
na integracao entre o portal, a fundacao Grupo Pepper e a API do Tiny.

## Objetivo

Definir a forma correta de:

- localizar produto pai e filha pelo SKU Pepper
- converter SKU em `id` operacional do Tiny
- consultar estoque individual
- montar contexto de familia pai/filhas

## Estrutura do SKU Pepper

- Pai: `NN-CODIGOBASE`
- Filha: `NN-CODIGOBASE-TT-CC`

Exemplos:

- Pai: `01-2504`
- Filha: `01-2504-22-01`

Onde:

- `NN` = quantidade/kit
- `CODIGOBASE` = produto base
- `TT` = tamanho
- `CC` = cor

## Regra principal

- SKU e a chave logica
- ID do Tiny e a chave operacional

Entao o fluxo correto e:

1. localizar por SKU
2. validar igualdade exata no campo `codigo`
3. capturar o `id` retornado
4. operar no Tiny sempre pelo `id`

## Como identificar se o SKU e pai ou filha

Regra simples:

- 2 blocos = pai
- 4 blocos = filha

Exemplos:

- `01-2504` -> pai
- `01-2504-22-01` -> filha

## Como descobrir o pai a partir da filha

Exemplo:

- filha: `01-2504-22-01`

Regra:

- remover os 2 ultimos blocos (`TT` e `CC`)
- pai = `01-2504`

Isso e usado quando:

- o usuario informa uma filha
- mas o sistema tambem precisa abrir o contexto da familia

## APIs oficiais do Tiny usadas nesse fluxo

### 1. Pesquisar Produtos

Usar para localizar o produto pelo SKU/codigo.

- parametro principal: `pesquisa`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-pesquisar>

### 2. Obter Estoque Produto
### 2. Obter Produto

Usar quando precisar dos detalhes completos do item apos localizar o `id`.

- parametro principal: `id`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-obter>

### 3. Obter Estrutura do Produto

Usar quando o SKU localizado representar o pai/familia e a fundacao precisar
listar as filhas reais da grade.

- parametro principal: `id`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-estrutura>

### 4. Obter Estoque Produto

Usar para consultar o estoque do produto localizado.

- parametro principal: `id`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-estoque>

## Fluxo correto quando o usuario informar o SKU pai

Exemplo:

- `01-2504`

Passos:

1. chamar `Pesquisar Produtos` com `pesquisa=01-2504`
2. localizar o item cujo campo `codigo` seja exatamente `01-2504`
3. guardar o `id` retornado
4. chamar `Obter Produto` para carregar os dados completos do pai
5. chamar `Obter Estrutura do Produto` com esse `id` para listar as filhas
6. chamar `Obter Estoque Produto` com o `id` de cada item operacional que sera persistido

Observacao importante:

- em operacao real, o estoque valido para compra e reposicao e o da filha
- o pai serve principalmente como referencia da familia

## Regra estrutural para familias grandes

Quando a familia tiver muitas filhas, a fundacao nao deve tratar isso como um
`inspect` curto comum.

Regra oficial:

- ate `39` filhas = fluxo unico permitido
- `40` filhas ou mais = familia grande
- familia grande = importacao em etapas na fundacao

Exemplo pratico:

- `01-1195` com `59` filhas entra como `familia grande`

## Importacao em etapas para SKU com muitas filhas

Quando a familia for grande, a ordem correta passa a ser:

1. localizar o SKU pai pelo Tiny
2. obter o produto pai
3. obter a estrutura completa do pai
4. registrar o plano de importacao na fundacao
5. hidratar as filhas em ondas curtas
6. consultar estoque por `id` em lote pequeno
7. persistir cada onda antes de seguir para a proxima
8. so depois sincronizar catalogo final e deixar o portal consumir

### Lote recomendado

Regra atual da fundacao:

- lote recomendado = `12` filhas por onda

### Objetivo dessa regra

- nao estourar timeout curto de fallback
- nao pressionar a API do Tiny sem necessidade
- manter auditoria do que ja entrou e do que ainda falta
- permitir retomar a importacao sem recomeçar tudo

## Fluxo correto quando o usuario informar o SKU filha

Exemplo:

- `01-2504-22-01`

Passos:

1. chamar `Pesquisar Produtos` com `pesquisa=01-2504-22-01`
2. localizar o item cujo campo `codigo` seja exatamente `01-2504-22-01`
3. guardar o `id` retornado
4. chamar `Obter Produto` com esse `id`
5. chamar `Obter Estoque Produto` com esse `id`
6. usar esse retorno como estoque real da variacao

## Regra para mais de uma API

Fluxo mais comum:

1. `Pesquisar Produtos`
2. `Obter Produto`
3. `Obter Estoque Produto`

Fluxo completo quando precisa mais contexto:

1. `Pesquisar Produtos`
2. `Obter Produto`
3. `Obter Estrutura do Produto`
4. `Obter Estoque Produto`

## Boa pratica obrigatoria

Ao pesquisar no Tiny:

- nunca confiar so no retorno parcial da busca
- sempre validar se o campo `codigo` retornado e exatamente igual ao SKU procurado

Motivo:

- a busca aceita nome ou codigo, inclusive parcial
- pode retornar itens parecidos

## Logica recomendada no sistema

Se o usuario digitar um SKU:

1. identificar se e pai ou filha
2. pesquisar pelo SKU
3. validar igualdade exata no campo `codigo`
4. capturar `id`
5. consultar estoque pelo `id`
6. se for filha, usar esse estoque como saldo real da variacao
7. se for pai, usar como referencia da familia e localizar filhas quando necessario

## Regra operacional da fundacao Grupo Pepper

Para a V1 deste projeto:

- o portal e `Supabase-first`
- a fundacao Grupo Pepper e a base principal
- o Tiny Pepper (matriz) e a origem de cadastro de produto
- Show Look e On Shop entram para pedidos, vendas e metricas
- importacao de produto nao deve consultar cadastro das dependentes

Portanto:

1. primeiro consultar o SKU na fundacao
2. se ja existir, responder pela fundacao
3. se nao existir, usar o SKU Pepper para localizar o produto no Tiny
4. validar o `codigo` exato
5. capturar o `id`
6. consultar detalhes por `id`
7. se for pai, consultar a estrutura por `id`
8. consultar estoque por `id`
9. persistir na fundacao

## Estrategia de povoamento da fundacao

Na reta final deste projeto, a regra oficial e:

- `webhook-first` para povoamento organico
- `Tiny manual` apenas para:
  - inspecao por SKU
  - importacao pontual por SKU
  - reconciliacao pontual

Portanto:

- nao forcar backfill grande agora
- nao tentar puxar catalogo inteiro de uma vez
- deixar pedido, estoque e status alimentarem a fundacao no tempo real do negocio
- usar importacao pontual por SKU quando um item ainda nao existir ou estiver incompleto

## Resumo pratico

- para buscar pelo SKU: usar `Pesquisar Produtos`
- para ler estoque: usar `Obter Estoque Produto`
- para detalhes completos: usar `Obter Produto`
- nunca operar estoque so com SKU se a API exigir `id`
- primeiro encontrar o `id`, depois operar

## Status

Este documento deve ser tratado como regra oficial para futuras implementacoes
de:

- inspecao de produto
- importacao Tiny
- leitura de estoque
- montagem de grade cor x tamanho
- metricas de giro e reposicao
