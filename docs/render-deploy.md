# Deploy no Render

## Stack escolhida

- GitHub para versionamento e auto deploy
- Render para hospedar o app Next.js
- Supabase para banco, storage e fila de dados
- dominio final: `fornecedor.pepperecommerce.com.br`

## Modelo recomendado

- 1 Web Service no Render
- plano `Starter`
- deploy por commit no branch principal
- custom domain configurado no proprio Render

## Arquivo pronto no repositorio

O projeto agora inclui `render.yaml` com:

- `runtime: node`
- `plan: starter`
- `region: virginia`
- `buildCommand: npm install && npm run build`
- `startCommand: npm run start`
- `healthCheckPath: /login`

## Variaveis que precisam ser configuradas no Render

Configurar manualmente no painel do serviço:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SESSION_SECRET`
- `TINY_API_TOKEN`
- `TINY_SHOWLOOK_API_TOKEN`
- `TINY_ONSHOP_API_TOKEN`
- `TINY_API_BASE_URL`
- `TINY_WEBHOOK_SECRET`
- `CRON_SECRET`
- `CATALOG_QUEUE_TOKEN`
- `ALLOW_DEMO_AUTH=false`
- `OPENAI_API_KEY` se a validacao assistida ficar ativa
- `OPENAI_SUGGESTION_MODEL=gpt-5-mini`

## Bucket no Supabase

Antes do deploy final:

- criar ou confirmar o bucket `portal-assets`
- validar permissao de upload para o service role
- confirmar que logos, romaneios e anexos estao apontando para o bucket

## Ordem de subida

1. Subir o codigo para o GitHub.
2. Criar um novo `Web Service` no Render a partir do repositorio.
3. Confirmar o plano `Starter`.
4. Revisar comandos de build e start.
5. Cadastrar todas as variaveis de ambiente.
6. Rodar o primeiro deploy.
7. Conferir logs e healthcheck.
8. Adicionar o dominio `fornecedor.pepperecommerce.com.br`.
9. Ajustar o DNS no provedor para o destino mostrado pelo Render.
10. Configurar webhooks do Tiny com a URL publica.

## Webhooks que precisam apontar para o Render

- estoque: `/api/tiny/webhooks/stock`
- vendas: `/api/tiny/webhooks/sales`

## Validacao minima apos deploy

- login admin
- login fornecedor
- importacao Tiny por SKU
- dashboard do fornecedor
- produtos do fornecedor
- pedidos recebidos
- financeiro do fornecedor
- pedidos ao fornecedor
- financeiro do admin
- conversas
- upload de logo do fornecedor
- upload de anexos e romaneios

## Observacoes importantes

- o projeto ja esta preparado para usar `Supabase Storage` em producao
- o preview local permite fallback controlado, mas no deploy o ideal e manter `ALLOW_DEMO_AUTH=false`
- a aplicacao deve ficar hospedada apenas no Render; nao e necessario combinar Render e Netlify para o mesmo app
