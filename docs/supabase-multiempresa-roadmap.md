# Supabase Multiempresa Roadmap

## Objetivo

Este roadmap transforma a fundacao multiempresa em uma ordem pratica de implementacao.

A ideia nao e implementar tudo de uma vez, e sim seguir uma sequencia segura que preserve:

- Pepper como matriz
- Show Look e On Shop como dependentes
- SKU como identidade logica compartilhada
- Tiny ID como identidade operacional por conta
- Supabase como base central da empresa
- uso futuro por multiplas IAs especializadas

---

## Fase 0. Preparacao e governanca

### Objetivo

Definir a base de controle antes de integrar os dominios.

### Entregas

- cadastrar `companies`
  - Pepper
  - Show Look
  - On Shop
- cadastrar `company_api_accounts`
- definir `company_type`
  - Pepper = `MATRIX`
  - Show Look = `DEPENDENT`
  - On Shop = `DEPENDENT`
- definir politica de logs
- definir ambiente e segredos
- documentar naming padrão dos recursos

### Resultado esperado

- o projeto passa a reconhecer oficialmente que os dados pertencem a empresas diferentes
- a camada de integracao deixa de ser monoempresa

### Prioridade

Maxima. Nenhuma fase posterior deve ser implementada sem isso.

---

## Fase 1. Catalogo mestre do grupo

### Objetivo

Criar a espinha dorsal do ecossistema por SKU.

### Entregas

- `catalog_products`
- `catalog_variants`
- `catalog_variant_company_links`
- `catalog_inventory_group`
- `catalog_inventory_company_snapshots`
- `catalog_prices`
- `catalog_categories`
- `catalog_images`

### APIs Tiny envolvidas

- Pesquisar Produtos
- Obter Produto
- Obter Estoque produto
- Obter Estrutura produto
- Obter lista produtos alterados
- Obter atualizacoes de estoque
- Obter Arvore de Categorias dos Produtos
- Atualizar precos dos produtos

### Regras

- SKU pai e SKU filha representam a identidade logica do grupo
- Tiny ID e salvo por empresa
- o estoque principal de leitura passa a ser:
  - `availableMultiCompanyStock`
- Pepper continua como referencia mais forte de estrutura

### Resultado esperado

- o grupo passa a ter um catalogo centralizado e consistente
- Show Look e On Shop deixam de ser vistas como catalogos paralelos isolados

---

## Fase 2. Taxonomia comercial e enriquecimento do catalogo

### Objetivo

Enriquecer o catalogo para uso operacional, comercial e por IA.

### Entregas

- `catalog_tag_groups`
- `catalog_tags`
- `catalog_product_tags`
- `catalog_price_lists`
- `catalog_price_list_exceptions`
- `catalog_marketplace_listings`

### APIs Tiny envolvidas

- Pesquisar Grupos de Tags
- Incluir Grupo de Tags
- Alterar Grupo de Tags
- Pesquisar Tags
- Incluir Tag
- Alterar Tag
- Pesquisar Listas de Precos
- Excecoes das Listas de Precos

### Resultado esperado

- o catalogo fica semanticamente rico
- preco e classificacao ficam prontos para IA vendedora, marketplace e recomendacao

---

## Fase 3. Contatos, clientes, fornecedores e vendedores

### Objetivo

Construir a base de relacionamento da empresa.

### Entregas

- `contacts`
- `customer_profiles`
- `customer_company_links`
- `supplier_profiles`
- `vendors`

### APIs Tiny envolvidas

- Pesquisar Contatos
- Obter Contato
- Incluir Contato
- Alterar Contato
- Pesquisar vendedores

### Regra critica

No CRM, so considerar clientes com:

- email
ou
- telefone
ou
- celular

Sem isso:

- o registro pode existir operacionalmente
- mas nao entra no pipeline de CRM

### Resultado esperado

- clientes e fornecedores passam a existir com contexto por empresa
- a IA passa a saber de qual empresa cada cliente faz parte

---

## Fase 4. CRM multiempresa

### Objetivo

Criar a camada de relacionamento comercial e follow-up.

### Entregas

- `crm_stages`
- `crm_subjects`
- `crm_actions`

### APIs Tiny envolvidas

- Lista de estagio dos assuntos do CRM
- Pesquisar assuntos do CRM
- Obter assunto do CRM
- Incluir assunto do CRM
- Incluir acao no assunto do CRM
- Alterar estagio do assunto do CRM
- Alterar situacao da acao do assunto do CRM

### Resultado esperado

- o ecossistema passa a ter pipeline comercial consultavel
- a futura `CRM IA` pode operar com contexto real

---

## Fase 5. Pedidos e comercial

### Objetivo

Fechar a trilha de venda por empresa.

### Entregas

- `sales_orders`
- `sales_order_items`
- `sales_order_status_history`
- `sales_order_markers`

### APIs Tiny envolvidas

- Pesquisar Pedidos
- Obter Pedido
- Incluir Pedido
- Alterar Pedido
- Atualizar situacao do pedido
- Incluir Marcadores no Pedido
- Remover Marcadores no Pedido

### Regras

- todo pedido deve ter `companyId`
- todo item deve tentar se amarrar ao SKU e ao `catalog_variant`
- a IA deve conseguir responder:
  - qual empresa gerou o pedido
  - qual produto/variacao foi vendido

### Resultado esperado

- base de atendimento e comercial passa a existir de forma completa

---

## Fase 6. Financeiro

### Objetivo

Conectar venda, cliente e recebiveis.

### Entregas

- `payment_methods`
- `accounts_receivable`
- `accounts_receivable_settlements`
- `invoices`
- `invoice_markers`

### APIs Tiny envolvidas

- Incluir Conta a Receber
- Alterar Conta a Receber
- Obter Conta a Receber
- Pesquisar Contas a Receber
- Baixar Conta a Receber
- Pesquisar Formas de Recebimento
- Pesquisar Notas
- Obter Nota
- Incluir Nota
- Obter XML Nota
- Obter Link Nota
- Emitir Nota

### Resultado esperado

- a empresa ganha visao financeira unificada no Supabase
- a futura `Financeiro IA` passa a ter base real

---

## Fase 7. Logistica e operacao

### Objetivo

Fechar a trilha pos-venda e operacional.

### Entregas

- `shipments`
- `shipment_groupings`
- `shipping_methods`
- `freight_quotes`
- `picking_separations`
- `tracking_events`

### APIs Tiny envolvidas

- Pesquisar expedições
- Pesquisar agrupamentos
- Obter expedição
- Alterar expedição
- Incluir agrupamento
- Concluir agrupamento
- Obter agrupamento para impressão
- Obter etiquetas para impressão
- Pesquisar formas de envio
- Obter forma de envio
- Incluir forma de envio
- Incluir forma de frete
- Pesquisar Separações
- Obter Separação
- Alterar situação de uma Separação
- Cotação de fretes

### Resultado esperado

- atendimento passa a ter contexto de entrega e rastreio
- a futura `Logistica IA` ganha base operacional real

---

## Fase 8. Integração, webhooks e reconciliação

### Objetivo

Garantir atualizacao automatica e governanca dos dados.

### Entregas

- `integration_sync_runs`
- `integration_sync_errors`
- `integration_raw_payloads`
- `tiny_webhook_logs`
- `integration_reconcile_jobs`

### Webhooks Tiny envolvidos

- Atualizacoes de estoque
- Envio de produtos
- Envio de codigo de rastreio
- Envio de nota fiscal
- Envio de precos de produtos
- Atualizacoes de situacao de pedido
- Busca cotacoes de fretes

### Regra operacional

Usar sempre dois caminhos:

- webhook para atualizacao rapida
- reconciliação periodica como rede de seguranca

### Resultado esperado

- base viva
- rastreabilidade
- menor dependencia de consulta direta ao Tiny em tempo real

---

## Fase 9. Views 360 para IA

### Objetivo

Criar a camada final de consumo por agentes.

### Entregas

- `ai_product_catalog`
- `ai_customer_360`
- `ai_order_360`
- `ai_crm_360`
- `ai_financial_360`
- `ai_logistics_360`
- `ai_company_360`

### Resultado esperado

- o Supabase deixa de ser apenas banco operacional
- vira base de conhecimento pronta para IA

---

## Fase 10. IAs especializadas por setor

### Objetivo

Separar o raciocinio de IA por funcao da empresa.

### Agentes sugeridos

- Atendimento IA
- Vendedora IA
- CRM IA
- Marketplace IA
- Financeiro IA
- Logistica IA
- Operacoes IA

### Regra

Cada IA deve consultar:

- apenas as views e tabelas do proprio dominio
- com contexto de empresa preservado

### Resultado esperado

- inteligencia mais precisa
- menos respostas genericamente erradas
- uso setorial profissional

---

## Fase 11. Governanca e reutilizacao em outros projetos

### Objetivo

Transformar a base em ativo estrutural da empresa.

### Entregas

- padrao de naming
- padrao de logs
- politicas de sincronizacao
- politicas de seguranca por dominio
- documentacao tecnica viva
- pacote de views reutilizaveis

### Resultado esperado

- o banco deixa de ser “do portal”
- e vira “a base central da empresa”

---

## Ordem recomendada real

Se fosse priorizar por impacto:

1. Fase 0 - Preparacao e governanca
2. Fase 1 - Catalogo mestre
3. Fase 3 - Contatos, clientes, fornecedores e vendedores
4. Fase 5 - Pedidos e comercial
5. Fase 8 - Integracao, webhooks e reconciliacao
6. Fase 6 - Financeiro
7. Fase 7 - Logistica e operacao
8. Fase 2 - Taxonomia comercial e enriquecimento
9. Fase 4 - CRM multiempresa
10. Fase 9 - Views para IA
11. Fase 10 - IAs especializadas
12. Fase 11 - Governanca e reutilizacao

---

## Observacao importante

Este roadmap e da fundacao multiempresa futura.

Ele nao substitui o projeto atual do portal.

O portal atual deve continuar do ponto onde paramos, com:

- revisao final de paginas
- QA
- ajuste de rotas e login
- deploy

Depois disso, esta fundacao multiempresa pode ser implementada com muito mais seguranca.
