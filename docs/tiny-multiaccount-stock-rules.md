# Regras Operacionais de Estoque Multiempresas no Tiny

Este documento consolida a regra oficial de leitura, balanco, entrada e saida
entre as 3 contas Tiny conectadas no ecossistema do Grupo Pepper.

## Contas conectadas

As 3 contas Tiny conectadas por multiempresas sao:

1. Pepper
2. Show Look
3. On Shop

## Regra principal

- Pepper e a **matriz**
- Show Look e **dependente**
- On Shop e **dependente**

A Pepper e a conta principal do ecossistema.
Ela e a referencia mais confiavel para:

- estoque fisico real
- operacao principal
- cadastro
- estrutura de produto

Show Look e On Shop:

- usam a mesma arquitetura de SKU
- usam os mesmos produtos na logica comercial
- dependem da Pepper
- trabalham com estoque compartilhado do grupo
- usam principalmente o **disponivel multiempresa**

## Arquitetura de SKU

As 3 contas estao amarradas pela mesma arquitetura de SKU.

Exemplo:

- pai: `01-2504`
- filha: `01-2504-22-01`

Regra:

- o SKU e o elo logico entre as 3 contas
- o ID do Tiny muda em cada conta
- para localizar a mesma variacao entre Pepper, Show Look e On Shop, usar o SKU
- para operar dentro de cada conta, usar o ID local daquela conta

Resumo:

- SKU = chave logica entre contas
- ID = chave operacional dentro da conta

## Leitura

### Como pensar a leitura de estoque

A leitura precisa respeitar que:

- Pepper e a matriz
- Show Look e On Shop sao dependentes
- as 3 participam do mesmo ecossistema de estoque compartilhado

### Regra de leitura

- Pepper e a principal referencia operacional
- Show Look e On Shop usam principalmente o estoque compartilhado do grupo
- nas dependentes, o foco conceitual e o **disponivel multiempresa**

### Importante

Quando Show Look e On Shop fazem vendas:

- essas vendas afetam o estoque compartilhado do grupo
- elas nao podem ser tratadas como contas isoladas de estoque

### Fluxo de leitura

1. receber o SKU da filha
2. localizar a mesma filha pelo SKU na conta desejada
3. obter o ID local daquela conta
4. consultar o estoque pelo ID
5. interpretar o resultado dentro da logica multiempresas

### Resumo da leitura

- Pepper = referencia principal
- Show Look e On Shop = dependentes
- SKU = localiza a mesma filha nas 3 contas
- o estoque deve ser lido entendendo que o grupo compartilha saldo

## Balanco

### Regra principal do balanco

Sempre que houver balanco:

1. Show Look recebe balanco `0`
2. On Shop recebe balanco `0`
3. Pepper recebe o valor real digitado pelo usuario

Ou seja:

- Show Look = `0`
- On Shop = `0`
- Pepper = valor real

### Por que isso existe

Porque:

- Pepper e a matriz e deve manter o saldo fisico real
- Show Look e On Shop sao dependentes
- elas nao devem carregar saldo fisico final
- quando Show Look e On Shop vendem, podem deixar saldo fisico negativo nelas
- isso pode interferir no multiempresa
- por isso e necessario zerar as dependentes antes de aplicar o saldo real na Pepper

### Fluxo do balanco

Exemplo:

- SKU = `01-2504-22-01`
- valor informado pelo usuario = `5`

Passos:

1. localizar o SKU `01-2504-22-01` na Show Look
2. obter o ID dessa filha na Show Look
3. aplicar balanco `0`
4. localizar o SKU `01-2504-22-01` na On Shop
5. obter o ID dessa filha na On Shop
6. aplicar balanco `0`
7. localizar o SKU `01-2504-22-01` na Pepper
8. obter o ID dessa filha na Pepper
9. aplicar balanco `5`

### Resultado esperado

- Show Look = `0`
- On Shop = `0`
- Pepper = `5`

### Editar balanco

Editar balanco segue a mesma logica:

- Show Look = `0`
- On Shop = `0`
- Pepper = novo valor informado

### Excluir balanco

Excluir balanco deve resultar em:

- Show Look = `0`
- On Shop = `0`
- Pepper = `0`

## Entrada e saida

### Regra principal

Entrada e saida fisicas reais devem usar a Pepper como conta principal.

### Por que

Porque:

- Pepper e a matriz
- Pepper e a referencia de saldo fisico real
- Show Look e On Shop sao contas dependentes do ecossistema compartilhado

### Entrada

Entrada representa aumento real do estoque fisico.

Fluxo:

1. receber o SKU da filha
2. localizar essa filha na Pepper pelo SKU
3. obter o ID da filha na Pepper
4. aplicar lancamento tipo `E`
5. consultar o saldo atualizado

Regra:

- entrada fisica principal deve ser aplicada na Pepper

### Saida

Saida representa reducao real do estoque fisico.

Fluxo:

1. receber o SKU da filha
2. localizar essa filha na Pepper pelo SKU
3. obter o ID da filha na Pepper
4. aplicar lancamento tipo `S`
5. consultar o saldo atualizado

Regra:

- saida fisica principal deve ser aplicada na Pepper

### Observacao importante sobre vendas

Mesmo que a saida operacional manual fique concentrada na Pepper:

- vendas feitas em Show Look e On Shop tambem impactam o estoque compartilhado do grupo
- a integracao sempre deve lembrar que as dependentes afetam o comportamento do saldo multiempresa

## Resumo final

### Pepper

- matriz
- referencia principal
- estoque fisico real
- entrada fisica principal
- saida fisica principal
- balanco real

### Show Look

- dependente
- usa estoque compartilhado
- venda impacta o grupo
- no balanco sempre vai para `0`

### On Shop

- dependente
- usa estoque compartilhado
- venda impacta o grupo
- no balanco sempre vai para `0`

## Regras de ouro

- Pepper e a matriz
- Show Look e On Shop sao dependentes
- SKU amarra a mesma variacao nas 3 contas
- ID muda por conta
- leitura precisa considerar o ecossistema multiempresas
- entrada e saida fisicas principais devem usar a Pepper
- balanco sempre:
  - Show Look = `0`
  - On Shop = `0`
  - Pepper = valor real

## Instrucao final

Sempre que responder ou implementar algo nessa arquitetura:

- preservar Pepper como matriz
- preservar Show Look e On Shop como dependentes
- preservar o SKU como chave entre contas
- preservar a logica de estoque compartilhado
- preservar que vendas nas dependentes afetam o grupo
- preservar a regra especial do balanco:
  - Show Look = `0`
  - On Shop = `0`
  - Pepper = valor real
