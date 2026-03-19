# SubtitleBot — Regras para o Cursor

## O Cursor deve entender que

1. este projeto está em fase inicial
2. o objetivo agora é estabilidade e simplicidade
3. não deve introduzir arquitetura exagerada
4. não deve adicionar IA, filas, workers ou microserviços neste momento
5. deve priorizar código claro, pequeno e funcional
6. deve respeitar a separação entre parser, formatter, persistência e UI
7. deve assumir que o usuário fake seeded será usado antes da auth real

## O Cursor não deve fazer agora

- adicionar serviços desnecessários
- criar abstrações prematuras
- inventar multi-tenant
- adicionar Redis sem necessidade
- adicionar fila de jobs agora
- tentar embutir Whisper no MVP 1
- tentar resolver futuros problemas antes da hora

## O Cursor deve priorizar agora

- rotas simples
- componentes pequenos
- persistência correta
- boa estrutura de arquivos
- facilidade de manutenção
- validações mínimas mas sólidas
- código legível

## Regras de implementação

- usar TypeScript em tudo
- evitar complexidade prematura
- isolar lógica de domínio em `lib/`
- manter UI separada da lógica de parsing
- tempos sempre em milissegundos no banco
- exportação `.srt` como string gerada a partir dos cues
- auth real só depois do fluxo principal funcionar

## Prompt base para o Cursor
```txt
Este projeto é o MVP 1 de um editor online de arquivos SRT.

Stack:

- Next.js
- TypeScript
- Tailwind
- Prisma
- PostgreSQL
- Docker

Objetivo atual:
permitir criar projeto, enviar arquivo .srt, parsear em cues, salvar no banco, editar texto e tempos e exportar um novo .srt.

Neste momento, NAO implementar:

- IA
- Whisper
- player de video/audio
- billing
- multiusuario complexo
- arquitetura complexa

Prioridades:

- simplicidade
- clareza
- codigo pequeno e funcional
- boa separacao entre parser, formatter, UI e persistencia
- tempos em milissegundos
- usar usuario fake seeded antes da auth real
```
