# Fases de Reconstrucao para Fechamento e Deploy

## Fase 1. Estabilizacao de ambiente
- Rodar `node scripts/deploy-doctor.mjs`
- Corrigir placeholders e ausencias no ambiente local/Render
- Confirmar bucket `portal-assets`, secrets e tokens Tiny
- Limpar processos presos de build antes de nova validacao

## Fase 2. Restauracao funcional
- Consolidar cards com foto em pedidos, financeiro, produtos, reposicao e sugestoes
- Confirmar modais com grade `cor x tamanho`
- Validar fluxo de pedido direto em `Produtos`
- Validar `Pepper AI` para sugestao de compra nos pontos operacionais

## Fase 3. Validacao da fundacao
- Criar pedido pelo admin e verificar:
  - gravacao na fundacao
  - leitura no modulo do fornecedor
- Enviar pedido ao financeiro pelo fornecedor e verificar:
  - gravacao na fundacao
  - visibilidade no financeiro admin
- Aprovar ou revisar sugestoes e validar persistencia do onboarding

## Fase 4. QA controlado
- Rodar `node scripts/guarded-build.mjs`
- Testar login admin e fornecedor
- Testar:
  - Produtos
  - Pedidos ao fornecedor
  - Pedidos recebidos
  - Financeiro admin e fornecedor
  - Sugestoes de produto
  - Fornecedores
- Validar upload de logo, romaneio, nota fiscal e comprovante

## Fase 5. Previa final
- Subir uma previa limpa
- Testar roteiro operacional ponta a ponta
- Validar feedback visual, cards, modais e Pepper IA contextual

## Fase 6. Deploy
- Confirmar `doctor` sem falhas criticas
- Confirmar `build:guarded` aprovado
- Aplicar checklist do Render
- Publicar e validar dominio

## Comandos recomendados
```bash
node scripts/deploy-doctor.mjs
node scripts/guarded-build.mjs
```

Ou via `npm`:

```bash
npm run doctor:deploy
npm run build:guarded
```
