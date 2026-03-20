const STYLE_ID = "subtitlebot-waveform-cue-shadow-styles";

export const WAVEFORM_CUE_SHADOW_CSS = `/* Regiões de cue — timeline contínua (estilo ferramenta desktop / trilho único) */

.editor-waveform-cue-regions {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 2;
  height: 100%;
  min-height: 160px;
  border-radius: 0;
  overflow: hidden;
  pointer-events: none;
  /* Grade temporal sutil ancorada no tempo (escala com o zoom). */
  background-image:
    linear-gradient(
      to bottom,
      transparent calc(50% - 0.5px),
      rgba(255, 255, 255, 0.18) calc(50% - 0.5px),
      rgba(255, 255, 255, 0.18) calc(50% + 0.5px),
      transparent calc(50% + 0.5px)
    ),
    repeating-linear-gradient(
      to right,
      rgba(148, 163, 184, 0.08) 0,
      rgba(148, 163, 184, 0.08) 1px,
      transparent 1px,
      transparent var(--wave-grid-minor-step, 24px)
    ),
    repeating-linear-gradient(
      to right,
      rgba(203, 213, 225, 0.14) 0,
      rgba(203, 213, 225, 0.14) 1px,
      transparent 1px,
      transparent var(--wave-grid-major-step, 120px)
    );
}

.editor-waveform-cue-region {
  position: absolute;
  top: 0;
  z-index: 1;
  height: 100%;
  min-width: 4px;
  box-sizing: border-box;
  border-left: 1px solid rgba(80, 200, 70, 0.7);
  border-right: 1px solid rgba(80, 200, 70, 0.7);
  border-top: 1px solid rgba(74, 222, 128, 0.3);
  border-bottom: 1px solid rgba(0, 0, 0, 0.65);
  background: rgba(20, 60, 15, 0.4);
  cursor: default;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  pointer-events: auto;
  transition:
    background 0.1s ease,
    border-color 0.1s ease;
}

.editor-waveform-cue-region:hover {
  background: rgba(45, 68, 32, 0.58);
  border-left-color: rgba(163, 230, 53, 0.98);
  border-right-color: rgba(163, 230, 53, 0.98);
  border-top-color: rgba(134, 239, 172, 0.45);
}

/* Centro: texto + meta — coluna, texto no topo da região */
.editor-waveform-cue-region-body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0;
  padding: 1px 2px 2px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  touch-action: none;
  cursor: grab;
}

.editor-waveform-cue-region-body:hover {
  background: rgba(0, 0, 0, 0.14);
}

.editor-waveform-cue-region-body--move-dragging {
  cursor: grabbing;
}

.editor-waveform-cue-preview {
  word-break: normal;
  hyphens: none;
  font-size: 9px;
  line-height: 1.3;
  color: rgba(200, 255, 190, 0.7);
  min-height: 0;
  width: 100%;
  flex: 1 1 auto;
  overflow: hidden;
  text-align: left;
  font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
  display: block;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.8);
}

.editor-waveform-cue-preview-spacer {
  flex: 1 1 auto;
  min-height: 4px;
  min-width: 0;
}

@media (min-width: 64rem) {
  .editor-waveform-cue-preview {
    font-size: 8px;
  }
}

/* Número + duração — faixa técnica inferior, discreta */
.editor-waveform-cue-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: auto;
  padding-top: 1px;
  border-top: 1px solid rgba(0, 0, 0, 0.35);
  font-family: ui-monospace, "Cascadia Mono", "Consolas", monospace;
  font-size: 6px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(161, 161, 170, 0.95);
  pointer-events: none;
  line-height: 1.1;
}

.editor-waveform-cue-region--selected .editor-waveform-cue-meta {
  color: rgba(254, 202, 202, 0.95);
}

.editor-waveform-cue-region--active:not(.editor-waveform-cue-region--selected) .editor-waveform-cue-meta {
  color: rgba(253, 230, 138, 0.92);
}

.editor-waveform-cue-region--edit-focus .editor-waveform-cue-meta {
  color: rgba(165, 243, 252, 0.95);
}

.editor-waveform-cue-region--warn:not(.editor-waveform-cue-region--selected) .editor-waveform-cue-meta {
  color: rgba(254, 215, 170, 0.9);
}

/* Handles — bordas verticais fortes, área de arrasto óbvia */
.editor-waveform-cue-handle {
  position: relative;
  flex: 0 0 1px;
  touch-action: none;
  cursor: ew-resize;
  z-index: 5;
  background: rgba(248, 250, 252, 0.6);
  box-shadow: none;
}

.editor-waveform-cue-handle::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  right: -6px;
}

.editor-waveform-cue-handle:hover,
.editor-waveform-cue-handle:focus-visible {
  background: rgba(248, 250, 252, 0.85);
  box-shadow: none;
  outline: none;
}

.editor-waveform-cue-handle--start {
  border-right: 0;
}

.editor-waveform-cue-handle--start::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 8%;
  bottom: 8%;
  width: 0;
  transform: translateX(-50%);
  border-left: 1px solid rgba(250, 250, 250, 0.72);
  border-right: 0;
  pointer-events: none;
}

.editor-waveform-cue-handle--end {
  border-left: 0;
}

.editor-waveform-cue-handle--end::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 8%;
  bottom: 8%;
  width: 0;
  transform: translateX(-50%);
  border-left: 1px solid rgba(250, 250, 250, 0.72);
  border-right: 0;
  pointer-events: none;
}

.editor-waveform-cue-handle--dragging {
  flex-basis: 1px;
  z-index: 15;
  background: rgba(254, 240, 138, 0.95) !important;
  box-shadow: none !important;
}

.editor-waveform-cue-handle--dragging::after {
  border-left-color: rgba(15, 23, 42, 0.95);
  border-right-color: rgba(15, 23, 42, 0.95);
  opacity: 1;
}

.editor-waveform-cue-region--edge-dragging {
  z-index: 12 !important;
  user-select: none;
  border-color: rgba(253, 224, 71, 0.95) !important;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(253, 224, 71, 0.55) !important;
  outline: 1px solid rgba(253, 224, 71, 0.75);
  outline-offset: -1px;
}

.editor-waveform-cue-region--move-dragging {
  z-index: 13 !important;
  user-select: none;
  outline: 1px solid rgba(228, 228, 231, 0.75);
  outline-offset: -1px;
  box-shadow: inset 0 0 0 1px rgba(253, 224, 71, 0.35) !important;
}

/* Playback na cue (sem seleção) — âmbar, distinto do verde base */
.editor-waveform-cue-region--active:not(.editor-waveform-cue-region--selected) {
  z-index: 4;
  border-left-color: rgba(251, 191, 36, 0.98);
  border-right-color: rgba(251, 191, 36, 0.98);
  border-top-color: rgba(253, 224, 71, 0.55);
  background: rgba(69, 47, 10, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* Seleção manual — vermelho forte (região em trabalho) */
.editor-waveform-cue-region--selected {
  z-index: 8;
  border-left-width: 2px;
  border-right-width: 2px;
  border-left-color: rgba(248, 80, 80, 1) !important;
  border-right-color: rgba(248, 80, 80, 1) !important;
  border-top-color: rgba(252, 165, 165, 0.55);
  background: rgba(100, 15, 15, 0.55) !important;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(220, 38, 38, 0.5);
  outline: 1px solid rgba(239, 68, 68, 0.6);
  outline-offset: -1px;
}

.editor-waveform-cue-region--selected:not(.editor-waveform-cue-region--edit-focus) {
  z-index: 8;
}

.editor-waveform-cue-region--selected .editor-waveform-cue-preview {
  color: rgba(255, 210, 210, 0.9);
}

/* Playback + seleção — vermelho domina; playhead ainda legível */
.editor-waveform-cue-region--active.editor-waveform-cue-region--selected:not(.editor-waveform-cue-region--edit-focus) {
  z-index: 9;
  border-left-color: rgba(239, 68, 68, 1) !important;
  border-right-color: rgba(239, 68, 68, 1) !important;
  background: rgba(110, 25, 25, 0.62) !important;
  box-shadow:
    inset 0 0 0 1px rgba(254, 243, 199, 0.2),
    0 0 0 1px rgba(220, 38, 38, 0.7);
  outline: 1px solid rgba(254, 202, 202, 0.9);
  outline-offset: -1px;
}

/* Problema — tom alaranjado, não confundir com vermelho de seleção */
.editor-waveform-cue-region--warn:not(.editor-waveform-cue-region--active):not(.editor-waveform-cue-region--selected) {
  border-left-color: rgba(251, 146, 60, 0.9);
  border-right-color: rgba(251, 146, 60, 0.9);
  background: rgba(67, 32, 10, 0.5);
  box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.25);
}

.editor-waveform-cue-region--selected.editor-waveform-cue-region--warn:not(.editor-waveform-cue-region--edit-focus) {
  outline-color: rgba(251, 146, 60, 1);
  box-shadow:
    inset 0 0 0 1px rgba(249, 115, 22, 0.35),
    0 0 0 1px rgba(220, 38, 38, 0.45);
}

/* Modo edição (duplo clique) — ciano muito visível */
.editor-waveform-cue-region--edit-focus {
  z-index: 10 !important;
  border-left-color: rgba(34, 211, 238, 0.98) !important;
  border-right-color: rgba(34, 211, 238, 0.98) !important;
  border-top-color: rgba(165, 243, 252, 0.55);
  background: rgba(12, 55, 68, 0.58) !important;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(6, 182, 212, 0.65);
  outline: 1px solid rgba(103, 232, 249, 0.9);
  outline-offset: -1px;
}

.editor-waveform-cue-region--edit-focus .editor-waveform-cue-preview {
  color: rgba(240, 253, 250, 0.98);
}

.editor-waveform-cue-region--edit-focus.editor-waveform-cue-region--warn {
  outline-color: rgba(251, 146, 60, 0.95);
  box-shadow:
    inset 0 0 0 1px rgba(249, 115, 22, 0.3),
    0 0 0 1px rgba(6, 182, 212, 0.55);
}

.editor-waveform-cue-region-body:focus-visible {
  outline: 1px solid rgba(56, 189, 248, 0.8);
  outline-offset: 1px;
}
`;

export function injectWaveformCueShadowStyles(root: Node): void {
  if (!(root instanceof ShadowRoot)) return;
  if (root.querySelector("#" + STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = WAVEFORM_CUE_SHADOW_CSS;
  root.insertBefore(el, root.firstChild);
}
