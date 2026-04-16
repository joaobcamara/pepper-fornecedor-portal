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

Usar para consultar o estoque do produto localizado.

- parametro principal: `id`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-estoque>

### 3. Obter Produto

Usar quando precisar dos detalhes completos do item apos localizar o `id`.

- parametro principal: `id`
- fonte oficial:
  - <https://tiny.com.br/api-docs/api2-produtos-obter>

## Fluxo correto quando o usuario informar o SKU pai

Exemplo:

- `01-2504`

Passos:

1. chamar `Pesquisar Produtos` com `pesquisa=01-2504`
2. localizar o item cujo campo `codigo` seja exatamente `01-2504`
3. guardar o `id` retornado
4. se precisar do estoque do pai, chamar `Obter Estoque Produto` com esse `id`
5. se precisar montar grade de variacoes, usar o SKU pai como referencia da familia e localizar as filhas

Observacao importante:

- em operacao real, o estoque valido para compra e reposicao e o da filha
- o pai serve principalmente como referencia da familia

## Fluxo correto quando o usuario informar o SKU filha

Exemplo:

- `01-2504-22-01`

Passos:

1. chamar `Pesquisar Produtos` com `pesquisa=01-2504-22-01`
2. localizar o item cujo campo `codigo` seja exatamente `01-2504-22-01`
3. guardar o `id` retornado
4. chamar `Obter Estoque Produto` com esse `id`
5. usar esse retorno como estoque real da variacao

## Regra para mais de uma API

Fluxo mais comum:

1. `Pesquisar Produtos`
2. `Obter Estoque Produto`

Fluxo completo quando precisa mais contexto:

1. `Pesquisar Produtos`
2. `Obter Produto`
3. `Obter Estoque Produto`

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
6. consultar detalhes/estoque por `id`
7. persistir na fundacao

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
