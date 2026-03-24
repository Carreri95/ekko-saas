"use client";

import { useCallback, useId, useState } from "react";

export type ModalConfig = {
  engine: "OPENAI_WHISPER" | "MOCK";
  languageCode: string;
  exportFormat: string;
  files: File[] | null;
};

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onRun: (config: ModalConfig) => void | Promise<void>;
  /** Se true, não envia ficheiros (retry / visualização). */
  hideFileInput?: boolean;
  initialEngine?: "OPENAI_WHISPER" | "MOCK";
  showActions?: boolean;
  viewMessage?: string;
  /** Ficheiros escolhidos na página (arrastar ou explorador). */
  selectedFiles: File[] | null;
};

const LANG_OPTIONS = [
  { label: "Português", code: "pt" },
  { label: "Inglês", code: "en" },
  { label: "Espanhol", code: "es" },
  { label: "Detecção automática", code: "" },
];

export function ConfigModal({
  open,
  title,
  onClose,
  onRun,
  hideFileInput = false,
  initialEngine = "OPENAI_WHISPER",
  showActions = true,
  viewMessage = "",
  selectedFiles = null,
}: Props) {
  const idBase = useId();
  const [engine, setEngine] = useState<"OPENAI_WHISPER" | "MOCK">(initialEngine);
  const [languageCode, setLanguageCode] = useState("pt");
  const [exportTxt, setExportTxt] = useState(false);
  const [exportSrt, setExportSrt] = useState(true);
  const [exportVtt, setExportVtt] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolveExportFormat = (): string => {
    if (exportSrt) return "SRT";
    if (exportVtt) return "VTT";
    if (exportTxt) return "TXT";
    return "SRT";
  };

  const handleRun = async () => {
    if (!hideFileInput && (!selectedFiles || selectedFiles.length === 0)) {
      return;
    }
    if (!exportSrt && !exportTxt && !exportVtt) {
      return;
    }
    setBusy(true);
    try {
      await onRun({
        engine,
        languageCode,
        exportFormat: resolveExportFormat(),
        files: hideFileInput ? null : selectedFiles,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="batch-gen-overlay open" role="dialog" aria-modal="true">
      <div className="batch-gen-modal">
        <div className="batch-gen-modal-title">
          <span>{title}</span>
          <button
            type="button"
            className="batch-gen-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="batch-gen-modal-body">
          {!showActions ? (
            <p
              style={{
                fontSize: "var(--fs-sm)",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {viewMessage || "Detalhes do job."}
            </p>
          ) : null}
          {showActions ? (
            <>
              <div className="batch-gen-field">
                <label htmlFor={`${idBase}-model`}>Modelo</label>
                <select
                  id={`${idBase}-model`}
                  value={engine}
                  onChange={(e) =>
                    setEngine(e.target.value as "OPENAI_WHISPER" | "MOCK")
                  }
                >
                  <option value="OPENAI_WHISPER">OpenAI Whisper API</option>
                  <option value="MOCK">Mock (sem API)</option>
                </select>
              </div>

              <div className="batch-gen-field">
                <label htmlFor={`${idBase}-task`}>Tarefa</label>
                <select id={`${idBase}-task`} disabled>
                  <option>Transcrever</option>
                </select>
              </div>

              <div className="batch-gen-field">
                <label htmlFor={`${idBase}-lang`}>Idioma</label>
                <select
                  id={`${idBase}-lang`}
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.label} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="batch-gen-checkrow">
                <input type="checkbox" disabled id={`${idBase}-w1`} />
                <label htmlFor={`${idBase}-w1`}>Timings por palavra</label>
              </div>
              <div className="batch-gen-checkrow">
                <input type="checkbox" disabled id={`${idBase}-w2`} />
                <label htmlFor={`${idBase}-w2`}>Extrair fala</label>
              </div>

              <div className="batch-gen-export-row">
                <label>Exportar:</label>
                <div className="batch-gen-export-opts">
                  <label>
                    <input
                      type="checkbox"
                      checked={exportTxt}
                      onChange={(e) => setExportTxt(e.target.checked)}
                    />
                    TXT
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={exportSrt}
                      onChange={(e) => setExportSrt(e.target.checked)}
                    />
                    SRT
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={exportVtt}
                      onChange={(e) => setExportVtt(e.target.checked)}
                    />
                    VTT
                  </label>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="batch-gen-modal-footer">
          {showActions ? (
            <>
              <button
                type="button"
                className="batch-gen-btn"
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="batch-gen-btn batch-gen-btn-primary"
                onClick={() => void handleRun()}
                disabled={
                  busy ||
                  (!hideFileInput && (!selectedFiles || selectedFiles.length === 0))
                }
              >
                Executar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="batch-gen-btn batch-gen-btn-primary"
              onClick={onClose}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
