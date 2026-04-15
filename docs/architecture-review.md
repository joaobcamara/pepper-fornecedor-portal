# Revisao de arquitetura e consolidacao do MVP

## Estado atual

A base principal do sistema esta correta para o tamanho e o objetivo do projeto:
- Next.js como camada de app e interface
- Prisma como ORM
- Supabase Postgres como base central
- Tiny como fonte operacional
- Supabase como camada consolidada para estoque, vendas, sugestoes e Pepper IA

## Modulos revisados

### 1. Catalogo e SKU
- Estrutura pai/filha esta correta
- SKU continua como chave logica
- Tiny ID continua como chave operacional
- Camada de catalogo consolidado no Supabase esta adequada

### 2. Estoque
- Webhook de estoque esta na direcao certa
- Reconciliacao manual e fallback existem
- Estoque salvo no catalogo usa apenas availableMultiCompanyStock
- Ainda vale reforcar observabilidade e alertas no admin conforme o uso real

### 3. Fornecedor
- Modulos ativos: Produtos, Dashboard, Sugestao de Produto, Mensagens e Pepper IA
- Navegacao horizontal esta coerente
- Shell do fornecedor agora precisa seguir um unico padrao visual e de dados

### 4. Sugestoes de produto
- Fluxo foi corrigido para fila de cadastro no Supabase
- Nao depende mais de envio direto ao Tiny
- Status de revisao e devolucao para correcao estao corretos
- Outro sistema pode consumir a fila de cadastro

### 5. Solicitacoes de reposicao
- Semantica foi corrigida
- Fornecedor envia para aprovacao, nao cria ordem de compra final
- Admin ja consegue receber e revisar esse fluxo

### 6. Mensagens
- Fluxo principal existe e atende o escopo atual
- Ainda vale seguir observando robustez de anexos e leituras em producao

### 7. Pepper IA
- Escopo por perfil esta correto
- Fornecedor conversa apenas com dados do proprio escopo
- Admin enxerga contexto global
- Pepper IA entrou como assistente consultiva, nao como automacao cega

## Acoplamentos que ainda merecem cuidado
- Alguns textos e labels ainda precisam ser normalizados no projeto inteiro
- Existem helpers que concentram responsabilidades demais e podem ser divididos por dominio
- Algumas paginas ainda dependem de queries diretas em page.tsx, e no futuro vale mover parte disso para services mais claros

## Pendencias prioritarias antes da subida final
1. Revisar visualmente todas as paginas principais autenticadas
2. Padronizar nomenclaturas e textos restantes
3. Fazer uma rodada final de hardening nas paginas sensiveis do admin
4. Revisar o que ainda e legado e pode ser removido
5. So depois abrir novas frentes como adaptacao mobile/app

## Direcao recomendada daqui para frente
- Entrar em modo de consolidacao
- Evitar novas features grandes por agora
- Fechar estabilidade, nomenclatura, UX e observabilidade
- Depois disso, retomar expansoes
