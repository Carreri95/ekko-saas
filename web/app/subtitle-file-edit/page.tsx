"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import WaveSurfer from "wavesurfer.js";

import { parseSrt } from "@/src/lib/srt/parse-srt";
import { matchEpisodes } from "@/src/lib/project/match-episodes";
import type { Episode, Project } from "@/src/types/project";
import { CueListItem } from "./components/cue-list-item";
import { CueTextEditor } from "./components/cue-text-editor";
import { EpisodeQueueScreen } from "./components/episode-queue-screen";
import { MediaPreviewPanel } from "./components/media-preview-panel";
import { TimelineDock } from "./components/timeline-dock";
import { UploadScreen } from "./components/upload-screen";
import { VersionsDrawer } from "./components/versions-drawer";
import { useWaveformCueDrag } from "./hooks/use-waveform-cue-drag";
import { useWaveformPanSeek } from "./hooks/use-waveform-pan-seek";
import { useAutoSave } from "./hooks/use-auto-save";
import { usePlaybackSync } from "./hooks/use-playback-sync";
import { useQueueAutoSnapshot } from "./hooks/use-queue-auto-snapshot";
import { useCueListAutoScroll } from "./hooks/use-cue-list-auto-scroll";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useWaveformLifecycle } from "./hooks/use-waveform-lifecycle";
import { useCueEditorNavigation } from "./hooks/use-cue-editor-navigation";
import { useMediaPlaybackControls } from "./hooks/use-media-playback-controls";
import { useMediaSessionControls } from "./hooks/use-media-session-controls";
import { useQueueActions } from "./hooks/use-queue-actions";
import { useProjectQueueIntake } from "./hooks/use-project-queue-intake";
import { useWaveformOverviewDrag } from "./hooks/use-waveform-overview-drag";
import { useLocalMediaSrtIntake } from "./hooks/use-local-media-srt-intake";
import { useVersionHistory } from "./hooks/use-version-history";
import { useCuePersistence } from "./hooks/use-cue-persistence";
import { useGlobalDropIntake } from "./hooks/use-global-drop-intake";
import { buildCueWaveformRegions } from "./lib/waveform-time";
import {
  getCueProblems,
} from "@/app/subtitle-file-edit/lib/cue-problems";
import {
  createTempId,
  getSaveCueHash,
  normalizeCueCollisions,
  toSaveCuePayload,
  validateCuesForSave,
} from "@/app/subtitle-file-edit/lib/cue-utils";
import { formatPlaybackTime } from "@/app/subtitle-file-edit/lib/format-time";
import {
  scrollCueIntoListPanel,
} from "@/app/subtitle-file-edit/lib/dom-utils";
import { inferProjectNameFromFiles } from "@/app/subtitle-file-edit/lib/project-utils";
import type {
  AspectRatio,
  CueDto,
  LocalWaveformData,
  ProblemFilter,
} from "./types";
import { injectWaveformCueShadowStyles } from "./waveformCueShadowStyles";

/** Duração mínima (ms) entre início e fim ao arrastar bordas na waveform. */
const WAVEFORM_DRAG_MIN_GAP_MS = 40;
const WAVEFORM_MIN_PX_PER_SEC = 48;

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

const QUEUE_STATE_KEY = "subtitlebot-local-queue-v1";

export default function SubtitleFileEditPage() {
  const mediaElementRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(
    null,
  );
  const cueListScrollRef = useRef<HTMLDivElement | null>(null);
  const cueItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastAutoScrollAtRef = useRef(0);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const waveformCueOverlayHostRef = useRef<HTMLDivElement | null>(null);
  const waveformDurationSecRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const lastSavedServerHashRef = useRef("");
  const queueSnapshotSyncTimerRef = useRef<number | null>(null);
  const lastQueueSnapshotKeyRef = useRef("");
  const audioRouteFallbackTriedRef = useRef(false);
  const waveformPanDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startScrollPx: number;
    moved: boolean;
  } | null>(null);
  const waveformOverviewDragRef = useRef<{ pointerId: number } | null>(null);
  const suppressWaveformInteractionUntilRef = useRef(0);
  const cueSingleClickTimerRef = useRef(0);
  const waveformViewportLastRef = useRef<{
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null>(null);
  const scheduleViewportRefreshRef = useRef<(() => void) | null>(null);
  const isWaveformSeekingRef = useRef(false);
  const currentPlaybackMsRef = useRef(0);
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [wavFilename] = useState<string | null>(null);
  const [wavPath] = useState<string | null>(null);
  const [cues, setCues] = useState<CueDto[]>([]);
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [exporting] = useState(false);
  /** Painel lateral do histórico de versões (drawer — não compete com a área de revisão). */
  const [filterMode] = useState<ProblemFilter>("all");
  const [localWaveformData, setLocalWaveformData] = useState<LocalWaveformData | null>(
    null,
  );
  const [mediaSourceUrl, setMediaSourceUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"video" | "audio" | null>(null);
  const [playerAspectRatio, setPlayerAspectRatio] = useState<AspectRatio>("16:9");
  const [currentPlaybackMs, setCurrentPlaybackMs] = useState(0);
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
  /** Host DOM dentro do wrapper do WaveSurfer para alinhar regiões de cue ao zoom. */
  const [waveformCueOverlayHostEl, setWaveformCueOverlayHostEl] =
    useState<HTMLElement | null>(null);
  const [isWaveformPanning, setIsWaveformPanning] = useState(false);
  const emptySrtInputRef = useRef<HTMLInputElement | null>(null);
  const emptyAudioInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [srtDropActive, setSrtDropActive] = useState(false);
  const [audioDropActive, setAudioDropActive] = useState(false);
  const [screenMode, setScreenMode] = useState<"upload" | "queue" | "editor">(
    "upload",
  );
  const [localProject, setLocalProject] = useState<Project | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  /** Vista geral da faixa (scroll) — barra por baixo da waveform. */
  const [waveformViewport, setWaveformViewport] = useState<{
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null>(null);

  const hasServerSubtitleFile = sanitizeSubtitleFileId(subtitleFileId) !== "";
  const isQueueEpisodeContext = screenMode === "editor" && currentEpisodeId !== null;
  const isEditorReady =
    hasServerSubtitleFile || (cues.length > 0 && (mediaSourceUrl !== null || isQueueEpisodeContext));
  const waveformEnabled = mediaKind === "audio" && mediaSourceUrl !== null && isEditorReady;

  useEffect(() => {
    if (!error) return;
    console.error("[subtitle-file-edit][ui-error]", error);
  }, [error]);

  const { bindPanSeekHandlers } = useWaveformPanSeek();
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
  });

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

  function saveQueueState(nextProject: Project) {
    try {
      const serializable = {
        name: nextProject.name,
        episodes: nextProject.episodes.map((ep) => ({
          name: ep.name,
          status: ep.status,
          editedCues: ep.editedCues,
        })),
      };
      window.localStorage.setItem(QUEUE_STATE_KEY, JSON.stringify(serializable));
    } catch (error) {
      logBrowserError("saveQueueState localStorage.setItem", error);
      /* ignore localStorage errors */
    }
  }

  function restoreQueueProgress(episodes: Episode[]): Episode[] {
    try {
      const raw = window.localStorage.getItem(QUEUE_STATE_KEY);
      if (!raw) return episodes;
      const parsed = JSON.parse(raw) as {
        name?: string;
        episodes?: Array<{
          name: string;
          status: Episode["status"];
          editedCues: Episode["editedCues"];
        }>;
      };
      const map = new Map((parsed.episodes ?? []).map((ep) => [ep.name, ep]));
      return episodes.map((ep) => {
        const saved = map.get(ep.name);
        if (!saved) return ep;
        return {
          ...ep,
          status: saved.status ?? ep.status,
          editedCues: saved.editedCues ?? ep.editedCues,
        };
      });
    } catch (error) {
      logBrowserError("restoreQueueProgress JSON/localStorage parse", error);
      return episodes;
    }
  }

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

  const {
    versions,
    versionsLoading,
    versionsDrawerOpen,
    setVersionsDrawerOpen,
    loadVersions,
  } = useVersionHistory({ logBrowserError });

  /** Reaplica scroll para #âncora quando o painel lateral monta (ex.: histórico após carregar). */
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
  }, [subtitleFileId, cues.length, versionsLoading, loading]);

  useEffect(() => {
    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, [mediaSourceUrl]);

  /** Altura da faixa de waveform (px) — foco em legibilidade da cue e da onda. */
  const WAVEFORM_PX = 220;

  const {
    seekPlaybackToTimeSec,
    seekPlaybackFromWaveClientX,
    scrollWaveformToCueStart,
    seekPlayerToCue,
    playMedia,
    pauseMedia,
    resetMediaToStart,
    handleMediaTimeUpdate,
  } = useMediaPlaybackControls({
    mediaElementRef,
    waveSurferRef,
    isWaveformSeekingRef,
    setCurrentPlaybackMs,
    logBrowserError,
  });

  useKeyboardShortcuts({
    mediaElementRef,
    currentPlaybackMsRef,
    seekPlaybackToTimeSec,
    logBrowserError,
    isSpaceReservedForFocusedElement,
    editingCueTempId,
    setEditingCueTempId,
  });

  useWaveformLifecycle({
    waveformEnabled,
    localWaveformData,
    bindPanSeekHandlers,
    mediaSourceUrl,
    mediaKind,
    wavPath,
    waveformPx: WAVEFORM_PX,
    waveformContainerRef,
    mediaElementRef,
    waveSurferRef,
    waveformMinPxPerSec: WAVEFORM_MIN_PX_PER_SEC,
    waveformCueOverlayHostRef,
    waveformViewportLastRef,
    scheduleViewportRefreshRef,
    waveformPanDragRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    suppressWaveformInteractionUntilRef,
    audioRouteFallbackTriedRef,
    setWaveformDurationSec,
    setWaveformCueOverlayHostEl,
    setIsWaveformPanning,
    setWaveformViewport,
    setError,
    setMediaSourceUrl,
    seekPlaybackToTimeSec,
    logBrowserError,
    normalizeBrowserMediaPath,
    injectWaveformCueShadowStyles,
  });

  usePlaybackSync({
    mediaSourceUrl,
    mediaKind,
    mediaElementRef,
    waveSurferRef,
    isWaveformSeekingRef,
    suppressWaveformInteractionUntilRef,
    waveformPanDragRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    scheduleViewportRefreshRef,
    setCurrentPlaybackMs,
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
        const durationSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
        const cps = cue.text.replace(/\s+/g, "").length / durationSec;
        return cps > 17 ? count + 1 : count;
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

  const editingCueIndex = useMemo(
    () => (editingCueTempId ? cues.findIndex((cue) => cue.tempId === editingCueTempId) : -1),
    [cues, editingCueTempId],
  );
  const editingCue = editingCueIndex >= 0 ? cues[editingCueIndex] : null;
  const currentEpisodeIndex = useMemo(() => {
    if (!localProject || !currentEpisodeId) return -1;
    return localProject.episodes.findIndex((ep) => ep.id === currentEpisodeId);
  }, [localProject, currentEpisodeId]);
  const currentEpisode =
    currentEpisodeIndex >= 0 && localProject
      ? localProject.episodes[currentEpisodeIndex]
      : null;

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
    // Major = ~1s; minor = ~100ms (escala com o zoom em px/s).
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
      setCueEditFocusTempId(firstCue.tempId);
      setEditingCueTempId(firstCue.tempId);
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
    loadVersions,
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

  useQueueAutoSnapshot({
    localProject,
    currentEpisodeId,
    cues,
    queueSnapshotSyncTimerRef,
    lastQueueSnapshotKeyRef,
    setLocalProject,
    saveQueueState,
  });

  const { clearMedia, resetPlaybackToStart } = useMediaSessionControls({
    mediaElementRef,
    waveSurferRef,
    scheduleViewportRefreshRef,
    setLocalWaveformData,
    setMediaSourceUrl,
    setMediaKind,
    setCurrentPlaybackMs,
  });

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

  async function buildEpisodeCues(episode: Episode): Promise<CueDto[]> {
    if (!episode.srtFile) {
      throw new Error("Episódio sem ficheiro SRT.");
    }
    const text = await episode.srtFile.text();
    return episode.editedCues && episode.editedCues.length > 0
      ? normalizeCueCollisions(
          episode.editedCues.map((cue) => ({
            ...cue,
            tempId: cue.tempId || createTempId(),
          })),
          WAVEFORM_DRAG_MIN_GAP_MS,
        )
      : toCueDtoListFromSrtText(text);
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

  const {
    openEpisodeById,
    handleDownloadEpisodeById,
    saveAndStayQueueEpisode,
    saveAndNextQueueEpisode,
  } = useQueueActions({
    localProject,
    currentEpisodeId,
    cues,
    setLocalProject,
    setCurrentEpisodeId,
    setScreenMode,
    setSaveSuccess,
    setError,
    setCues,
    setFilename,
    setSubtitleFileId,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    setEditingCueTempId,
    saveQueueState,
    buildEpisodeCues,
    resetPlaybackToStart,
    applyLocalMediaFile,
    clearMedia,
    logBrowserError,
  });

  const { handleFolderInputChange, handleFolderDrop } = useProjectQueueIntake({
    restoreQueueProgress,
    matchEpisodes,
    inferProjectNameFromFiles,
    saveQueueState,
    setLocalProject,
    setCurrentEpisodeId,
    setScreenMode,
    setError,
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
    seekPlayerToCue,
    scrollWaveformToCueStart,
    focusCueCardInList,
  });

  const { handleWaveformOverviewPointerDown } = useWaveformOverviewDrag({
    waveSurferRef,
    waveformViewport,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    waveformPanDragRef,
    waveformOverviewDragRef,
    logBrowserError,
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

  return (
    <main className="mvp-page editor-desktop-page">
      <div className="editor-desktop-shell flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        {screenMode === "queue" && localProject ? (
          <EpisodeQueueScreen
            project={localProject}
            onBackToUpload={() => setScreenMode("upload")}
            onOpenEpisode={openEpisodeById}
            onDownloadEpisode={handleDownloadEpisodeById}
          />
        ) : (
          <>
            {currentEpisode && localProject ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/70 bg-zinc-900/70 px-3 py-1 text-[11px]">
                <button
                  type="button"
                  className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  onClick={() => {
                    saveAndStayQueueEpisode();
                    setScreenMode("queue");
                  }}
                >
                  ← Fila
                </button>
                <span className="text-zinc-600">|</span>
                <span className="font-medium text-zinc-100">{currentEpisode.name}</span>
                <span className="text-zinc-400">
                  {currentEpisodeIndex + 1} / {localProject.episodes.length}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  onClick={saveAndStayQueueEpisode}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="rounded bg-emerald-600 px-2.5 py-0.5 font-semibold text-white hover:bg-emerald-500"
                  onClick={() => void saveAndNextQueueEpisode()}
                >
                  ✓ Salvar e próximo →
                </button>
              </div>
            ) : null}
        <div className="editor-desktop-toolbar shrink-0 border-b border-zinc-800/90 bg-zinc-950/80 px-2 py-1.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-medium text-zinc-200"
                title={filename ?? undefined}
              >
                {filename ?? "—"}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
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
              className="editor-desktop-workspace editor-desktop-workspace--stacked min-h-0 min-w-0 flex-1 overflow-hidden"
              data-editor-workspace-mode={editorWorkspaceMode}
            >
              <div className="editor-workspace-split flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-zinc-800/90 lg:flex-row">
                <div className={`editor-panel-cues editor-cue-track-column editor-cue-track-layout flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0 lg:min-h-0 ${cuePanelRatioClass}`}>
                  {cues.length > 0 ? (
                    <>
                      <div className="editor-cue-rail-head shrink-0 border-b border-zinc-800/80 bg-zinc-950 px-1 py-0.5">
                        <p className="text-[9px] leading-tight text-zinc-600">
                          <span className="tabular-nums text-zinc-500">
                            {cues.length}
                          </span>
                          {problematicCount > 0 ? (
                            <span className="text-amber-200/80">
                              {" "}
                              · {problematicCount}!
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div
                        ref={cueListScrollRef}
                        className="editor-cue-panel-list editor-cue-list-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-r border-zinc-800/50 bg-[rgba(9,9,11,0.75)]"
                        role="list"
                        aria-label="Lista de cues (ligada à timeline)"
                      >
                        <div className="cue-list-header sticky top-0 z-10 grid grid-cols-[48px_180px_minmax(0,1fr)_72px] border-b border-zinc-700/60 bg-zinc-950/95 px-0 py-1 backdrop-blur-[1px]">
                          <span className="px-1 text-center text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                            #
                          </span>
                          <span className="px-1.5 text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                            Tempo
                          </span>
                          <span className="px-2 text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                            Texto
                          </span>
                          <span className="px-1 text-right text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                            Ações
                          </span>
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
                              setEditingCueTempId((prev) =>
                                prev ? itemCue.tempId : prev,
                              );
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
                            onUpdateCue={updateCue}
                          />
                        ))}
                        {visibleCueProblemsList.length === 0 ? (
                          <div className="editor-cue-panel-empty border-t border-dashed border-zinc-800/80 px-3 py-6 text-center text-[13px] text-zinc-500">
                            Nenhuma cue neste filtro.
                          </div>
                        ) : null}
                      </div>
                      <div className="flex h-12 shrink-0 items-center gap-2 border-r border-t border-zinc-800/50 bg-[#141414] px-3">
                        <span className="text-[11px] text-white/30">
                          {cues.length} legendas
                        </span>
                        <span className="text-[11px] text-white/20">·</span>
                        {highCpsCount > 0 ? (
                          <span className="text-[11px] text-amber-300/90">
                            ⚠ {highCpsCount} com CPS alto
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-300/90">
                            ✓ Todos ok
                          </span>
                        )}
                        <div className="flex-1" />
                      </div>
                    </>
                  ) : loading ? (
                    <div className="border border-zinc-800/80 bg-zinc-950/80 py-10 text-center text-sm text-zinc-500">
                      Carregando linhas…
                    </div>
                  ) : (
                    <div className="border border-dashed border-zinc-800/90 bg-zinc-950/50 py-10 text-center text-sm text-zinc-500">
                      {subtitleFileId.trim()
                        ? "Nenhuma linha neste ficheiro."
                        : mediaSourceUrl
                          ? "Nenhuma legenda na lista — largue um .srt ou indique o ID e Abrir sessão."
                          : "Nenhuma linha. Largue um .srt ou utilize o ID e Abrir sessão."}
                    </div>
                  )}
                </div>

                <aside
                  className={`editor-rail-context editor-panel-rail mvp-workspace-rail flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-zinc-800/90 bg-zinc-950/30 py-1 pl-1.5 pr-1 ${previewPanelRatioClass} lg:border-l lg:border-t-0 lg:border-zinc-800/90`}
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
                  />
                </aside>
              </div>
              <div className="editor-timeline-dock min-h-0 min-w-0">
                <div className="flex h-[380px] min-w-0 flex-row border-t-2 border-zinc-800/90">
                  <aside className="flex min-w-[380px] flex-[0_0_38%] flex-col border-r border-zinc-800/90 bg-[#161616]">
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
                  <div className="min-w-0 flex-1">
                    <TimelineDock
                      mediaSourceUrl={mediaSourceUrl}
                      mediaKind={mediaKind}
                      currentPlaybackMs={currentPlaybackMs}
                      canReplaceAudio={Boolean(mediaSourceUrl && cues.length > 0)}
                      onReplaceAudio={clearMedia}
                      waveformViewport={waveformViewport}
                      waveformDurationSec={waveformDurationSec}
                      waveformContainerRef={waveformContainerRef}
                      isWaveformPanning={isWaveformPanning}
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
                      waveformPx={WAVEFORM_PX}
                      waveformGridStyle={waveformGridStyle}
                    />
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden transition-opacity duration-300 ease-out">
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
                onPickFolder={() => folderInputRef.current?.click()}
                onFolderDrop={handleFolderDrop}
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
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderInputChange}
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              />
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <VersionsDrawer
        open={versionsDrawerOpen}
        loading={versionsLoading}
        versions={versions}
        onClose={() => setVersionsDrawerOpen(false)}
      />
    </main>
  );
}
