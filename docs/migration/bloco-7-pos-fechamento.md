# Pós-Bloco 7 — balanço operacional (sem execução)

**Seguinte fase:** **`bloco-8.md`** — Bloco 8 (higiene: forward unificado, remoção segura de mortos, documentação operacional).

**Estado de referência:** Bloco 7 fechado até **PR 7.4**; eixo HTTP principal do editor com **dono = `apps/api`**; Next como BFF/proxy.

Este documento regista **o que ainda existe** em `apps/web/app/api` (forward vs lógica local), **buracos reais vs dívida**, e **próximos passos** — alinhado ao inventário por grep no repositório (análise estática, sem comandos de validação em runtime).

---

## 1. Rotas / domínios em `apps/web/app/api/*` que não estão “só” em forward

Em termos de **negócio / Prisma:** nenhuma `route.ts` sob `app/api` continua a ser **dono** de lógica de domínio com Prisma — o eixo fechado no Bloco 7 está em **proxy** para `apps/api`.

**Actualização (PR 8.1):** o forward duplicado `API_BASE_URL` + `fetch` nessas rotas foi **unificado** em `forward-to-api.ts` — ver **`bloco-8.md`**.

**Resumo:** não há “rota HTTP ainda migrar” no sentido Bloco 7; o padrão de encaminhamento está **centralizado** no helper.

---

## 2. Buracos reais de lógica / Prisma ainda no Next

**Nas rotas HTTP (`app/api/**/route.ts`):** nenhum buraco de produto com Prisma no inventário estático — **0** `route.ts` com `prisma` nos greps usados para este balanço.

**Fora das rotas** — **actualização PR 8.2:** os candidatos abaixo foram **removidos** (órfãos confirmados por grep); ver **`bloco-8.md`**.

| Situação (histórico) | Estado |
|----------------------|--------|
| `sync-status`, `serialize.ts`, `prisma-unique.ts` sob `app/api` | **Removidos** |
| `src/server/transcription/*` | **Pasta removida** (lógica viva em `apps/api` / `apps/worker`) |
| `demo-user.ts`, `subtitle-file-queries.ts` | **Removidos** |
| `prisma/seed.ts` | **Mantido** (ferramenta) |

**Conclusão:** no `apps/web` resta Prisma sobretudo para **seed** e **cliente gerado**; não há segunda narrativa de transcrição em processo no Next.

---

## 3. Resíduos menores / dívida técnica

- ~~**Dois estilos de proxy**~~ — resolvido no **PR 8.1** (`bloco-8.md`).
- ~~**Helpers órfãos** / `transcription/` no web~~ — limpos no **PR 8.2**.
- **Manter Prisma no `apps/web`** ainda faz sentido para **seed**, **testes**, eventual **RSC** — não é “erro”, é dependência de **tooling**.

---

## 4. Ainda há um “bloco grande” ou só acabamentos?

- **Migração HTTP do editor (Bloco 7):** **fechada** no sentido **dono = `apps/api`**.
- **Não** há outro bloco do **mesmo tamanho** só de “rotas HTTP em Prisma no Next” — isso **acabou**.
- O que resta é **Bloco 8** (higiene BFF: um só padrão de forward, documentação `API_BASE_URL`, remoção de mortos) e **Bloco 9** (storage/MinIO, etc.) **se** for prioridade de produto — **não** é obrigatório para dizer “reorganização HTTP principal concluída”.

---

## 5. Estimativa realista de PRs

| Objetivo | PRs (ordem de grandeza) |
|----------|-------------------------|
| Considerar a reorganização principal (HTTP editor + BFF) **“concluída”** | **0–1:** opcional PR de **documentação** + checklist; ou **nada** se o critério for só o fecho do Bloco 7. |
| “Projeto **bem redondo**” (BFF limpo, mortos fora, docs, smoke) | **~2–4:** (1) consolidar forwards / apagar órfãos confirmados, (2) documentação `API_BASE_URL` + convenções, (3) opcional testes e2e smoke, (4) pequenos ajustes de DX. |
| Incluir **storage de produção / MinIO** (Bloco 9) | **vários PRs** (não é “acabamento”; é **novo** eixo). |

**Números honestos:** para fechar a narrativa “monorepo HTTP saudável” **sem** MinIO, **2–3 PRs** costuma ser realista; **+1–2** se quiseres **testes automatizados** fortes.

---

## 6. Roadmap curto (próximos passos finais)

1. **Auditoria rápida de imports** — confirmar que `sync-status`, `transcription-services`, `demo-user`, `subtitle-file-queries` são **mortos**; depois **PR único** de remoção ou arquivo em `docs/adr`.
2. **Unificar proxy** — migrar rotas `fetch(API_BASE_URL)` para `forwardToApi` (ou wrapper único), **sem** mudar contratos.
3. **Documentar** — `API_BASE_URL`, ambientes, e “Next = BFF apenas”.
4. **(Opcional)** smoke automatizado mínimo nos fluxos críticos (bulk, export, project create).
5. **Bloco 9** só quando houver **decisão de produto** em storage.

---

## Síntese

Depois do **PR 7.4**, **não falta** um “último monstro” de migração HTTP no Next; falta sobretudo **higiene**, **remoção de mortos** e **consistência do BFF** — trabalho de **acabamento**, não de **segundo pilar** igual ao Bloco 7.
