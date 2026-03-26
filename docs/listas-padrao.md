# Padrão de Listas no Produto

Este documento define uma convenção de evolução para listas do SubtitleStudio/SubtitleBot.
Objetivo: manter implementações pequenas no início, sem perder previsibilidade quando o volume crescer.

## Escopo

- Válido para listas em `apps/web` que consomem `apps/api`.
- Não substitui regras de arquitetura do `docs/ENGINEERING-RULES.md`.
- Não descreve detalhes de calendário visual; cobre apenas padrão de listagem.

## Fase 1 — Volume baixo / Escopo local

Quando usar:

- Lista limitada a contexto de projeto (ex.: sessões de um projeto).
- Volume esperado baixo ou médio.
- PR focado em entregar fluxo funcional rápido e seguro.

Como implementar:

- Carregar os dados da lista via endpoint existente.
- Ordenar, filtrar e agrupar no frontend.
- Paginação leve local (fatias ou botão "Carregar mais"), se necessário.
- Evitar complexidade prematura em API.

## Fase 2 — Volume crescente

Quando migrar:

- Perda de fluidez no cliente.
- Lista ficando grande para carregar de uma vez.
- Necessidade de reduzir payload inicial.

Como evoluir:

- Introduzir paginação no backend (ou carregamento incremental).
- Frontend deixa de assumir "lista completa".
- Manter compatibilidade de contrato sempre que possível.

## Fase 3 — Volume alto / Filtros críticos

Quando migrar:

- Filtros/sorts passam a ser parte crítica da operação.
- Listas globais (multi-projeto) ou com alto volume.
- Necessidade de consistência forte entre usuário e servidor.

Como evoluir:

- Mover filtros principais para API.
- Padronizar query params de listagem (ex.: `page`, `pageSize`, `status`, `from`, `to`).
- Frontend atua como consumidor de lista paginada/filtrada.

## Critérios de decisão

- Listas pequenas ou por projeto podem começar localmente.
- Listas globais ou volumosas devem migrar para paginação/filtro na API.
- Não antecipar complexidade sem necessidade real.
- Preferir consistência entre módulos quando um padrão provar valor.

## Diretriz de UX mínima em listas

- Separar loading por ação:
  - carregamento da lista
  - salvamento (create/edit)
  - remoção
- Exibir estado vazio claro.
- Exibir feedback curto de erro/sucesso.
- Evitar bloquear toda a tela por uma única ação de item.

## Nota de localização desta documentação

Este padrão fica em `docs/listas-padrao.md` porque é uma convenção funcional de produto/frontend.
`docs/monorepo-operacao.md` permanece focado em operação de monorepo, infra e rotinas de execução.
