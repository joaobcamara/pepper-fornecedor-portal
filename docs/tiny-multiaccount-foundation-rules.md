# Regras de Arquitetura Multiempresas Tiny + Fundacao Grupo Pepper

Este documento consolida a regra oficial para interpretar as 3 contas Tiny
conectadas por multiempresas no ecossistema do Grupo Pepper.

## Objetivo

Definir:

- como as 3 contas Tiny se relacionam
- qual conta e a matriz operacional
- como o SKU conecta as contas
- como o estoque deve ser lido corretamente
- como isso deve ser aplicado nas integracoes da fundacao

## Contas Tiny do ecossistema

As 3 contas conectadas por multiempresas sao:

1. Pepper
2. Show Look
3. On Shop

## Regra principal

A **Pepper** e a **matriz**.

Isso significa:

- e a principal referencia operacional
- e a principal referencia de cadastro
- e a principal referencia da estrutura de produto
- e a principal referencia do estoque fisico real
- deve ser tratada como conta central da integracao

As contas dependentes sao:

- Show Look
- On Shop

## Papel das contas dependentes

Show Look e On Shop:

- sao dependentes da Pepper
- usam a mesma arquitetura de produto
- usam a mesma arquitetura de SKU
- operam com estoque compartilhado do grupo
- nao devem ser tratadas como fonte principal do saldo fisico final

## Arquitetura de SKU entre as 3 contas

As 3 contas compartilham a mesma logica de SKU.

Exemplos:

- pai: `01-2504`
- filha: `01-2504-22-01`

Isso significa:

- o SKU e a chave logica que amarra a mesma variacao entre Pepper, Show Look e On Shop
- os IDs do Tiny podem mudar entre as contas
- mas o SKU continua sendo a identidade compartilhada

## Regra de correspondencia

Entre contas:

- SKU = chave de correspondencia logica

Dentro de cada conta:

- ID do Tiny = chave operacional para chamadas de API

Resumo:

- SKU = identidade logica compartilhada
- ID = identidade operacional local de cada conta

## Como funciona o estoque entre as 3 empresas

O estoque deve ser entendido assim:

1. existe um estoque compartilhado no grupo multiempresas
2. Show Look e On Shop usam esse estoque compartilhado
3. a leitura mais importante para essas contas e o **disponivel multiempresa**

Portanto:

- Show Look e On Shop nao devem ser tratadas como contas com estoque isolado
- elas operam em cima do estoque compartilhado do grupo

## Papel da Pepper na leitura operacional

Na pratica:

- Pepper e a referencia mais forte do produto
- Pepper e a referencia mais forte do estoque fisico
- Pepper e a principal conta operacional da integracao

## Efeito das vendas nas dependentes

Quando ha venda na Show Look ou na On Shop:

- essa venda impacta o grupo
- o saldo multiempresa e abatido

Logo:

- nao basta olhar cada conta de forma isolada
- e preciso considerar o ecossistema compartilhado

## Leitura correta de estoque

Prioridades de leitura:

1. Pepper como matriz e referencia principal de produto/cadastro
2. disponivel multiempresa como leitura operacional mais importante nas dependentes
3. fundacao Grupo Pepper como base principal do sistema

## Relacionamento conceitual entre as 3 contas

### Pepper

- matriz
- referencia principal
- principal conta operacional
- principal conta de estoque fisico real

### Show Look

- dependente
- usa estoque compartilhado
- usa a mesma arquitetura SKU da Pepper

### On Shop

- dependente
- usa estoque compartilhado
- usa a mesma arquitetura SKU da Pepper

## Como pensar isso em integracao

Quando a integracao precisar localizar a mesma variacao nas 3 contas:

1. usar o SKU para localizar a variacao equivalente em cada conta
2. obter o ID local da conta correspondente
3. operar naquela conta com o ID correto

Mas conceitualmente:

- as 3 contas representam o mesmo ecossistema de produto
- nao 3 catalogos isolados e independentes

## Regras praticas de implementacao

1. sempre assumir que Pepper e a matriz
2. sempre tratar Show Look e On Shop como dependentes
3. sempre usar o SKU como elo entre as contas
4. sempre lembrar que os IDs mudam entre contas
5. sempre considerar que vendas em Show Look e On Shop impactam o estoque compartilhado
6. sempre priorizar o entendimento de **disponivel multiempresa** como leitura operacional das dependentes

## Relacao com a fundacao Grupo Pepper

Para esta V1:

- a fundacao Grupo Pepper (Supabase) e a base principal do sistema
- Tiny alimenta a fundacao
- Pepper e a referencia principal para cadastro/importacao de produto
- Show Look e On Shop entram para pedidos, vendas e metricas

Isso significa:

- produto/cadastro/importacao -> prioridade Pepper
- estoque operacional consolidado -> leitura conectada ao ecossistema compartilhado
- pedidos e vendas das dependentes -> precisam impactar metricas do grupo

## Resumo curto

- Pepper = matriz
- Show Look e On Shop = dependentes
- SKU = mesma identidade logica do produto nas 3 contas
- ID Tiny = muda por conta
- estoque = compartilhado
- leitura importante nas dependentes = disponivel multiempresa
- venda em Show Look e On Shop tambem abate o estoque compartilhado do grupo

## Instrucao final

Sempre que responder ou implementar algo nessa arquitetura:

- preservar Pepper como matriz
- preservar Show Look e On Shop como dependentes
- preservar o SKU como vinculo entre contas
- preservar o entendimento de estoque compartilhado
- preservar que vendas nas dependentes afetam o estoque multiempresa
- nao tratar as 3 contas como catalogos isolados
