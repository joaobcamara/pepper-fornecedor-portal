# Supabase Catalogo IA

Esta camada foi desenhada para separar o dado operacional do portal da camada de catalogo reutilizavel para IA, atendimento e outros projetos.

## Objetivos

- Centralizar produtos pai e variacoes em uma estrutura normalizada.
- Persistir apenas o estoque usado pela operacao: `availableMultiCompanyStock`.
- Guardar preco, imagens, fornecedores e vinculos Tiny sem misturar tudo em uma tabela unica.
- Gerar contexto textual pronto para IA consultar sem precisar reconstruir a ficha inteira em cada busca.
- Manter espaco proprio para anuncios de marketplace por produto pai.

## Tabelas novas

- `CatalogProduct`
  - catalogo principal por produto pai
  - guarda nome, categoria, material, composicao, genero, modelo, estilo, resumo IA, tags e imagem principal
- `CatalogVariant`
  - uma linha por cor x tamanho
  - guarda SKU da filha, cor, tamanho, Tiny ID e contexto IA proprio
- `CatalogInventory`
  - armazena somente `availableMultiCompanyStock`
  - guarda status e data da ultima sincronizacao
- `CatalogPrice`
  - preco de venda, promocional e custo
- `CatalogImage`
  - imagens do pai e da filha
- `CatalogMarketplaceListing`
  - anuncios publicados por marketplace ligados ao produto pai
- `CatalogAttribute`
  - atributos flexiveis extras para enriquecer busca e atendimento
- `CatalogTinyMapping`
  - chave logica SKU e chave operacional Tiny ID, separadas
- `CatalogProductSupplier`
  - relacao produto pai x fornecedor
- `Customer`
  - cadastro consolidado do cliente para AtendimentoIA
- `SalesOrder`
  - pedido vindo do Tiny com contexto comercial e de atendimento
- `SalesOrderItem`
  - itens do pedido ligados por SKU a variacoes e produtos
- `SalesOrderStatusHistory`
  - historico de status do pedido
- `VariantSalesMetricDaily`
  - metricas diarias por variacao
- `ProductSalesMetricDaily`
  - metricas diarias por produto pai
- `SupplierSalesMetricDaily`
  - metricas diarias por fornecedor

## Colunas de IA

As duas camadas abaixo foram pensadas para consulta por IA:

- `salesContextAi`
  - mini prompt descritivo com nome, categoria, material, modelo, genero, grade, estoque e preco
- `searchText`
  - texto consolidado para full text search
- `intentTags`
  - tags consolidadas em JSON string para filtros e enriquecimento semantico

## View de consulta para IA

O arquivo [prisma/supabase-ai-catalog.sql](/D:/Arquivos%20para%20sites/Fornecedor/prisma/supabase-ai-catalog.sql) cria a view `ai_product_catalog`.

Ela foi pensada para responder consultas como:

- `tem short preto M?`
- `me mostra body canelado com estoque`
- `qual produto feminino preto em tamanho unico esta disponivel?`

Cada linha da view representa uma variacao pronta para venda.

Tambem foram preparadas:

- `ai_customer_360`
  - cliente, historico resumido, total de pedidos, ultima compra
- `ai_order_360`
  - pedido, cliente e itens consolidados para AtendimentoIA consultar pos-venda

## Fluxo recomendado de sincronizacao

1. Tiny continua sendo fonte operacional.
2. O portal importa ou sincroniza o produto.
3. O script `npm run catalog:sync` converte a camada operacional para o catalogo profissional.
4. A view `ai_product_catalog` consolida o dado final para IA e outros projetos.

## Estoque em tempo quase real

O projeto agora tambem esta preparado para dois caminhos complementares:

- webhook Tiny de estoque em `POST /api/tiny/webhooks/stock`
- reconciliacao periodica em `POST /api/internal/reconcile-stock`

Regras adotadas:

- a camada de catalogo armazena apenas `availableMultiCompanyStock`
- o webhook atualiza a base operacional e a camada de catalogo ao mesmo tempo
- cada processamento gera log em `TinyWebhookLog`
- a reconciliacao serve como rede de seguranca para eventos perdidos ou produtos que ficaram sem movimentacao recente

## Vendas e atendimento IA

O projeto tambem passa a aceitar webhook de vendas em `POST /api/tiny/webhooks/sales`.

Fluxo:

1. Tiny avisa sobre inclusao ou atualizacao de pedido.
2. O backend consulta o pedido completo no Tiny.
3. O backend enriquece o cliente pelo contato do Tiny.
4. Pedido, cliente e itens sao gravados no Supabase.
5. Itens sao amarrados por SKU a `CatalogVariant` e `Product`.
6. Metricas diarias sao agregadas por variacao, produto pai e fornecedor.
7. AtendimentoIA pode consultar `ai_customer_360`, `ai_order_360` e `ai_product_catalog`.

## Conexao com Supabase

Quando a conexao real for configurada:

- `DATABASE_URL` deve apontar para a conexao usada pela aplicacao.
- `DIRECT_URL` deve apontar para a conexao direta de migracao/Prisma CLI.

No estado atual, o projeto ainda roda localmente com SQLite, mas a modelagem ja foi preparada para a migracao do catalogo.
