import type { CueRegionResult, CueTimeLike, WaveformViewportMetrics } from "../types";

export function buildCueWaveformRegions<TCue extends CueTimeLike>(
  cues: TCue[],
  waveformDurationSec: number | null,
  waveformTotalWidthPx: number | null,
  hasProblemsAtIndex: (index: number) => boolean,
): CueRegionResult<TCue>[] {
  if (waveformDurationSec == null || waveformDurationSec <= 0) return [];
  if (waveformTotalWidthPx == null || waveformTotalWidthPx <= 0) return [];
  const dur = waveformDurationSec;
  const totalW = waveformTotalWidthPx;
  return cues
    .map((cue, index) => {
      const startSec = Math.min(dur, Math.max(0, cue.startMs / 1000));
      const endSec = Math.min(dur, Math.max(startSec, cue.endMs / 1000));
      const leftPx = (startSec / dur) * totalW;
      const rightPx = (endSec / dur) * totalW;
      let widthPx = Math.max(0, rightPx - leftPx);
      if (cue.endMs > cue.startMs && widthPx < 1) {
        widthPx = 1;
      }
      if (leftPx + widthPx > totalW) {
        widthPx = Math.max(1, totalW - leftPx);
      }
      return {
        cue,
        leftPx,
        widthPx,
        hasProblems: hasProblemsAtIndex(index),
      };
    })
    .filter((r) => r.cue.startMs < r.cue.endMs && r.widthPx > 0);
}

export function computeOverviewMetrics(
  viewport: WaveformViewportMetrics | null,
  waveformDurationSec: number | null,
): {
  thumbWidthPct: number;
  thumbLeftPct: number;
} {
  const overviewRawThumbW =
    viewport && viewport.totalW > 0
      ? Math.min(100, (viewport.viewW / viewport.totalW) * 100)
      : 0;
  const thumbWidthPct = Math.max(2, Math.min(100, overviewRawThumbW));
  const overviewScrollRatio =
    viewport && viewport.maxScroll > 0
      ? Math.max(0, Math.min(1, viewport.scroll / viewport.maxScroll))
      : 0;
  const thumbMaxLeft = Math.max(0, 100 - thumbWidthPct);
  const thumbLeftPct = overviewScrollRatio * thumbMaxLeft;
  void waveformDurationSec;
  return { thumbWidthPct, thumbLeftPct };
}
