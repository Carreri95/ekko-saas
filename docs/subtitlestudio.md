SubtitleStudio — entidades, vínculos e fluxo operacional
Versão limpa e consolidada

1. Objetivo

Este documento define a base estrutural do SubtitleStudio como sistema operacional de estúdio de dublagem.

Ele existe para deixar claro:

quais são as entidades centrais
como elas se relacionam
qual é o fluxo operacional natural
quais vínculos precisam existir no banco e na aplicação
o que já existe hoje
o que falta nascer
qual deve ser a ordem de evolução sem retrabalho estrutural

O produto já não é apenas um editor de SRT. Ele está evoluindo para um sistema que organiza cliente, projeto, episódios, elenco, personagem, transcrição, editor, gravação, comunicação e entrega.

2. Visão macro do domínio

O fluxo central do produto é este:

Cliente contrata um projeto.

Esse projeto possui:

episódios
personagens
elenco vinculado aos personagens
arquivos de entrada e saída
fases/status de produção
eventualmente blocos de gravação
futuramente sessões de gravação, comunicação e QC

O episódio é a principal unidade operacional entre o administrativo e o editorial.

O editor e o gerador de SRT pertencem ao eixo editorial do episódio.

3. Princípio estrutural principal

A regra mais importante do sistema deve ser:

quase tudo nasce em um projeto ou aponta para um projeto

E, quando necessário, também aponta para um destes níveis:

projeto
episódio
bloco
personagem
sessão de gravação

Isso evita dados soltos e reduz retrabalho.

4. Entidades principais
   4.1 User

Representa quem acessa o sistema internamente.

Campos base:

id
nome
email
senhaHash
status
role
createdAt
updatedAt

Relações:

cria convites
cria clientes
cria projetos
pode ser responsável por tarefas, episódios ou sessões
4.2 Invite

Convite de acesso ao sistema.

Campos base:

id
email
token
status
expiresAt
sentAt
acceptedAt
revokedAt
invitedByUserId

Status:

pending
accepted
revoked
expired
4.3 Client

Cliente do estúdio.

Campos base:

id
nome
emailPrincipal
telefone
país
status
observações
createdByUserId
createdAt
updatedAt

Status:

active
inactive
prospect

Relação:

1 cliente possui muitos projetos
4.4 DubbingProject

É a entidade central operacional do estúdio.

Campos base:

id
clientId
nome
código interno
descrição
statusMacro
faseAtual
prazoFinal
valorPrevisto
minutagemPrevista
idiomaOrigem
idiomaDestino
observações
createdByUserId
createdAt
updatedAt

Fases sugeridas:

spotting
adaptação
revisão
gravação
qc
legenda_final
entrega
concluído
pausado

Relações:

pertence a um cliente
possui muitos episódios
possui muitos personagens
possui muitos arquivos
terá blocos, sessões, tarefas, QC e comunicação

Observação importante:
No teu código atual, o DubbingProject é o projeto operacional do estúdio. Ele não deve ser fundido à força agora com o Project técnico/editorial.

4.5 Episode

É a principal ponte entre operação e editorial.

Campos base:

id
dubbingProjectId
número
título
status
duraçãoSegundos
prazoEditorial
observações
ordem
subtitleFileId opcional
audioFileId opcional
transcriptionProjectId opcional
editedAt opcional
createdAt
updatedAt

Status operacionais úteis:

pending
sem_audio
transcrevendo
pronto_para_editar
em_edição
pronto_para_gravação
gravado
em_qc
concluído
entregue

Relações:

pertence a um DubbingProject
aponta para recursos técnicos/editoriais
pode futuramente apontar para bloco, sessão, QC, tarefas e arquivos

Ponto central:
Episode já é hoje a entidade de integração mais importante do sistema.

4.6 Project

No estado atual do código, Project pertence ao núcleo técnico/editorial.

Ele sustenta:

SubtitleFile
SubtitleCue
SubtitleVersion
TranscriptionJob
MediaAsset

Papel atual:

projeto técnico de transcrição/edição
pode ser criado automaticamente quando um episódio recebe áudio e precisa entrar no pipeline editorial

Conclusão arquitetural atual:

DubbingProject = projeto operacional
Project = projeto técnico/editorial
Episode = ponte entre os dois

Não tentar unificar isso agora.

4.7 ProjectFile / MediaAsset

Camada genérica de arquivos do sistema.

Campos base:

id
projectId ou dubbingProjectId
episodeId opcional
blockId opcional
tipo
nomeOriginal
nomeArmazenado
mimeType
tamanhoBytes
storagePath
versão
observações
uploadedByUserId
createdAt

Tipos úteis:

video_source
audio_source
srt_source
srt_generated
srt_final
screenshot_character
qc_report
delivery_package
recording_take
production_order

A recomendação continua sendo centralizar arquivos em uma camada única, em vez de espalhar tabelas específicas cedo demais.

4.8 SubtitleFile

Entidade específica do módulo editorial.

Campos base:

id
projectId
episodeId opcional
sourceProjectFileId opcional
tipo
filename
idioma
versão
origem
status
totalCues
createdByUserId
createdAt
updatedAt

Origem/tipo:

original_upload
whisper_generated
manual_edit
final_delivery

Relações:

pertence a Project
opcionalmente aponta para Episode
possui muitos cues
possui versionamento
4.9 SubtitleCue

Representa cada fala da legenda.

Campos base:

id
subtitleFileId
episodeId opcional
índice
startMs
endMs
texto
cps opcional
characterId opcional
status opcional
observações opcionais
createdAt
updatedAt

Status úteis:

normal
warning
problem
revisado
finalizado

Ponto importante:
Hoje o cue ainda está técnico demais. O próximo salto é permitir:

vínculo com personagem
status editorial
observação operacional
4.10 ProjectCharacter

Personagem dentro do projeto.

Campos base:

id
dubbingProjectId
nome
slug opcional
descrição
tipoVoz
faixaEtária
gêneroVocal
protagonista
observações
status
castMemberId opcional por compatibilidade
createdAt
updatedAt

Status:

identificado
em_casting
escalado
gravando
concluído

Regra importante:

personagem pertence ao projeto, não ao elenco global

4.11 CastMember / Talent

Elenco global do sistema.

Campos base:

id
nome
cpf (apenas dígitos na BD)
cnpj (apenas dígitos na BD)
razaoSocial
email
whatsapp
prefersEmail (boolean) — canal e-mail ativo para comunicação automática e pré-preenchimento
prefersWhatsapp (boolean) — canal WhatsApp ativo
status
bio curta
cidade
país
gravaRemoto
especialidadePrincipal
equipamentoResumo
observações
createdAt
updatedAt

Status:

disponível
em_projeto
inativo
bloqueado

Observação importante:
Hoje o backend já recalcula parcialmente a ocupação do elenco com base em vínculos ativos de personagem. Isso é útil, mas ainda não substitui agenda real.

CastMemberAvailability (disponibilidade manual):
Períodos explícitos ligados ao dublador (`AVAILABLE`, `UNAVAILABLE`, `BLOCKED`), cadastrados manualmente. São uma camada separada de `RecordingSession`: nesta fase não bloqueiam criação de sessão nem são validadas contra a agenda. Integração futura (avisos ou restrições no agendamento) virá em PRs posteriores.

4.12 ProjectCharacterAssignment

Esta é a próxima entidade estrutural mais importante.

Ela representa o vínculo real entre personagem e dublador.

Campos base:

id
dubbingProjectId
projectCharacterId
castMemberId
tipo
status
prioridade
aprovadoPeloCliente
observações
createdAt
updatedAt

Tipos:

teste_opção_1
teste_opção_2
principal
reserva
suporte

Status:

convidado
teste_enviado
teste_recebido
aprovado
escalado
substituído
recusado

Ponto crucial:
Hoje o personagem guarda castMemberId direto. Isso é útil como estado temporário, mas não é suficiente como modelagem final.

4.13 RecordingSession

Sessão real de gravação (implementada no código actual; este bloco descreve o modelo já persistido).

Campos base:

id
dubbingProjectId
episodeId opcional (legado; preferir ligação N:N a episódios quando usada)
blockId opcional
castMemberId
recordingTechnicianId — técnico de gravação (`Collaborator` com papel adequado); **opcional** (PR seguinte à 29E)
título
início
fim
formato
status
local
meetingUrl opcional
materialUrl opcional
observaçõesDireção
createdByUserId
createdAt
updatedAt

Formatos:

presencial
remoto
híbrido

Status:

pendente_confirmação
confirmado
reagendado
em_andamento
concluído
faltou
cancelado
retake

Regra importante:
a agenda da tela deve ser só uma visão; o dado real precisa viver em RecordingSession

4.14 CommunicationLog

Histórico de comunicação operacional: registo manual de contactos (canal, direção, estado, corpo, destinatários e vínculos opcionais a projeto, episódio, dublador, cliente, sessão). Não é ActivityLog nem AuditLog (esses seriam auditoria de ações de utilizador). WhatsApp real, webhooks inbound e automações novas por evento continuam fora de âmbito até PRs futuros.

Implementação atual: modelo Prisma `CommunicationLog` (fonte de verdade); API REST escopada ao projeto (`GET`/`POST` `/api/dubbing-projects/:id/communication-logs`, `PATCH`/`DELETE` `.../communication-logs/:logId`); UI mínima na página do projeto (aba «Comunicação»).

Na agenda do projeto, cada sessão pode abrir «Registrar comunicação»: muda para a aba Comunicação e pré-preenche o formulário a partir da `RecordingSession` (dublador, sessão, texto sugerido).

**Envio real (PR 23 + PR 24 + PR 25):** O pedido `POST .../communication-logs/:logId/send` apenas **enfileira** o envio (HTTP **202**, estado `PROCESSING`); o **apps/worker** processa `CommunicationLog` assíncrono, aplica lock/retry e actualiza `SENT` / `FAILED`, `sentAt`, `error`, `providerMessageId`.

No PR 24, o fluxo ganhou robustez incremental sem ampliar domínio: `providerMessageId` (idempotência básica/rastreio do aceite no provider), `nextRetryAt` (retry temporal simples e previsível), logs estruturados por `communicationLogId`.

No PR 25, o mesmo pipeline passou a suportar dois canais de envio real:
- `EMAIL` (`OUTBOUND`) via Resend
- `WHATSAPP` (`OUTBOUND`) via Evolution API (texto simples)

Sem arquitectura paralela: `CommunicationLog` continua fonte de verdade/outbox, API só faz enqueue e worker faz dispatch por canal. Ainda fora de escopo: inbound/webhook, confirmação de leitura/entrega, mídia/anexos, chat/inbox e automações novas por evento.

Envio automático ao guardar sessão (PR 22 + 23): estava previsto como checkbox explícito no formulário da agenda; **no código actual o fluxo real é** «Registrar comunicação» / aba Comunicação (pré-preenchimento a partir da sessão). O helper `runSessionSaveEmailAutomation` existiu sem ligação ao `onSaveSession` e foi **removido no PR 29E** como código morto; não bloqueia evoluções futuras de um checkbox ligado à API.

No PR 26, o prefill de comunicação passou a usar templates básicos por tipo (`SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_REMINDER`, `SESSION_CANCELED`) com `templateKey` coerente (`session_created`, `session_updated`, etc.). Não há engine avançada: subject/body continuam editáveis pelo utilizador antes de guardar/enviar.

No PR 27, a aba Comunicação ganhou seleção explícita de template básico no formulário e ação de aplicar template (regenera `subject`, `body` e `templateKey`). O conteúdo permanece totalmente editável após aplicação; não existe engine avançada nem administração de templates.

No PR 28, houve polimento final de UX na aba Comunicação (frontend): copy mais direta, envio em lote (`Enviar todos` para OUTBOUND `PENDING`/`FAILED`), chips visuais consistentes para status/canal/direção e simplificação do formulário (sem edição manual de estado/erro). Não houve alteração no backend, worker ou fluxo de outbox/envio.

No PR 29, `CastMember` passou a usar dois booleanos (`prefersEmail`, `prefersWhatsapp`) em vez de um único enum de canal. **PR 29E** alinhou validação: é obrigatório ter **pelo menos um** canal ativo; se `prefersEmail` é verdadeiro, o e-mail é obrigatório e válido; se `prefersWhatsapp` é verdadeiro, o WhatsApp é obrigatório (mínimo de dígitos). Ambos os canais podem estar ativos em simultâneo — o prefill e o worker de lembretes enviam para **todos** os canais activos para os quais exista contacto (com fallback mínimo para um canal quando nenhum está explícito na preferência legada).

**Colaborador** (`Collaborator`) segue a mesma regra de canais activos e contactos obrigatórios (paridade com dublador), incluindo `prefersEmail` / `prefersWhatsapp` no schema.

**Validação obrigatória (produto, PR 29E):** dublador — nome, CPF (11 dígitos), CNPJ (14 dígitos), razão social, pelo menos um canal activo com contacto correspondente, especialidades; colaborador — nome, função (`role`), CPF, CNPJ, razão social, canais e contactos; cliente — nome e `paymentMethod`; sessão de gravação — título, `startAt`, `endAt`, `castMemberId`; `recordingTechnicianId` opcional. **Agenda (PR sessão):** início e fim no **mesmo dia**; `endAt` > `startAt`; duração máxima **5 horas**; UI limita o fim ao mesmo dia e ao intervalo válido. Frontend (Zod) e API (Zod + serviço) alinhados; a API é fonte de verdade.

**CPF/CNPJ:** máscara na UI; persistência só com dígitos completos; valores parciais ou só com máscara são rejeitados pelo Zod.

**Worker (lembretes de sessão):** deduplicação de criação de `CommunicationLog` por `sessionId` + `templateKey` + `channel`, para permitir lembrete em e-mail e WhatsApp sem um canal bloquear o outro.

Campos ver schema Prisma (inclui `templateKey` opcional, campos de outbox mínimos no próprio `CommunicationLog`).

Canais (enum): EMAIL, WHATSAPP, SYSTEM.

Direções (enum): OUTBOUND, INBOUND.

Estados (enum): PENDING, **PROCESSING** (pedido de envio e-mail na fila / a processar), SENT, RECEIVED, FAILED.

5. Relações principais
Núcleo administrativo
User 1:N Invite
User 1:N Client
User 1:N DubbingProject
Client 1:N DubbingProject
Núcleo operacional
DubbingProject 1:N Episode
DubbingProject 1:N ProjectCharacter
DubbingProject 1:N ProjectFile
DubbingProject 1:N RecordingSession
DubbingProject 1:N CommunicationLog
Núcleo editorial
Project 1:N SubtitleFile
SubtitleFile 1:N SubtitleCue
Episode 0..1 ou 1:N relação com SubtitleFile, conforme teu fluxo atual
ProjectCharacter 0..N SubtitleCue
Núcleo de elenco
CastMember 1:N ProjectCharacterAssignment
ProjectCharacter 1:N ProjectCharacterAssignment
Núcleo de agenda
CastMember 1:N RecordingSession
Episode 0..N RecordingSession
Block 0..N RecordingSession
Núcleo de comunicação
RecordingSession 1:N CommunicationLog
CastMember 1:N CommunicationLog
Client 1:N CommunicationLog
DubbingProject 1:N CommunicationLog 6. Estado real atual do teu sistema

Hoje existem dois núcleos convivendo:

Núcleo técnico/editorial
Project
SubtitleFile
SubtitleCue
SubtitleVersion
TranscriptionJob
MediaAsset
Núcleo operacional do estúdio
Client
DubbingProject
Episode
ProjectCharacter
CastMember

O que já está sólido:

CRUD de projetos operacionais
episódios criados junto com o projeto
upload de áudio por episódio
transcrição disparada por episódio
personagens por projeto
editor com cues
versionamento de SRT
exportação ZIP
estado parcial de ocupação do elenco

O que ainda não existe de verdade:

assignment intermediário de casting
agenda real
sessão de gravação
histórico de comunicação
vínculo de cue com personagem/status operacional 7. Riscos estruturais a evitar
Colocar o dublador direto no personagem como solução final
Tratar agenda como componente visual sem entidade real por trás
Subir arquivos sem vínculo claro com projeto/episódio
Manter o editor isolado do contexto do projeto
Tentar fundir agora DubbingProject e Project
Criar enums demais cedo demais 8. Direção arquitetural correta

A evolução segura do sistema é esta:

Episode como ponte -> casting intermediário -> sessão de gravação -> comunicação

Essa é a rota mais estável porque aproveita o que já existe sem reconstruir a base.

O que você deve fazer agora, exatamente

Agora vem a parte mais importante: a ordem prática.

Etapa 1 — fechar Episode como centro operacional

Essa é a prioridade imediata.

Você deve fazer agora:

melhorar a listagem e detalhe de episódios dentro da página do projeto
mostrar claramente no frontend:
status do episódio
audioFileId
subtitleFileId
transcriptionProjectId
editedAt
criar estados visuais objetivos para o episódio:
sem áudio
transcrevendo
pronto para editar
em edição
concluído
garantir que toda entrada no editor aconteça a partir do episódio
garantir que o editor saiba sempre:
de qual episódio veio
de qual projeto operacional veio
qual subtitleFile está sendo editado
Resultado esperado

Você para de tratar o editor como um módulo solto e passa a tratá-lo como parte do fluxo real do projeto.

Etapa 2 — enriquecer a tela de episódio

Depois da etapa 1, ainda dentro do mesmo pacote, você faz:

botão de upload de áudio por episódio
botão de iniciar transcrição
botão de abrir no editor
botão de marcar episódio como concluído
feedback visual de estado
timeline simples do episódio:
criado
áudio enviado
transcrição iniciada
legenda disponível
edição concluída
Resultado esperado

O episódio vira a unidade operacional real da produção.

Etapa 3 — criar o assignment intermediário de casting

Essa é a próxima entidade estrutural crítica.

Você deve fazer:

criar tabela ProjectCharacterAssignment
manter ProjectCharacter como personagem do projeto
mover o vínculo real com elenco para assignment
permitir tipos:
principal
reserva
teste_opção_1
teste_opção_2
suporte
manter compatibilidade temporária com castMemberId no personagem
adaptar backend para ler assignment sem quebrar a UI atual
Resultado esperado

Você sai do modelo simplificado de “personagem com dublador fixo” e passa a suportar casting real.

Etapa 4 — depois criar RecordingSession

Só depois de casting intermediário.

Você deve fazer:

criar tabela RecordingSession
criar CRUD backend
vincular com:
DubbingProject
Episode opcional
CastMember
adicionar campos:
data/hora
formato
status
local
meetingUrl
materialUrl
observações
criar tela de agenda do projeto
criar visão de agenda do dublador
Resultado esperado

A agenda deixa de ser conceito e vira dado real.

Etapa 5 — criar CommunicationLog

Depois da sessão.

Você deve fazer:

criar tabela CommunicationLog
registrar canal:
email
whatsapp
system
registrar direção:
inbound
outbound
registrar vínculo com:
projeto
episódio
sessão
elenco
cliente
já deixar preparado para templates
registrar mesmo antes da integração real
Resultado esperado

Quando entrar Evolution API, e-mail ou outro envio, o sistema já terá histórico consistente.
