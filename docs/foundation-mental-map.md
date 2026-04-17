# Mapa Mental da Fundacao Grupo Pepper

Data base: 2026-04-16

## Visao mental da fundacao

```mermaid
mindmap
  root((Fundacao Grupo Pepper))
    Tiny Multiempresas
      Pepper (matriz)
      Show Look (dependente)
      On Shop (dependente)
      SKU = identidade logica
      Tiny ID = identidade operacional por conta
      Estoque oficial consumido = saldo multiempresa
    Ingestao
      Webhooks
        sales
        orders
        stock
        invoice future
      Reconcile
        stock
        sales
      Logs
        TinyWebhookLog
        SyncRun
        FoundationInboundEvent
    Catalogo
      CatalogProduct
      CatalogVariant
      CatalogInventory
      CatalogTinyMapping
      CatalogImage
      CatalogVariantAccountState
    Comercial
      SalesOrder
      SalesOrderItem
      SalesOrderStatusHistory
      Metrics Daily
    Operacao
      SupplierOrder
      ReplenishmentRequest
      Conversations
      Suggestions
    Estoque
      FoundationStockMovement
      InventorySnapshot (compatibilidade)
      Saldo por conta
      Saldo multiempresa
    Midia e arquivos
      CatalogImage
      FoundationAsset
      XML
      DANFE
      Etiquetas
      Comprovantes
      Fotos
    Dominios futuros
      FoundationContact
      FoundationPriceList
      PickingSeparation
      Shipment
      Invoice
```

## Fluxo oficial de leitura

```mermaid
flowchart LR
  A["Sistema consumidor"] --> B["Ler CatalogProduct / CatalogVariant"]
  B --> C["Ler CatalogInventory.availableMultiCompanyStock"]
  C --> D["Ler CatalogTinyMapping da conta certa"]
  D --> E["Se faltar dado, consultar Tiny"]
  E --> F["Persistir na fundacao"]
  F --> G["Responder como dado oficial"]
```

## Fluxo oficial de estoque multiempresa

```mermaid
flowchart TD
  A["Evento Tiny de estoque"] --> B["TinyWebhookLog / FoundationInboundEvent"]
  B --> C["Identificar SKU e conta"]
  C --> D["Reconsultar saldo atual no Tiny"]
  D --> E["Salvar saldo multiempresa em CatalogInventory"]
  D --> F["Salvar leitura por conta em CatalogVariantAccountState"]
  D --> G["Salvar trilha em FoundationStockMovement"]
```

## Fluxo oficial para futuros sistemas

1. identificar o dominio certo
2. consumir a fundacao antes de abrir nova tabela
3. usar `SKU` como chave entre sistemas
4. usar `Tiny ID` so dentro da chamada operacional da conta
5. persistir tudo de volta na fundacao

## Regras de bolso

- `Pepper` e matriz de governanca
- `Show Look` e `On Shop` sao dependentes, mas tambem afetam o saldo compartilhado
- o saldo oficial do portal e sempre o `saldo multiempresa`
- webhook e sinal, nao verdade final sem reconciliacao
- fotos e documentos devem ficar em dominio oficial de midia
- sistema novo nao cria lista paralela se a fundacao ja tiver um dominio para aquilo
