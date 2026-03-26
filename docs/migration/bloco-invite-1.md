# Bloco Invite — PR 1 (modelo `Invite` + migration)

**Objectivo:** fundação de dados para convites por email (ADMIN → futuro USER), sem envio de email, UI ou aceite.

## O que entrou

- Modelo Prisma `Invite` em `apps/api` e `apps/web` (schema alinhado).
- Campos: `email`, `role` (enum existente; default `USER`), `tokenHash`, `invitedByUserId` → `User`, `expiresAt`, `acceptedAt`, `revokedAt`, `createdAt`, `updatedAt`.
- Migration em `apps/api/prisma/migrations/` (comando canónico: `npm run db:migrate` na raiz → `apps/api`).
- Índice único parcial PostgreSQL: no máximo um convite **ativo** por `LOWER(email)` (aceite ou revogado libera o email para novo convite).

## O que não entrou

- Envio de email, aceite, criação de `User` a partir do convite, UI admin.

---

## PR 2 — rotas HTTP admin (`/api/admin/invites`)

**Objectivo:** CRUD mínimo de convites na API; só sessão **ADMIN**; sem web/worker.

### Rotas (`apps/api`)

| Método | Path | Função |
|--------|------|--------|
| `POST` | `/api/admin/invites` | Body `{ email }` — cria convite `role` **USER**, `tokenHash` na BD, token puro só na resposta em `inviteUrl` (uma vez). |
| `GET` | `/api/admin/invites` | Lista convites com `status` derivado: `pending` / `accepted` / `expired` / `revoked`. |
| `POST` | `/api/admin/invites/:id/revoke` | Revoga pendente; não altera convite já aceite. |

### Autorização

- Cookie de sessão (mesmo mecanismo que `/api/auth/me`); `resolveSessionUser` em `AuthService`.
- `401` / `403` se não autenticado, inactivo ou não `ADMIN`.

### Política de duplicados

- Email normalizado (`trim` + minúsculas).
- Se já existir **User** com esse email → **409**.
- Convites **expirados** ainda pendentes (`acceptedAt`/`revokedAt` nulos) são marcados com `revokedAt` antes do create, para libertar o índice único parcial.
- Se após isso ainda existir convite **pendente válido** (não expirado) → **409** (bloquear; não substituir automaticamente).

### Variáveis

- `PUBLIC_WEB_ORIGIN` (default `http://localhost:3000`) — base do `inviteUrl`.
- `INVITE_TTL_SEC` (default 7 dias em segundos).

### Validação mínima

- `npm run build` em `apps/api`.
- Com sessão ADMIN: `POST` / `GET` / `revoke`; com USER ou sem cookie → **403**/**401**.

## Validação mínima (PR 1)

- `npx prisma validate` em `apps/web` e `npm run db:validate` em `apps/api`.
- `npm run db:migrate` (ou `db:deploy`) contra Postgres de teste.
- Opcional: inspeccionar `Invite` no Prisma Studio após `INSERT` manual (respeitando o índice único).

## Ressalvas

- O schema Prisma permite `role` em convites; as rotas fixam **USER** na criação.
- A página pública de aceite vive em `apps/web` em `/invite/accept` (BFF `GET/POST /api/invites/*`); a regra de negócio continua em `apps/api`.

---

## Validação E2E — fechamento de fase (convites)

**Data de registo:** 2026-03-25. **Âmbito:** validação ponta a ponta da fase de convites (admin, resolve/aceite, email assíncrono), **sem alterar código** — registo factual do que foi possível verificar neste ambiente e contratos esperados para reexecução.

### O que foi testado neste ambiente (execução real)

| Verificação | Resultado |
|-------------|-----------|
| `GET http://127.0.0.1:4000/health` (API directa) | **200** — API a responder. |
| `POST /api/auth/login` (credenciais seed `demo@subtitlestudio.local` / `dev-fake-password`) | **500** (`P2022`) — base de dados **desalinhada** do schema Prisma actual (“column does not exist”). Impediu obter cookie de sessão e correr o resto dos cenários com BD real. |
| `http://127.0.0.1:3000` (web / BFF) | **Não acessível** no momento do teste (ligação falhou / processo não em execução). |

**Conclusão:** não foi possível **concluir** os 12 cenários mínimos com pedidos HTTP reais contra API+BD+web nesta máquina. A validação abaixo combina o que correu com **revisão de contrato** (código + BFF) para paridade `:4000` / `:3000`.

### Cenários mínimos — comportamento esperado (contrato) e notas

| # | Cenário | API directa (`:4000`) | Web via BFF (`:3000`) | BD / worker |
|---|---------|------------------------|-------------------------|-------------|
| 1 | Admin autenticado cria convite | `POST /api/admin/invites` com cookie ADMIN → **201**, corpo `{ invite, inviteUrl }`. | `POST /api/admin/invites` (Next) → mesmo **status** e corpo; `Set-Cookie` repassado se aplicável. | `Invite` + `InviteEmailDispatch` **PENDING** (transacção). |
| 2 | Utilizador não admin (ou sem sessão) cria convite | **401** (não autenticado) ou **403** (não ADMIN). | Idem (forward JSON). | Sem alteração de convite. |
| 3 | Listagem para admin | `GET /api/admin/invites` → **200**, `{ invites: [...] }` com `status` e `emailDelivery` quando existir fila de email. | Idem. | Leitura apenas. |
| 4 | Revogar pendente | `POST /api/admin/invites/:id/revoke` → **200** `{ ok: true }` ou erros documentados. | Idem. | `revokedAt` preenchido. |
| 5 | Resolve token válido (pendente) | `GET /api/invites/resolve?token=` → **200**, `{ status: "pending", email, role, expiresAt }`. | `GET /api/invites/resolve?...` idem (`forwardToApi` preserva query). | — |
| 6 | Resolve token inválido | **404** `{ error: "..." }`. | Idem. | — |
| 7 | Resolve expirado (não aceite) | **200** com `status: "expired"` (mensagem de negócio na API). | Idem. | — |
| 8 | Aceite válido cria `User` | `POST /api/invites/accept` → **201** `{ user }`; **Set-Cookie** de sessão. | Idem + cookie no browser. | `User` novo; convite `acceptedAt`; dispatch email irrelevante para aceite. |
| 9 | Reutilizar convite já aceite | `POST /accept` → **400** convite já utilizado / inválido. | Idem. | Sem segundo utilizador. |
| 10 | Convite revogado não aceite | `POST /accept` → **400** (estado inválido). | Idem. | — |
| 11 | Despacho de email (Resend) | Não envia email na API; fila na BD. | — | Worker: `InviteEmailDispatch` **PENDING** → **SENT**/**FAILED**; `inviteUrl` limpo após **SENT**. Requer `RESEND_API_KEY` + worker a correr. |
| 12 | Paridade :4000 / :3000 | Referência. | `forward-to-api.ts`: mesmo **HTTP status**, **corpo** texto JSON, **Set-Cookie** upstream → resposta Next. | `API_BASE_URL` deve apontar para a API real (default `http://localhost:4000`). |

### Paridade API vs web (BFF)

- **Sem divergência intencional:** as rotas Next `app/api/admin/invites/**` e `app/api/invites/**` apenas reencaminham para os mesmos paths em `apps/api`, com **Cookie** do browser para rotas autenticadas.
- **Única fonte de discrepância operacional:** `API_BASE_URL` incorrecto ou API inacessível a partir do processo Next → **502** “Falha ao comunicar com apps/api” (comportamento do BFF, não do domínio de convites).

### Riscos residuais (honestos)

- Migrações não aplicadas ou BD partilhada desactualizada → erros Prisma (**P2022**, etc.) em **qualquer** camada.
- Worker parado → emails ficam **PENDING** ou **FAILED** (sem chave Resend).
- Registos `InviteEmailDispatch` em **PROCESSING** se o worker morrer a meio — recuperação manual ou futura ferramenta (fora desta fase).
- Resend sandbox / domínio: restrições do provider não são bugs da app.

### Conclusão sobre fechamento da fase

- **Contrato público** (rotas, códigos HTTP, campos de resposta, ausência de `tokenHash` nas APIs públicas) permanece **coerente** com o código revisto.
- **Fecho formal da fase** para merge/release: recomenda-se **reexecutar** os cenários 1–12 num ambiente com **Postgres migrado**, **seed** aplicável, **API + web + worker** a correr, e **RESEND** configurado se se quiser validar o ponto 11.
- Neste ambiente de validação, o **PR de documentação / fecho** pode ser considerado **fechado** no que toca a **registar** estado e checklist; o **fecho de produto** da fase convites fica **condicionado** a uma passagem E2E bem-sucedida noutro ambiente.

### Checklist rápido para revalidação manual

1. `npm run db:migrate` (ou equivalente) + seed se necessário.  
2. Subir `dev:api`, `dev:web`, `dev:worker`.  
3. Login ADMIN no web ou cookie via `POST /api/auth/login` na API.  
4. Percorrer tabela de cenários acima e confirmar status + JSON.  
5. Inspeccionar `Invite`, `InviteEmailDispatch`, `User` no Prisma Studio ou SQL.  
6. Com worker + `RESEND_API_KEY`: confirmar log `invite_email_sent` ou estado **SENT** na listagem admin.
