# Project Status

## Stack atual

- Next.js 15
- TypeScript
- Tailwind CSS
- Prisma
- Supabase Postgres
- Autenticacao propria por sessao

## Areas do sistema

### Fornecedor

- `/login`
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

- Tiny import por SKU
- Tiny webhook de estoque
- Tiny webhook de vendas
- reconciliacao manual e interna
- fila de cadastro no Supabase
- catalogo consolidado no Supabase
- Pepper IA consultiva por perfil e por pagina
- storage de anexos via Supabase em producao

## Situacao atual

Ja concluido:

- fornecedor monitora estoque, giro e indicadores
- fornecedor acompanha financeiro operacional por card e periodo
- admin importa, revisa e vincula produtos
- mensagens com anexos
- sugestoes de produto com revisao, devolucao, historico e fila de cadastro
- dashboards alimentados pelo Supabase
- CRUD de fornecedores com logo por upload, contato e endereco
- CRUD inicial de usuarios
- logout por sessao
- solicitacoes de reposicao com aprovacao no admin
- pedidos ao fornecedor no admin
- pedidos recebidos no fornecedor
- financeiro no admin
- conversas com cards de contexto e slash commands
- Pepper IA bubble contextual com hints, alertas e avisos por modulo

## Compatibilidade

- `/dashboard-insights` continua existindo apenas como redirecionamento legado para `/dashboard`
- `/pepperia` e `/admin/pepperia` continuam existindo apenas como redirecionamentos, porque a Pepper IA agora funciona como bubble

## Pendencias principais ainda abertas

- fortalecer separacao real por subdominio
- continuar a limpeza de legado residual
- reforcar observabilidade de sincronizacoes e webhooks
- fechar checklist final de deploy com dominio e webhooks publicos
