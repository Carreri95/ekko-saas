"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import "@/components/batch/batch-generator.css";
import { filterAudioFiles } from "@/components/batch/audio-files";
import { BatchStatusBar } from "@/components/batch/BatchStatusBar";
import { ConfigModal, type ModalConfig } from "@/components/batch/ConfigModal";
import { useBatchPolling } from "@/components/batch/hooks/useBatchPolling";
import { JobsTable } from "@/components/batch/JobsTable";
import type { BatchJobRow, BatchStatusPayload } from "@/components/batch/types";

type SortKey = "name" | "status" | "completed" | "added" | null;

function sortJobs(
  jobs: BatchJobRow[],
  sortKey: SortKey,
  sortDir: "asc" | "desc",
): BatchJobRow[] {
  if (!sortKey) return jobs;
  const m = sortDir === "asc" ? 1 : -1;
  const statusOrder: Record<string, number> = {
    PENDING: 0,
    RUNNING: 1,
    DONE: 2,
    FAILED: 3,
  };
  return [...jobs].sort((a, b) => {
    if (sortKey === "name") {
      const an = a.originalFilename ?? "";
      const bn = b.originalFilename ?? "";
      return an.localeCompare(bn) * m;
    }
    if (sortKey === "status") {
      return ((statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)) * m;
    }
    if (sortKey === "completed") {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return (at - bt) * m;
    }
    if (sortKey === "added") {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return (at - bt) * m;
    }
    return 0;
  });
}

/** Corpo vazio ou HTML de erro do Next não deve rebentar o `JSON.parse`. */
async function readResponseJson<T extends object>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export default function GerarPage() {
  const confirm = useConfirm();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatusPayload | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "retry">("add");
  const [modalViewOnly, setModalViewOnly] = useState(false);
  const [viewMessage, setViewMessage] = useState("");
  const [retryJobId, setRetryJobId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("Configuração de transcrição");
  const [modalInitialFiles, setModalInitialFiles] = useState<File[] | null>(
    null,
  );
  const [appDragOver, setAppDragOver] = useState(false);
  const appDragDepth = useRef(0);
  const [accountKeyLoading, setAccountKeyLoading] = useState(true);
  const [accountHasKey, setAccountHasKey] = useState(false);
  const [accountMaskedKey, setAccountMaskedKey] = useState<string | null>(null);
  const [accountKeyError, setAccountKeyError] = useState<string | null>(null);

  useBatchPolling(batchId, setBatchStatus);

  const sortedJobs = useMemo(
    () =>
      batchStatus?.jobs ? sortJobs(batchStatus.jobs, sortKey, sortDir) : [],
    [batchStatus, sortKey, sortDir],
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const handleConfigRun = useCallback(
    async (config: ModalConfig) => {
      if (modalViewOnly) return;
      if (modalMode === "retry" && retryJobId && batchId) {
        const res = await fetch(
          `/api/batch-jobs/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(retryJobId)}/retry`,
          { method: "POST" },
        );
        if (!res.ok) {
          const j = await readResponseJson<{ error?: string }>(res);
          throw new Error(j.error ?? `Erro ${res.status}`);
        }
        return;
      }

      const res = await fetch("/api/batch-jobs", { method: "POST" });
      const json = await readResponseJson<{
        batchId?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      const bid = json.batchId;
      if (!bid) throw new Error("Resposta sem batchId");

      const files = config.files;
      if (!files?.length) throw new Error("Selecione pelo menos um ficheiro");

      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("engine", config.engine);
        fd.append("language", config.languageCode);
        fd.append("exportFormat", config.exportFormat);
        const up = await fetch(
          `/api/batch-jobs/${encodeURIComponent(bid)}/files`,
          {
            method: "POST",
            body: fd,
          },
        );
        const errBody = await readResponseJson<{ error?: string }>(up);
        if (!up.ok) {
          throw new Error(errBody.error ?? `Upload falhou: ${up.status}`);
        }
      }

      const st = await fetch(
        `/api/batch-jobs/${encodeURIComponent(bid)}/start`,
        { method: "POST" },
      );
      if (!st.ok) {
        const j = await readResponseJson<{ error?: string }>(st);
        throw new Error(j.error ?? `Start falhou: ${st.status}`);
      }

      setBatchId(bid);
    },
    [modalMode, retryJobId, batchId, modalViewOnly],
  );

  const loadAccountKeyStatus = useCallback(async () => {
    setAccountKeyLoading(true);
    setAccountKeyError(null);
    try {
      const res = await fetch("/api/auth/openai-key", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readResponseJson<{
        hasKey?: unknown;
        masked?: unknown;
        error?: string;
      }>(res);
      if (!res.ok) {
        setAccountHasKey(false);
        setAccountMaskedKey(null);
        setAccountKeyError(data.error ?? "Não foi possível carregar a chave da conta.");
        return;
      }
      setAccountHasKey(Boolean(data.hasKey));
      setAccountMaskedKey(typeof data.masked === "string" ? data.masked : null);
    } catch {
      setAccountHasKey(false);
      setAccountMaskedKey(null);
      setAccountKeyError("Não foi possível carregar a chave da conta.");
    } finally {
      setAccountKeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccountKeyStatus();
  }, [loadAccountKeyStatus]);

  const handleAppDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appDragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) setAppDragOver(true);
  }, []);

  const handleAppDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appDragDepth.current = Math.max(0, appDragDepth.current - 1);
    if (appDragDepth.current === 0) setAppDragOver(false);
  }, []);

  const handleAppDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleAppDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    appDragDepth.current = 0;
    setAppDragOver(false);
    const files = filterAudioFiles(Array.from(e.dataTransfer.files));
    if (files.length === 0) return;
    setModalInitialFiles(files);
    setModalMode("add");
    setModalViewOnly(false);
    setRetryJobId(null);
    setViewMessage("");
    setModalTitle("Configuração de transcrição");
    setModalOpen(true);
  }, []);

  const openRowModal = (job: BatchJobRow) => {
    setModalTitle(`${job.originalFilename ?? "Job"} — configuração`);
    if (job.status === "FAILED") {
      setModalMode("retry");
      setModalViewOnly(false);
      setRetryJobId(job.id);
      setViewMessage("");
    } else {
      setModalMode("add");
      setModalViewOnly(true);
      setRetryJobId(null);
      setViewMessage(
        `Estado do job: ${job.status}. Acompanhe o progresso na tabela.`,
      );
    }
    setModalInitialFiles(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalInitialFiles(null);
  };

  const deleteSelectedJobs = useCallback(async () => {
    if (!batchId || selectedIds.size === 0) return;
    const n = selectedIds.size;
    const ok = await confirm({
      title: "Remover jobs",
      description: `Confirma remover ${n} job(s) da fila? Só são removidos jobs pendentes ou em falha; os restantes serão ignorados.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
    });
    if (!ok) return;
    const res = await fetch(
      `/api/batch-jobs/${encodeURIComponent(batchId)}/jobs`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: Array.from(selectedIds) }),
      },
    );
    const j = await readResponseJson<{
      error?: string;
      removed?: number;
      skipped?: number;
    }>(res);
    if (!res.ok) {
      alert(j.error ?? `Erro ${res.status}`);
      return;
    }
    if ((j.skipped ?? 0) > 0 && (j.removed ?? 0) === 0) {
      alert(
        "Não foi possível remover: só é permitido para jobs pendentes ou em falha.",
      );
      return;
    }
    if ((j.skipped ?? 0) > 0 && (j.removed ?? 0) > 0) {
      alert(
        `Removidos: ${j.removed}. Ignorados (já concluídos ou em execução): ${j.skipped}.`,
      );
    }
    setSelectedIds(new Set());
  }, [batchId, confirm, selectedIds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (modalOpen) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }
      if (selectedIds.size === 0 || !batchId) return;
      e.preventDefault();
      void deleteSelectedJobs();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [batchId, deleteSelectedJobs, modalOpen, selectedIds.size]);

  const doneCount = batchStatus?.done ?? 0;
  const total = batchStatus?.total ?? 0;

  const downloadZip = async () => {
    if (!batchId || doneCount === 0) return;
    const res = await fetch(
      `/api/batch-jobs/${encodeURIComponent(batchId)}/download`,
    );
    if (!res.ok) {
      const j = await readResponseJson<{ error?: string }>(res);
      alert(j.error ?? `Erro ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legendas-${batchId.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell noScroll title="Gerador SRT" section="editor">
      <div className="mvp-page flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
      <div className="batch-gen-wrap">
        <div
          className={`batch-gen-app${appDragOver ? " batch-gen-app--drag" : ""}`}
          onDragEnter={handleAppDragEnter}
          onDragLeave={handleAppDragLeave}
          onDragOver={handleAppDragOver}
          onDrop={handleAppDrop}
          role="region"
          aria-label="Gerador: arraste ficheiros de áudio para esta área."
        >
          <div className="batch-gen-toolbar">
            <div className="batch-gen-toolbar-openai">
              <span className="batch-gen-openai-strip-label">Chave OpenAI da conta</span>
              <div
                className="batch-gen-openai-strip-input api-key-input"
                style={{ display: "flex", alignItems: "center" }}
              >
                {accountKeyLoading
                  ? "A carregar..."
                  : accountHasKey
                    ? `Usando chave salva na conta (${accountMaskedKey ?? "configurada"})`
                    : "Sem chave salva na conta"}
              </div>
              <Link className="batch-gen-openai-strip-link" href="/perfil/seguranca">
                Configurar em Segurança
              </Link>
              {accountKeyError ? (
                <span className="batch-gen-openai-strip-label" style={{ color: "#f09595" }}>
                  {accountKeyError}
                </span>
              ) : null}
            </div>
            <div className="batch-gen-toolbar-right">
              <span className="batch-gen-count-label">
                {total > 0
                  ? `${doneCount} de ${total} concluídos`
                  : "0 de 0 concluídos"}
              </span>
              <button
                type="button"
                className={`batch-gen-zip-btn${doneCount === 0 ? " disabled" : ""}`}
                onClick={() => void downloadZip()}
                disabled={doneCount === 0 || !batchId}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 12l2-2h6l2 2M8 2v8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Baixar ZIP
              </button>
            </div>
          </div>

          <JobsTable
            jobs={sortedJobs}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleRow={(id, checked) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onToggleAll={(checked) => {
              if (checked) {
                setSelectedIds(new Set(sortedJobs.map((j) => j.id)));
              } else {
                setSelectedIds(new Set());
              }
            }}
            notes={notes}
            onNotesChange={(jobId, value) => {
              setNotes((n) => ({ ...n, [jobId]: value }));
            }}
            onRowClick={(id) => {
              setSelectedIds(new Set([id]));
            }}
            onRowDoubleClick={(job) => {
              openRowModal(job);
            }}
          />

          <BatchStatusBar
            total={batchStatus?.total ?? 0}
            done={batchStatus?.done ?? 0}
            running={batchStatus?.running ?? 0}
            pending={batchStatus?.pending ?? 0}
          />
        </div>

        <ConfigModal
          key={`${modalMode}-${modalViewOnly}-${modalOpen}`}
          open={modalOpen}
          title={modalTitle}
          hideFileInput={modalMode === "retry" || modalViewOnly}
          showActions={!modalViewOnly}
          viewMessage={viewMessage}
          selectedFiles={modalInitialFiles}
          onClose={closeModal}
          onRun={handleConfigRun}
        />
      </div>
    </div>
    </PageShell>
  );
}
