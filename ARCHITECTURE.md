# SubtitleBot — Arquitetura Inicial

## Estrutura macro atual
```txt
SubtitleBot/
  docker-compose.yml
  web/
    prisma/
      schema.prisma
      migrations/
    prisma.config.ts
    .env
    package.json
    src/
```

## Estrutura planejada
```txt
SubtitleBot/
  docker-compose.yml
  web/
    .env
    package.json
    prisma/
      schema.prisma
      seed.ts
      migrations/
    src/
      app/
        dashboard/
          page.tsx
          projects/
            page.tsx
            [projectId]/
              page.tsx
              editor/
                page.tsx
        api/
          projects/
            route.ts
          upload-srt/
            route.ts
          subtitle-files/
            [id]/
              export/
                route.ts
      components/
        ui/
        editor/
          subtitle-editor.tsx
          subtitle-row.tsx
          upload-srt-form.tsx
      lib/
        prisma.ts
        srt/
          time.ts
          parse-srt.ts
          format-srt.ts
      types/
        subtitle.ts
```

## Regras de arquitetura

### Regra 1 — simplicidade primeiro

Tudo deve ser construído do jeito mais simples que funcione bem.

### Regra 2 — sem IA no MVP 1

Qualquer coisa ligada a IA deve ser tratada como fase futura.

### Regra 3 — editor primeiro, inteligência depois

O coração do produto é o fluxo de edição de legenda.

### Regra 4 — sem autenticação complexa agora

Enquanto o fluxo principal não estiver pronto, usar usuário fixo seeded no banco.

### Regra 5 — dados estruturados desde o início

Mesmo sendo simples, o banco deve ser preparado para evolução futura.

### Regra 6 — funções puras para SRT

Parser e formatter devem ficar isolados, testáveis e independentes da UI.

### Regra 7 — o editor deve operar em milissegundos

Internamente, tempos devem ser salvos em `ms`, não como string.

## Modelo de dados do MVP 1

### User
Representa o dono dos projetos.

Campos principais:

* `id`
* `name`
* `email`
* `password`
* `createdAt`
* `updatedAt`

### Project
Representa um projeto de edição de legenda.

Campos principais:

* `id`
* `name`
* `description`
* `status`
* `userId`
* `createdAt`
* `updatedAt`

### SubtitleFile
Representa um arquivo de legenda importado para um projeto.

Campos principais:

* `id`
* `filename`
* `language`
* `sourceType`
* `projectId`
* `createdAt`
* `updatedAt`

### SubtitleCue
Representa cada bloco da legenda.

Campos principais:

* `id`
* `cueIndex`
* `startMs`
* `endMs`
* `text`
* `subtitleFileId`
* `createdAt`
* `updatedAt`

### SubtitleVersion
Representa snapshots/versionamentos exportáveis do conteúdo.

Campos principais:

* `id`
* `versionNumber`
* `label`
* `srtContent`
* `subtitleFileId`
* `createdAt`

## Fluxo funcional do MVP 1

1. usuário entra no dashboard
2. cria um projeto
3. envia um `.srt`
4. backend lê o arquivo
5. parser converte o conteúdo em cues
6. cues são persistidos no banco
7. usuário é levado ao editor
8. usuário edita texto, início e fim
9. usuário salva
10. usuário exporta um novo `.srt`
