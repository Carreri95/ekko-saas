"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import WaveSurfer from "wavesurfer.js";

import { parseSrt } from "@/src/lib/srt/parse-srt";
import { CueListItem } from "./components/cue-list-item";
import { CueTextEditor } from "./components/cue-text-editor";
import { MediaPreviewPanel } from "./components/media-preview-panel";
import { TimelineDock } from "./components/timeline-dock";
import { WaveformContextMenu } from "./components/waveform-context-menu";
import { UploadScreen } from "./components/upload-screen";
import { useWaveformCueDrag } from "./hooks/use-waveform-cue-drag";
import { useWaveformPanSeek } from "./hooks/use-waveform-pan-seek";
import { useAutoSave } from "./hooks/use-auto-save";
import { usePlaybackSync } from "./hooks/use-playback-sync";
import { useCueListAutoScroll } from "./hooks/use-cue-list-auto-scroll";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useUndoHistory } from "./hooks/use-undo-history";
import { useWaveformLifecycle } from "./hooks/use-waveform-lifecycle";
import { useCueEditorNavigation } from "./hooks/use-cue-editor-navigation";
import { useMediaPlaybackControls } from "./hooks/use-media-playback-controls";
import { useMediaSessionControls } from "./hooks/use-media-session-controls";
import { useWaveformOverviewDrag } from "./hooks/use-waveform-overview-drag";
import { useWaveformCanvasOverlay } from "./hooks/use-waveform-canvas-overlay";
import { useWaveformCueCreate } from "./hooks/use-waveform-cue-create";
import { useLocalMediaSrtIntake } from "./hooks/use-local-media-srt-intake";
import { useCuePersistence } from "./hooks/use-cue-persistence";
import { useGlobalDropIntake } from "./hooks/use-global-drop-intake";
import { buildCueWaveformRegions } from "./lib/waveform-time";
import {
  getCueProblems,
} from "@/app/subtitle-file-edit/lib/cue-problems";
import {
  autoBrText,
  computeCueCps,
  CPS_WARN_ABOVE,
  createTempId,
  getSaveCueHash,
  normalizeCueCollisions,
  reindexCues,
  splitCueTextAtTemporalRatio,
  toSaveCuePayload,
  validateCuesForSave,
} from "@/app/subtitle-file-edit/lib/cue-utils";
import { formatPlaybackTime } from "@/app/subtitle-file-edit/lib/format-time";
import {
  scrollCueIntoListPanel,
} from "@/app/subtitle-file-edit/lib/dom-utils";
import type {
  AspectRatio,
  CueDto,
  LocalWaveformData,
  ProblemFilter,
  SubtitleFileResponse,
  WaveformContextMenuOpenState,
  WaveformOverviewDragRefState,
  WaveformViewport,
} from "./types";
import { PageShell } from "@/app/components/page-shell";
import { useSidebarDisplay } from "@/app/components/sidebar-display-context";
import { injectWaveformCueShadowStyles } from "./waveformCueShadowStyles";

/** Duração mínima (ms) entre início e fim ao arrastar bordas na waveform. */
const WAVEFORM_DRAG_MIN_GAP_MS = 40;
const WAVEFORM_MIN_PX_PER_SEC = 48;

const SPEED_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

function sanitizeSubtitleFileId(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  // Evita placeholders comuns como "<ID>" que quebram as rotas de API.
  if (/^<[^>]+>$/.test(trimmed)) return "";
  return trimmed;
}

function normalizeBrowserMediaPath(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (/^(blob:|data:|https?:\/\/)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return null;
  const withoutPublic = trimmed
    .replace(/^web[\\/]+public[\\/]+/i, "")
    .replace(/^public[\\/]+/i, "")
    .replace(/[\\/]+/g, "/");
  return `/${withoutPublic.replace(/^\/+/, "")}`;
}

function logBrowserError(context: string, error: unknown): void {
  console.error(`[subtitle-file-edit] ${context}`, error);
}

/** Foco em controles onde Espaço deve manter o comportamento nativo (texto, botão, link, etc.). */
function isSpaceReservedForFocusedElement(target: EventTarget | null): boolean {
  const active = target instanceof HTMLElement ? target : document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "select" ||
    tag === "textarea" ||
    active.isContentEditable
  );
}

export default function SubtitleFileEditPage() {
  const mediaElementRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(
    null,
  );
  const cueListScrollRef = useRef<HTMLDivElement | null>(null);
  const cueItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastAutoScrollAtRef = useRef(0);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const waveformCueOverlayHostRef = useRef<HTMLDivElement | null>(null);
  const waveformDurationSecRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const lastSavedServerHashRef = useRef("");
  const audioRouteFallbackTriedRef = useRef(false);
  const waveformOverviewDragRef = useRef<WaveformOverviewDragRefState>(null);
  const suppressWaveformInteractionUntilRef = useRef(0);
  /** Enquanto `performance.now()` < valor, não forçar scroll a seguir o playhead (scroll manual). */
  const suppressPlayheadFollowUntilRef = useRef(0);
  const cueSingleClickTimerRef = useRef(0);
  const waveformViewportLastRef = useRef<WaveformViewport>(null);
  const scheduleViewportRefreshRef = useRef<(() => void) | null>(null);
  const isWaveformSeekingRef = useRef(false);
  const currentPlaybackMsRef = useRef(0);
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const { setEditorFilename } = useSidebarDisplay();
  const [wavFilename, setWavFilename] = useState<string | null>(null);
  const [wavPath, setWavPath] = useState<string | null>(null);
  const [cues, setCues] = useState<CueDto[]>([]);
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const { pushHistory, undo } = useUndoHistory();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [exporting] = useState(false);
  const [filterMode] = useState<ProblemFilter>("all");
  const [localWaveformData, setLocalWaveformData] = useState<LocalWaveformData | null>(
    null,
  );
  const [mediaSourceUrl, setMediaSourceUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"video" | "audio" | null>(null);
  const [playerAspectRatio, setPlayerAspectRatio] = useState<AspectRatio>("16:9");
  const [currentPlaybackMs, setCurrentPlaybackMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const playbackRateRef = useRef(1.0);
  /** Duração do ficheiro de áudio (s) — para desenhar cues na timeline da waveform. */
  const [waveformDurationSec, setWaveformDurationSec] = useState<number | null>(
    null,
  );
  /** Cue escolhida manualmente (lista ou waveform) — distinta da cue “ativa” pelo playhead. */
  const [selectedCueTempId, setSelectedCueTempId] = useState<string | null>(
    null,
  );
  /** Duplo clique na lista ou na região: modo explícito de trabalho nessa cue (estilo Subtitle Edit). */
  const [cueEditFocusTempId, setCueEditFocusTempId] = useState<string | null>(
    null,
  );
  const [editingCueTempId, setEditingCueTempId] = useState<string | null>(null);
  /** Evita `pushHistory` em cada tecla quando o texto é atualizado em tempo real no editor. */
  const textEditUndoBaselineTempIdRef = useRef<string | null>(null);
  useEffect(() => {
    textEditUndoBaselineTempIdRef.current = null;
  }, [editingCueTempId]);

  /** Host DOM dentro do wrapper do WaveSurfer para alinhar regiões de cue ao zoom. */
  const [waveformCueOverlayHostEl, setWaveformCueOverlayHostEl] =
    useState<HTMLElement | null>(null);
  const emptySrtInputRef = useRef<HTMLInputElement | null>(null);
  const emptyAudioInputRef = useRef<HTMLInputElement | null>(null);
  const [srtDropActive, setSrtDropActive] = useState(false);
  const [audioDropActive, setAudioDropActive] = useState(false);
  /** Vista geral da faixa (scroll) — barra por baixo da waveform. */
  const [waveformViewport, setWaveformViewport] = useState<WaveformViewport>(null);

  /** Menu de contexto na waveform (split) — portal em document.body. */
  const [waveformContextMenu, setWaveformContextMenu] = useState<
    WaveformContextMenuOpenState | null
  >(null);

  const hasServerSubtitleFile = sanitizeSubtitleFileId(subtitleFileId) !== "";
  const isEditorReady =
    hasServerSubtitleFile || (cues.length > 0 && mediaSourceUrl !== null);
  const waveformEnabled = mediaKind === "audio" && mediaSourceUrl !== null && isEditorReady;

  useEffect(() => {
    if (!error) return;
    console.error("[subtitle-file-edit][ui-error]", error);
  }, [error]);

  const { bindPanSeekHandlers } = useWaveformPanSeek();

  useEffect(() => {
    const rawId = new URLSearchParams(window.location.search).get(
      "subtitleFileId",
    );
    const id = sanitizeSubtitleFileId(rawId);
    if (id) {
      setSubtitleFileId(id);
      return;
    }
    if (rawId && /^<[^>]+>$/.test(rawId.trim())) {
      setError(
        "ID inválido na URL (placeholder). Use um subtitleFileId real ou carregue SRT/áudio local.",
      );
    }
  }, []);

  /** Carrega legenda e metadados do servidor quando há `?subtitleFileId=` na URL. */
  useEffect(() => {
    const id = sanitizeSubtitleFileId(subtitleFileId);
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/subtitle-files/${encodeURIComponent(id)}`);
        const json = (await res.json()) as SubtitleFileResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? `Erro ${res.status}`);
        }
        if (cancelled) return;

        const mapped: CueDto[] = json.cues.map((c) => {
          const sid = c.id ?? createTempId();
          return {
            id: c.id,
            tempId: sid,
            cueIndex: c.cueIndex,
            startMs: c.startMs,
            endMs: c.endMs,
            text: c.text,
          };
        });
        const normalized = normalizeCueCollisions(mapped, WAVEFORM_DRAG_MIN_GAP_MS);
        setCues(normalized);
        setFilename(json.filename);
        setWavFilename(json.wavFilename);
        setWavPath(json.wavPath);
        setMediaSourceUrl(`/api/subtitle-files/${encodeURIComponent(id)}/audio`);
        setMediaKind("audio");
        setLocalWaveformData(null);
        lastSavedServerHashRef.current = getSaveCueHash(normalized);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subtitleFileId]);

  useEffect(() => {
    setEditorFilename(filename);
  }, [filename, setEditorFilename]);

  useEffect(() => {
    return () => setEditorFilename(null);
  }, [setEditorFilename]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("subtitlebot-player-ratio");
      if (saved === "16:9" || saved === "9:16" || saved === "1:1") {
        setPlayerAspectRatio(saved);
      }
    } catch (error) {
      logBrowserError("localStorage get subtitlebot-player-ratio", error);
      /* ignore localStorage errors */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("subtitlebot-player-ratio", playerAspectRatio);
    } catch (error) {
      logBrowserError("localStorage set subtitlebot-player-ratio", error);
      /* ignore localStorage errors */
    }
  }, [playerAspectRatio]);

  useEffect(() => {
    currentPlaybackMsRef.current = currentPlaybackMs;
  }, [currentPlaybackMs]);

  useEffect(() => {
    return () => {
      if (cueSingleClickTimerRef.current) {
        window.clearTimeout(cueSingleClickTimerRef.current);
        cueSingleClickTimerRef.current = 0;
      }
    };
  }, []);

  /** Reaplica scroll para #âncora quando o conteúdo carrega. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [subtitleFileId, cues.length, loading]);

  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, [mediaSourceUrl]);

  /** Altura da waveform (px) — alinhada à altura real do mount via ResizeObserver. */
  const [waveformPx, setWaveformPx] = useState(220);

  useEffect(() => {
    const el = waveformContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (h: number) => {
      if (h < 1) return;
      const next = Math.max(48, Math.floor(h));
      setWaveformPx((prev) =>
        Math.abs(prev - next) < 2 ? prev : next,
      );
    };
    apply(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      apply(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mediaSourceUrl, mediaKind]);

  const {
    seekPlaybackToTimeSec,
    seekPlaybackFromWaveClientX,
    scrollWaveformToCueStart,
    ensureWaveformPlayheadVisible,
    seekPlayerToCue,
    playMedia,
    pauseMedia,
    resetMediaToStart,
    handleMediaTimeUpdate,
  } = useMediaPlaybackControls({
    mediaElementRef,
    waveSurferRef,
    playbackRateRef,
    isWaveformSeekingRef,
    setCurrentPlaybackMs,
    logBrowserError,
  });

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    playbackRateRef.current = rate;
    const media = mediaElementRef.current;
    if (!media) return;
    media.playbackRate = rate;
    media.defaultPlaybackRate = rate;
  }, []);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const el = mediaElementRef.current;
    if (!el || !mediaSourceUrl) return;
    el.playbackRate = playbackRate;
    el.defaultPlaybackRate = playbackRate;
  }, [mediaSourceUrl, mediaKind, playbackRate]);

  useWaveformCanvasOverlay({
    canvasRef: waveformCanvasOverlayRef,
    waveSurferRef,
    waveformContainerRef,
    currentPlaybackMsRef,
    waveformDurationSec,
    waveformViewport,
    enabled: waveformEnabled,
  });

  useEffect(() => {
    waveformDurationSecRef.current = waveformDurationSec;
  }, [waveformDurationSec]);

  /** Reforço: metadata do elemento audio se o ready da waveform atrasar. */
  useEffect(() => {
    const el = mediaElementRef.current;
    if (!el || mediaKind !== "audio" || !mediaSourceUrl) return;
    const node = el;

    function syncFromElement() {
      const ws = waveSurferRef.current;
      const wsDur = ws?.getDuration();
      if (typeof wsDur === "number" && Number.isFinite(wsDur) && wsDur > 0) {
        const wsDurNum = Number(wsDur);
        setWaveformDurationSec((prev) => {
          if (prev != null && Math.abs(prev - wsDurNum) < 0.01) return prev;
          return wsDurNum;
        });
        return;
      }
      const d = node.duration;
      if (Number.isFinite(d) && d > 0) {
        setWaveformDurationSec(d);
      }
    }

    node.addEventListener("loadedmetadata", syncFromElement);
    node.addEventListener("durationchange", syncFromElement);
    syncFromElement();

    return () => {
      node.removeEventListener("loadedmetadata", syncFromElement);
      node.removeEventListener("durationchange", syncFromElement);
    };
  }, [mediaSourceUrl, mediaKind]);

  const hasInvalidCue = useMemo(
    () =>
      cues.some(
        (cue) =>
          !Number.isFinite(cue.startMs) ||
          !Number.isFinite(cue.endMs) ||
          cue.startMs >= cue.endMs,
      ),
    [cues],
  );

  const cueProblemsList = useMemo(
    () =>
      cues.map((cue, index) => ({
        cue,
        problems: getCueProblems(cues, index),
      })),
    [cues],
  );

  const problematicCount = useMemo(
    () => cueProblemsList.filter((item) => item.problems.length > 0).length,
    [cueProblemsList],
  );
  const highCpsCount = useMemo(
    () =>
      cues.reduce((count, cue) => {
        const cps = computeCueCps(cue.text, cue.startMs, cue.endMs);
        return cps > CPS_WARN_ABOVE ? count + 1 : count;
      }, 0),
    [cues],
  );

  const visibleCueProblemsList = useMemo(
    () =>
      filterMode === "all"
        ? cueProblemsList
        : cueProblemsList.filter((item) => {
            if (filterMode === "problematic") {
              return item.problems.length > 0;
            }
            if (filterMode === "invalid-time") {
              return item.problems.some((problem) =>
                problem.startsWith("startMs >="),
              );
            }
            if (filterMode === "empty-text") {
              return item.problems.some((problem) => problem === "texto vazio");
            }
            if (filterMode === "overlap") {
              return item.problems.some((problem) =>
                problem.startsWith("overlap"),
              );
            }
            if (filterMode === "short-duration") {
              return item.problems.some((problem) =>
                problem.startsWith("duração curta"),
              );
            }
            if (filterMode === "long-duration") {
              return item.problems.some((problem) =>
                problem.startsWith("duração longa"),
              );
            }
            return false;
          }),
    [cueProblemsList, filterMode],
  );

  const activeCueTempId = useMemo(() => {
    const activeCue = cues.find(
      (cue) =>
        currentPlaybackMs >= cue.startMs && currentPlaybackMs < cue.endMs,
    );
    return activeCue?.tempId ?? null;
  }, [cues, currentPlaybackMs]);

  const activeCueText = useMemo(() => {
    if (!activeCueTempId) return "";
    const cue = cues.find((item) => item.tempId === activeCueTempId);
    return cue?.text?.trim() ?? "";
  }, [cues, activeCueTempId]);

  const activeCueInfoForPreview = useMemo(() => {
    if (!activeCueTempId) return null;
    const cue = cues.find((item) => item.tempId === activeCueTempId);
    if (!cue) return null;
    return {
      cueIndex: cue.cueIndex,
      startMs: cue.startMs,
      endMs: cue.endMs,
      cps: computeCueCps(cue.text, cue.startMs, cue.endMs),
    };
  }, [cues, activeCueTempId]);

  const editingCueIndex = useMemo(
    () => (editingCueTempId ? cues.findIndex((cue) => cue.tempId === editingCueTempId) : -1),
    [cues, editingCueTempId],
  );
  const editingCue = editingCueIndex >= 0 ? cues[editingCueIndex] : null;

  /** Posição das cues na barra temporal da waveform (px), ancorada em timecode. */
  const cueWaveformRegions = useMemo(() => {
    return buildCueWaveformRegions(
      cues,
      waveformDurationSec,
      waveformViewport?.totalW ?? null,
      (index) => getCueProblems(cues, index).length > 0,
    );
  }, [cues, waveformDurationSec, waveformViewport]);

  const waveformGridStyle = useMemo(() => {
    const minorStepPx = Math.max(6, Math.round(WAVEFORM_MIN_PX_PER_SEC / 10));
    const majorStepPx = minorStepPx * 10;
    return {
      "--wave-grid-major-step": `${majorStepPx}px`,
      "--wave-grid-minor-step": `${minorStepPx}px`,
    } as CSSProperties;
  }, []);

  const prevCueCountRef = useRef(0);

  useEffect(() => {
    if (
      selectedCueTempId &&
      !cues.some((c) => c.tempId === selectedCueTempId)
    ) {
      setSelectedCueTempId(null);
      setCueEditFocusTempId(null);
    }
  }, [cues, selectedCueTempId]);

  useEffect(() => {
    if (!selectedCueTempId) setCueEditFocusTempId(null);
  }, [selectedCueTempId]);

  useEffect(() => {
    if (
      cueEditFocusTempId &&
      !cues.some((c) => c.tempId === cueEditFocusTempId)
    ) {
      setCueEditFocusTempId(null);
    }
  }, [cues, cueEditFocusTempId]);

  useEffect(() => {
    if (editingCueTempId && !cues.some((c) => c.tempId === editingCueTempId)) {
      setEditingCueTempId(null);
    }
  }, [cues, editingCueTempId]);

  useEffect(() => {
    const prevCount = prevCueCountRef.current;
    if (prevCount === 0 && cues.length > 0) {
      const firstCue = cues[0];
      setSelectedCueTempId(firstCue.tempId);
      setCueEditFocusTempId(null);
      setEditingCueTempId(null);
    }
    prevCueCountRef.current = cues.length;
  }, [cues]);

  function focusCueCardInList(tempId: string) {
    requestAnimationFrame(() => {
      const el = cueItemRefs.current[tempId];
      const panel = cueListScrollRef.current;
      if (el && panel) {
        scrollCueIntoListPanel(el, panel);
      }
      window.setTimeout(() => {
        el?.focus({ preventScroll: true });
      }, 320);
    });
  }

  const handleWaveformCueContextMenu = useCallback(
    (e: ReactMouseEvent, cue: CueDto) => {
      e.preventDefault();
      const clientX = e.clientX;
      const regionEl = e.currentTarget as HTMLElement;
      const rect = regionEl.getBoundingClientRect();
      let splitMs = Math.round((cue.startMs + cue.endMs) / 2);
      let canSplit = false;
      if (rect.width > 0) {
        const ratio = Math.max(
          0,
          Math.min(1, (clientX - rect.left) / rect.width),
        );
        splitMs = Math.round(
          cue.startMs + ratio * (cue.endMs - cue.startMs),
        );
        canSplit =
          splitMs - cue.startMs >= WAVEFORM_DRAG_MIN_GAP_MS &&
          cue.endMs - splitMs >= WAVEFORM_DRAG_MIN_GAP_MS;
      }
      setWaveformContextMenu({
        x: e.clientX,
        y: e.clientY,
        cue,
        splitMs,
        canSplit,
        canAddText: cue.text.trim() === "",
      });
    },
    [],
  );

  const handleWaveformAddTextToCue = useCallback((cue: CueDto) => {
    setSelectedCueTempId(cue.tempId);
    setCueEditFocusTempId(cue.tempId);
    setEditingCueTempId(cue.tempId);
    focusCueCardInList(cue.tempId);
    setWaveformContextMenu(null);
  }, []);

  const handleWaveformSplitCue = useCallback(
    (cue: CueDto, splitMs: number) => {
      if (splitMs - cue.startMs < WAVEFORM_DRAG_MIN_GAP_MS) return;
      if (cue.endMs - splitMs < WAVEFORM_DRAG_MIN_GAP_MS) return;
      pushHistory(cuesRef.current.map((c) => ({ ...c })), `Split cue #${cue.cueIndex}`);
      setCues((prev) => {
        const idx = prev.findIndex((c) => c.tempId === cue.tempId);
        if (idx < 0) return prev;
        const next = [...prev];
        const { textA, textB } = splitCueTextAtTemporalRatio(cue, splitMs);
        const cueA: CueDto = {
          ...cue,
          endMs: splitMs,
          text: autoBrText(textA),
        };
        const cueB: CueDto = {
          ...cue,
          startMs: splitMs,
          tempId: createTempId(),
          id: null,
          text: autoBrText(textB),
        };
        next.splice(idx, 1, cueA, cueB);
        return reindexCues(next);
      });
      setWaveformContextMenu(null);
    },
    [pushHistory],
  );

  const handleDeleteCueFromContext = useCallback(
    (cue: CueDto) => {
      pushHistory(
        cuesRef.current.map((c) => ({ ...c })),
        `Deletar cue #${cue.cueIndex}`,
      );
      setCues((prev) =>
        reindexCues(prev.filter((c) => c.tempId !== cue.tempId)),
      );
      setSelectedCueTempId((prev) =>
        prev === cue.tempId ? null : prev,
      );
      setCueEditFocusTempId((prev) =>
        prev === cue.tempId ? null : prev,
      );
      setEditingCueTempId((prev) =>
        prev === cue.tempId ? null : prev,
      );
      setWaveformContextMenu(null);
    },
    [pushHistory],
  );

  useEffect(() => {
    if (!waveformContextMenu) return;
    function onMouseDown(ev: globalThis.MouseEvent) {
      const t = ev.target;
      if (t instanceof Element && t.closest("[data-waveform-context-menu]")) {
        return;
      }
      setWaveformContextMenu(null);
    }
    function onKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") setWaveformContextMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [waveformContextMenu]);

  useCueListAutoScroll({
    activeCueTempId,
    selectedCueTempId,
    mediaElementRef,
    lastAutoScrollAtRef,
    cueItemRefs,
    cueListScrollRef,
  });

  function getCueNeighborBounds(cueTempId: string) {
    const idx = cues.findIndex((cue) => cue.tempId === cueTempId);
    if (idx < 0) {
      return { prevEndMs: 0, nextStartMs: Number.POSITIVE_INFINITY };
    }
    const prevEndMs = idx > 0 ? cues[idx - 1].endMs : 0;
    const nextStartMs =
      idx < cues.length - 1 ? cues[idx + 1].startMs : Number.POSITIVE_INFINITY;
    return { prevEndMs, nextStartMs };
  }

  function updateCue(
    cueTempId: string,
    patch: Partial<Pick<CueDto, "startMs" | "endMs" | "text">>,
  ) {
    setCues((prev) => {
      const idx = prev.findIndex((cue) => cue.tempId === cueTempId);
      if (idx < 0) return prev;
      const cue = prev[idx];
      const prevEnd = idx > 0 ? prev[idx - 1].endMs : 0;
      const nextStart =
        idx < prev.length - 1 ? prev[idx + 1].startMs : Number.POSITIVE_INFINITY;
      const room = nextStart - prevEnd;
      if (room < WAVEFORM_DRAG_MIN_GAP_MS) return prev;

      let startMs = Math.max(0, patch.startMs ?? cue.startMs);
      let endMs = Math.max(0, patch.endMs ?? cue.endMs);
      const text = patch.text ?? cue.text;

      startMs = Math.max(startMs, prevEnd);
      endMs = Math.min(endMs, nextStart);

      if (endMs - startMs < WAVEFORM_DRAG_MIN_GAP_MS) {
        if (patch.startMs != null && patch.endMs == null) {
          startMs = Math.max(prevEnd, endMs - WAVEFORM_DRAG_MIN_GAP_MS);
        } else {
          endMs = Math.min(nextStart, startMs + WAVEFORM_DRAG_MIN_GAP_MS);
        }
      }
      if (endMs - startMs < WAVEFORM_DRAG_MIN_GAP_MS) {
        return prev;
      }

      if (
        startMs === cue.startMs &&
        endMs === cue.endMs &&
        text === cue.text
      ) {
        return prev;
      }

      const next = [...prev];
      next[idx] = { ...cue, startMs, endMs, text };
      return next;
    });
  }

  const takeCuesSnapshotForUndo = useCallback(
    () => cuesRef.current.map((c) => ({ ...c })),
    [],
  );

  const commitTimingUndo = useCallback(
    (snapshot: CueDto[], label: string) => {
      pushHistory(snapshot, label);
    },
    [pushHistory],
  );

  const {
    waveformEdgeDragRef,
    waveformMoveDragRef,
    waveformEdgeDrag,
    waveformMoveDrag,
    handleWaveformEdgePointerDown,
    handleWaveformEdgePointerMove,
    handleWaveformEdgePointerEnd,
    handleWaveformMovePointerDown,
    handleWaveformMovePointerMove,
    handleWaveformMovePointerEnd,
  } = useWaveformCueDrag<CueDto>({
    waveformDurationSecRef,
    waveSurferRef,
    minGapMs: WAVEFORM_DRAG_MIN_GAP_MS,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    suppressWaveformInteractionUntilRef,
    updateCue,
    getCueNeighborBounds,
    takeCuesSnapshotForUndo,
    commitTimingUndo,
  });

  usePlaybackSync({
    mediaSourceUrl,
    mediaKind,
    mediaElementRef,
    isWaveformSeekingRef,
    setCurrentPlaybackMs,
    waveSurferRef,
    scheduleViewportRefreshRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    suppressPlayheadFollowUntilRef,
  });

  const onBeforeCommitCueText = useCallback(
    (cueTempId: string) => {
      if (textEditUndoBaselineTempIdRef.current === cueTempId) return;
      textEditUndoBaselineTempIdRef.current = cueTempId;
      const cue = cuesRef.current.find((c) => c.tempId === cueTempId);
      if (cue) {
        pushHistory(
          cuesRef.current.map((c) => ({ ...c })),
          `Editar texto cue #${cue.cueIndex}`,
        );
      }
    },
    [pushHistory],
  );

  useKeyboardShortcuts({
    mediaElementRef,
    currentPlaybackMsRef,
    seekPlaybackToTimeSec,
    ensureWaveformPlayheadVisible,
    logBrowserError,
    isSpaceReservedForFocusedElement,
    editingCueTempId,
    setEditingCueTempId,
    undo,
    setCues,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    setSaveSuccess,
  });

  useWaveformLifecycle({
    waveformEnabled,
    localWaveformData,
    bindPanSeekHandlers,
    mediaSourceUrl,
    mediaKind,
    wavPath,
    waveformPx,
    waveformContainerRef,
    mediaElementRef,
    waveSurferRef,
    waveformMinPxPerSec: WAVEFORM_MIN_PX_PER_SEC,
    waveformCueOverlayHostRef,
    waveformViewportLastRef,
    scheduleViewportRefreshRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    suppressWaveformInteractionUntilRef,
    suppressPlayheadFollowUntilRef,
    audioRouteFallbackTriedRef,
    setWaveformDurationSec,
    setWaveformCueOverlayHostEl,
    setWaveformViewport,
    setError,
    setMediaSourceUrl,
    seekPlaybackToTimeSec,
    logBrowserError,
    normalizeBrowserMediaPath,
    injectWaveformCueShadowStyles,
  });

  const { persistCuesToServer } = useCuePersistence({
    subtitleFileId,
    cues,
    minGapMs: WAVEFORM_DRAG_MIN_GAP_MS,
    autoSaveInFlightRef,
    lastSavedServerHashRef,
    sanitizeSubtitleFileId,
    validateCuesForSave,
    toSaveCuePayload,
    normalizeCueCollisions,
    getSaveCueHash,
    logBrowserError,
    setSaving,
    setError,
    setSaveSuccess,
    setCues,
  });

  useAutoSave({
    subtitleFileId,
    cues,
    loading,
    autoSaveTimerRef,
    autoSaveInFlightRef,
    lastSavedServerHashRef,
    persistCuesToServer,
  });

  const { clearMedia: clearMediaInner, resetPlaybackToStart: resetPlaybackInner } =
    useMediaSessionControls({
      mediaElementRef,
      waveSurferRef,
      scheduleViewportRefreshRef,
      setLocalWaveformData,
      setMediaSourceUrl,
      setMediaKind,
      setCurrentPlaybackMs,
    });

  const clearMedia = useCallback(() => {
    setPlaybackRate(1);
    playbackRateRef.current = 1;
    const m = mediaElementRef.current;
    if (m) {
      m.playbackRate = 1;
      m.defaultPlaybackRate = 1;
    }
    clearMediaInner();
  }, [clearMediaInner]);

  const resetPlaybackToStart = useCallback(() => {
    setPlaybackRate(1);
    playbackRateRef.current = 1;
    const m = mediaElementRef.current;
    if (m) {
      m.playbackRate = 1;
      m.defaultPlaybackRate = 1;
    }
    resetPlaybackInner();
  }, [resetPlaybackInner]);

  function toCueDtoListFromSrtText(text: string): CueDto[] {
    const parsed = parseSrt(text);
    return normalizeCueCollisions(
      parsed.map((c) => ({
        id: null,
        tempId: createTempId(),
        cueIndex: c.cueIndex,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
      })),
      WAVEFORM_DRAG_MIN_GAP_MS,
    );
  }

  const {
    applyLocalMediaFile,
    queueLocalMediaFromFiles,
    applyDroppedSrtFile,
    handleEmptySrtDrop,
    handleEmptyAudioDrop,
  } = useLocalMediaSrtIntake({
    setLocalWaveformData,
    setMediaSourceUrl,
    setMediaKind,
    setCurrentPlaybackMs,
    setError,
    setSaveSuccess,
    setCues,
    setFilename,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    setEditingCueTempId,
    setSrtDropActive,
    setAudioDropActive,
    toCueDtoListFromSrtText,
    resetPlaybackToStart,
    logBrowserError,
  });

  useGlobalDropIntake({
    subtitleFileId,
    cuesLength: cues.length,
    mediaSourceUrl,
    sanitizeSubtitleFileId,
    applyDroppedSrtFile,
    queueLocalMediaFromFiles,
  });

  function shouldIgnoreCueClick(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, button, select, label, a"));
  }

  const { handleEditorCommitText, handleEditorNavigate } = useCueEditorNavigation({
    cues,
    editingCueIndex,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    setEditingCueTempId,
    updateCue,
    onBeforeCommitCueText: onBeforeCommitCueText,
    seekPlayerToCue,
    scrollWaveformToCueStart,
    focusCueCardInList,
  });

  const { handleWaveformOverviewPointerDown } = useWaveformOverviewDrag({
    suppressPlayheadFollowUntilRef,
    waveSurferRef,
    waveformViewport,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    waveformOverviewDragRef,
    logBrowserError,
  });

  const { cueCreatePreviewRect, onWaveformShellPointerDownCapture } =
    useWaveformCueCreate({
      waveSurferRef,
      waveformDurationSec,
      waveformTotalWidthPx: waveformViewport?.totalW ?? null,
      cues,
      setCues,
      setSelectedCueTempId,
      minGapMs: WAVEFORM_DRAG_MIN_GAP_MS,
      seekPlaybackFromWaveClientX,
      waveformEdgeDragRef,
      waveformMoveDragRef,
      waveformOverviewDragRef,
      pushHistory,
    });

  const hasEditorContent =
    hasServerSubtitleFile || cues.length > 0 || mediaSourceUrl !== null;
  const srtLoadedOnly = cues.length > 0 && mediaSourceUrl === null && !hasServerSubtitleFile;

  /** Modo do workspace: só o rail e blocos condicionais devem depender disto. */
  const editorWorkspaceMode: "empty" | "local" | "remote" = !hasEditorContent
    ? "empty"
    : hasServerSubtitleFile
      ? "remote"
      : "local";

  const cuePanelRatioClass =
    playerAspectRatio === "9:16"
      ? "lg:basis-[60%]"
      : playerAspectRatio === "1:1"
        ? "lg:basis-[55%]"
        : "lg:basis-1/2";
  const previewPanelRatioClass =
    playerAspectRatio === "9:16"
      ? "lg:basis-[40%]"
      : playerAspectRatio === "1:1"
        ? "lg:basis-[45%]"
        : "lg:basis-1/2";

  const pageShellSubtitle =
    filename != null && filename.trim() !== ""
      ? `· ${filename.length > 52 ? `${filename.slice(0, 49)}…` : filename}`
      : undefined;

  return (
    <PageShell
      title="Editor"
      subtitle={pageShellSubtitle}
      section="editor"
      noScroll
    >
    <main className="mvp-page editor-desktop-page flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="editor-desktop-shell flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        <>
        {hasEditorContent || loading ? (
        <div className="editor-desktop-toolbar shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-medium text-[var(--text-primary)]"
                title={filename ?? undefined}
              >
                {filename ?? "—"}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
                {cues.length} cues
                {wavFilename ? ` · ${wavFilename}` : ""}
              </p>
            </div>
          </div>
          <div className="mvp-state-row mt-2">
            {loading ? (
              <span className="mvp-state-badge mvp-state-badge--loading">
                carregando legenda
              </span>
            ) : null}
            {saving ? (
              <span className="mvp-state-badge mvp-state-badge--loading">
                salvando alteracoes
              </span>
            ) : null}
            {exporting ? (
              <span className="mvp-state-badge mvp-state-badge--loading">
                exportando
              </span>
            ) : null}
            {saveSuccess ? (
              <span className="mvp-state-badge mvp-state-badge--success">
                salvamento concluido
              </span>
            ) : null}
            {error ? (
              <span className="mvp-state-badge mvp-state-badge--error">
                erro na operacao
              </span>
            ) : null}
          </div>
        </div>
        ) : null}

        {error ? (
          <pre className="mvp-feedback-error max-h-28 shrink-0 overflow-auto whitespace-pre-wrap font-mono text-xs shadow-sm">
            {error}
          </pre>
        ) : null}

        {saveSuccess ? (
          <pre className="mvp-feedback-success max-h-24 shrink-0 overflow-auto whitespace-pre-wrap font-mono text-xs shadow-sm">
            {saveSuccess}
          </pre>
        ) : null}

        {cues.length > 0 && hasInvalidCue ? (
          <pre className="mvp-feedback-warn max-h-24 shrink-0 overflow-auto whitespace-pre-wrap font-mono text-xs shadow-sm">
            Existem cues inválidas. Corrija antes de salvar (`startMs` deve ser
            menor que `endMs`).
          </pre>
        ) : null}

        <div className="editor-desktop-body flex min-h-0 flex-1 flex-col overflow-hidden">
          {isEditorReady ? (
            <section
              className="editor-desktop-workspace editor-desktop-workspace--stacked min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-[var(--bg-page)] p-2"
              data-editor-workspace-mode={editorWorkspaceMode}
            >
              <div className="editor-workspace-split flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden lg:flex-row">
                <div
                  className={`editor-panel-cues editor-cue-track-column editor-cue-track-layout box-border flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 lg:min-h-0 ${cuePanelRatioClass}`}
                >
                  {cues.length > 0 ? (
                    <>
                      <div
                        ref={cueListScrollRef}
                        className="editor-cue-panel-list editor-cue-list-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[var(--radius-md)] bg-[rgba(9,9,11,0.75)]"
                        role="list"
                        aria-label="Lista de cues (ligada à timeline)"
                      >
                        <div className="editor-cue-list-header grid w-full grid-cols-[36px_112px_minmax(0,1fr)_56px] items-center gap-x-2 gap-y-0">
                          <div className="editor-cue-list-header-cell flex items-center justify-center">
                            #
                          </div>
                          <div className="editor-cue-list-header-cell pl-[4px]">Timing</div>
                          <div className="editor-cue-list-header-cell">Legenda</div>
                          <div className="editor-cue-list-header-cell flex items-center justify-end pr-[6px]">
                            <span className="rounded-[3px] px-[7px] py-[4px]">
                              C/S
                            </span>
                          </div>
                        </div>
                        {visibleCueProblemsList.map(({ cue, problems }, index) => (
                          <CueListItem
                            key={cue.tempId}
                            cue={cue}
                            problems={problems}
                            isPlaybackCue={cue.tempId === activeCueTempId}
                            isSelectedCue={cue.tempId === selectedCueTempId}
                            isEditFocusCue={cue.tempId === cueEditFocusTempId}
                            nextCueStartMs={
                              index < visibleCueProblemsList.length - 1
                                ? visibleCueProblemsList[index + 1].cue.startMs
                                : null
                            }
                            assignCueRef={(tempId, element) => {
                              cueItemRefs.current[tempId] = element;
                            }}
                            shouldIgnoreCueClick={shouldIgnoreCueClick}
                            onSelectSingle={(itemCue) => {
                              setSelectedCueTempId(itemCue.tempId);
                              setCueEditFocusTempId(null);
                              if (mediaSourceUrl) {
                                seekPlayerToCue(itemCue.startMs);
                                scrollWaveformToCueStart(itemCue.startMs);
                              }
                              requestAnimationFrame(() => {
                                cueItemRefs.current[itemCue.tempId]?.focus({
                                  preventScroll: true,
                                });
                              });
                            }}
                            onSelectDouble={(itemCue) => {
                              setSelectedCueTempId(itemCue.tempId);
                              setCueEditFocusTempId(itemCue.tempId);
                              setEditingCueTempId(itemCue.tempId);
                              if (mediaSourceUrl) {
                                seekPlayerToCue(itemCue.startMs);
                                scrollWaveformToCueStart(itemCue.startMs);
                              }
                              requestAnimationFrame(() => {
                                cueItemRefs.current[itemCue.tempId]?.focus({
                                  preventScroll: true,
                                });
                              });
                            }}
                          />
                        ))}
                        {visibleCueProblemsList.length === 0 ? (
                          <div className="editor-cue-panel-empty border-t border-dashed border-[var(--border)] px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">
                            Nenhuma cue neste filtro.
                          </div>
                        ) : null}
                      </div>
                      <div className="flex min-h-[2.25rem] shrink-0 items-center gap-2 rounded-b-[var(--radius-md)] border-t border-[var(--border)] bg-[var(--bg-page)] px-3 py-2">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {cues.length} cues
                        </span>
                        {highCpsCount > 0 ? (
                          <>
                            <span className="text-[var(--border-mid)]">·</span>
                            <span className="text-[10px] text-amber-400/80">
                              ⚠ {highCpsCount} CPS alto
                            </span>
                          </>
                        ) : null}
                        {problematicCount > 0 ? (
                          <>
                            <span className="text-[var(--border-mid)]">·</span>
                            <span className="text-[10px] text-orange-400/80">
                              {problematicCount} com problemas
                            </span>
                          </>
                        ) : null}
                        {highCpsCount === 0 && problematicCount === 0 ? (
                          <>
                            <span className="text-[var(--border-mid)]">·</span>
                            <span className="text-[10px] text-emerald-500/70">
                              ✓ tudo ok
                            </span>
                          </>
                        ) : null}
                        <div className="flex-1" />
                      </div>
                    </>
                  ) : loading ? (
                    <div className="border border-[var(--border)] bg-[var(--bg-page)] py-10 text-center text-sm text-[var(--text-muted)]">
                      Carregando linhas…
                    </div>
                  ) : (
                    <div className="border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-page)_50%,transparent)] py-10 text-center text-sm text-[var(--text-muted)]">
                      {subtitleFileId.trim()
                        ? "Nenhuma linha neste ficheiro."
                        : mediaSourceUrl
                          ? "Nenhuma legenda na lista — largue um .srt ou indique o ID e Abrir sessão."
                          : "Nenhuma linha. Largue um .srt ou utilize o ID e Abrir sessão."}
                    </div>
                  )}
                </div>

                <aside
                  className={`editor-rail-context editor-panel-rail mvp-workspace-rail box-border flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-page)_30%,transparent)] p-2 ${previewPanelRatioClass}`}
                  data-editor-rail-mode={editorWorkspaceMode}
                >
                  <MediaPreviewPanel
                    mediaSourceUrl={mediaSourceUrl}
                    mediaKind={mediaKind}
                    mediaRef={mediaElementRef}
                    activeSubtitleText={activeCueText}
                    onTimeUpdate={handleMediaTimeUpdate}
                    aspectRatio={playerAspectRatio}
                    onAspectRatioChange={setPlayerAspectRatio}
                    currentTimeSec={currentPlaybackMs / 1000}
                    durationSec={waveformDurationSec ?? undefined}
                    activeCueInfo={activeCueInfoForPreview}
                  />
                </aside>
              </div>
              <div className="editor-timeline-dock min-h-0 min-w-0">
                <div className="flex h-[380px] min-w-0 flex-row gap-3">
                  <aside className="box-border flex min-w-[380px] flex-[0_0_38%] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                    {editingCue ? (
                      <CueTextEditor
                        key={editingCue.tempId}
                        cue={editingCue}
                        cueIndex={editingCueIndex}
                        totalCues={cues.length}
                        onClose={() => setEditingCueTempId(null)}
                        onCommitText={handleEditorCommitText}
                        onNavigate={handleEditorNavigate}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-white/20">
                        Duplo clique numa legenda na wave para editar
                      </div>
                    )}
                  </aside>
                  <div className="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                    <TimelineDock
                      mediaSourceUrl={mediaSourceUrl}
                      mediaKind={mediaKind}
                      currentPlaybackMs={currentPlaybackMs}
                      waveformViewport={waveformViewport}
                      waveformDurationSec={waveformDurationSec}
                      waveformContainerRef={waveformContainerRef}
                      waveformCanvasOverlayRef={waveformCanvasOverlayRef}
                      cueCreatePreviewRect={cueCreatePreviewRect}
                      onWaveformShellPointerDownCapture={
                        onWaveformShellPointerDownCapture
                      }
                      waveformCueOverlayHostEl={waveformCueOverlayHostEl}
                      cueWaveformRegions={cueWaveformRegions}
                      activeCueTempId={activeCueTempId}
                      selectedCueTempId={selectedCueTempId}
                      cueEditFocusTempId={cueEditFocusTempId}
                      waveformEdgeDrag={waveformEdgeDrag}
                      waveformMoveDrag={waveformMoveDrag}
                      minGapMs={WAVEFORM_DRAG_MIN_GAP_MS}
                      formatPlaybackTime={formatPlaybackTime}
                      onEdgePointerDown={handleWaveformEdgePointerDown}
                      onEdgePointerMove={handleWaveformEdgePointerMove}
                      onEdgePointerEnd={handleWaveformEdgePointerEnd}
                      onMovePointerDown={handleWaveformMovePointerDown}
                      onMovePointerMove={handleWaveformMovePointerMove}
                      onMovePointerEnd={handleWaveformMovePointerEnd}
                      setSelectedCueTempId={setSelectedCueTempId}
                      setCueEditFocusTempId={setCueEditFocusTempId}
                      setEditingCueTempId={setEditingCueTempId}
                      cueSingleClickTimerRef={cueSingleClickTimerRef}
                      seekPlaybackFromWaveClientX={seekPlaybackFromWaveClientX}
                      focusCueCardInList={focusCueCardInList}
                      onOverviewPointerDown={handleWaveformOverviewPointerDown}
                      onPlayMedia={() => void playMedia()}
                      onPauseMedia={pauseMedia}
                      onResetMediaToStart={resetMediaToStart}
                      waveformPx={waveformPx}
                      waveformGridStyle={waveformGridStyle}
                      onCueContextMenu={handleWaveformCueContextMenu}
                      playbackRate={playbackRate}
                      speedSteps={SPEED_STEPS}
                      onPlaybackRateChange={handleSpeedChange}
                    />
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-300 ease-out">
              <UploadScreen
                srtLoaded={srtLoadedOnly}
                srtFilename={filename}
                srtCount={cues.length}
                srtDropActive={srtDropActive}
                audioDropActive={audioDropActive}
                onSrtDragEnter={(e) => {
                  e.preventDefault();
                  setSrtDropActive(true);
                }}
                onSrtDragLeave={() => setSrtDropActive(false)}
                onSrtDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onSrtDrop={handleEmptySrtDrop}
                onAudioDragEnter={(e) => {
                  e.preventDefault();
                  setAudioDropActive(true);
                }}
                onAudioDragLeave={() => setAudioDropActive(false)}
                onAudioDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onAudioDrop={handleEmptyAudioDrop}
                onPickSrt={() => emptySrtInputRef.current?.click()}
                onPickAudio={() => emptyAudioInputRef.current?.click()}
              />
              <input
                ref={emptySrtInputRef}
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void applyDroppedSrtFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={emptyAudioInputRef}
                type="file"
                accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.opus,.mp4,.webm,.mkv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setError(null);
                    queueLocalMediaFromFiles([f]);
                  }
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>
        </>
      </div>

      {waveformContextMenu ? (
        <WaveformContextMenu
          x={waveformContextMenu.x}
          y={waveformContextMenu.y}
          canAddText={waveformContextMenu.canAddText}
          canSplit={waveformContextMenu.canSplit}
          onAddText={() =>
            handleWaveformAddTextToCue(waveformContextMenu.cue)
          }
          onSplit={() =>
            handleWaveformSplitCue(
              waveformContextMenu.cue,
              waveformContextMenu.splitMs,
            )
          }
          onDelete={() =>
            handleDeleteCueFromContext(waveformContextMenu.cue)
          }
        />
      ) : null}
    </main>
    </PageShell>
  );
}
