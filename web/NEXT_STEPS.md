# SubtitleBot — Próximos Passos

## Fase 1 — base técnica
- [x] Next.js
- [x] Docker
- [x] PostgreSQL
- [x] Prisma
- [x] migration inicial

## Fase 2 — núcleo de legenda
- [ ] utilitários de tempo
- [ ] parser de SRT
- [ ] formatter de SRT
- [ ] tipagem base de cues

## Fase 3 — fluxo mínimo do produto
- [ ] seed do usuário fake
- [ ] criação de projeto
- [ ] upload de `.srt`
- [ ] persistência dos cues

## Fase 4 — editor
- [ ] listagem dos blocos
- [ ] edição de texto
- [ ] edição de início/fim
- [ ] salvar alterações

## Fase 5 — exportação
- [ ] gerar `.srt`
- [ ] baixar arquivo
- [ ] salvar versão simples

## Ordem recomendada agora

1. criar `src/types/subtitle.ts`
2. criar `src/lib/srt/time.ts`
3. criar `src/lib/srt/parse-srt.ts`
4. criar `src/lib/srt/format-srt.ts`
5. criar `src/lib/prisma.ts`
6. criar `prisma/seed.ts`
7. rodar seed do usuário fake
8. criar tela de teste para colar um `.srt` e visualizar os cues parseados
9. criar rota de upload real
10. criar editor e exportação

## Meta imediata
Chegar neste ponto:

> subir um arquivo `.srt`, parsear, salvar no banco, editar e exportar de volta.
