Guia de Desenvolvimento – SubtitleStudio (Next.js)

Este guia apresenta um resumo estruturado para configurar e executar o SubtitleStudio, um workspace de legendas e gestão de estúdio de dublagem baseado em Next.js. O objetivo é fornecer uma referência rápida para instalar dependências, configurar a base de dados e iniciar a aplicação localmente, bem como descrever scripts úteis e variáveis de ambiente necessárias.

Pré‑requisitos

Antes de iniciar, verifique se você possui as seguintes ferramentas instaladas:

Node.js 20 ou superior (recomendado LTS)
npm, pnpm ou yarn para gerenciar dependências
Docker Desktop (ou Docker Engine + Compose) para executar o PostgreSQL em ambiente de desenvolvimento
Clonando o repositório

Clone o repositório do projeto e navegue até sua raiz:

git clone https://github.com/SEU_USUARIO/SEU_REPO.git
cd SEU_REPO

Substitua SEU_USUARIO/SEU_REPO pela URL real do seu fork ou repositório no GitHub.

Instalação de dependências

Instale as dependências da aplicação localizada na pasta web/. Há duas formas equivalentes:

A partir da raiz do repositório (instala apenas o que está em web/):

npm install --prefix web

Ou navegando para dentro da pasta web/:

cd web
npm install
Configuração da base de dados (PostgreSQL + Prisma)
1. Subir o PostgreSQL com Docker

Na raiz do repositório, execute o compose para iniciar o PostgreSQL:

docker compose up -d

Isto iniciará o PostgreSQL com as configurações padrão do arquivo docker-compose.yml: porta 5432, banco de dados subtitle_studio, usuário e senha postgres/postgres. Para parar o serviço:

docker compose down
2. Criar o arquivo .env

Dentro da pasta web/, crie um arquivo .env com a variável DATABASE_URL apontando para o PostgreSQL local (use .env.example como modelo se existir no repositório):

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/subtitle_studio"

Ajuste usuário, senha ou nome do banco se tiver modificado o docker-compose.yml.

3. Gerar cliente Prisma e aplicar migrações

Estando em web/ (ou usando --prefix web a partir da raiz), execute:

cd web
npm run db:generate   # gera o cliente Prisma em app/generated/prisma
npm run db:migrate    # aplica migrações em desenvolvimento

Em ambiente de CI/produção, utilize npm run db:deploy para aplicar as migrações sem criar novas.

4. Popular dados iniciais (seed)

Para criar um usuário de desenvolvimento (demo@subtitlestudio.local) e dados necessários para algumas rotas da API:

npm run seed

# ou, de forma equivalente
npm run db:seed
5. (Opcional) Acessar Prisma Studio

Prisma Studio permite inspecionar e editar dados via interface web. Para iniciar:

npm run db:studio
Executando a aplicação em desenvolvimento

A partir da raiz do repositório ou dentro de web/, execute:

npm run dev

O servidor de desenvolvimento do Next.js estará disponível em http://localhost:3000
. A rota raiz (/) redireciona para /gerar, que é o gerador de SRT em lote.

Scripts úteis

Os comandos abaixo devem ser executados dentro de web/ (ou usando --prefix web a partir da raiz):

Comando	Descrição
npm run dev	Inicia o servidor de desenvolvimento Next.js
npm run build	Gera o build de produção
npm run start	Serve a aplicação após build
npm run lint	Executa o ESLint
npm run test	Roda os testes (Vitest)
npm run db:generate	Executa prisma generate
npm run db:migrate	Aplica migrações em desenvolvimento
npm run db:deploy	Aplica migrações em CI/produção
npm run seed	Executa o seed da base de dados
npm run db:seed	Variante de seed (mesma função)
npm run db:studio	Abre o Prisma Studio

Na raiz do monorepo, existem atalhos equivalentes (ver package.json): npm run dev, npm run db:migrate, npm run db:up, entre outros.

Variáveis de ambiente
Variável	Obrigatória	Descrição
DATABASE_URL	Sim (API)	URL de conexão com o PostgreSQL
OPENAI_API_KEY	Opcional	Chave para usar o Whisper quando não é enviada pelo cliente
MAX_FILE_SIZE_MB	Opcional	Tamanho máximo de upload em MB (padrão 500 MB)
MAX_TRANSCRIPTION_ATTEMPTS	Opcional	Número de tentativas de transcrição por job (padrão 3)

No gerador (/gerar), a chave da OpenAI pode ser armazenada no navegador via localStorage conforme a interface da aplicação.

Documentação adicional

Para uma visão geral completa do sistema, incluindo modelos, APIs e fluxos, consulte o documento ../docs/SISTEMA‑DETALHADO.md
 na raiz do repositório.

Deploy

Para preparar a aplicação para produção:

Execute npm run build dentro de web/ (ou npm run build na raiz).
Defina a variável DATABASE_URL no ambiente de destino e rode npm run db:deploy para aplicar as migrações.
Em instalações self‑hosted, configure o proxy reverso para permitir o upload de arquivos de tamanho igual ou superior ao valor definido em MAX_FILE_SIZE_MB (veja também as configurações de next.config.ts).

Base técnica: Next.js
, Prisma
 e PostgreSQL.
