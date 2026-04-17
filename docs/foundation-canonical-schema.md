# Schema Canonico da Fundacao Grupo Pepper

Data base: 2026-04-16

## Objetivo

Definir a estrutura oficial da fundacao para:

- consolidar o que vem do Tiny
- guardar payloads completos e auditaveis
- manter catalogo, estoque, pedidos, contatos, fiscal e logistica em dominios claros
- permitir que sistemas futuros consumam a base sem criar novas listas

## Regra principal

O dado oficial da fundacao deve ficar em dominios canonicos.

Os sistemas futuros:

1. leem esses dominios primeiro
2. so consultam Tiny quando faltar dado ou quando precisarem reconciliar
3. persistem de volta na fundacao antes de responder como verdade oficial

## Dominio 1. Referencias Pepper

Tabelas:

- `PepperSizeReference`
- `PepperColorReference`
- `PepperTinyAccountReference`

Uso:

- interpretar SKU Pepper
- saber quem e matriz e quem e dependente
- saber como cada conta deve ser tratada no multiempresa

## Dominio 2. Catalogo oficial

Tabelas:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogPrice`
- `CatalogImage`
- `CatalogAttribute`
- `CatalogTinyMapping`
- `CatalogProductSupplier`
- `CatalogVariantAccountState`

Uso:

- `CatalogProduct` = pai/familia
- `CatalogVariant` = filha/variacao operavel
- `CatalogInventory.availableMultiCompanyStock` = saldo oficial consumido pelo portal
- `CatalogVariantAccountState` = leitura por conta do Tiny, inclusive saldo local, reservado e multiempresa
- `CatalogTinyMapping` = SKU -> Tiny ID por conta
- `CatalogImage` = fotos oficiais do produto/variacao

Campos chave de governanca:

- `sourcePayloadJson`
- `foundationMetadataJson`
- `sourceAccountKey`
- `lastReconciledTinyId`
- `rawPayload`

Regra estrutural adicional:

- familia com `40` filhas ou mais entra como `importacao em etapas`
- o plano da onda deve ficar auditavel em `TinyImportBatch` / `TinyImportItem`
- o objetivo e evitar que o portal trate familia grande como um inspect curto comum

## Dominio 3. Eventos brutos e observabilidade

Tabelas:

- `TinyWebhookLog`
- `SyncRun`
- `FoundationInboundEvent`

Uso:

- registrar o evento bruto recebido
- saber se foi novo, atualizado, warning, falha ou duplicado
- manter replay, auditoria e diagnostico

Regra:

- webhook e sinal
- a fundacao registra primeiro o sinal bruto
- depois normaliza para as listas finais

## Dominio 4. Movimentacao de estoque

Tabelas:

- `FoundationStockMovement`
- `InventorySnapshot`
- `CatalogInventory`

Uso:

- `FoundationStockMovement` = trilha operacional por conta, com origem, motivo, referencia e saldo apos o evento
- `InventorySnapshot` = espelho bruto legado/compatibilidade
- `CatalogInventory` = saldo oficial que o portal consome

Regra:

- qualquer evento de estoque deve reconciliar o saldo multiempresa
- nunca aplicar delta cego como saldo final
- se a conta dependente emitir um evento manual, registrar anomalia e reconciliar pelo saldo multiempresa

## Dominio 5. Contatos

Tabelas:

- `FoundationContact`
- `Customer`
- `Supplier`

Uso:

- `FoundationContact` = camada generica para clientes, fornecedores, parceiros, marketplace e contatos CRM
- `Customer` = dominio comercial atual do portal
- `Supplier` = dominio operacional do portal

Regra:

- dados vindos do Tiny entram completos em `FoundationContact`
- o que for especifico do portal continua refletido em `Customer`/`Supplier`

## Dominio 6. Pedidos comerciais

Tabelas:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

Uso:

- historico comercial
- Pepper IA
- analise de giro
- cards operacionais

Regra:

- pedido aprovado pode reduzir o saldo multiempresa se o Tiny ja refletir reserva
- a fundacao espelha o saldo do Tiny e nao tenta recalcular fora dele

## Dominio 7. Lista de preco

Tabelas:

- `FoundationPriceList`
- `FoundationPriceListItem`
- `CatalogPrice`

Uso:

- listas oficiais de preco do Tiny
- excecoes futuras
- leitura consolidada de preco por SKU

Regra:

- `CatalogPrice` guarda a leitura atual mais util ao portal
- `FoundationPriceList*` guarda a origem completa e historica de listas

## Dominio 8. Mídia e documentos

Tabelas:

- `CatalogImage`
- `ProductSuggestionImage`
- `FoundationAsset`

Uso:

- imagens oficiais do catalogo
- documentos operacionais
- comprovantes, xml, danfe, etiquetas, romaneios, fotos e anexos futuros

Regra:

- toda midia relevante deve poder ser identificada por:
  - dominio dono
  - entidade dona
  - tipo
  - conta/origem
  - bucket/path/url

## Dominio 9. Separacao

Tabelas:

- `PickingSeparation`
- `PickingSeparationItem`
- `PickingSeparationStatusHistory`

Uso:

- refletir separacao do Tiny
- acompanhar status e itens
- ligar pedido -> separacao -> expedicao

## Dominio 10. Expedicao

Tabelas:

- `ShipmentGrouping`
- `Shipment`
- `ShipmentPackage`
- `ShipmentStatusHistory`

Uso:

- agrupamentos
- etiquetas
- tracking
- forma de envio
- despacho

## Dominio 11. Fiscal

Tabelas:

- `Invoice`
- `InvoiceItem`
- `InvoiceStatusHistory`

Uso:

- NF autorizada
- cancelamento
- XML/DANFE
- ligacao entre pedido, saldo e despacho

## Dominio 12. Compatibilidade e legado

Tabelas mantidas apenas para transicao:

- `Product`
- `ProductSupplier`
- `InventorySnapshot`

Regra:

- nao usar como lista oficial para sistemas novos
- manter apenas enquanto o portal atual ainda depender delas

## Fonte oficial por necessidade

### Produto

- `CatalogProduct`
- `CatalogVariant`

### Estoque

- `CatalogInventory.availableMultiCompanyStock`

### Estoque por conta

- `CatalogVariantAccountState`

### Tiny ID por conta

- `CatalogTinyMapping`

### Pedido

- `SalesOrder`
- `SalesOrderItem`

### Historico de mudanca

- `TinyWebhookLog`
- `SyncRun`
- `FoundationInboundEvent`
- `FoundationStockMovement`

### Fotos e arquivos

- `CatalogImage`
- `FoundationAsset`

## Regra final de organizacao

Se um sistema novo quiser se conectar:

1. primeiro consultar este schema canonico
2. escolher o dominio oficial
3. nunca criar tabela paralela sem extensao formal da fundacao
