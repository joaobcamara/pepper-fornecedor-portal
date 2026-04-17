# Checklist Final de Homologacao

## Objetivo

Fechar a reta final do portal com uma regua simples:

- fundacao pronta
- portal lendo Supabase primeiro
- Tiny usado so para webhook, importacao sob demanda e reconciliacao pontual
- fluxos criticos validados antes do deploy

## Fase 1. Ambiente e fundacao

- [x] `node scripts/deploy-doctor.mjs`
- [x] `node scripts/guarded-build.mjs`
- [x] `npm run smoke:foundation`
- [ ] bucket `portal-assets` confirmado
- [x] webhooks Tiny apontando para o Render
- [x] `CatalogProduct`, `CatalogVariant`, `CatalogInventory` e `CatalogTinyMapping` ativos

Critero de aceite:

- sem falha critica no doctor
- build protegido aprovado
- fundacao respondendo primeiro para SKU ja cadastrado

## Fase 2. Admin

- [x] `/admin`
- [x] `/admin/estoque`
- [x] `/admin/produtos`
- [x] importacao sob demanda dentro de `Produtos`
- [x] `/admin/financeiro`
- [x] `/admin/whatsapp`
- [x] `/admin/conversas`
- [x] `/admin/sincronizacoes`
- [x] `/admin/importacao-tiny` redirecionando para `/admin/produtos`

Critero de aceite:

- telas carregam via fundacao
- produto ja cadastrado abre sem consultar Tiny no fluxo normal
- modulo WhatsApp do admin cria, abre, fecha e apaga links

## Fase 3. Fornecedor

- [x] `/produtos`
- [x] `/dashboard`
- [x] `/financeiro`
- [x] `/mensagens`
- [x] `/sugestao-produto`
- [x] `/pedidos-recebidos`

Critero de aceite:

- cards carregam rapido pelo Supabase
- produto vinculado pelo admin aparece para o fornecedor
- pedido, reposicao e sugestao continuam refletindo na fundacao

## Fase 4. Fluxos vivos

- [x] webhook de estoque
- [x] webhook organico de vendas chegando por operacao real em Show Look e On Shop
- [ ] webhook organico de vendas chegando por operacao real na Pepper
- [ ] webhook organico de pedidos enviados chegando por operacao real do deposito
- [x] pedido do admin para fornecedor
- [x] reposicao do fornecedor para admin
- [x] conversas
- [x] sugestao de produto
- [x] HTML baixavel com logo e foto em base64
- [x] link publico do WhatsApp com leitura viva da fundacao
- [ ] arquivos/documentos do Tiny entrando pela trilha fiscal/asset

Critero de aceite:

- `TinyWebhookLog` e `SyncRun` registrando eventos
- estoque multiempresa refletindo na fundacao
- vendas e pedidos enviados das contas ativas chegando sem disparo manual
- `FoundationAsset` e/ou `Invoice` preenchidos quando a trilha documental for ativada
- snapshot x estado atual funcionando no link compartilhado

## Fase 5. QA visual

- [x] Pepper IA mobile sem cobrir menu
- [x] dashboard de estoque legivel no desktop e mobile
- [x] modais de pedido e financeiro com botoes de baixar arquivo
- [x] cards e modais do WhatsApp legiveis no celular
- [ ] estados vazios e mensagens de erro claros

Critero de aceite:

- nenhum botao sobrepondo acao principal
- nenhuma tela critica com visual quebrado

## Fase 6. Comandos finais antes do deploy

- [x] `npx tsc --noEmit`
- [x] `node scripts/guarded-build.mjs`
- [x] `npm run smoke:http`
- [x] `npm run smoke:foundation`
- [x] `npm run smoke:collab`

Critero de aceite:

- tudo verde
- unico warning tolerado hoje: fallback controlado do SKU `01-1195`

## Fase 7. Deploy

- [x] `Manual Deploy -> Deploy latest commit`
- [ ] healthcheck `/login`
- [ ] login admin real
- [ ] login fornecedor real
- [ ] 1 validacao viva de estoque
- [ ] 1 validacao viva de pedido
- [ ] 1 validacao viva de link WhatsApp
- [ ] conferir eventos organicos de `sales` e `orders` apos movimentacao real do deposito

Critero de aceite:

- Render live
- dominio publico respondendo
- fundacao, portal e webhooks operando juntos sem ajuste manual emergencial
