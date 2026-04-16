# Integracoes Externas da Fundacao Grupo Pepper

Data base: 2026-04-16

## Objetivo

Registrar as integracoes externas complementares da fundacao para que:

- fiquem documentadas desde ja
- usem nomes padronizados de variaveis
- entrem no dominio correto quando forem implementadas
- outros sistemas saibam como aproveitar essas conexoes

## Regra de seguranca

Segredos e chaves nunca devem ser gravados nos documentos versionados.

Devem ficar apenas em:

- `.env`
- Render
- secrets manager futuro, quando existir

Nos documentos, mantemos apenas:

- nome da integracao
- papel na fundacao
- variaveis de ambiente
- status de prontidao

## 1. PrintNode

### Variavel oficial

- `PRINTNODE_API_KEY`

### Papel na fundacao

PrintNode deve ser o conector oficial de impressao para:

- etiquetas
- agrupamentos
- impressos de expedicao
- comprovantes operacionais
- futuras impressoes de NF quando o dominio fiscal estiver ativo

### Dominios que ele deve consumir

- `Shipment`
- `ShipmentGrouping`
- `PickingSeparation`
- `Invoice`

### Regra de implementacao

PrintNode nao deve ter tabela de produto ou pedido propria.

Ele deve consumir a fundacao e produzir, no futuro:

- `PrintJob`
- `PrintTemplate`
- `PrintQueueItem`

quando esse dominio for ativado.

### Status atual

- credencial: disponivel
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 2. SendPulse

### Variaveis oficiais

- `SENDPULSE_CLIENT_ID`
- `SENDPULSE_API_KEY`

### Papel na fundacao

SendPulse deve ser o conector oficial de:

- WhatsApp
- comunicacao automatizada
- notificacoes
- captura de contexto para atendimento

### Dominios que ele deve consumir

- `Conversation`
- `Supplier`
- `SalesOrder`
- `Shipment`
- futuros dominios de CRM e financeiro

### Regra de implementacao

SendPulse nao deve virar banco paralelo de conversas.

Ele deve:

1. consumir a fundacao
2. registrar interacoes relevantes na fundacao
3. servir como canal, nao como base principal

### Status atual

- credencial: disponivel
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 3. Mercado Livre

### Variaveis oficiais

- `MERCADO_LIVRE_CLIENT_ID`
- `MERCADO_LIVRE_CLIENT_SECRET`
- `MERCADO_LIVRE_REDIRECT_URI`

### Papel na fundacao

Mercado Livre deve entrar no dominio de marketplace para:

- anuncios
- pedidos por canal
- preco por canal
- status logistico

### Dominios que ele deve consumir

- `CatalogProduct`
- `CatalogVariant`
- `CatalogPrice`
- `SalesOrder`
- `Shipment`

### Status atual

- credencial: parcial
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 4. Shopee Brasil

### Variaveis oficiais

- `SHOPEE_PARTNER_ID`
- `SHOPEE_PARTNER_KEY`
- `SHOPEE_SHOP_ID`

### Papel na fundacao

Shopee deve entrar no mesmo dominio de marketplace:

- anuncios
- pedidos por canal
- preco por canal
- status logistico

### Status atual

- credencial: pendente
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 5. TikTok Shop

### Variaveis oficiais

- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `TIKTOK_SHOP_ID`

### Papel na fundacao

TikTok Shop deve entrar no mesmo dominio de marketplace:

- catalogo por canal
- pedidos por canal
- preco por canal
- status logistico

### Status atual

- credencial: pendente
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 6. Magalu Seller

### Variaveis oficiais

- `MAGALU_SELLER_CLIENT_ID`
- `MAGALU_SELLER_CLIENT_SECRET`
- `MAGALU_SELLER_STORE_ID`

### Papel na fundacao

Magalu Seller deve entrar no mesmo dominio de marketplace:

- catalogo por canal
- pedidos por canal
- preco por canal
- status logistico

### Status atual

- credencial: pendente
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 7. Melhor Envio

### Variaveis oficiais

- `MELHOR_ENVIO_CLIENT_ID`
- `MELHOR_ENVIO_CLIENT_SECRET`
- `MELHOR_ENVIO_REDIRECT_URI`
- `MELHOR_ENVIO_ACCESS_TOKEN`
- `MELHOR_ENVIO_REFRESH_TOKEN`

### Papel na fundacao

Melhor Envio deve entrar como conector logistico para:

- cotacao
- frete
- emissao de etiquetas
- rastreio
- consolidacao de envios

### Dominios que ele deve consumir

- `Shipment`
- `ShipmentGrouping`
- `ShippingMethod`
- `FreightQuote`
- `TrackingEvent`

### Regra de implementacao

Melhor Envio nao deve criar base propria de pedido ou produto.

Ele deve:

1. consumir pedidos e expedicoes da fundacao
2. devolver cotacao, etiqueta e rastreio para a fundacao
3. registrar eventos logisticos na fundacao

### Status atual

- credencial: pendente
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## 8. Mercado Pago

### Variaveis oficiais

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_PUBLIC_KEY`
- `MERCADO_PAGO_WEBHOOK_SECRET`

### Papel na fundacao

Mercado Pago deve ser o conector oficial de pagamentos para:

- cobranca
- recebimento
- baixa financeira
- conciliacao

### Dominios que ele deve consumir

- `AccountsReceivable`
- `AccountsReceivableSettlement`
- `SalesOrder`
- `Invoice`

### Regra de implementacao

Mercado Pago nao deve virar um financeiro paralelo.

Ele deve:

1. consumir a cobranca existente na fundacao
2. registrar status e liquidacao na fundacao
3. alimentar IA financeira e atendimento sem criar tabela duplicada

### Status atual

- credencial: pendente
- codigo: ainda nao implementado
- fundacao: documentada e reservada

## Regra de consumo para outros sistemas

Se um sistema futuro quiser usar essas integracoes:

1. nao criar banco proprio do dominio
2. consumir a fundacao primeiro
3. usar a integracao externa apenas como conector de canal
4. registrar os efeitos do canal na fundacao

## Ordem recomendada de ativacao

1. `SendPulse`
   - maior valor rapido para atendimento e relacionamento
2. `PrintNode`
   - fecha impressao operacional junto de expedicao
3. `Melhor Envio`
   - fecha frete, etiqueta e rastreio junto da camada logistica
4. `Mercado Pago`
   - fecha cobranca e baixa junto da camada financeira
5. `Mercado Livre`
   - quando o dominio marketplace for aberto
6. `Shopee`, `TikTok Shop`, `Magalu Seller`
   - em seguida, no mesmo dominio unificado de marketplace
