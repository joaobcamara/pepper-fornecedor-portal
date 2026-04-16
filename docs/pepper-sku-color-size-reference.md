# Referencia Oficial de SKU, Cor e Tamanho da Pepper

Este documento consolida a regra oficial para interpretar e montar SKUs da
Pepper, incluindo:

- estrutura pai/filha
- significado de cada bloco
- base oficial de tamanhos
- base oficial de cores
- regra de montagem da grade cor x tamanho

## Objetivo

Definir a base fixa de conhecimento usada pelo sistema para:

- interpretar SKUs Pepper
- localizar pai e filhas
- ler cor e tamanho corretamente
- montar grade de variacoes
- manter coerencia entre fundacao, Tiny e modulos do portal

## Estrutura do SKU

A Pepper trabalha com SKU em blocos separados por hifen.

Temos 2 formatos principais:

### 1. SKU pai

`NN-CODIGOBASE`

Exemplo:

- `01-2504`

### 2. SKU filha

`NN-CODIGOBASE-TT-CC`

Exemplo:

- `01-2504-22-01`

## Significado dos blocos

- `NN` = quantidade / kit / composicao
- `CODIGOBASE` = codigo principal do produto
- `TT` = codigo do tamanho
- `CC` = codigo da cor

## Leitura do SKU

Exemplo:

- `01-2504-22-01`

Interpretacao:

- `01` = unidade
- `2504` = produto base
- `22` = tamanho M
- `01` = cor Preto

Resultado:

- produto unitario do codigo `2504`, tamanho `M`, cor `Preto`

## Logica geral

- o SKU pai representa a familia principal do produto
- o SKU filha representa a variacao real vendavel
- a filha sempre carrega tamanho e cor
- o pai serve como referencia comercial e agrupamento
- a filha serve para estoque, cor, tamanho, imagem e operacao individual

## Exemplo pratico

Pai:

- `01-2504`

Filhas:

- `01-2504-21-01`
- `01-2504-22-01`
- `01-2504-23-01`
- `01-2504-24-01`
- `01-2504-21-03`
- `01-2504-22-03`

Ou seja:

- mesmo produto base
- variando por tamanho e cor

## Primeiro bloco: quantidade / kit

Esse bloco representa a composicao comercial do item.

Exemplos:

- `01` = unidade
- `02` = kit 2
- `03` = kit 3
- `05` = kit 5
- `10` = kit 10
- `20` = kit 20
- `50` = kit 50
- `100` = kit 100

Exemplo:

- `01-2504` = produto unitario
- `05-2504` = kit com 5 pecas do mesmo produto base

## Base oficial de tamanhos da Pepper

Use esta base como referencia principal:

- `01` = 1 ano
- `02` = 2 anos
- `03` = 3 anos
- `04` = 4 anos
- `06` = 6 anos
- `08` = 8 anos
- `10` = 10 anos
- `12` = 12 anos
- `14` = 14 anos
- `16` = 16 anos
- `20` = PP
- `21` = P
- `22` = M
- `23` = G
- `24` = GG
- `25` = XGG
- `26` = Unico
- `27` = Variado
- `28` = Combinei
- `36` = 36
- `37` = 37
- `38` = 38
- `40` = 40
- `42` = 42
- `44` = 44
- `46` = 46
- `48` = 48
- `50` = 50
- `52` = 52
- `54` = 54
- `56` = 56

## Base oficial de cores da Pepper

Use esta base como referencia principal:

- `01` = Preto
- `02` = Bege
- `03` = Vermelho
- `04` = Amarelo
- `05` = Rosa
- `06` = Verde
- `07` = Pink
- `08` = Rose
- `09` = Cinza
- `10` = Azul Royal
- `11` = Azul Marinho
- `12` = Verde Militar
- `13` = Esmeralda
- `14` = Vinho
- `15` = Grafite
- `16` = Branco
- `17` = Variadas / Estampas variadas
- `18` = Claro
- `19` = Escuro
- `20` = Combinei
- `21` = Laranja
- `22` = Azul
- `23` = Estampado
- `24` = Liso
- `25` = Alca fina
- `26` = Alca grossa
- `27` = Roxo
- `28` = Oncinha
- `29` = Marrom
- `30` = Verde Folha
- `31` = Acai
- `44` = Satim / Satin
- `52` = Salmao
- `54` = Fucsia
- `55` = Lilas
- `56` = Verde Azulado
- `57` = Verde Claro
- `58` = Telha
- `59` = Verde Abacate
- `60` = Azul Claro
- `61` = Rosa Choque
- `62` = Chumbo
- `63` = Rosa Claro
- `64` = Verde Agua
- `65` = Azul Turquesa
- `66` = Verde Musgo
- `67` = Verde Bandeira
- `68` = Verde Lima
- `69` = Amarelo Claro
- `70` = Violeta
- `71` = Dourado
- `72` = Creme
- `73` = Rosa Bebe
- `79` = Azul Bebe
- `82` = Mostarda
- `84` = Goiaba
- `86` = Magenta
- `87` = Cinza Azulado
- `88` = Azul Jeans
- `89` = Azul Bic
- `90` = Azul Violeta
- `91` = Areia
- `92` = Verde Tiffany
- `93` = Verde Menta

## Como aplicar o SKU corretamente

Para montar um SKU filha:

1. definir a quantidade/composicao
2. definir o codigo base do produto
3. definir o codigo do tamanho
4. definir o codigo da cor
5. juntar tudo com hifen

Exemplo:

- quantidade: `01`
- base: `2504`
- tamanho: `22`
- cor: `01`

Resultado:

- `01-2504-22-01`

## Como identificar pai e filha

- SKU com 2 blocos = pai
- SKU com 4 blocos = filha

Exemplos:

- `01-2504` = pai
- `01-2504-22-01` = filha

## Como aplicar na operacao

- pai = referencia da familia
- filha = variacao real
- estoque sempre deve ser tratado na filha
- cor e tamanho sempre vem da filha
- imagem da variacao preferencialmente fica vinculada a filha
- a grade cor x tamanho deve ser montada usando as filhas

## Como montar a grade cor x tamanho

1. pegar todas as filhas do pai
2. ler o penultimo bloco como tamanho
3. ler o ultimo bloco como cor
4. converter os codigos usando a base Pepper
5. montar:
   - linhas = cores
   - colunas = tamanhos

Exemplo:

SKUs:

- `01-2504-21-01`
- `01-2504-22-01`
- `01-2504-23-01`
- `01-2504-21-03`
- `01-2504-22-03`

Grade:

Preto:

- P
- M
- G

Vermelho:

- P
- M

## Regras importantes

- nunca tratar o pai como se fosse a variacao final
- nunca ignorar os codigos `TT` e `CC` da filha
- sempre usar a base de cor e tamanho da Pepper para interpretar o SKU
- sempre manter o SKU como identidade logica principal do produto
- quando houver multiempresa, o SKU continua sendo a chave que amarra a mesma variacao entre contas

## Resumo final

- pai: `NN-CODIGOBASE`
- filha: `NN-CODIGOBASE-TT-CC`
- `NN` = quantidade/kit
- `TT` = tamanho
- `CC` = cor
- pai = familia
- filha = operacao real

## Instrucao final

Sempre que responder ou implementar algo sobre SKU Pepper:

- preservar essa estrutura
- preservar a base de cor
- preservar a base de tamanho
- preservar a logica pai/filha
- explicar a montagem do SKU com base nesses blocos
- tratar o SKU como padrao central da operacao
