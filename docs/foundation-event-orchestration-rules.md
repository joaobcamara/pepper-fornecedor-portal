# Regras de Orquestracao de Eventos da Fundacao

Data base: 2026-04-16

## Objetivo

Definir como a fundacao Grupo Pepper deve reagir quando receber notificacoes das contas Tiny:

- Pepper
- Show Look
- On Shop

Sem criar:

- duplicidade
- sobrescrita indevida
- contaminacao entre dominios
- historico contraditorio

## Principio geral

A sua sugestao esta correta:

- a fundacao deve entender se o evento e novo, repetido ou atualizacao
- a fundacao deve aproveitar o identificador recebido para enriquecer outros dominios
- a fundacao deve ligar os pontos automaticamente quando isso for seguro

Mas isso deve acontecer com regras de governanca.

## Regra 1. Webhook nao e verdade final; webhook e sinal

O webhook deve ser tratado como:

- gatilho de atualizacao
- gatilho de reconciliacao pontual
- gatilho de enriquecimento

Nao como payload final absoluto.

### Exemplo

Se chegar:

- `idPedido`
- `idSeparacao`
- `idExpedicao`
- `idContato`

A fundacao pode:

1. registrar o webhook bruto
2. identificar a conta de origem
3. atualizar a entidade principal que o webhook representa
4. buscar detalhes adicionais via API Tiny do mesmo dominio
5. refletir os dados consolidados nas tabelas oficiais

## Regra 2. Toda notificacao precisa ser classificada

Ao receber um evento, a fundacao deve classificar:

- `novo`
- `atualizacao`
- `duplicado`
- `evento parcial`
- `evento invalido`

### Como decidir isso

Usando:

- `accountKey`
- `webhookType`
- `eventType`
- identificador Tiny escopado por conta
- hash/fingerprint do payload quando necessario

## Regra 3. A chave de identidade sempre precisa ser escopada por conta

### Entre contas

- SKU = chave logica compartilhada

### Dentro da fundacao por evento

A identidade deve ser:

- `pepper:<id>`
- `showlook:<id>`
- `onshop:<id>`

Isso vale para:

- pedido
- contato
- expedicao
- separacao
- nota
- qualquer entidade que venha do Tiny

## Regra 4. Dominios oficiais e conta correta

### Pedidos e vendas

Receber das 3 contas:

- Pepper
- Show Look
- On Shop

Alimentam:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- metricas

### Estoque

- o saldo oficial do portal deve ser sempre o `saldo multiempresa`
- Pepper, Show Look e On Shop podem disparar o refresh desse saldo
- nenhuma conta deve ser tratada como saldo isolado dentro da fundacao

Alimenta:

- `CatalogInventory`
- `InventorySnapshot`

### Regra adicional para contas dependentes

Se um webhook de estoque vier de `Show Look` ou `On Shop`:

- a fundacao deve classificar se o evento veio com contexto comercial (`idPedido`, `idNotaFiscal`, `idSeparacao`)
- se vier sem esse contexto, tratar como `anomalia de movimentacao manual em dependente`
- em vez de aplicar o delta bruto, usar a `sku`/`id` recebidos para consultar novamente o saldo multiempresa atual no Tiny
- atualizar a fundacao com o saldo reconciliado

Resumo:

- Pepper = matriz operacional e de governanca
- dependentes = sinal + reconciliacao por SKU
- saldo oficial da fundacao = saldo multiempresa reconsultado

### Balanco

Segue a regra oficial da fundacao:

- Show Look = `0`
- On Shop = `0`
- Pepper = saldo real

### Separacao, expedicao e despacho

Devem ser buscados da conta que originou o pedido.

Mas a consolidacao deve respeitar:

- Pepper como matriz operacional
- sem sobrescrever estoque fisico final fora da Pepper

### Nota fiscal

Pode ser recebida depois, quando o dominio fiscal estiver ativo.

Ela deve enriquecer:

- status fiscal
- reversoes
- despacho
- rastreabilidade

Mas nao substitui a regra principal de estoque:

- a fundacao espelha o saldo multiempresa atual que o Tiny ja estiver mostrando
- se a reserva do pedido ja reduziu esse saldo, o portal deve refletir essa reducao sem esperar a NF

## Regra 5. Enriquecimento automatico e desejavel, mas assíncrono

Se um webhook trouxer um identificador adicional, a fundacao deve aproveitar isso.

### Exemplo correto

Se vier:

- `idPedido`

A fundacao pode:

- atualizar pedido
- atualizar itens
- atualizar status
- reconstruir metricas

Se vier:

- `idSeparacao`

A fundacao pode:

- buscar `Obter Separacao`
- atualizar `PickingSeparation`
- atualizar historico de status
- relacionar com pedido

Se vier:

- `idExpedicao`

A fundacao pode:

- buscar `Obter Expedicao`
- atualizar `Shipment`
- atualizar despacho/rastreio

Se vier:

- `idContato`

A fundacao pode:

- buscar `Obter Contato`
- atualizar `Customer`/`Contact`

### Regra de ouro

Esse enriquecimento nao deve travar a resposta do webhook principal.

Fluxo correto:

1. registra webhook
2. atualiza entidade principal
3. marca enriquecimento pendente quando necessario
4. busca detalhes adicionais em segundo passo

## Regra 6. A fundacao precisa ser idempotente

Se o Tiny reenviar o mesmo webhook:

- a fundacao nao pode duplicar pedido
- a fundacao nao pode duplicar saldo final
- a fundacao nao pode duplicar marcador de estado

### Regras praticas

- pedido: `upsert` por `tinyOrderId` escopado
- estoque: `upsert` por `catalogVariantId`
- historico de status: so grava quando o estado muda de verdade
- webhook log: sempre grava recebimento, mas com fingerprint para identificar reenvio

## Regra 7. O enriquecimento deve respeitar o dominio certo

O evento recebido pode disparar atualizacoes secundarias, mas so nos dominios coerentes.

### Exemplo coerente

Pedido mudou:

- atualizar `SalesOrder`
- talvez atualizar separacao
- talvez atualizar expedicao
- talvez atualizar metricas

### Exemplo incoerente

Pedido mudou:

- calcular delta proprio de estoque dentro do portal

Fluxo correto:

- o portal registra pedido, reserva e metricas
- a fundacao espelha o saldo multiempresa oficial que o Tiny passou a exibir

### Outro exemplo incoerente

Movimentacao manual em conta dependente:

- aplicar a entrada/saida diretamente como verdade final da fundacao

Fluxo correto:

1. registrar o evento
2. marcar `anomalia`
3. reconciliar o saldo multiempresa pelo SKU/ID da conta
4. atualizar a fundacao pelo saldo reconsultado

## Regra 8. Toda automacao precisa deixar trilha

Cada atualizacao relevante deve deixar rastro em:

- `TinyWebhookLog`
- `SyncRun`
- historico do dominio afetado

Isso permite:

- auditoria
- debug
- explicabilidade para futuras IAs

## Regra 9. A fundacao deve virar inteligente, mas nao adivinha

A fundacao pode cruzar informacoes automaticamente.

Ela nao deve inventar relacoes sem chave forte.

Cruzar automaticamente quando houver:

- id Tiny escopado
- SKU exato
- entidade oficial ja mapeada

Nao cruzar automaticamente quando houver:

- texto solto
- nome parcial
- SKU ambiguo

## Regra 10. Ordem de processamento recomendada

### Pipeline oficial

1. receber webhook
2. validar segredo
3. identificar conta de origem
4. registrar payload bruto em `TinyWebhookLog`
5. classificar `novo`, `atualizacao`, `duplicado`, `invalido`
6. atualizar entidade principal do dominio
7. disparar enriquecimentos secundarios quando houver IDs uteis
8. atualizar metricas derivadas quando cabivel
9. registrar `SyncRun`/resultado

## Casos que mais valem a pena automatizar

### Quando chegar pedido/venda

Atualizar:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- metricas diarias
- cliente/contato

Buscar mais se houver:

- `idContato`
- `idSeparacao`
- `idExpedicao`

### Quando chegar estoque

Atualizar:

- `CatalogInventory`
- `InventorySnapshot`

Buscar mais se houver:

- `idProduto`
- SKU exato da variacao

Regra operacional:

- o webhook de estoque e sinal de reconciliacao
- o saldo salvo deve ser o saldo multiempresa reconsultado
- se o pedido aprovado ja gerou reserva no Tiny, a fundacao deve refletir essa reducao

### Quando chegar separacao

Atualizar:

- `PickingSeparation`
- `PickingSeparationStatusHistory`
- ponte com pedido

### Quando chegar expedicao

Atualizar:

- `Shipment`
- `ShipmentGrouping`
- `TrackingEvent`

## Conclusao executiva

Sua sugestao e coerente e recomendada.

Mas a fundacao deve seguir esta regra:

- receber tudo que e coerente por dominio
- processar a entidade principal primeiro
- enriquecer dominios secundarios de forma controlada
- nunca misturar estoque fisico com dominio de pedido
- nunca sobrescrever Pepper matriz com dependentes fora da regra oficial

## Proxima recomendacao tecnica

As proximas implementacoes devem adicionar:

- fingerprint de webhook
- fila de enriquecimento por dominio
- `SyncRun` mais detalhado por entidade
- tabelas oficiais de `PickingSeparation`, `Shipment` e `Contact`
