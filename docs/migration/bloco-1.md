# Bloco 1 - espinha dorsal monorepo

Objetivo:
- Criar a estrutura base de monorepo.
- Mover a aplicacao atual para `apps/web`.
- Manter comportamento funcional do produto.

Escopo executado:
- Pastas `apps/api` e `apps/worker` criadas como placeholders.
- `packages/shared` criado como pacote placeholder.
- `infra/docker/docker-compose.dev.yml` criado (equivalente ao legado).
- Scripts da raiz ajustados para `apps/web`.

Fora de escopo (mantido para proximos blocos):
- Extrair `app/api/*` de `apps/web` para `apps/api`.
- Extrair `src/server/*` para `apps/worker`.
- Introduzir MinIO/MediaAsset.
- Refatorar dominios de produto.
