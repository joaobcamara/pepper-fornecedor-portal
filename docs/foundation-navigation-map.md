# Mapa Vivo da Fundacao Grupo Pepper

Data base: 2026-04-17

## Objetivo

Ser o mapa rapido da fundacao:

- o que existe hoje
- onde fica
- como chegar
- o que da para fazer
- como fazer direito

Este documento deve ser atualizado sempre que:

- nova tabela canonica entrar no Supabase
- novo modulo do portal passar a consumir a fundacao
- novo webhook ou rota oficial entrar
- novo dominio operacional nascer na fundacao

## Como usar este mapa

Quando alguem precisar mexer na fundacao:

1. localizar o dominio aqui
2. ver a tabela oficial
3. ver por qual rota ou tela ele entra
4. confirmar no manual certo como operar
5. so depois implementar

## Mapa por dominio

### 1. Catalogo oficial

Onde fica:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogInventory`
- `CatalogTinyMapping`
- `CatalogImage`
- `CatalogVariantAccountState`

Como chegar:

- portal admin: `/admin/produtos`
- portal fornecedor: `/produtos`
- importacao sob demanda: `POST /api/admin/tiny/import`
- inspecao por SKU: `POST /api/admin/tiny/inspect`

O que da para fazer:

- carregar produto e variacoes pela fundacao
- vincular fornecedor ao produto
- controlar visibilidade do card no portal
- importar SKU faltante do Tiny para a fundacao
- ler estoque multiempresa oficial
- manter foto do pai e galeria oficial na fundacao

Como fazer:

- primeiro consultar Supabase/fundacao
- se faltar SKU, consultar Tiny Pepper
- persistir o produto completo na fundacao
- responder o portal a partir da fundacao
- foto do portal deve vir da fundacao; a ordem oficial e:
  - foto da filha, se existir
  - foto do pai na fundacao
  - placeholder visual
- webhook comercial ou de estoque pode virar gatilho de hidratacao de catalogo/midia quando o SKU ainda nao estiver completo

Manual principal:

- `foundation-consumer-manual.md`
- `tiny-sku-operational-rules.md`

### 2. Overlay do portal

Onde fica:

- `CatalogProduct.foundationMetadataJson`

Como chegar:

- portal admin: `/admin/produtos`
- configuracao do card: `POST /api/admin/products/configure`
- ajustes do card: `POST /api/admin/products/settings`

O que da para fazer:

- ocultar/exibir card no portal
- manter catalogo canonico intacto
- controlar vinculacao do produto ao portal sem apagar o produto-base

Como fazer:

- nunca apagar `CatalogProduct` para esconder produto
- alterar apenas o overlay do portal

### 3. Estoque

Onde fica:

- `CatalogInventory`
- `CatalogVariantAccountState`
- `FoundationStockMovement`
- `TinyWebhookLog`
- `SyncRun`

Como chegar:

- portal admin: `/admin/estoque`
- painel tecnico: `/admin/sincronizacoes`
- webhook: `POST /api/tiny/webhooks/stock`
- reconcile: `POST /api/admin/sincronizacoes/reconcile`

O que da para fazer:

- ler saldo multiempresa oficial
- reconciliar saldo por evento de estoque
- auditar saldo por conta
- rastrear origem da movimentacao

Como fazer:

- saldo oficial consumido pelo portal = `availableMultiCompanyStock`
- webhook de estoque = gatilho de reconciliacao
- nao aplicar delta cego como saldo final
- Pepper e a conta oficial para confirmar o saldo multiempresa persistido em `CatalogInventory`
- Show Look e On Shop continuam enviando sinais e alimentando `CatalogVariantAccountState`, mas o saldo oficial nao deve somar as 3 contas
- o portal so deve consumir saldo quando `CatalogInventory` tiver origem auditavel da fundacao nova
- `CatalogVariantAccountState` guarda o retrato por conta; `CatalogInventory` guarda o saldo multiempresa oficial

Manual principal:

- `foundation-webhook-setup-manual.md`
- `foundation-event-orchestration-rules.md`

### 4. Pedidos e vendas

Onde fica:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `VariantSalesMetricDaily`
- `ProductSalesMetricDaily`
- `SupplierSalesMetricDaily`

Como chegar:

- pedidos admin: `/admin/pedidos-fornecedor`
- pedidos fornecedor: `/pedidos-recebidos`
- webhook vendas: `POST /api/tiny/webhooks/sales`
- webhook pedidos enviados: `POST /api/tiny/webhooks/orders`
- reconcile vendas: `POST /api/admin/sincronizacoes/reconcile-sales`

O que da para fazer:

- registrar venda/pedido por conta
- alimentar metricas
- alimentar Pepper IA
- refletir pedido do admin para fornecedor

Como fazer:

- chave de pedido sempre escopada por conta
- Pepper, Show Look e On Shop entram no dominio comercial
- pedido/reserva afeta leitura comercial e pode refletir saldo se o Tiny ja refletir multiempresa
- `sales` e `orders` devem permanecer rastreaveis separadamente em `TinyWebhookLog` e `SyncRun`

### 5. Conversas e sugestoes

Onde fica:

- `Conversation`
- `Message`
- `MessageAttachment`
- `ProductSuggestion`
- `ProductSuggestionStatusHistory`
- `CatalogOnboardingItem`

Como chegar:

- admin conversas: `/admin/conversas`
- fornecedor mensagens: `/mensagens`
- admin sugestoes: `/admin/sugestoes-produto`
- fornecedor sugestao: `/sugestao-produto`

O que da para fazer:

- trocar contexto operacional
- enviar anexos
- registrar sugestao de produto
- revisar e aprovar fluxo de onboarding

Como fazer:

- manter fundacao como memoria do fluxo
- nao criar area paralela fora da fundacao

### 6. WhatsApp compartilhavel do admin

Onde fica:

- `WhatsAppShareLink`
- `WhatsAppShareLinkItem`

Como chegar:

- portal admin: `/admin/whatsapp`
- rota de criacao: `POST /api/whatsapp-links`
- pagina publica: `/whatsapp/[slug]`

O que da para fazer:

- gerar link compartilhavel vivo
- comparar snapshot inicial x estado atual
- aprovar, recusar, pedir alteracao, fechar e apagar
- abrir layout mobile-first com estoque real da fundacao

Como fazer:

- criar link sempre a partir do admin
- snapshot inicial fica salvo
- leitura atual vem da fundacao em tempo real

### 7. Financeiro operacional

Onde fica:

- `SupplierFinancialEntry`
- `SupplierFinancialAttachment`
- `SupplierFinancialStatusHistory`

Como chegar:

- admin: `/admin/financeiro`
- fornecedor: `/financeiro`

O que da para fazer:

- acompanhar pendencia financeira operacional
- anexar comprovantes
- compartilhar resumo/exportacao

Como fazer:

- card financeiro continua refletindo na fundacao
- anexos e status precisam permanecer auditaveis

### 8. Referencias Pepper

Onde fica:

- `PepperSizeReference`
- `PepperColorReference`
- `PepperTinyAccountReference`

Como chegar:

- leitura por codigo de SKU
- importadores Tiny
- parsers de produto e variacao

O que da para fazer:

- interpretar tamanho
- interpretar cor
- saber papel da conta no multiempresa

Como fazer:

- SKU sempre por bloco
- cor sempre no ultimo bloco inteiro
- conta Pepper = matriz

### 9. Dominios futuros ja preparados

Onde fica:

- `FoundationContact`
- `FoundationPriceList`
- `FoundationPriceListItem`
- `PickingSeparation`
- `PickingSeparationItem`
- `Shipment`
- `ShipmentPackage`
- `Invoice`
- `FoundationAsset`

Como chegar:

- via integracoes futuras da fundacao
- via novos bundles Tiny

O que da para fazer:

- contatos
- listas de preco
- separacao
- expedicao
- fiscal
- midia e documentos completos

Como fazer:

- ativar sempre por bundle
- registrar evento bruto e persistencia final
- atualizar este mapa junto com o schema

## Regra de importacao por complexidade

### SKU comum

- ate `39` filhas
- fluxo unico permitido

### Familia grande

- `40` filhas ou mais
- importacao em etapas
- lote recomendado = `12`
- timeout estendido de importacao

Exemplo conhecido:

- `01-1195` com `59` filhas

Manual principal:

- `foundation-staged-import-manual.md`

## Regra de manutencao obrigatoria

Sempre que algo novo entrar na fundacao, atualizar:

1. `foundation-canonical-schema.md`
2. `foundation-navigation-map.md`
3. `foundation-consumer-manual.md`
4. `foundation-mental-map.md`

Se a mudanca envolver webhook Tiny, atualizar tambem:

5. `foundation-webhook-setup-manual.md`

## Regra de bolso

- Tiny = origem externa
- Fundacao = memoria viva oficial
- Portal = consumidor da fundacao
- SKU = chave logica
- Tiny ID = chave operacional por conta
- saldo do portal = multiempresa
- webhook-first para operacao normal
- importacao manual so quando faltar dado ou houver reconciliacao pontual
