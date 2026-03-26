# Bloco — Gestão admin de utilizadores (validação de fechamento)

> **Estado (arquivo histórico):** a UI `/admin/usuarios` e `/admin/usuarios/[id]`, o BFF `apps/web/app/api/admin/users/*` e os endpoints `GET`/`GET`/`PATCH` `/api/admin/users` no `apps/api` foram **removidos**. A administração de acessos concentra-se em **`/admin/convites`** e nas rotas `POST`/`GET` `/api/admin/invites`. O texto abaixo descreve o fecho documental da implementação anterior.

**Objectivo:** fechar documentalmente a feature já implementada (listagem, edição, integração de convites na página de utilizadores), sem ampliar escopo.

**Referência de código (removida):**

- API: `apps/api/src/modules/admin-users/` (rotas, serviço, schemas)
- BFF: `apps/web/app/api/admin/users/route.ts`, `apps/web/app/api/admin/users/[id]/route.ts`
- UI: `apps/web/app/(private)/admin/usuarios/page.tsx`, `apps/web/app/(private)/admin/usuarios/[id]/page.tsx`
- Convites (reutilizado): `POST`/`GET` `/api/admin/invites` — sem alteração de contrato neste fecho

**Estados (§18.3 do `ENGINEERING-RULES.md`):**

| Estado | Significado |
|--------|-------------|
| **IMPLEMENTADO** | Comportamento presente no código |
| **VALIDADO EM EXECUÇÃO** | Testado com serviços/HTTP reais neste ambiente |
| **VALIDADO POR INSPEÇÃO** | Confirmado por leitura de código/contrato |
| **NÃO VALIDADO** | Não executado nem provado aqui |

---

## 1. Contrato API (`apps/api`) — payloads seguros

| Verificação | Estado | Notas |
|-------------|--------|--------|
| `GET /api/admin/users` devolve apenas `id`, `name`, `email`, `role`, `isActive`, `createdAt` (ISO) | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `select` em `AdminUsersService.listUsers` — sem `passwordHash` |
| `GET /api/admin/users/:id` devolve `user` com os anteriores + `updatedAt` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `getById` com `select` explícito |
| `PATCH /api/admin/users/:id` responde `{ user: … }` com o mesmo subconjunto seguro | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `update` com `select` explícito |
| Nenhum payload expõe `passwordHash`, `tokenHash` ou campos de sessão | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | Modelo `User` contém segredos; rotas admin não os incluem no `select` |

---

## 2. Acesso ADMIN vs não autenticado / USER

| Cenário | Estado | Evidência |
|---------|--------|-----------|
| Sem cookie de sessão: `GET /api/admin/users` → **401** | VALIDADO EM EXECUÇÃO | `curl`/PowerShell contra `:4000` sem `Cookie` → `401` (`ensureAdmin` → `Nao autenticado`) |
| Conta inactiva: 403 com mensagem coerente | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `ensureAdmin` em `routes.ts` |
| Papel não ADMIN: **403** `Acesso negado` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `session.user.role !== "ADMIN"` |
| USER autenticado a chamar API admin | NÃO VALIDADO EM EXECUÇÃO | Exige cookie de sessão de utilizador `USER` (credenciais de teste não exercitadas neste fecho) |
| UI: páginas `/admin/usuarios` e `/admin/usuarios/[id]` mostram “Acesso negado” se `role !== "ADMIN"` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `usePrivateAuth()` nas páginas |
| Sidebar: entradas admin só se `role === "ADMIN"` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `sidebar-nav.tsx` (`showAdminInvites`) |

---

## 3. BFF (`apps/web` → `forwardToApi`)

| Rota BFF | Proxy para API | Estado |
|----------|----------------|--------|
| `GET /api/admin/users` | idem | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `forwardToApi` sem lógica extra |
| `GET`/`PATCH /api/admin/users/[id]` | `/api/admin/users/:id` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | `route.ts` dinâmico |
| Convite na página de utilizadores: `POST` `/api/admin/invites` | rota já existente | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | Sem novo BFF |

**Divergência API vs web:** nenhuma identificada nos paths públicos; o BFF repete o mesmo path que a API.

---

## 4. Cenários de negócio (edição)

| Cenário | Estado | Notas |
|---------|--------|--------|
| ADMIN lista utilizadores | IMPLEMENTADO; fluxo E2E browser | NÃO VALIDADO EM EXECUÇÃO neste fecho |
| ADMIN abre detalhe (`GET` por id) | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | 404 se id inválido |
| ADMIN altera nome | IMPLEMENTADO | BD: `User.name` actualizado — **NÃO VALIDADO EM EXECUÇÃO** (sem prova em BD) |
| Email duplicado (outro utilizador) | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | Serviço: `email_in_use` → rota **409** com mensagem fixa |
| Prisma `P2002` (unicidade) | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | Mapeado para mesmo erro |
| ADMIN tenta `isActive: false` sobre si | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | **400** `Não pode desativar a sua própria conta`; UI desactiva checkbox para self |
| Único ADMIN tenta `role: USER` sobre si | IMPLEMENTADO + VALIDADO POR INSPEÇÃO | **400** `Tem de existir pelo menos um administrador ativo` |

---

## 5. Integração de convite na página de utilizadores

| Verificação | Estado |
|-------------|--------|
| Modal “Convidar utilizador” → `POST /api/admin/invites` com `{ email }` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO |
| Sucesso: refresco de lista de utilizadores + `GET /api/admin/invites` para secção “Convites pendentes” | IMPLEMENTADO + VALIDADO POR INSPEÇÃO |
| Link “Gerir convites” → `/admin/convites` | IMPLEMENTADO + VALIDADO POR INSPEÇÃO |
| Feedback erro/sucesso (incl. `inviteUrl` + copiar) | IMPLEMENTADO + VALIDADO POR INSPEÇÃO |
| Fluxo completo convite + email em produção | NÃO VALIDADO | Depende de worker/outbox (fora deste fecho) |

---

## 6. Efeitos em base de dados

| Operação | Efeito esperado | Estado |
|----------|-----------------|--------|
| `PATCH` nome/email/role/isActive | `UPDATE` em `User` | IMPLEMENTADO no código |
| Verificação em BD após PATCH | — | **NÃO VALIDADO** (sem `psql`/Studio neste fecho) |
| `POST` convite | `INSERT` em `Invite` (rotas existentes) | IMPLEMENTADO nas rotas de convites; **NÃO revalidado** aqui |

---

## 7. O que foi testado em execução (lista)

| Teste | Resultado |
|-------|-----------|
| `GET http://127.0.0.1:4000/api/admin/users` sem `Cookie` | **401** (esperado) |

---

## 8. Riscos residuais (honestos)

- **Cobertura de testes automatizados:** não há suite dedicada a estes endpoints; regressões dependem de QA manual ou futuros testes.
- **USER autenticado na API:** comportamento 403 assumido por simetria com `ensureAdmin`; não foi reproduzido com cookie real neste fecho.
- **Race em email único:** duas actualizações simultâneas podem colidir; `P2002` cobre persistência.
- **Último ADMIN:** protecção explícita só para **auto**-desactivação e **auto**-rebaixamento quando não há outro ADMIN; outro admin pode ainda alterar o único ADMIN restante (risco de produto conhecido, fora deste fecho).

---

## 9. Conclusão sobre fechamento documental

- A feature está **implementada** e **alinhada** com a arquitectura (API dona do negócio, BFF transparente, UI sem Prisma).
- A validação **em execução** neste fecho limitou-se a **acesso anónimo à API** (`401`).
- O restante é **validado por inspecção de código** ou marcado como **não validado**, conforme tabelas acima.
- **Não** se declara “pronto para produção” nem “E2E validado” ao abrigo do §18.3.

**Data / contexto:** fecho documental gerado no repositório; repetir validação manual ou automatizada após deploy ou alterações em auth/admin.
