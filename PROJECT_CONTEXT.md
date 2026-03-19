# SubtitleBot — Contexto do Projeto

## Visão geral
O SubtitleBot é um editor online de arquivos `.srt`.

O objetivo do MVP 1 é ser o menor produto funcional possível, sem IA, sem transcrição e sem player de vídeo.

O foco neste momento é permitir que um usuário:

1. crie um projeto
2. envie um arquivo `.srt`
3. visualize os blocos da legenda
4. edite texto e tempo
5. salve no banco
6. exporte um novo `.srt`

## Objetivo real do MVP 1
Chegar neste ponto:

> “Eu subi um SRT, editei blocos e baixei um SRT novo no navegador.”

Quando isso funcionar, o produto já saiu da fase de ideia e entrou na fase de base funcional.

## O que entra no MVP 1
- estrutura web com Next.js
- PostgreSQL rodando localmente com Docker
- Prisma para modelagem e acesso ao banco
- entidades mínimas para projetos e legendas
- parser de `.srt`
- formatter de `.srt`
- dashboard simples
- criação de projeto
- upload de `.srt`
- editor básico de cues
- exportação de `.srt`
- versionamento simples de conteúdo exportado

## O que não entra agora
- Whisper
- OpenAI
- correção automática por IA
- análise semântica
- comparação Buzz vs final
- player de vídeo/áudio
- waveform
- colaboração em tempo real
- billing
- ACL complexa
- multi-tenant complexo

## Stack
### Frontend + backend web
- Next.js
- TypeScript
- App Router

### UI
- Tailwind CSS
- shadcn/ui

### Banco
- PostgreSQL

### ORM
- Prisma

### Ambiente local
- Docker Desktop

### Auth
- adiado temporariamente
- no começo, usar usuário fake de seed para acelerar o desenvolvimento

## Estado atual do projeto
### Já existe
- projeto Next.js criado dentro de `web/`
- PostgreSQL rodando por Docker Compose
- Prisma configurado
- schema inicial criado
- migration aplicada
- Prisma Studio funcionando

## Marco imediato
O próximo grande marco do projeto é:
> subir um arquivo `.srt`, parsear, salvar no banco, editar e exportar de volta.
