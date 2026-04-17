# Deploy Checklist

## Objetivo

Checklist final para subir o portal atual no Render usando:

- dominio base: `fornecedor.pepperecommerce.com.br`
- admin: `fornecedor.pepperecommerce.com.br/admin`
- fornecedor: `fornecedor.pepperecommerce.com.br/produtos`, `dashboard`, `financeiro`, `mensagens`, `sugestao-produto` e `pedidos-recebidos`

## 1. Ambiente

- [ ] `DATABASE_URL` configurado
- [ ] `DIRECT_URL` configurado
- [ ] `SUPABASE_URL` configurado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado
- [ ] `SUPABASE_STORAGE_BUCKET` configurado
- [ ] `SESSION_SECRET` configurado com valor forte
- [ ] `TINY_API_TOKEN` configurado
- [ ] `TINY_API_BASE_URL` configurado
- [ ] `CATALOG_QUEUE_TOKEN` configurado
- [ ] `ALLOW_DEMO_AUTH=false`
- [ ] `TINY_WEBHOOK_SECRET` configurado, se for usar validacao por segredo
- [ ] `CRON_SECRET` configurado
- [ ] `OPENAI_API_KEY` configurado apenas se a validacao assistida estiver ativa

## 2. Banco

- [ ] `prisma generate`
- [ ] `prisma db push`
- [ ] `npm run db:seed` no ambiente inicial, se desejar base de teste
- [ ] revisar se a base de producao nao esta com credenciais de teste desnecessarias
- [ ] validar bucket de anexos no Supabase Storage

## 3. Dominio

- [ ] criar `CNAME` ou `A` para `fornecedor.pepperecommerce.com.br` conforme a hospedagem escolhida
- [ ] adicionar dominio customizado no provedor de deploy
- [ ] aguardar SSL e propagacao

## 3.1 Render

- [ ] criar `Web Service` a partir do GitHub
- [ ] confirmar plano `Starter`
- [ ] validar `buildCommand` e `startCommand`
- [ ] cadastrar variaveis de ambiente no painel do Render
- [ ] validar `healthCheckPath=/login`

## 4. Tiny

- [ ] apontar webhook de estoque para a URL publica
- [ ] apontar webhook de vendas para a URL publica
- [ ] validar se as chamadas do Tiny chegam com sucesso
- [ ] testar reconciliacao manual

## 5. Fluxos principais

- [ ] login fornecedor
- [ ] login admin
- [ ] `admin/estoque`
- [ ] `admin/whatsapp`
- [ ] importacao Tiny por SKU dentro de `admin/produtos`
- [ ] produtos do fornecedor
- [ ] dashboard do fornecedor
- [ ] financeiro do fornecedor
- [ ] mensagens
- [ ] sugestao de produto
- [ ] aprovacao de sugestao
- [ ] fila de cadastro
- [ ] solicitacao de reposicao
- [ ] pedidos ao fornecedor
- [ ] pedidos recebidos
- [ ] financeiro do admin
- [ ] conversas com cards de contexto e slash commands
- [ ] link compartilhavel de WhatsApp do admin
- [ ] cadastro de fornecedor com logo por upload, contato e endereco
- [ ] sincronizacoes

## 6. QA visual

- [ ] revisar top nav do fornecedor
- [ ] revisar cards e fontes nas telas principais
- [ ] revisar boards operacionais de pedidos, sugestoes, reposicao e financeiro
- [ ] revisar estados vazios
- [ ] revisar erros amigaveis nas rotas sensiveis
- [ ] revisar Pepper IA bubble

## 7. Observabilidade

- [ ] revisar logs de webhook
- [ ] revisar logs de sync
- [ ] revisar logs da fila de cadastro
- [ ] validar fallback em caso de oscilacao do Supabase

## 8. Pos deploy

- [ ] trocar credenciais de teste ou restringir seed em producao
- [ ] revisar usuarios admin reais
- [ ] cadastrar fornecedores reais com logo
- [ ] revisar permissoes de visibilidade financeira por fornecedor
- [ ] validar fila de cadastro com o outro sistema
