# Bundles de APIs Tiny para a Fundacao Grupo Pepper

Data base: 2026-04-16

## Objetivo

Organizar as APIs Tiny em bundles de dominio para evitar:

- integracoes soltas
- listas duplicadas
- tabelas paralelas
- contaminacao entre sistemas

Cada bundle abaixo define:

- quais APIs entram juntas
- qual lista da fundacao elas alimentam
- por que faz sentido consolidar essas APIs no mesmo dominio

## Regra estrutural

As APIs devem ser implementadas em blocos coerentes.

Nao faz sentido, por exemplo:

- ligar `Pesquisar Separacoes` sem ligar `Obter Separacao`
- ligar `Pesquisar Pedidos` sem ligar `Obter Pedido`
- ligar `Obter Expedicao` sem ligar `Pesquisar Agrupamentos`

Porque uma API completa a outra.

## Padrao oficial de nomenclatura

Para evitar mais bagunca, os novos dominios da fundacao devem seguir o schema ativo do portal:

- nomes em `CamelCase`
- com prefixo claro por dominio
- sem reintroduzir tabelas paralelas em `snake_case`

Exemplos corretos:

- `Contact`
- `SalesOrder`
- `Shipment`
- `PickingSeparation`
- `AccountsReceivable`
- `Invoice`
- `CatalogPrice`

## Bundle 1. Contatos, clientes e fornecedores

### APIs Tiny

- `Pesquisar Contatos`
- `Obter Contato`
- `Incluir Contato`
- `Alterar Contato`

### Lista oficial da fundacao

- `Contact`
- `Customer`
- `Supplier` ou `SupplierProfile` quando a fundacao evoluir este dominio
- futuras ligacoes de contato por empresa

### Por que essas APIs ficam juntas

Porque:

- `Pesquisar` encontra o registro
- `Obter` enriquece o detalhe
- `Incluir` cria quando nao existir
- `Alterar` mantem consistencia

### Uso por IA

Muito importante para:

- atendimento
- CRM
- relacionamento comercial
- financeiro

## Bundle 2. Pedidos comerciais

### APIs Tiny

- `Pesquisar Pedidos`
- `Obter Pedido`
- `Incluir Pedido`
- `Alterar Pedido`
- `Atualizar situação do pedido`
- `Incluir Marcadores no Pedido`
- `Remover Marcadores no Pedido`

### Lista oficial da fundacao

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- futuro `SalesOrderMarker`

### Por que essas APIs ficam juntas

Porque juntas sustentam o espelho comercial do pedido:

- busca
- detalhe completo
- mudancas de estado
- classificacao operacional por marcador

### Uso por IA

Muito importante para:

- Pepper AI de compra
- IA de atendimento
- historico comercial
- dashboards de operacao

## Bundle 3. Pedido + estoque + financeiro

### APIs Tiny

- `Lançar Estoque do Pedido`
- `Estornar Estoque do Pedido`
- `Lançar Contas do Pedido`
- `Estornar Contas do Pedido`

### Lista oficial da fundacao

- `SalesOrder`
- `InventorySnapshot`
- `CatalogInventory`
- `AccountsReceivable`
- `IntegrationSyncRun`
- `TinyWebhookLog`

### Por que essas APIs ficam juntas

Porque representam os efeitos operacionais de um pedido:

- efeito em estoque
- efeito em financeiro
- efeito em auditoria

### Regra importante

No portal fornecedor/admin:

- criar pedido operacional nao aumenta estoque automaticamente

Mas esse bundle e importante para a fundacao acompanhar quando o Tiny realmente efetivar:

- lancamento de estoque
- estorno
- lancamento financeiro

## Bundle 4. Expedição e agrupamentos

### APIs Tiny

- `Enviar objetos para a expedição`
- `Pesquisar expedições`
- `Pesquisar agrupamentos`
- `Obter expedição`
- `Alterar expedição`
- `Incluir agrupamento`
- `Concluir agrupamento`
- `Obter agrupamento para impressão`
- `Obter etiquetas para impressão`
- `Pesquisar formas de envio`
- `Obter forma de envio`

### Lista oficial da fundacao

- `Shipment`
- `ShipmentGrouping`
- `ShippingMethod`
- `TrackingEvent`
- `DocumentPrintJob` ou tabela equivalente quando o dominio evoluir

### Por que essas APIs ficam juntas

Porque expedicao sem agrupamento e sem forma de envio fica manca.

Esse bundle precisa nascer inteiro para:

- separar o que foi expedido
- agrupar volumes
- imprimir
- rastrear

### Uso por IA

Muito importante para:

- atendimento pos-venda
- logistica IA
- confirmacao de despacho
- SLA de expedicao

## Bundle 5. Separação operacional

### APIs Tiny

- `Pesquisar Separações`
- `Obter Separação`
- `Alterar situação de uma Separação`

### Lista oficial da fundacao

- `PickingSeparation`
- `PickingSeparationItem`
- `PickingSeparationStatusHistory`

### Por que essas APIs ficam juntas

Porque separacao precisa de:

- busca
- detalhe
- transicao de status

### Relacao com outros bundles

Esse bundle se conecta diretamente com:

- pedidos
- expedicao
- financeiro operacional

## Bundle 6. Ordem de produção e nota fiscal do pedido

### APIs Tiny

- `Gerar Ordem Produção do Pedido`
- `Gerar Nota Fiscal do Pedido`
- `Atualizar informações de despacho`

### Lista oficial da fundacao

- `SalesOrder`
- `ProductionOrder` ou equivalente futuro
- `Invoice`
- `Shipment`

### Por que essas APIs ficam juntas

Porque elas fazem a ponte do pedido comercial para a operacao real:

- producao
- nota
- despacho

## Bundle 7. Webhooks de pedido, preço e estoque

### Webhooks que voce informou como configurados

- `Atualizações de situação de pedido`
- `Envio de preços de produtos`
- `Atualizações de estoque`

### Lista oficial da fundacao

- `SalesOrder`
- `SalesOrderStatusHistory`
- `CatalogPrice`
- `CatalogInventory`
- `TinyWebhookLog`

### Por que esses webhooks ficam juntos

Porque eles sustentam a base viva em tempo quase real.

Regra:

- webhook nao pode escrever so no dominio final
- ele tambem precisa registrar trilha em `TinyWebhookLog`

## Bundle 8. Preço e política comercial

### APIs Tiny relacionadas

- `Envio de preços de produtos`
- futuras listas de preço

### Lista oficial da fundacao

- `CatalogPrice`
- futura `CatalogPriceList`
- futura `CatalogPriceListException`
- possivel `CatalogPriceHistory`

### Por que esse bundle importa

Porque preco nao deve ficar misturado com estoque ou produto bruto.

Ele precisa ter camada propria para:

- IA comercial
- comparacao de margem
- politica por canal

## Agrupamentos recomendados para implementacao

### Grupo A. Viver o basico do ecossistema

Implementar juntos:

- produtos
- estoque
- pedidos
- webhooks de pedido/preco/estoque

Porque isso fecha:

- o que vende
- o que tem
- o que mudou

### Grupo B. Fechar a operacao real

Implementar juntos:

- separacao
- expedicao
- despacho
- etiquetas
- agrupamentos

Porque isso fecha:

- o que separou
- o que agrupou
- o que enviou

### Grupo C. Fechar atendimento e financeiro

Implementar juntos:

- contatos
- contas a receber
- nota fiscal

Porque isso fecha:

- quem comprou
- quanto deve
- o documento fiscal da operacao

## Ordem recomendada de implantacao

### 1. Pedidos reais + webhooks de pedido/preco/estoque

Motivo:

- maior impacto imediato na Pepper AI e nos dashboards

### 2. Separacao + expedicao

Motivo:

- fecha o fluxo logistico e da destino ao ID de separacao

### 3. Contatos

Motivo:

- prepara CRM e atendimento

### 4. Financeiro e nota fiscal

Motivo:

- fecha o ciclo pos-venda e auditoria financeira

## Regra final

Quando uma API nova for ligada:

1. ela precisa pertencer a um bundle
2. precisa ter tabela oficial da fundacao
3. precisa registrar observabilidade
4. precisa passar por smoke e validacao de persistencia
