import type {
  CSSProperties,
  Dispatch,
  DragEvent,
  MouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from "react";
import type WaveSurfer from "wavesurfer.js";

// --- API / domínio ---

export type CueDto = {
  id: string | null;
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type SubtitleFileResponse = {
  subtitleFileId: string;
  filename: string;
  wavFilename: string | null;
  wavPath: string | null;
  projectId: string;
  cues: CueDto[];
};

export type SaveResponse = {
  subtitleFileId: string;
  updatedCount: number;
  versionId: string;
  versionNumber: number;
  versionCreatedAt: string;
  cues: Array<{
    id: string;
    cueIndex: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
};

export type ProblemFilter =
  | "all"
  | "problematic"
  | "invalid-time"
  | "empty-text"
  | "overlap"
  | "short-duration"
  | "long-duration";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type LocalWaveformData = {
  peaks: number[][];
  duration: number;
};

// --- Waveform / timeline ---

export type WaveformViewportMetrics = {
  scroll: number;
  maxScroll: number;
  viewW: number;
  totalW: number;
};

/** Métricas da viewport ou `null` quando ainda não há dimensões. */
export type WaveformViewport = WaveformViewportMetrics | null;

export type WaveformOverviewDragRefState = { pointerId: number } | null;

export type CueTimeLike = {
  startMs: number;
  endMs: number;
};

export type CueRegionResult<TCue extends CueTimeLike> = {
  cue: TCue;
  leftPx: number;
  widthPx: number;
  hasProblems: boolean;
};

export type CueWaveformOverlayRow = {
  cue: CueDto;
  leftPx: number;
  widthPx: number;
  hasProblems: boolean;
};

export type WaveformEdgeDragState = { tempId: string; edge: "start" | "end" };

export type WaveformMoveDragState = { tempId: string };

// --- Cues (UI parcial) ---

/** Campos de cue usados na lista e no editor de texto (sem `id`). */
export type CueCardFields = Pick<
  CueDto,
  "tempId" | "cueIndex" | "startMs" | "endMs" | "text"
>;

export type CueWaveformDragCue = {
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
};

export type HistoryEntry = {
  cues: CueDto[];
  label: string;
};

export type CueCreateDragState = {
  startX: number;
  startMs: number;
  currentX: number;
  pointerId: number;
  leftBoundMs: number;
  rightBoundMs: number;
};

// --- Persistência ---

export type PersistOptions = {
  showSuccess: boolean;
  syncServerResponseToUi: boolean;
};

export type SaveCuePayloadItem = {
  id?: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type PersistCuesToServerFn = (options: PersistOptions) => Promise<boolean | void>;

// --- Componentes ---

export type WaveformTransportControlsProps = {
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  currentPlaybackMs: number;
  durationMs: number | null;
};

export type TimelineDockProps = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  currentPlaybackMs: number;
  waveformViewport: WaveformViewportMetrics | null;
  waveformDurationSec: number | null;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  waveformCanvasOverlayRef: MutableRefObject<HTMLCanvasElement | null>;
  cueCreatePreviewRect: { leftPx: number; widthPx: number } | null;
  onWaveformShellPointerDownCapture: (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  waveformCueOverlayHostEl: HTMLElement | null;
  cueWaveformRegions: CueWaveformOverlayRow[];
  activeCueTempId: string | null;
  selectedCueTempId: string | null;
  cueEditFocusTempId: string | null;
  waveformEdgeDrag: WaveformEdgeDragState | null;
  waveformMoveDrag: WaveformMoveDragState | null;
  minGapMs: number;
  formatPlaybackTime: (ms: number) => string;
  onEdgePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    cue: CueDto,
    edge: "start" | "end",
  ) => void;
  onEdgePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onEdgePointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMovePointerDown: (
    e: ReactPointerEvent<HTMLElement>,
    cue: CueDto,
  ) => void;
  onMovePointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onMovePointerEnd: (e: ReactPointerEvent<HTMLElement>) => void;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  cueSingleClickTimerRef: MutableRefObject<number>;
  seekPlaybackFromWaveClientX: (clientX: number) => void;
  focusCueCardInList: (tempId: string) => void;
  onOverviewPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPlayMedia: () => void;
  onPauseMedia: () => void;
  onResetMediaToStart: () => void;
  waveformPx: number;
  waveformGridStyle: CSSProperties;
  onCueContextMenu: (e: MouseEvent, cue: CueDto) => void;
  formatToolbarTime: (ms: number) => string;
  playbackRate: number;
  speedSteps: readonly number[];
  onPlaybackRateChange: (rate: number) => void;
};

export type WaveformOverviewProps = {
  viewport: WaveformViewport;
  thumbLeftPct: number;
  thumbWidthPct: number;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

export type WaveformCueRegionItemProps = {
  cue: CueDto;
  leftPx: number;
  widthPx: number;
  hasProblems: boolean;
  isPlaybackHere: boolean;
  isSelectedHere: boolean;
  isEditFocusHere: boolean;
  isEdgeDragging: boolean;
  isMoveDragging: boolean;
  dragEdge: "start" | "end" | null;
  waveformDurationSec: number | null;
  minGapMs: number;
  formatPlaybackTime: (ms: number) => string;
  onEdgePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    cue: CueDto,
    edge: "start" | "end",
  ) => void;
  onEdgePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onEdgePointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMovePointerDown: (e: ReactPointerEvent<HTMLElement>, cue: CueDto) => void;
  onMovePointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onMovePointerEnd: (e: ReactPointerEvent<HTMLElement>) => void;
  onBodyClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onBodyDoubleClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onCueContextMenu: (e: MouseEvent, cue: CueDto) => void;
};

export type WaveformTimeRulerProps = {
  viewport: WaveformViewport;
  durationSec: number | null;
};

export type WaveformTimeRulerTick = {
  leftPx: number;
  isMajor: boolean;
  label: string;
};

export type WaveformContextMenuProps = {
  x: number;
  y: number;
  canAddText: boolean;
  canSplit: boolean;
  onAddText: () => void;
  onSplit: () => void;
  onDelete: () => void;
};

/** Estado do menu de contexto na waveform (split) antes de mapear para props do componente. */
export type WaveformContextMenuOpenState = {
  x: number;
  y: number;
  cue: CueDto;
  /** Tempo de corte (ms) derivado do clique; usado no split (evita querySelector no shadow DOM). */
  splitMs: number;
  canSplit: boolean;
  canAddText: boolean;
};

export type MediaPreviewPanelProps = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  mediaRef: RefObject<HTMLAudioElement | HTMLVideoElement | null>;
  activeSubtitleText: string;
  onTimeUpdate: (currentTimeSec: number) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
};

export type CueTextEditorProps = {
  cue: CueCardFields;
  cueIndex: number;
  totalCues: number;
  onClose: () => void;
  onCommitText: (cueTempId: string, text: string) => void;
  onNavigate: (direction: "prev" | "next") => void;
};

export type CueListItemProps = {
  cue: CueCardFields;
  problems: string[];
  isPlaybackCue: boolean;
  isSelectedCue: boolean;
  isEditFocusCue: boolean;
  nextCueStartMs: number | null;
  assignCueRef: (tempId: string, element: HTMLElement | null) => void;
  shouldIgnoreCueClick: (target: EventTarget | null) => boolean;
  onSelectSingle: (cue: CueCardFields) => void;
  onSelectDouble: (cue: CueCardFields) => void;
};

export type UploadScreenProps = {
  srtLoaded: boolean;
  srtFilename: string | null;
  srtCount: number;
  srtDropActive: boolean;
  audioDropActive: boolean;
  onSrtDragEnter: (e: DragEvent) => void;
  onSrtDragLeave: () => void;
  onSrtDragOver: (e: DragEvent) => void;
  onSrtDrop: (e: DragEvent) => void;
  onAudioDragEnter: (e: DragEvent) => void;
  onAudioDragLeave: () => void;
  onAudioDragOver: (e: DragEvent) => void;
  onAudioDrop: (e: DragEvent) => void;
  onPickSrt: () => void;
  onPickAudio: () => void;
};

// --- Hooks ---

export type UseKeyboardShortcutsParams = {
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  currentPlaybackMsRef: MutableRefObject<number>;
  seekPlaybackToTimeSec: (sec: number) => void;
  ensureWaveformPlayheadVisible: (timeSec: number) => void;
  logBrowserError: (context: string, error: unknown) => void;
  isSpaceReservedForFocusedElement: (target: EventTarget | null) => boolean;
  editingCueTempId: string | null;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  undo: (setCues: Dispatch<SetStateAction<CueDto[]>>) => boolean;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
};

export type UseLocalMediaSrtIntakeParams = {
  setLocalWaveformData: Dispatch<SetStateAction<LocalWaveformData | null>>;
  setMediaSourceUrl: Dispatch<SetStateAction<string | null>>;
  setMediaKind: Dispatch<SetStateAction<"video" | "audio" | null>>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setFilename: Dispatch<SetStateAction<string | null>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  setSrtDropActive: Dispatch<SetStateAction<boolean>>;
  setAudioDropActive: Dispatch<SetStateAction<boolean>>;
  toCueDtoListFromSrtText: (text: string) => CueDto[];
  resetPlaybackToStart: () => void;
  logBrowserError: (context: string, error: unknown) => void;
};

export type UseWaveformOverviewDragParams = {
  suppressPlayheadFollowUntilRef: MutableRefObject<number>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformViewport: WaveformViewportMetrics | null;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformOverviewDragRef: MutableRefObject<WaveformOverviewDragRefState>;
  logBrowserError: (context: string, error: unknown) => void;
};

export type UseWaveformCueCreateParams = {
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformDurationSec: number | null;
  waveformTotalWidthPx: number | null;
  cues: CueDto[];
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  minGapMs: number;
  seekPlaybackFromWaveClientX: (clientX: number) => void;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformOverviewDragRef: MutableRefObject<WaveformOverviewDragRefState>;
  pushHistory?: (cuesSnapshot: CueDto[], label: string) => void;
};

export type UseCueListAutoScrollParams = {
  activeCueTempId: string | null;
  selectedCueTempId: string | null;
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  lastAutoScrollAtRef: MutableRefObject<number>;
  cueItemRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  cueListScrollRef: MutableRefObject<HTMLDivElement | null>;
};

export type UseCuePersistenceParams = {
  subtitleFileId: string;
  cues: CueDto[];
  minGapMs: number;
  autoSaveInFlightRef: MutableRefObject<boolean>;
  lastSavedServerHashRef: MutableRefObject<string>;
  sanitizeSubtitleFileId: (raw: string | null | undefined) => string;
  validateCuesForSave: (cues: CueDto[]) => string | null;
  toSaveCuePayload: (cues: CueDto[]) => SaveCuePayloadItem[];
  normalizeCueCollisions: (cues: CueDto[], minGapMs: number) => CueDto[];
  getSaveCueHash: (cues: CueDto[]) => string;
  logBrowserError: (context: string, error: unknown) => void;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
};

export type UseMediaSessionControlsParams = {
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  scheduleViewportRefreshRef: MutableRefObject<(() => void) | null>;
  setLocalWaveformData: Dispatch<SetStateAction<LocalWaveformData | null>>;
  setMediaSourceUrl: Dispatch<SetStateAction<string | null>>;
  setMediaKind: Dispatch<SetStateAction<"video" | "audio" | null>>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
};

export type UseAutoSaveParams = {
  subtitleFileId: string;
  cues: CueDto[];
  loading: boolean;
  autoSaveTimerRef: MutableRefObject<number | null>;
  autoSaveInFlightRef: MutableRefObject<boolean>;
  lastSavedServerHashRef: MutableRefObject<string>;
  persistCuesToServer: PersistCuesToServerFn;
};

export type UseGlobalDropIntakeParams = {
  subtitleFileId: string;
  cuesLength: number;
  mediaSourceUrl: string | null;
  sanitizeSubtitleFileId: (raw: string | null | undefined) => string;
  applyDroppedSrtFile: (file: File) => Promise<void>;
  queueLocalMediaFromFiles: (files: File[]) => boolean;
};

export type UseWaveformCanvasOverlayParams = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  currentPlaybackMsRef: MutableRefObject<number>;
  waveformDurationSec: number | null;
  waveformViewport: WaveformViewportMetrics | null;
  enabled: boolean;
};

export type UseCueEditorNavigationParams = {
  cues: CueDto[];
  editingCueIndex: number;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  updateCue: (
    cueTempId: string,
    patch: Partial<Pick<CueDto, "startMs" | "endMs" | "text">>,
  ) => void;
  onBeforeCommitCueText?: (cueTempId: string) => void;
  seekPlayerToCue: (startMs: number) => void;
  scrollWaveformToCueStart: (startMs: number) => void;
  focusCueCardInList: (tempId: string) => void;
};

export type BindPanSeekHandlers = (params: {
  waveSurfer: WaveSurfer;
  suppressWaveformInteractionUntilRef: MutableRefObject<number>;
  suppressPlayheadFollowUntilRef: MutableRefObject<number>;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformOverviewDragRef: MutableRefObject<WaveformOverviewDragRefState>;
  scheduleViewportRefresh: () => void;
}) => () => void;

export type UseWaveformLifecycleParams = {
  waveformEnabled: boolean;
  localWaveformData: LocalWaveformData | null;
  bindPanSeekHandlers: BindPanSeekHandlers;
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  wavPath: string | null;
  waveformPx: number;
  waveformMinPxPerSec: number;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformCueOverlayHostRef: MutableRefObject<HTMLDivElement | null>;
  waveformViewportLastRef: MutableRefObject<WaveformViewport>;
  scheduleViewportRefreshRef: MutableRefObject<(() => void) | null>;
  waveformOverviewDragRef: MutableRefObject<WaveformOverviewDragRefState>;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  suppressWaveformInteractionUntilRef: MutableRefObject<number>;
  suppressPlayheadFollowUntilRef: MutableRefObject<number>;
  audioRouteFallbackTriedRef: MutableRefObject<boolean>;
  setWaveformDurationSec: Dispatch<SetStateAction<number | null>>;
  setWaveformCueOverlayHostEl: Dispatch<SetStateAction<HTMLElement | null>>;
  setWaveformViewport: Dispatch<SetStateAction<WaveformViewport>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMediaSourceUrl: Dispatch<SetStateAction<string | null>>;
  seekPlaybackToTimeSec: (nextTimeSec: number) => void;
  logBrowserError: (context: string, error: unknown) => void;
  normalizeBrowserMediaPath: (raw: string | null | undefined) => string | null;
  injectWaveformCueShadowStyles: (rootNode: Node) => void;
};

export type UseWaveformCueDragParams<TCue extends CueWaveformDragCue> = {
  waveformDurationSecRef: RefObject<number | null>;
  waveSurferRef: RefObject<WaveSurfer | null>;
  minGapMs: number;
  setSelectedCueTempId: (tempId: string) => void;
  setCueEditFocusTempId: (updater: (prev: string | null) => string | null) => void;
  suppressWaveformInteractionUntilRef: RefObject<number>;
  updateCue: (cueTempId: string, patch: Partial<Pick<TCue, "startMs" | "endMs">>) => void;
  getCueNeighborBounds: (cueTempId: string) => {
    prevEndMs: number;
    nextStartMs: number;
  };
  takeCuesSnapshotForUndo?: () => TCue[];
  commitTimingUndo?: (snapshotBeforeDrag: TCue[], label: string) => void;
};

export type UsePlaybackSyncParams = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  isWaveformSeekingRef: MutableRefObject<boolean>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  scheduleViewportRefreshRef: MutableRefObject<(() => void) | null>;
  waveformOverviewDragRef: MutableRefObject<WaveformOverviewDragRefState>;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformPanDragRef?: MutableRefObject<unknown>;
  suppressPlayheadFollowUntilRef: MutableRefObject<number>;
};

export type BindPanSeekParams = {
  waveSurfer: WaveSurfer;
  suppressWaveformInteractionUntilRef: RefObject<number>;
  suppressPlayheadFollowUntilRef: RefObject<number>;
  waveformEdgeDragRef: RefObject<unknown>;
  waveformMoveDragRef: RefObject<unknown>;
  waveformOverviewDragRef: RefObject<WaveformOverviewDragRefState>;
  scheduleViewportRefresh: () => void;
};

export type UseMediaPlaybackControlsParams = {
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  playbackRateRef: MutableRefObject<number>;
  isWaveformSeekingRef: MutableRefObject<boolean>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
  logBrowserError: (context: string, error: unknown) => void;
};
