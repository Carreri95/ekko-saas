# Bloco Auth — PR 1 (fundação schema + seed)

**Objectivo:** fundação de autenticação no monorepo sem lógica HTTP de login/sessão neste PR.

## O que entrou

- Enum Prisma `Role` (`ADMIN`, `USER`).
- Modelos `User` (incl. `passwordHash`, `role`, `isActive`) e `Session` (`tokenHash`, `expiresAt`, relação com `User`).
- Migration em `apps/api/prisma/migrations/` (comando canónico: `npm run db:migrate` na raiz → `apps/api`).
- Seed: utilizador `demo@subtitlestudio.local` com `role` ADMIN, `isActive` true, `passwordHash` com bcrypt (ver `apps/web/prisma/seed.ts`).
- `packages/shared`: constante/tipo `Role` espelhando o enum Prisma.

## O que não entrou

- Rotas de login/logout, cookies httpOnly, validação de sessão na API.
- Cadastro público, reset de password, convites por email, RBAC fino.

## Validação recomendada (proporcional)

- `npx prisma validate` em `apps/web` e `apps/api`.
- `npm run db:migrate` (ou `db:deploy` em CI) e `npm run db:seed` contra Postgres de teste.
- Smoke: `POST /api/projects` continua a funcionar com utilizador demo resolvido (`demo-user.ts`).

---

## PR 2 — rotas HTTP em `apps/api` (`/api/auth/*`)

**Objectivo:** login por email/senha, sessão em BD (hash do token), cookie httpOnly, logout e `me`.

### Rotas

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Body JSON `{ email, password }` — `Set-Cookie` com token opaco; resposta `{ user }`. |
| `POST` | `/api/auth/logout` | Remove sessão (se cookie válido) e limpa cookie. |
| `GET` | `/api/auth/me` | Lê cookie; resposta `{ user }` ou `401`/`403`. |

### Variáveis de ambiente (API)

| Variável | Default | Função |
|----------|---------|--------|
| `SESSION_COOKIE_NAME` | `sb_session` | Nome do cookie. |
| `SESSION_MAX_AGE_SEC` | `604800` (7d) | `maxAge` do cookie e `expiresAt` da sessão. |
| `COOKIE_SECURE` | `true` se `NODE_ENV=production` | `Secure` no cookie; em dev HTTP local usar `false` ou omitir. |

### Validação sugerida

- `curl` / Thunder Client contra `:4000` com `-c`/`-b` cookies (ver checklist no PR).

---

## PR 3 — BFF + UI login em `apps/web`

**Objectivo:** proxy `/api/auth/*` → `apps/api`, página `/login` e helper de sessão no cliente — **sem** lógica de negócio no Next.

### O que entrou

- `forwardToApi`: reencaminha header `Cookie` para a API e repassa `Set-Cookie` da resposta (sessão no domínio do Next).
- Rotas `app/api/auth/login|logout|me/route.ts` — apenas `forwardToApi` para os mesmos paths em `API_BASE_URL`.
- `app/login/page.tsx` — formulário mínimo; `fetch` a `/api/auth/*` com `credentials: 'include'`; redirect para `/projetos` após login ou se já autenticado (`fetchAuthMe`).
- `src/lib/auth-client.ts` — `fetchAuthMe()` via BFF.

### Validação sugerida (`:3000`)

- Com API a correr em `:4000`: abrir `/login`, login com seed, confirmar redirect para `/projetos` e cookie no browser.
- Recarregar `/login` com sessão — redirect imediato para `/projetos`.

---

## PR 4 — protecção da área privada (`app/(private)`)

**Objectivo:** sem lógica de negócio no web — só UX: quem não tem sessão válida (via BFF `/api/auth/me`) é enviado para `/login`; quem tem sessão vê as páginas da app e o `UserMenu` com dados reais.

### O que entrou

- Grupo de rotas `app/(private)/` com `layout.tsx` + `PrivateAuthProvider` (cliente: `fetchAuthMe` → redirect `/login` se falhar).
- Páginas da app movidas para `(private)` (URLs inalteradas); `app/login` e `app/page.tsx` ficam fora.
- `PageShell` + `useOptionalPrivateAuth` para nome/email no menu; `signOut` no contexto chama BFF `POST /api/auth/logout` e `location.assign("/login")`.
- Imports `@/app/(private)/...` onde necessário; `waveform.css` aponta para o CSS do editor dentro de `(private)`.

### O que não entrou

- ACL por ecrã, middleware Edge complexo, validação de JWT no web.

**Complemento (sessão UX):** `UserMenu` mostra `role`; `signOut` no contexto chama BFF `POST /api/auth/logout` e `location.assign("/login")`; revalidação em `visibilitychange` para sessão expirada.

---

## Fechamento — validação ponta a ponta (documental, PR auth)

**Data de registo:** 2026-03. **Nota:** nesta sessão **não** foi possível executar pedidos HTTP reais a `:4000` / `:3000` (serviços indisponíveis no ambiente de validação). Os resultados abaixo cruzam **revisão estática do código** (`apps/api` rotas auth, `apps/web` `forwardToApi`, BFF, `PrivateAuthProvider`) com o comportamento **esperado**. Recomenda-se repetir os mesmos cenários com `curl`/browser antes de merge em produção.

### Contrato e arquitectura (coerência)

- **Paths canónicos:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (não existe `/auth/*` sem prefixo `/api` na API nem no BFF).
- **Dono da regra:** `apps/api`; **BFF** apenas encaminha com `forwardToApi` — preserva **método**, **corpo**, **`Content-Type`**, **status**, texto de resposta e repassa **`Cookie`** → upstream e **`Set-Cookie`** → browser (`forward-to-api.ts`).
- **Paridade esperada API vs Web (BFF):** para o mesmo pedido, status e JSON de sucesso/erro devem coincidir; divergência só se a API estiver inacessível (**502** `{ error: "Falha ao comunicar com apps/api" }` no Next, não na API).
- **Cookies/sessão em BD:** login cria linha `Session` (`tokenHash`, `expiresAt`); logout remove por `tokenHash`; cookie httpOnly no nome `SESSION_COOKIE_NAME` (default `sb_session`).

### Matriz de cenários (esperado pelo código)

| # | Cenário | API `:4000` (esperado) | Web `:3000` via BFF (esperado) | BD |
|---|---------|------------------------|--------------------------------|-----|
| 1 | Login credenciais válidas | **200** `{ user }`; **Set-Cookie** | Igual + cookie no domínio `:3000` | Nova `Session` |
| 2 | Senha inválida | **401** `{ error: "Credenciais invalidas" }` | Igual | — |
| 3 | Utilizador inexistente | **401** (mesma mensagem; não revela existência) | Igual | — |
| 4 | Utilizador `isActive: false` | **403** `{ error: "Conta desativada" }` | Igual | — |
| 5 | `GET /api/auth/me` com sessão válida | **200** `{ user }` | Igual (com `Cookie` repassado) | — |
| 6 | `GET /api/auth/me` sem sessão | **401** `{ error: "Nao autenticado" }` | Igual | — |
| 7 | Logout com sessão válida | **200** `{ ok: true }`; limpar cookie | Igual | `Session` removida |
| 8 | Rota privada sem autenticação (web) | — | `PrivateAuthProvider`: `fetchAuthMe` → **401** → `replace("/login")` | — |
| 9 | Rota privada autenticada (web) | — | Conteúdo após **200** em `/api/auth/me` | — |
| 10 | Após logout (web) | — | `signOut` → BFF logout → `assign("/login")`; contexto desmontado no reload | Sessão removida se cookie era válido |

### Divergências API vs Web (a verificar em runtime)

- Nenhuma divergência **semântica** prevista quando a API responde: o BFF não altera JSON nem status.
- **Única divergência sistémica:** falha de rede/API down → Next devolve **502** (mensagem acima), a API não é contactada.

### Riscos residuais (honestos)

- Chamadas `fetch` do cliente a rotas de domínio (`/api/projects`, etc.) com **401** não têm interceptor global; utilizador pode ver erro na UI até revalidação (`visibilitychange`) ou nova navegação.
- Cookie `Secure` em dev HTTP: exige `COOKIE_SECURE`/env alinhados (já documentado).
- Validação **HTTP real** não executada neste registo — dívida: smoke manual obrigatório antes de produção.

### Conclusão sobre fechamento do PR

- **Pode ser considerado fechado ao nível de implementação e documentação arquitectural**, com a **ressalva** de que o dono do merge deve **confirmar** os cenários na tabela com API + web + Postgres a correr (e seed), incluindo inspecção de cookie e, se útil, linhas `Session` na BD.
- **Não** foi alterada semântica nem feito refactor neste fechamento — apenas este registo em `bloco-auth-1.md`.
