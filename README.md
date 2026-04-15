# Portal do Fornecedor Pepper

Portal interno da Pepper para fornecedores acompanharem estoque, giro, sugestoes de produto, mensagens e operacao administrativa integrada ao Tiny ERP.

## Stack atual

- Next.js 15
- TypeScript
- Tailwind CSS
- Prisma
- Supabase Postgres
- autenticacao propria por sessao
- Tiny ERP via API e webhooks
- OpenAI para validacao assistida de sugestoes

## Setup local

1. Instale as dependencias:

```powershell
npm.cmd install
```

2. Copie o ambiente:

```powershell
Copy-Item .env.example .env
```

3. Configure no `.env`:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SESSION_SECRET`
- `TINY_API_TOKEN`
- `TINY_SHOWLOOK_API_TOKEN`
- `TINY_ONSHOP_API_TOKEN`
- `TINY_API_BASE_URL`
- `CATALOG_QUEUE_TOKEN`
- `ALLOW_DEMO_AUTH=false`
- `OPENAI_API_KEY` se quiser usar validacao assistida
- `OPENAI_SUGGESTION_MODEL=gpt-5-mini` para manter a Pepper IA e a validacao assistida no modelo padrao do projeto

4. Gere o Prisma Client:

```powershell
.\node_modules\.bin\prisma.cmd generate
```

5. Suba o schema no Supabase:

```powershell
.\node_modules\.bin\prisma.cmd db push
```

6. Popule a base:

```powershell
npm.cmd run db:seed
```

7. Rode o projeto:

```powershell
npm.cmd run dev
```

## Credenciais de teste

- Admin: `admin / pepper123`
- Fornecedor: `luna / pepper123`

## Rotas principais

### Fornecedor

- `/produtos`
- `/dashboard`
- `/financeiro`
- `/mensagens`
- `/sugestao-produto`
- `/pedidos-recebidos`

### Admin

- `/admin`
- `/admin/produtos`
- `/admin/financeiro`
- `/admin/importacao-tiny`
- `/admin/sugestoes-produto`
- `/admin/solicitacoes-reposicao`
- `/admin/pedidos-fornecedor`
- `/admin/conversas`
- `/admin/fornecedores`
- `/admin/usuarios`
- `/admin/sincronizacoes`

## Integracoes ativas

### Tiny ERP

- importacao manual por SKU
- leitura de pai e filhas
- sincronizacao de estoque
- webhooks de estoque
- webhooks de vendas
- importacao agregada de vendas de Pepper + Show Look + On Shop para as metricas do fornecedor
- reconciliacao manual/assistida

### Supabase

- banco operacional principal
- catalogo consolidado para IA
- clientes, pedidos e itens para AtendimentoIA
- base analitica para dashboards
- fila de cadastro para consumo por sistema externo
- storage de anexos e romaneios em producao
- logos e anexos de fornecedor com upload por arquivo

### OpenAI

- validacao assistida da sugestao de produto no fornecedor
- Pepper IA consultiva com escopo por perfil, contexto dinamico por pagina e alertas operacionais

## Documentacao complementar

- veja `docs/project-status.md` para o status consolidado do MVP
- veja `docs/architecture-review.md` para a consolidacao tecnica do portal atual
- veja `docs/render-deploy.md` para o passo a passo de deploy em GitHub + Render + Supabase
- veja `docs/supabase-catalog.md` para a arquitetura do catalogo e da camada de IA
- veja `docs/supabase-multiempresa-master-plan.md` para a fundacao multiempresa futura
- veja `docs/supabase-multiempresa-schema-base.md` para a base de dados por dominio
- veja `docs/supabase-multiempresa-roadmap.md` para a ordem de implementacao dessa fundacao
