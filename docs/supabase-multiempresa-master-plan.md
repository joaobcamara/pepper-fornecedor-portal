# Supabase Multiempresa Master Plan

## Objetivo

Este documento define a fundacao de dados da Pepper para uso multiempresa, integrando:

- Pepper
- Show Look
- On Shop

A proposta nao e apenas sustentar o portal atual, mas criar uma base central reutilizavel para:

- operacao interna
- dashboards
- catalogo central
- atendimento
- CRM
- financeiro
- logistica
- futuras IAs especializadas por setor

## Regra estrutural principal

### Matriz e dependentes

- `Pepper` = matriz
- `Show Look` = dependente
- `On Shop` = dependente

### Regra de identificacao

- `SKU` = identidade logica compartilhada entre as 3 contas
- `Tiny ID` = identidade operacional local dentro de cada conta

### Regra de estoque

- o ecossistema trabalha com estoque compartilhado
- a leitura operacional principal deve considerar `availableMultiCompanyStock`
- Pepper continua sendo a referencia mais forte de estrutura e confianca operacional

### Regra de vendas nas dependentes

- vendas em Show Look e On Shop tambem impactam o estoque compartilhado do grupo
- por isso nao devemos tratar as 3 contas como catalogos isolados

## Camadas da arquitetura

### 1. Camada de empresa

Representa a origem organizacional dos dados.

Tabelas sugeridas:

- `Company`
- `CompanyApiAccount`
- `CompanyWebhookSource`

Campos principais:

- `id`
- `name`
- `slug`
- `type` (`MATRIX` ou `DEPENDENT`)
- `isPrimary`
- `tinyBaseUrl`
- `tinyTokenEnvKey`
- `active`

Uso:

- identificar de qual empresa veio cada dado
- diferenciar matriz e dependentes
- permitir que a IA responda corretamente a origem de pedidos, clientes e operacoes

## 2. Camada de catalogo central

Representa o ecossistema logico compartilhado por SKU.

Tabelas sugeridas:

- `CatalogProduct`
- `CatalogVariant`
- `CatalogVariantCompanyLink`
- `CatalogInventoryGroup`
- `CatalogInventoryCompanySnapshot`
- `CatalogPrice`
- `CatalogPriceList`
- `CatalogPriceListException`
- `CatalogCategory`
- `CatalogTagGroup`
- `CatalogTag`
- `CatalogProductTag`
- `CatalogImage`
- `CatalogMarketplaceListing`
- `CatalogTinyMapping`

### Regras

- `CatalogProduct` = produto pai logico do grupo
- `CatalogVariant` = variacao logica do grupo
- `CatalogVariantCompanyLink` = ligacao da variacao com cada conta Tiny
- `CatalogInventoryGroup` = leitura principal de estoque do grupo
- `CatalogInventoryCompanySnapshot` = leitura auxiliar por conta, para auditoria

### Campos importantes em `CatalogVariantCompanyLink`

- `catalogVariantId`
- `companyId`
- `sku`
- `tinyProductId`
- `tinyParentId`
- `tinyCode`
- `lastSyncAt`

## 3. Camada de relacionamento e CRM

Representa pessoas, empresas, relacionamento comercial e pipeline.

Tabelas sugeridas:

- `Contact`
- `CustomerProfile`
- `SupplierProfile`
- `Vendor`
- `CrmStage`
- `CrmSubject`
- `CrmAction`

### Regra importante do CRM

So entra no CRM se houver pelo menos um dado de contato relevante:

- email
- telefone
- celular

Sem isso:

- o contato pode existir na camada operacional
- mas nao entra no pipeline CRM

### Regra multiempresa

Todo cliente deve carregar contexto de empresa:

- `companyId`
- ou relacao `CustomerCompanyLink`

Assim a IA consegue responder:

- de qual empresa o cliente e
- em qual loja comprou
- em qual contexto o relacionamento existe

## 4. Camada comercial

Representa pedidos e contexto de venda.

Tabelas sugeridas:

- `SalesOrder`
- `SalesOrderItem`
- `SalesOrderStatusHistory`
- `SalesOrderMarker`

Campos importantes:

- `companyId`
- `customerId`
- `tinyOrderId`
- `orderNumber`
- `status`
- `channel`
- `createdAt`
- `updatedAt`

Regra:

- a origem do pedido sempre precisa ser preservada por empresa
- os itens devem ser ligados ao SKU e, quando possivel, ao `CatalogVariant`

## 5. Camada financeira

Representa contas a receber, formas de recebimento e vinculacao com pedido/cliente.

Tabelas sugeridas:

- `AccountsReceivable`
- `AccountsReceivableSettlement`
- `PaymentMethod`
- `Invoice`
- `InvoiceMarker`

Uso:

- alimentar uma futura IA financeira
- responder status financeiro no atendimento
- consolidar historico comercial da empresa

## 6. Camada logistica

Representa expedicao, agrupamentos, separacao e rastreio.

Tabelas sugeridas:

- `Shipment`
- `ShipmentGrouping`
- `ShippingMethod`
- `FreightQuote`
- `PickingSeparation`
- `TrackingEvent`

Uso:

- pos-venda
- atendimento
- logistica
- dashboards operacionais

## 7. Camada de integracao

Representa sincronizacao, webhooks, reconciliacao e fila tecnica.

Tabelas sugeridas:

- `IntegrationSyncRun`
- `IntegrationSyncError`
- `TinyWebhookLog`
- `IntegrationReconcileJob`
- `IntegrationRawPayload`

Campos importantes:

- `companyId`
- `resourceType`
- `status`
- `startedAt`
- `finishedAt`
- `errorMessage`
- `payloadJson`

## 8. Camada de IA e conhecimento

Representa a camada pronta para consulta por agentes e assistentes especializados.

Views sugeridas:

- `ai_product_catalog`
- `ai_customer_360`
- `ai_order_360`
- `ai_crm_360`
- `ai_financial_360`
- `ai_logistics_360`
- `ai_company_360`

Campos de contexto sugeridos:

- `salesContextAi`
- `searchText`
- `intentTags`
- `customerContextAi`
- `orderContextAi`
- `crmContextAi`

## APIs Tiny por dominio

### Contatos

Usar:

- Pesquisar Contatos
- Obter Contato
- Incluir Contato
- Alterar Contato

Objetivo:

- consolidar contatos, clientes e fornecedores
- enriquecer CRM e atendimento

### Produtos

Usar:

- Pesquisar Produtos
- Obter Produto
- Incluir Produto
- Alterar Produto
- Obter Estoque produto
- Obter Estrutura produto
- Obter Tags produto
- Obter lista produtos alterados
- Obter atualizacoes de estoque
- Atualizar estoque de um produto
- Obter Arvore de Categorias dos Produtos
- Atualizar precos dos produtos

Objetivo:

- construir e manter o catalogo mestre do grupo

### Tags

Usar:

- Pesquisar Grupos de Tags
- Incluir Grupo de Tags
- Alterar Grupo de Tags
- Pesquisar Tags
- Incluir Tag
- Alterar Tag

Objetivo:

- enriquecer classificacao semantica e operacional do catalogo

### Listas de preco

Usar:

- Pesquisar Listas de Precos
- Excecoes das Listas de Precos

Objetivo:

- sustentar politica comercial por canal, contexto ou cliente

### Vendedores

Usar:

- Pesquisar vendedores

Objetivo:

- ligar clientes, CRM e operacao comercial a donos responsaveis

### CRM

Usar:

- Lista de estagio dos assuntos do CRM
- Pesquisar assuntos do CRM
- Obter assunto do CRM
- Incluir assunto do CRM
- Incluir acao no assunto do CRM
- Alterar estagio do assunto do CRM
- Alterar situacao da acao do assunto do CRM

Objetivo:

- sustentar pipeline de relacionamento

### Financeiro

Usar:

- Incluir Conta a Receber
- Alterar Conta a Receber
- Obter Conta a Receber
- Pesquisar Contas a Receber
- Baixar Conta a Receber
- Pesquisar Formas de Recebimento

Objetivo:

- consolidar visao financeira por cliente e empresa

### Webhooks

Usar:

- Atualizacoes de estoque
- Envio de produtos
- Envio de codigo de rastreio
- Envio de nota fiscal
- Envio de precos de produtos
- Atualizacoes de situacao de pedido
- Busca cotacoes de fretes

Objetivo:

- manter a base viva com atualizacao quase em tempo real

### Fretes

Usar:

- Cotacao de fretes

Objetivo:

- apoio logistico, atendimento e simulacao

### Pedidos

Usar:

- Pesquisar Pedidos
- Obter Pedido
- Incluir Pedido
- Alterar Pedido
- Gerar Ordem Producao do Pedido
- Gerar Nota Fiscal do Pedido
- Atualizar informacoes de despacho
- Atualizar situacao do pedido
- Incluir Marcadores no Pedido
- Remover Marcadores no Pedido
- Lancar Estoque do Pedido
- Estornar Estoque do Pedido
- Lancar Contas do Pedido
- Estornar Contas do Pedido

Objetivo:

- fechar a camada comercial e operacional completa

### Notas fiscais

Usar:

- Pesquisar Notas
- Obter Nota
- Incluir Nota
- Incluir Marcadores na Nota
- Remover Marcadores na Nota
- Incluir Nota Consumidor
- Incluir Nota via XML
- Obter XML Nota
- Obter Link Nota
- Emitir Nota
- Atualizar informacoes de despacho
- Lancar Estoque da Nota Fiscal
- Lancar Contas da Nota Fiscal

Objetivo:

- sustentar fiscal, financeiro e atendimento pos-venda

### Expedicao

Usar:

- Enviar objetos para a expedicao
- Pesquisar expedicoes
- Pesquisar agrupamentos
- Obter expedicao
- Alterar expedicao
- Incluir agrupamento
- Concluir agrupamento
- Obter agrupamento para impressao
- Obter etiquetas para impressao
- Pesquisar formas de envio
- Obter forma de envio
- Incluir forma de envio
- Incluir forma de frete

Objetivo:

- sustentar logistica e acompanhamento de envio

### Separacao

Usar:

- Pesquisar Separacoes
- Obter Separacao
- Alterar situacao de uma Separacao

Objetivo:

- sustentar operacao interna e futura IA de separacao/logistica

## Regra de multiempresa por dominio

### Produtos

- o SKU representa a identidade do grupo
- Pepper e a referencia principal
- Show Look e On Shop ficam ligadas por `companyId` e `tinyProductId`

### Estoque

- leitura principal do grupo = `availableMultiCompanyStock`
- snapshots por empresa servem de apoio, nao como verdade final isolada

### Clientes

- um cliente pode existir em mais de uma empresa
- o relacionamento com cada empresa deve ser preservado

### Pedidos

- todo pedido precisa carregar `companyId`
- a IA deve ser capaz de dizer de qual empresa ele veio

### CRM

- so entra no CRM quem tiver informacao de contato valida
- a entidade CRM precisa ser identificada por empresa

## IAs especializadas por setor

### 1. Atendimento IA

Escopo:

- cliente
- pedido
- nota
- rastreio
- expedição
- empresa de origem

### 2. Vendedora IA

Escopo:

- catalogo
- estoque
- preco
- listas de preco
- recomendacao de produto

### 3. CRM IA

Escopo:

- assuntos
- acoes
- estagios
- follow-up
- vendedores

### 4. Marketplace IA

Escopo:

- anuncios
- catalogo por canal
- tags comerciais
- preco por canal

### 5. Financeiro IA

Escopo:

- contas a receber
- formas de recebimento
- baixas
- notas

### 6. Logistica IA

Escopo:

- expedicao
- separacao
- agrupamentos
- frete
- rastreio

### 7. Operacoes IA

Escopo:

- webhooks
- sync runs
- erros
- reconcile
- consistencia da integracao

## Ordem recomendada de implementacao

### Fase 1

- estrutura multiempresa
- companies
- company tokens
- webhooks por empresa

### Fase 2

- catalogo mestre
- variants por SKU
- links por conta
- estoque do grupo

### Fase 3

- contatos
- clientes
- fornecedores
- vendedores
- CRM

### Fase 4

- pedidos
- itens
- status
- financeiro
- notas

### Fase 5

- expedicao
- separacao
- fretes
- rastreio

### Fase 6

- views 360
- IAs especializadas
- observabilidade e governanca

## Resultado esperado

Ao final dessa fundacao, a Pepper tera:

- uma base central multiempresa
- produto, cliente, pedido e estoque conectados por empresa e por SKU
- rastreabilidade operacional
- dados prontos para IA
- condicao de reutilizar essa estrutura em multiplos sistemas futuros

## Lembrete de continuidade

Este documento e uma fundacao de arquitetura. Ele nao substitui o andamento do projeto atual.

Depois de consolidar esta base conceitual, o trabalho deve continuar normalmente no portal atual, fechando:

- revisao final de paginas
- QA de rotas e links
- documentacao real
- deploy
- e depois expansao controlada para o ecossistema multiempresa
