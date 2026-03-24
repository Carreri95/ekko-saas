ENGINEERING RULES — SUBTITLEBOT / SUBTITLE STUDIO
Finalidade

Este documento define as regras permanentes de implementação do projeto.

Ele existe para evitar:

mistura de responsabilidades entre web, api e worker
regressões silenciosas de contrato
duplicação de lógica
refactors perigosos durante migrações
drift arquitetural
decisões inconsistentes entre PRs

Estas regras devem ser tratadas como padrão oficial para novas implementações.

1. ARQUITETURA OFICIAL

A arquitetura oficial do projeto é:

apps/web → interface + BFF/proxy
apps/api → backend HTTP real / dono da lógica de negócio
apps/worker → execução assíncrona / jobs / processamento pesado
packages/shared → contratos, tipos e utilidades realmente compartilhadas
infra → docker, envs e infra local
docs → documentação operacional, migração e arquitetura
Regra principal

Toda nova implementação deve respeitar essa divisão.

2. REGRA DE RESPONSABILIDADE POR CAMADA
   2.1 apps/web

Use apps/web para:

páginas
layouts
componentes de UI
lógica de interface
chamadas do browser para /api/...
rotas BFF/proxy que encaminham para apps/api
Proibido em apps/web

Não colocar no apps/web:

regra de negócio nova importante
lógica principal de Prisma de produto
persistência principal do editor
pipeline pesado
execução de transcrição
regras duplicadas que já existem em apps/api
Regra curta

Se é UI ou transporte, provavelmente é apps/web.

2.2 apps/api

Use apps/api para:

rotas HTTP de negócio
validação de input
regras de negócio
Prisma
leitura/escrita de dados
exports
integração com storage
operações de batch/jobs expostas por HTTP
Regra curta

Se é regra HTTP/de negócio, provavelmente é apps/api.

2.3 apps/worker

Use apps/worker para:

polling de jobs
claim de jobs
transcrição
processamento pesado
retries técnicos
atualização de status de execução
pipeline assíncrono
Proibido em apps/worker

Não colocar no worker:

UI
rota HTTP pública
comportamento de BFF
lógica de página
regra de transporte do browser
Regra curta

Se é assíncrono, pesado ou orientado a job, provavelmente é apps/worker.

2.4 packages/shared

Use packages/shared apenas para:

tipos
enums
contratos estáveis
DTOs
utilidades realmente compartilhadas
Proibido em packages/shared

Não colocar:

Prisma
regra de negócio específica
código fortemente acoplado a web, api ou worker
abstrações “talvez úteis no futuro” 3. REGRA DE NOVAS ROTAS
3.1 Regra geral

Se uma rota é de negócio, ela deve nascer em apps/api.

O apps/web só deve espelhar essa rota quando necessário como BFF.

3.2 Regra do apps/web/app/api

Handlers em apps/web/app/api/\*\*/route.ts não devem ser donos da lógica.

Eles devem, preferencialmente:

validar params mínimos
encaminhar para apps/api
preservar contrato, headers e corpo
3.3 Helpers de forward

Escolher o helper pelo tipo real do payload:

forwardToApi → JSON / texto
forwardBinaryToApi → binário / download
forwardMultipartToApi → multipart/form-data
Proibido
usar .text() para ZIP/binário
usar helper JSON para multipart
ignorar Content-Type / boundary
inventar fetch manual duplicado quando já existe helper adequado 4. REGRA DE CONTRATO PÚBLICO
4.1 Ao migrar uma rota, preservar

Sempre que possível, preservar:

path
método HTTP
status codes
shape do JSON
mensagens de erro relevantes
headers importantes
semântica observável
4.2 Mudança de contrato

Só pode acontecer se for:

intencional
explícita
documentada
validada
4.3 Objetivo padrão de migração

O padrão é:

mesmo comportamento observável, novo dono interno

5. REGRA DE IMPLEMENTAÇÃO
   5.1 Primeiro portar, depois melhorar

Em migração:

primeiro lift-and-shift
depois refactor em outro PR
Proibido
migrar e refatorar ao mesmo tempo
migrar e “aproveitar para melhorar tudo”
mudar semântica junto com mudança de camada
5.2 Um PR = um slice claro

Cada PR deve ter:

objetivo único
escopo explícito
itens fora de escopo
critério de pronto
validação proporcional ao risco
5.3 Se for arriscado, quebrar

Quebrar em slices menores se tocar em:

binário
multipart
jobs
worker
transações pesadas
bulk save do editor
storage
exports 6. REGRA DE PRISMA
6.1 Dono oficial

O Prisma de negócio deve viver em apps/api.

6.2 No apps/web

Não criar nova lógica de produto com Prisma no apps/web, salvo tooling/documentação/seed muito claramente justificados.

6.3 Em transações

Se o legado usa transação, manter transação até decisão explícita em contrário.

6.4 Semântica não muda por acidente

Não mudar sem justificativa:

ordem de delete/create/update
semântica de updatedCount
semântica de lista vazia
reindexação
mensagens de erro
criação de versionamento 7. REGRA DE STORAGE E ARQUIVOS
7.1 Arquivo não é detalhe

Upload, delete, mídia, ZIP, export e MinIO sempre exigem cuidado especial.

7.2 Tipos de payload

Separar sempre:

JSON
texto
binário
multipart
7.3 Headers obrigatórios em downloads

Preservar quando aplicável:

Content-Type
Content-Disposition
Cache-Control
Content-Length 8. REGRA DE JOBS E WORKER
8.1 O web não executa pipeline pesado

O apps/web não deve:

rodar transcrição até o fim
processar job pesado
executar pipeline assíncrono in-process
8.2 A API cria e consulta

A API deve:

criar job
consultar job
aceitar retry
orquestrar estado
8.3 O worker processa

O worker deve:

pegar PENDING
marcar RUNNING
concluir DONE / FAILED
aplicar retry técnico quando aplicável 9. REGRA DO EDITOR
9.1 Domínio crítico

Tudo que mexe com:

subtitle-files
cues
bulk-update
SubtitleVersion
snapshot SRT
export

deve ser tratado como sensível.

9.2 Save do editor é caminho crítico

bulk-update não deve ser alterado semanticamente sem decisão explícita.

9.3 Validação forte

Mudanças nesse domínio exigem validação mais forte:

API
web
banco
export
smoke de editor quando fizer sentido 10. REGRA DE VALIDAÇÃO
10.1 Toda mudança deve ser validada

A validação deve ser proporcional ao risco.

Rotas simples

Validar:

status
shape
erro principal
Rotas médias

Validar:

API direta
web via forward
efeito em banco
erros principais
Rotas pesadas

Validar:

API
web
banco
storage
worker
headers/corpo
smoke manual de UI se fizer sentido
10.2 Paridade API vs Web

Quando houver BFF/proxy, validar :4000 vs :3000.

10.3 Em binário

Validar:

headers
tamanho
conteúdo útil
hash quando fizer sentido
10.4 Em multipart

Validar:

status
erro
efeito em disco
efeito em banco
preservação do boundary 11. REGRA DE DOCUMENTAÇÃO
11.1 Todo PR relevante fecha com doc

Depois de implementar e validar:

atualizar o bloco-\*.md
registrar o que foi validado
registrar ressalvas honestas
11.2 Não mentir

Se algo não foi testado, dizer claramente que não foi testado.

11.3 Documento âncora

A operação atual do monorepo deve se basear em:

docs/monorepo-operacao.md 12. REGRA DE HIGIENE
12.1 Código morto deve sair

Depois que um eixo migra:

procurar restos órfãos
procurar Prisma legado
procurar helpers mortos
remover com prova de não uso
12.2 Nunca apagar no escuro

Só remover quando:

não há import
não há uso indireto conhecido
ou há decisão documentada
12.3 Se houver dúvida, manter

Melhor manter com nota do que remover vivo por engano.

13. COMANDOS OFICIAIS DO DIA A DIA
    13.1 Infra
    Subir banco local
    npm run db:up

Faz: sobe o Postgres local do projeto.

Subir infra local completa
npm run dev:infra

Faz: sobe a infraestrutura local relevante, como Postgres e MinIO.

13.2 Banco
Aplicar migrações
npm run db:migrate

Faz: aplica migrações do Prisma no ambiente local.

Rodar seed
npm run db:seed

Faz: popula a base com dados iniciais.

Validar schema Prisma
npm run db:validate

Faz: valida o schema Prisma.

Gerar Prisma Client
npm run db:generate

Faz: regenera o client do Prisma.

Deploy de migrações
npm run db:deploy

Faz: aplica migrações pendentes em modo de deploy/runtime.

13.3 Aplicações
Subir web
npm run dev:web

Faz: sobe o Next em localhost:3000.

Subir API
npm run dev:api

Faz: sobe a API em localhost:4000.

Subir worker
npm run dev:worker

Faz: sobe o processo de worker.

13.4 Ordem recomendada
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
npm run dev:worker

Faz, em ordem:

sobe banco
aplica migrações
popula base
sobe API
sobe web
sobe worker 14. VARIÁVEIS IMPORTANTES
DATABASE_URL

Exemplo:

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/subtitle_studio?schema=public

Faz: aponta para o banco.

API_BASE_URL

Exemplo:

API_BASE_URL=http://localhost:4000

Faz: diz para o apps/web para onde o BFF deve encaminhar.

Outras variáveis

Chaves como OpenAI/storage devem continuar documentadas nos .env.example e no doc operacional.

15. CHECKLIST OBRIGATÓRIO POR PR

Antes de considerar um PR pronto, conferir:

Escopo
o objetivo do PR é único e claro
o que está fora do PR está explícito
não houve expansão de escopo sem decisão
Arquitetura
a camada escolhida está correta (web, api, worker, shared, infra)
não foi colocada lógica de negócio nova no lugar errado
o apps/web ficou como BFF onde aplicável
Contrato
path/método preservados
status preservados
shape da resposta preservado
mensagens relevantes preservadas
headers importantes preservados, se aplicável
Validação
validação proporcional ao risco foi executada
API direta foi testada
web via forward foi testado, se aplicável
banco/storage/worker foram validados, se aplicável
Documentação
bloco de migração correspondente foi atualizado
ressalvas foram registradas com honestidade 16. TEMPLATE DE PEDIDO PARA O CURSOR

Use isto para iniciar qualquer tarefa nova:

Use o ENGINEERING RULES do projeto como regra principal desta implementação.

Antes de propor código:

1. diga em qual camada isso deve entrar (apps/web, apps/api, apps/worker, packages/shared, infra)
2. diga por que essa camada é a correta
3. diga o que explicitamente NÃO deve entrar nas outras camadas
4. preserve o contrato público atual, salvo se eu pedir mudança
5. se for migração, faça lift-and-shift antes de refactor
6. proponha validação proporcional ao risco
7. respeite docs/monorepo-operacao.md e os blocos de migração

Depois:

- defina o escopo exato do PR
- liste o que fica fora
- execute sem ampliar escopo

17. TEMPLATE DE VALIDAÇÃO
    Agora valide este PR de ponta a ponta, sem ampliar escopo.

Quero validar:

- apps/api direto
- apps/web via forward, se aplicável

Confira:

- status HTTP
- payload/corpo
- headers relevantes
- coerência entre apps/api e apps/web
- efeito em BD/storage/worker, se aplicável
- se o contrato público permaneceu igual ao legado

No final, me entregue:

1. o que foi testado
2. resultado de cada teste
3. divergências entre apps/api e apps/web
4. riscos residuais
5. se o PR pode ser considerado fechado
6. TEMPLATE DE FECHAMENTO DOCUMENTAL
   Faça apenas um fechamento documental curto deste PR, sem ampliar escopo.

Objetivo:
registrar no bloco de migração correspondente o resultado da validação.

Inclua:

- o que foi validado
- API e web, quando aplicável
- principais cenários
- efeitos em BD/storage/worker, quando aplicável
- ressalvas honestas
- conclusão sobre fechamento do PR

Não altere código.
Só documentação. 19. REGRA FINAL

Daqui para frente, a premissa oficial do projeto é:

apps/api é o backend real.
apps/web é o BFF.
apps/worker é o executor assíncrono.

Nada novo deve violar isso sem decisão explícita.

Se você quiser, eu posso agora transformar esse conteúdo em uma versão curta e dura, tipo “mandamentos do projeto”, com menos texto e mais regras objetivas para colar no topo do Cursor.
