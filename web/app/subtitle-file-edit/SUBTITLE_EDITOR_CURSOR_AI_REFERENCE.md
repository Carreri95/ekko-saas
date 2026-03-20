# Subtitle Editor - Referencia Arquitetural (Atualizada)

## Escopo

Este documento descreve o estado real do modulo `web/app/subtitle-file-edit/` e deve ser a fonte unica para manutencao do editor.

Objetivos centrais:
- manter `page.tsx` como orquestrador de alto nivel;
- concentrar regra de negocio em `lib/` (funcoes puras) e `hooks/` (efeitos/orquestracao);
- preservar estabilidade do fluxo WaveSurfer + media element;
- evitar divergencia entre codigo e documentacao.

## Estrutura Real do Modulo

```txt
web/app/subtitle-file-edit/
  components/
    cue-list-item.tsx
    cue-text-editor.tsx
    episode-queue-screen.tsx
    media-preview-panel.tsx
    timeline-dock.tsx
    upload-screen.tsx
    versions-drawer.tsx
    waveform-cue-region-item.tsx
    waveform-overview.tsx
    waveform-time-ruler.tsx
    waveform-transport-controls.tsx
    waveform-zoom-toolbar.tsx
  hooks/
    use-auto-save.ts
    use-cue-editor-navigation.ts
    use-cue-list-auto-scroll.ts
    use-cue-persistence.ts
    use-global-drop-intake.ts
    use-keyboard-shortcuts.ts
    use-local-media-srt-intake.ts
    use-media-playback-controls.ts
    use-media-session-controls.ts
    use-playback-sync.ts
    use-project-queue-intake.ts
    use-queue-actions.ts
    use-queue-auto-snapshot.ts
    use-version-history.ts
    use-waveform-cue-drag.ts
    use-waveform-lifecycle.ts
    use-waveform-overview-drag.ts
    use-waveform-pan-seek.ts
    use-waveform-zoom-controls.ts
  lib/
    cue-problems.ts
    cue-utils.ts
    dom-utils.ts
    format-time.ts
    project-utils.ts
    waveform-time.ts
    waveform-zoom.ts
  page.tsx
  types.ts
  waveform-cue-shadow.css
  waveformCueShadowStyles.ts
```

## Estado de Refatoracao

### Concluido

- Extracao de funcoes puras para `lib/`:
  - validacao/problemas de cue;
  - normalizacao e payload de persistencia;
  - formatacao de tempo;
  - utilitarios de DOM/lista;
  - inferencia de projeto.
- Extracao dos principais blocos de `useEffect` para hooks:
  - ciclo de vida do waveform;
  - sincronizacao playback <-> UI;
  - auto-save e snapshot local;
  - atalhos de teclado;
  - intake por drag-and-drop (global e por pasta);
  - controles de zoom e sessao de media;
  - acoes de fila e navegacao de editor.
- Extracao do bloco de timeline para `components/timeline-dock.tsx`.
- Remocao do wrapper residual `renderTimelineDock()` em `page.tsx`:
  - `TimelineDock` agora e renderizado diretamente no JSX.

### Pendencias Reais (nao bloqueantes)

- Nao ha pendencia estrutural obrigatoria mapeada no momento.
- Melhorias futuras opcionais:
  - adicionar cobertura de testes para hooks criticos (`use-waveform-lifecycle`, `use-cue-persistence`, `use-queue-actions`);
  - reduzir ainda mais props do `TimelineDock` caso surja necessidade de manutencao.

## Regras Arquiteturais

### 1) Papel de `page.tsx`

`page.tsx` deve:
- montar estado principal;
- conectar hooks e componentes;
- evitar concentrar logica pesada de efeito, IO ou transformacao de dados.

Evitar em `page.tsx`:
- funcoes utilitarias puras extensas;
- `useEffect` com regras de negocio complexas;
- JSX de blocos grandes que ja possuem componente dedicado.

### 2) Funcoes puras em `lib/`

Qualquer regra sem dependencia de React/DOM deve ficar em `lib/`.

Exemplos:
- calculo de problemas de cue;
- validacao para persistencia;
- normalizacao de intervalos e colisao de cues;
- formatacao e calculo de tempo.

### 3) Efeitos e orquestracao em `hooks/`

Hooks concentram:
- side effects;
- assinaturas de eventos;
- sincronizacao entre refs/estado;
- operacoes assincronas com cancelamento/guardas.

Cada hook deve ter responsabilidade unica e API enxuta.

### 4) Componentes controlados

Componentes de UI devem receber estado e callbacks por props.
Sem estado duplicado local para dados centrais de cue/playback, salvo estado estritamente visual e efemero.

## Fluxos Criticos (nao regredir)

### Auto-save de cue

- A persistencia silenciosa nao deve gerar `setState` desnecessario que provoque re-render amplo.
- Em modo silencioso, manter apenas o minimo para sincronizar dados sem feedback visual intrusivo.

### Waveform lifecycle

- Criacao/destruicao do WaveSurfer centralizada em `use-waveform-lifecycle`.
- Evitar alterar dependencias do efeito principal sem validar impacto de recriacao da instancia.
- Manter backend `MediaElement` quando necessario para consistencia com elemento `<audio>/<video>` existente.

### Drag e seek

- Operacoes de pan/seek/drag de cue devem preservar:
  - `pointer capture`;
  - guardas contra conflito de interacoes simultaneas;
  - limites de duracao e gap minimo.

### Intake de arquivos

- Drops globais e por tela devem rotear corretamente:
  - `.srt` para carga/parse de legendas;
  - media local para fila de reproducao.

## Checklist de Mudanca (obrigatorio)

Antes de concluir alteracoes neste modulo:
- validar imports/simbolos mortos apos extracoes;
- executar lint focado no modulo;
- revisar se o comportamento de waveform e autosave permaneceu estavel;
- atualizar este arquivo quando houver mudanca estrutural (novo hook/lib/componente).

## Convencoes de Evolucao

- Nome de hook sempre inicia com `use-` e comunica intencao unica.
- Evitar utilitario "generico demais"; preferir modulo por dominio (`cue-*`, `waveform-*`, `project-*`).
- Se um bloco de JSX crescer e passar a ter regras proprias, promover para `components/`.
- Ao extrair codigo, manter contrato de props/retorno explicito e tipado.

## Fonte de Verdade

Se houver divergencia entre implementacao e este documento, a divergencia deve ser resolvida na mesma entrega:
- ou ajustando o codigo para o padrao definido;
- ou atualizando este guia com o novo estado real, de forma explicita.
# SUBTITLE EDITOR — Cursor AI Reference

Next.js 14 App Router · WaveSurfer 7 · TypeScript estrito · Tailwind CSS

## 1. ESTRUTURA DE PASTAS (como DEVE ficar)

A pasta do editor vive em `src/app/subtitle-file-edit/`. Qualquer arquivo fora deste layout quebra os imports.

```text
src/app/subtitle-file-edit/
├── page.tsx                          ← Orquestrador central (~2700 linhas)
├── types.ts                          ← Todos os tipos públicos do módulo
├── waveformCueShadowStyles.ts        ← CSS injetado no Shadow DOM do WaveSurfer
├── waveform-cue-shadow.css           ← Fonte do CSS (não importado diretamente)
│
├── components/                       ← Componentes puros (zero estado próprio)
│   ├── cue-list-item.tsx
│   ├── cue-text-editor.tsx
│   ├── episode-queue-screen.tsx
│   ├── media-preview-panel.tsx
│   ├── upload-screen.tsx
│   ├── versions-drawer.tsx
│   ├── waveform-cue-region-item.tsx
│   ├── waveform-overview.tsx
│   ├── waveform-time-ruler.tsx
│   ├── waveform-transport-controls.tsx
│   └── waveform-zoom-toolbar.tsx
│
├── hooks/                            ← Custom hooks (lógica reutilizável)
│   ├── use-waveform-cue-drag.ts
│   └── use-waveform-pan-seek.ts
│
└── lib/                              ← Funções puras (sem React)
    ├── waveform-time.ts
    └── waveform-zoom.ts
```

⚠ REGRA: Nunca mover arquivos sem atualizar todos os imports em `page.tsx`. Usar path aliases `@/src/...` para libs externas e caminhos relativos `./components/` `./hooks/` `./lib/` para arquivos do módulo.

## 1.1 Refatorações pendentes (backlog do Cursor)

Funções puras dentro de `page.tsx` que DEVEM ser extraídas para `lib/`:

| Função Atual (`page.tsx`) | Destino | Motivo |
|---|---|---|
| `getCueProblems()` | `lib/cue-problems.ts` | Lógica de validação pura, testável |
| `createTempId()` | `lib/cue-utils.ts` | Utilitário sem dependências |
| `reindexCues()` | `lib/cue-utils.ts` | Pura, usada em 4 lugares |
| `normalizeCueCollisions()` | `lib/cue-utils.ts` | Algoritmo complexo, deve ter testes |
| `toSaveCuePayload()` | `lib/cue-utils.ts` | Serialização pura |
| `getSaveCueHash()` | `lib/cue-utils.ts` | Pura, sem React |
| `validateCuesForSave()` | `lib/cue-utils.ts` | Validação pura, testável |
| `formatPlaybackTime()` | `lib/format-time.ts` | Formatter puro, usado em 3+ lugares |
| `scrollCueIntoListPanel()` | `lib/dom-utils.ts` | DOM helper sem estado React |
| `isCueVisibleInListPanel()` | `lib/dom-utils.ts` | DOM helper sem estado React |
| `inferProjectNameFromFiles()` | `lib/project-utils.ts` | Pura, sem React |
| `renderTimelineDock()` | `components/timeline-dock.tsx` | JSX grande demais para estar em `page.tsx` |

## 1.2 Hooks a extrair de `page.tsx`

Blocos `useEffect` + lógica acoplada que devem virar hooks próprios:

- `useKeyboardShortcuts()` — Espaço play/pause, setas seek, Esc fechar editor
- `useWaveformLifecycle()` — Criação/destruição do WaveSurfer, `on("ready")`, `on("zoom")`, rAF sync
- `usePlaybackSync()` — rAF loop que sincroniza `ws.setTime()` + `currentPlaybackMs` durante play
- `useAutoSave()` — Debounce 700ms + `persistCuesToServer()` silencioso
- `useQueueAutoSnapshot()` — Debounce 350ms + `saveQueueState()` ao editar cues no modo fila
- `useCueListAutoScroll()` — Scroll automático da lista durante playback

## 2. MAPA COMPLETO DO ESTADO (`page.tsx`)

Todo estado vive em `page.tsx`. Componentes são 100% controlled — nunca têm estado próprio relevante.

### 2.1 `useRef` — não causam re-render

| Ref | Tipo | Papel |
|---|---|---|
| `mediaElementRef` | `HTMLAudio` \| `HTMLVideo` | Elemento de mídia do DOM. Usado para play/pause/seek sem re-render. |
| `cueListScrollRef` | `HTMLDivElement` | Container scroll da lista de cues. Usado para `scrollCueIntoListPanel()`. |
| `cueItemRefs` | `Record<string, HTMLElement>` | Map `tempId` → elemento DOM de cada linha da lista. |
| `lastAutoScrollAtRef` | `number` | Timestamp do último auto-scroll (throttle 700ms). |
| `waveformContainerRef` | `HTMLDivElement` | Container onde o WaveSurfer monta seu canvas. |
| `waveSurferRef` | `WaveSurfer` | Instância do WaveSurfer. NÃO usar diretamente — sempre via `applyWaveformZoom()` ou `seekPlaybackToTimeSec()`. |
| `waveformZoomRef` | `number` | Zoom REAL em px/s. Atualizado ANTES de `ws.zoom()`. O estado `waveformMinPxPerSec` fica 1 render atrás — usar o ref para cálculos. |
| `waveformCueOverlayHostRef` | `HTMLDivElement` | Host div dentro do wrapper do WaveSurfer para o portal de regiões. |
| `waveformDurationSecRef` | `number \| null` | Duração do áudio em segundos. Cópia do estado para uso em callbacks sem closure stale. |
| `autoSaveTimerRef` | `number \| null` | Handle do `setTimeout` de debounce do auto-save (700ms). |
| `autoSaveInFlightRef` | `boolean` | Flag: requisição de auto-save em voo. Evita chamadas paralelas. |
| `lastSavedServerHashRef` | `string` | Hash JSON das cues salvas no servidor. Evita POST redundante. |
| `queueSnapshotSyncTimerRef` | `number \| null` | Handle do `setTimeout` de snapshot da fila (350ms debounce). |
| `lastQueueSnapshotKeyRef` | `string` | Chave `episodeId:hash` do último snapshot salvo. |
| `audioRouteFallbackTriedRef` | `boolean` | Flag: fallback de URL de áudio já tentado. |
| `waveformPanDragRef` | `PanDrag \| null` | Estado do drag de pan na waveform (pointer capture). |
| `waveformOverviewDragRef` | `{ pointerId } \| null` | Estado do drag na minimap overview. |
| `suppressWaveformInteractionUntilRef` | `number` | Timestamp: cliques na waveform ignorados enquanto `Date.now() < valor`. |
| `cueSingleClickTimerRef` | `number` | Handle do `setTimeout` 190ms para distinguir single vs double click. |
| `waveformViewportLastRef` | `Viewport \| null` | Último viewport calculado — evita `setState()` redundante no `scheduleViewportRefresh`. |
| `scheduleViewportRefreshRef` | `() => void \| null` | Referência à função de refresh do viewport (criada dentro do `useEffect` do WaveSurfer). |
| `isWaveformSeekingRef` | `boolean` | Flag: seek em progresso — impede que rAF do play sobrescreva a posição. |
| `currentPlaybackMsRef` | `number` | Cópia do `currentPlaybackMs` para uso em keydown handler sem closure stale. |
| `prevCueCountRef` | `number` | Contagem anterior de cues — detecta primeira carga para auto-selecionar cue 1. |

### 2.2 `useState` — causam re-render quando alterados

| Estado | Tipo | Papel & Regra |
|---|---|---|
| `subtitleFileId` | `string` | ID do arquivo no servidor. Vazio = modo local. Afeta autosave, `handleLoad`, export. |
| `filename` | `string \| null` | Nome do arquivo `.srt` carregado (exibição apenas). |
| `cues` | `CueDto[]` | LISTA MASTER. Toda mutação via `setCues()`. NUNCA mutar diretamente. Sempre reindexar com `reindexCues()`. |
| `loading` | `boolean` | `true` durante `handleLoad()`. Bloqueia autosave. |
| `saving` | `boolean` | `true` durante `persistCuesToServer()` com `showSuccess=true` APENAS. |
| `error` | `string \| null` | Mensagem de erro visível. Só setar em ações explícitas do usuário. NUNCA no auto-save silencioso. |
| `saveSuccess` | `string \| null` | Mensagem de sucesso (salvar manual). `null` no auto-save. |
| `versions` | `VersionItem[]` | Histórico de versões do servidor. |
| `versionsDrawerOpen` | `boolean` | Drawer lateral de histórico aberto. |
| `filterMode` | `ProblemFilter` | Filtro ativo na lista de cues. |
| `mediaSourceUrl` | `string \| null` | URL do áudio/vídeo. Trocar = destruir + recriar WaveSurfer (via `useEffect`). |
| `mediaKind` | `"audio"` \| `"video"` \| `null` | Determina se WaveSurfer é montado (apenas áudio). |
| `currentPlaybackMs` | `number` | Posição do playhead em ms. Atualizado a ~30fps via rAF durante play. |
| `waveformDurationSec` | `number \| null` | Duração do áudio. Vem do WaveSurfer `on("ready")` ou de `loadedmetadata`. |
| `selectedCueTempId` | `string \| null` | Cue selecionada (highlight azul na lista, vermelho na waveform). |
| `cueEditFocusTempId` | `string \| null` | Cue em modo edição duplo-clique (ciano na waveform, `CueTextEditor` aberto). |
| `editingCueTempId` | `string \| null` | Cue com `CueTextEditor` montado. `null` = editor fechado. |
| `waveformMinPxPerSec` | `number` | Zoom em px/s para UI (label + grid). 1 render atrás do `waveformZoomRef` — não usar em cálculos. |
| `waveformCueOverlayHostEl` | `HTMLElement \| null` | Elemento host do portal de regiões (necessário para `createPortal`). |
| `isWaveformPanning` | `boolean` | `true` durante drag de pan — muda cursor e classe CSS. |
| `srtDropActive` | `boolean` | Dropzone SRT com arquivo sobre ela. |
| `audioDropActive` | `boolean` | Dropzone áudio com arquivo sobre ela. |
| `screenMode` | `"upload"` \| `"queue"` \| `"editor"` | Tela ativa. Upload = inicial, Queue = lista episódios, Editor = principal. |
| `localProject` | `Project \| null` | Projeto da fila local (modo sem servidor). |
| `currentEpisodeId` | `string \| null` | Episódio aberto no editor (modo fila). |
| `waveformViewport` | `Viewport \| null` | Scroll + largura atual da waveform para régua e minimap. |
| `playerAspectRatio` | `AspectRatio` | Ratio do player de vídeo. Persistido no localStorage. |

## 3. FLUXOS CRÍTICOS

### 3.1 Fluxo de zoom da waveform

O zoom é em px por segundo de áudio. Fluxo obrigatório:

```ts
// 1. Usuário clica +/-/⊡
handleWaveformZoomIn/Out/Reset()
  → calcFitAllPx(durationSec, viewW)    // mínimo para caber tudo
  → zoomByFactor(current, 1.5, fitAll)  // clamp entre fitAll e MAX
  → applyWaveformZoom(nextPx)

// 2. applyWaveformZoom(nextPx)
  → captura centerSec ANTES de ws.zoom()   // ← crítico, não inverter a ordem
  → waveformZoomRef.current = clamped      // ref sincroniza imediatamente
  → setWaveformMinPxPerSec(clamped)        // state para UI (1 render atrás)
  → ws.zoom(clamped)                       // WaveSurfer redesenha async
  → rAF settle(): aguarda 2 frames estáveis → ws.setScroll() restaura centro

// 3. on("ready") — inicialização
  waveformZoomRef = 0  (resetado ao trocar URL)
  fitAll = calcFitAllPx(dur, viewW)
  initialPx = savedPx <= fitAll ? fitAll : savedPx
  applyWaveformZoom(initialPx)
```

✗ NUNCA chamar `ws.zoom()` diretamente. Sempre usar `applyWaveformZoom()`. Não usar `Math.round()` em `clampZoom()` — WaveSurfer aceita floats e arredondar causava snap/travamento.

### 3.2 Fluxo de seek

```ts
// Todas as formas de seek passam por seekPlaybackToTimeSec(sec)
seekPlaybackToTimeSec(sec)
  → isWaveformSeekingRef.current = true    // bloqueia rAF de sobrescrever
  → media.currentTime = sec
  → ws.setTime(sec)
  → setCurrentPlaybackMs(Math.floor(sec*1000))
  → setTimeout(120ms) → isWaveformSeekingRef = false

// Helpers que chamam seekPlaybackToTimeSec:
seekPlayerToCue(startMs)           → seekPlaybackToTimeSec(startMs/1000)
seekPlaybackFromWaveClientX(x)     → calcula ratio → seekPlaybackToTimeSec()
```

### 3.3 Fluxo de auto-save ⚠ REGRA MAIS IMPORTANTE

```ts
useEffect([cues, subtitleFileId, loading]) {
  if (!subtitleFileId || loading || !cues.length) return
  if (hash === lastSavedServerHashRef) return   // sem mudança real
  debounce 700ms → persistCuesToServer({
    showSuccess: false,
    syncServerResponseToUi: false
  })
}
```

`persistCuesToServer` com `showSuccess=false`:

- NÃO chama: `setSaving()`, `setError()`, `setSaveResponse()`
- ZERO `setState()` = ZERO re-render = waveform DOM intacto

`persistCuesToServer` com `showSuccess=true` (salvar manual):

- `setSaving(true)` → fetch → `setSaving(false)`
- `setError()` se falhar, `setSaveSuccess()` se OK
- `setCues(normalized)` se `syncServerResponseToUi=true`

⚠ CRÍTICO: Qualquer `setState()` chamado durante auto-save silencioso causa re-render que pode destruir o DOM do WaveSurfer. Esta é a causa #1 de "wave sumindo". Não adicionar NENHUM `setState` ao path `showSuccess=false`.

### 3.4 Fluxo de edição de cue

```ts
// Single click na lista ou região da waveform:
setSelectedCueTempId(tempId)
setCueEditFocusTempId(null)    // só seleção, não abre editor
seekPlayerToCue(startMs)

// Double click:
setSelectedCueTempId(tempId)
setCueEditFocusTempId(tempId)  // abre CueTextEditor no dock
setEditingCueTempId(tempId)

// Edição de texto no CueTextEditor:
onCommitText(tempId, text) → updateCue(tempId, { text })

// updateCue(tempId, patch):
  → lê vizinhos via getCueNeighborBounds()
  → clamp startMs/endMs entre prevEnd e nextStart
  → garante gap mínimo WAVEFORM_DRAG_MIN_GAP_MS (40ms)
  → setCues(nextCues)  ← único ponto de mutação
```

## 4. MAPA DE FUNÇÕES (`page.tsx` — 2716 linhas)

| Função | Responsabilidade |
|---|---|
| `getCueProblems()` | Valida uma cue: `startMs>=endMs`, texto vazio, overlap, duração curta/longa → extrair para `lib/` |
| `createTempId()` | Gera ID temporário `tmp-timestamp-random` → extrair para `lib/` |
| `reindexCues()` | Renumera `cueIndex` 1-based após insert/remove → extrair para `lib/` |
| `toSaveCuePayload()` | Serializa cues para o body do POST → extrair para `lib/` |
| `getSaveCueHash()` | JSON hash das cues para detectar mudanças → extrair para `lib/` |
| `validateCuesForSave()` | Valida array completo antes de salvar → extrair para `lib/` |
| `normalizeCueCollisions()` | Ordena + garante gaps mínimos → extrair para `lib/` |
| `formatPlaybackTime()` | `ms` → `HH:MM:SS,mmm` ou `MM:SS,mmm` → extrair para `lib/` |
| `scrollCueIntoListPanel()` | Scroll suave da lista centrado na cue → extrair para `lib/dom-utils` |
| `saveQueueState()` | Persiste projeto no localStorage (fila local) |
| `restoreQueueProgress()` | Restaura status/editedCues do localStorage ao abrir pasta |
| `applyWaveformZoom()` | NÚCLEO do zoom: captura centro, `ws.zoom()`, rAF settle, restaura scroll |
| `handleWaveformZoomIn/Out/Reset` | In/Out/Reset: calcula `fitAllPx`, chama `applyWaveformZoom()` |
| `focusCueCardInList()` | `rAF + setTimeout`: scroll + focus no elemento da lista |
| `handleLoad()` | Carrega subtitle file do servidor por ID |
| `loadVersions()` | Busca histórico de versões do servidor |
| `getCueNeighborBounds()` | Retorna `prevEndMs/nextStartMs` para `updateCue()` |
| `updateCue()` | ÚNICO ponto de mutação de timing/texto de cue. Clamp + gap mínimo |
| `duplicateCue()` | Clona cue após o índice atual, reindexar |
| `removeCue()` | Remove cue por `tempId`, reindexar |
| `splitCue()` | Divide cue no playhead (ou no meio), mínimo 80ms total |
| `persistCuesToServer()` | `POST /api/subtitle-cues/bulk-update`. Ver Seção 3.3 para regras |
| `handleSave()` | Salvar manual: chama `persistCuesToServer({showSuccess:true, syncUI:true})` |
| `handleExport()` | Abre URL de download do SRT em nova aba |
| `clearMedia()` | Revoga blob URL + reseta `mediaSourceUrl/Kind/Name` |
| `applyLocalMediaFile()` | Cria blob URL a partir de `File`, detecta `audio` vs `video` |
| `openEpisodeById()` | Abre episódio da fila: lê SRT, restaura `editedCues`, abre áudio |
| `downloadEpisodeSrt()` | Serializa `editedCues` → SRT → download via blob URL |
| `updateEpisodeProgress()` | Atualiza status + `editedCues` do episódio no `localProject` |
| `saveAndNextQueueEpisode()` | Marca done + download + abre próximo episódio pendente |
| `applyDroppedSrtFile()` | Lê `File .srt` → `parseSrt()` → `setCues()` |
| `seekPlaybackToTimeSec()` | ÚNICO ponto de seek. Sincroniza media + WaveSurfer + ref |
| `seekPlaybackFromWaveClientX()` | `clientX` → ratio na timeline → `seekPlaybackToTimeSec()` |
| `scrollWaveformToCueStart()` | `ws.setScrollTime()` — alinha timeline ao início da cue |
| `handleWaveformOverviewPointerDown()` | Drag no minimap: pointer capture + `ws.setScroll()` |
| `renderTimelineDock()` | JSX do dock inferior (waveform + editor) → extrair para componente |

## 5. MAPA DE COMPONENTES

Todos os componentes são 100% controlled — recebem props e callbacks, NUNCA gerenciam estado próprio. Qualquer estado que "parece local" deve ir para `page.tsx`.

| Componente | Props principais + Responsabilidade |
|---|---|
| `CueListItem` | `cue`, `problems`, `isPlaybackCue`, `isSelectedCue`, `isEditFocusCue`, `nextCueStartMs` → Linha da lista com índice, tempo, texto, badge CPS, indicadores de qualidade, inputs ms inline (visíveis só quando selecionado) |
| `CueTextEditor` | `cue`, `cueIndex`, `totalCues`, `onCommitText`, `onNavigate`, `onClose` → Painel do dock: textarea, barra CPS colorida, Unbreak/Auto br, botões ↑↓ de navegação, footer com stats |
| `MediaPreviewPanel` | `mediaSourceUrl`, `mediaKind`, `mediaRef`, `activeSubtitleText`, `aspectRatio` → Player vídeo/áudio com legenda sobreposta, botões `16:9/9:16/1:1` |
| `WaveformCueRegionItem` | `cue`, `leftPx`, `widthPx`, `isSelectedHere`, `isEditFocusHere`, `isPlaybackHere` + handlers → Região de cue na waveform: handles drag start/end (`ew-resize`), body com texto preview + meta (`#N`, `Xs`) |
| `WaveformTimeRuler` | `viewport`, `durationSec` → Régua de tempo: ticks por `chooseStep()` baseado na duração visível. Major=inteiros, minor=frações |
| `WaveformZoomToolbar` | `playbackLabel`, `zoomPx`, `onZoom*`, `canReplaceAudio`, `onReplaceAudio` → Toolbar: timecode, botões `−/⊡/+`, px/s label, Substituir áudio |
| `WaveformTransportControls` | `onPlay`, `onPause`, `onReset` → Botões `⏮ ▶ ‖` com `onMouseDown preventDefault` (evita blur do textarea) |
| `WaveformOverview` | `viewport`, `thumbLeftPct`, `thumbWidthPct`, `onPointerDown` → Minimap: barra com thumb proporcional ao viewport atual |
| `EpisodeQueueScreen` | `project`, `onOpenEpisode`, `onDownloadEpisode`, `onBackToUpload` → Tabela de episódios com status, barra de progresso, botões Abrir/Baixar/Continuar |
| `UploadScreen` | `srtLoaded`, `srtFilename`, `srtCount`, `*DropActive`, `onPick*`, `onFolderDrop` → Tela inicial: dropzones SRT + áudio/vídeo, picker de pasta |
| `VersionsDrawer` | `open`, `loading`, `versions`, `onClose` → Drawer lateral com histórico de versões (read-only, sem rollback) |

## 6. HOOKS E LIBS

### 6.1 `use-waveform-cue-drag.ts`

Gerencia drag de bordas (`start/end`) e drag de movimento (mover cue inteira) na waveform.

- Usa pointer capture para drag suave fora da região
- Throttle via rAF: `scheduleCueTimingPatch()` — acumula patches e aplica só no próximo frame
- Ao soltar, flush imediato do patch pendente (sem esperar rAF)
- Emite `suppressWaveformInteractionUntilRef = now + 200ms` ao iniciar drag (evita seek acidental)
- Retorna `waveformEdgeDragRef` e `waveformMoveDragRef` para o `page.tsx` consultar durante render das regiões

### 6.2 `use-waveform-pan-seek.ts`

Bind de handlers de pan (arrastar a timeline) e seek (clicar no fundo) no wrapper do WaveSurfer.

- Retorna `bindPanSeekHandlers()` — chamado dentro do `on("ready")` do WaveSurfer
- Pan: `pointerdown` no fundo → pointer capture → `pointermove` calcula delta px → `ws.setScroll()`
- Seek: `pointerup` sem movimento → `seekFromBackgroundClick()` usando `scrollLeft` real do wrapper
- Wheel: `deltaX` ou `-deltaY` → `ws.setScroll()` com fator 1.15
- Ignora eventos quando edge/move drag ou overview drag estão ativos

### 6.3 `lib/waveform-zoom.ts`

| Exportação | Contrato |
|---|---|
| `WAVEFORM_ZOOM_MIN = 10` | px/s mínimo absoluto |
| `WAVEFORM_ZOOM_MAX = 1200` | px/s máximo absoluto |
| `WAVEFORM_ZOOM_DEFAULT = 48` | Valor inicial de referência (UI) |
| `calcFitAllPx(dur, viewW)` | `(viewW-2)/dur` clamped a MIN. Margem de 2px evita scrollbar espúria |
| `zoomByFactor(current, factor, fitAll)` | `current*factor` clamped `[fitAll, MAX]`. SEM `Math.round()` |
| `clampZoom(px, fitAll)` | `min(MAX, max(fitAll, px))`. SEM `Math.round()` — nunca remover |

### 6.4 `lib/waveform-time.ts`

- `buildCueWaveformRegions()` — converte ms → px para cada cue baseado em `durationSec` e `totalWidthPx`
- `computeOverviewMetrics()` — calcula `thumbLeftPct` e `thumbWidthPct` para o minimap

## 7. HISTÓRICO DE BUGS RESOLVIDOS

Para cada bug: sintoma → causa raiz → correção aplicada. Nunca regredir.

| Sintoma | Causa Raiz | Arquivo | Correção |
|---|---|---|---|
| Wave sumia ao editar texto | Auto-save chamava `setSaving()+setError()` mesmo silencioso → re-render destruía DOM do WaveSurfer | `page.tsx:1491` | Remover TODOS `setState()` do path `showSuccess=false` |
| Zoom travado/colapsava | `clampZoom()` usava `Math.round()` → arredondava abaixo de `fitAllPx` float | `waveform-zoom.ts` | Remover `Math.round()` do `clampZoom()` |
| Régua desalinhada após zoom | `waveformGridStyle` usava state (1 render atrás) em vez do ref | `page.tsx:1152` | Usar `waveformZoomRef.current` no cálculo do grid |
| Áudio longo abria com scroll | `on("ready")` usava `waveformZoomRef=DEFAULT(48)` sem calcular `fitAllPx` | `page.tsx:645` | Zerar `ref=0` no reset; ready calcula `fitAllPx` real |
| rAF infinito após zoom | `stableCount<3` exigia 3 frames; WaveSurfer estabiliza em 2 | `page.tsx:558` | Reduzir threshold para `stableFrames<2` |
| Scroll errado após zoom | `centerSec` calculado APÓS `ws.zoom()` (wrapper já tinha nova largura) | `page.tsx:558` | Capturar `centerSec` ANTES de `ws.zoom()` |
| Auto-save causava seek errado | `setSaving()` re-renderizava, fechando closure de `isWaveformSeekingRef` | `page.tsx:1491` | Zero `setState` no auto-save silencioso |

## 8. REGRAS PARA O CURSOR AI

### 8.1 O que NUNCA fazer

- ✗ NUNCA chamar qualquer `setState()` dentro do auto-save silencioso (`showSuccess=false`). Inclui `setSaving`, `setError`, `setSaveResponse`. Zero `setState` = zero re-render = waveform intacta.
- ✗ NUNCA adicionar `Math.round()` ao `clampZoom()`. O WaveSurfer aceita floats. Arredondar causava snap indesejado e zoom travado.
- ✗ NUNCA chamar `ws.zoom()` diretamente. Sempre usar `applyWaveformZoom()`. Ela captura o centro, atualiza o ref, aplica o zoom e restaura a posição.
- ✗ NUNCA mutar o array `cues[]` diretamente. Sempre `setCues(novo array)`. Sempre chamar `reindexCues()` após insert/remove.
- ✗ NUNCA adicionar dependências extras ao `useEffect` do WaveSurfer além de `[bindPanSeekHandlers, mediaSourceUrl, mediaKind]`. Qualquer dependência extra recria o WaveSurfer desnecessariamente.

### 8.2 Padrões corretos

- Para zoom: `applyWaveformZoom(px)` — nunca `ws.zoom()` direto
- Para seek: `seekPlaybackToTimeSec(sec)` — sincroniza tudo de uma vez
- Para editar cue: `updateCue(tempId, patch)` — normaliza colisões e gap mínimo
- Para ler zoom atual: `waveformZoomRef.current` — não `waveformMinPxPerSec` (1 render atrás)
- Para sincronizar com WaveSurfer: ref primeiro, state depois — ref = tempo real, state = trigger de render da UI
- Para extrair função para `lib/`: verificar que é pura (sem React, sem closures de state)
- Para extrair hook: criar em `hooks/`, importar em `page.tsx`, não em componentes

### 8.3 Checklist antes de qualquer PR

- [ ] A wave continua visível após editar texto de cue por 5+ segundos?
- [ ] Zoom in/out/reset funcionam sem travar ou colapsar para mínimo?
- [ ] A régua (ticks) fica alinhada com as regiões de cue após zoom?
- [ ] Auto-save NÃO exibe loading/erro na UI durante edição normal?
- [ ] Após trocar arquivo de áudio, zoom reseta para "ver tudo" corretamente?
- [ ] Drag de borda start/end funciona sem jump inicial?
- [ ] Drag de mover cue funciona sem afetar vizinhos além do gap mínimo?
- [ ] TypeScript compila sem erros (`tsc --noEmit`)?
- [ ] Nenhum `any` novo, nenhum `// @ts-ignore` novo?

### 8.4 Ordem de refatoração recomendada

Para não quebrar o sistema ao refatorar, seguir esta ordem:

1. Extrair funções puras para `lib/cue-utils.ts` (sem tocar em `page.tsx` além dos imports)
2. Extrair `formatPlaybackTime` para `lib/format-time.ts`
3. Extrair `useAutoSave()` para `hooks/use-auto-save.ts`
4. Extrair `useQueueAutoSnapshot()` para `hooks/use-queue-auto-snapshot.ts`
5. Extrair `usePlaybackSync()` (rAF loop) para `hooks/use-playback-sync.ts`
6. Extrair `useWaveformLifecycle()` (maior e mais delicado — fazer por último)
7. Extrair `renderTimelineDock()` para `components/timeline-dock.tsx`
8. A cada extração: compilar, testar zoom + wave + autosave manualmente

## 9. GLOSSÁRIO

| Termo | Definição |
|---|---|
| `tempId` | ID de cue gerado no cliente: `"tmp-{timestamp}-{random}"`. Usado como key React e nos refs. Pode ser promovido ao `id` do servidor após save. |
| `cueIndex` | Número sequencial 1-based exibido ao usuário. Recalculado por `reindexCues()` sempre que cues são inseridas/removidas. |
| `fitAllPx` | Zoom mínimo (px/s) para o áudio caber inteiro na viewport: `(viewWidth-2)/durationSec`. |
| `editFocus` | Estado em que uma cue está selecionada E com `CueTextEditor` aberto (duplo clique). `cueEditFocusTempId !== null`. |
| `playbackCue` | Cue cujo intervalo `[startMs, endMs)` contém o `currentPlaybackMs` atual (`activeCueTempId`). |
| `WAVEFORM_DRAG_MIN_GAP_MS (40ms)` | Gap mínimo obrigatório entre `endMs` de uma cue e `startMs` da próxima. Aplicado em `updateCue()` e `normalizeCueCollisions()`. |
| `syncServerResponseToUi` | Flag de `persistCuesToServer()`. `true` = substitui `cues[]` pelos IDs do servidor. `false` = mantém tempIds locais (auto-save silencioso). |
| `showSuccess` | Flag de `persistCuesToServer()`. `true` = pode chamar `setState()`. `false` = ZERO `setState()`. Ver Seção 3.3. |
| `stableFrames` | Contador de frames consecutivos sem mudança no `scrollWidth` do wrapper do WaveSurfer. Threshold=2 para restaurar scroll após zoom. |
| `pointer capture` | `setPointerCapture()` — garante que eventos de `pointermove/up` cheguem ao elemento mesmo quando o ponteiro sai da área. Usado em todos os drags. |
| `suppress interaction` | `suppressWaveformInteractionUntilRef`: timestamp futuro. Cliques/drags na waveform ignorados até esse momento (evita seek acidental pós-drag). |
| `screenMode` | `"upload"` \| `"queue"` \| `"editor"`. Determina qual tela renderizar. Independente do estado do editor. |
| `localProject` | Modo sem servidor: `Project` com episódios lidos de uma pasta local. Salvo no localStorage via `saveQueueState()`. |
| `waveformGridStyle` | CSS custom props (`--wave-grid-major-step`, `--wave-grid-minor-step`) para grade visual na waveform. Calculado do `waveformZoomRef`, não do state. |

