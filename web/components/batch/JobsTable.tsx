"use client";

import type { BatchJobRow } from "./types";
import {
  doneDurationSeconds,
  formatEngineLabel,
  formatUtcTimestamp,
} from "./format-batch";

type SortKey = "name" | "status" | "completed" | "added" | null;

type Props = {
  jobs: BatchJobRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  notes: Record<string, string>;
  onNotesChange: (jobId: string, value: string) => void;
  onRowClick: (id: string) => void;
  onRowDoubleClick: (job: BatchJobRow) => void;
};

function StatusBadge({ job }: { job: BatchJobRow }) {
  const dur = doneDurationSeconds(job);
  const durSuffix = job.status === "DONE" && dur !== null ? ` (${dur}s)` : "";

  if (job.status === "DONE") {
    return (
      <span className="batch-gen-badge batch-gen-badge-done">
        <span className="batch-gen-dot batch-gen-dot-done" />
        Concluído{durSuffix}
      </span>
    );
  }
  if (job.status === "RUNNING") {
    return (
      <span className="batch-gen-badge batch-gen-badge-running">
        <span className="batch-gen-dot batch-gen-dot-running" />
        Processando...
      </span>
    );
  }
  if (job.status === "FAILED") {
    return (
      <span className="batch-gen-badge batch-gen-badge-failed">
        <span className="batch-gen-dot batch-gen-dot-failed" />
        Falhou
      </span>
    );
  }
  return (
    <span className="batch-gen-badge batch-gen-badge-pending">
      <span className="batch-gen-dot batch-gen-dot-pending" />
      Aguardando
    </span>
  );
}

export function JobsTable({
  jobs,
  sortKey,
  sortDir,
  onSort,
  selectedIds,
  onToggleRow,
  onToggleAll,
  notes,
  onNotesChange,
  onRowClick,
  onRowDoubleClick,
}: Props) {
  const allChecked =
    jobs.length > 0 && jobs.every((j) => selectedIds.has(j.id));

  if (jobs.length === 0) {
    return (
      <div className="batch-gen-table-wrap">
        <div className="batch-gen-empty-panel">
          <div className="batch-gen-empty-panel-inner" role="status">
            <p className="batch-gen-empty-panel-text">
              Arraste audios/vídeos aqui
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-gen-table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
            </th>
            <th onClick={() => onSort("name")}>
              Arquivo{" "}
              {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
            </th>
            <th>Modelo</th>
            <th onClick={() => onSort("status")}>
              Status{" "}
              {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
            </th>
            <th>Tarefa</th>
            <th>Exportar</th>
            <th onClick={() => onSort("completed")}>
              Concluído em
              {sortKey === "completed" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
            </th>
            <th onClick={() => onSort("added")}>
              Adicionado em
              {sortKey === "added" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
            </th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className={selectedIds.has(job.id) ? "selected" : ""}
              onClick={() => onRowClick(job.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                onRowDoubleClick(job);
              }}
            >
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.has(job.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleRow(job.id, e.target.checked);
                  }}
                  style={{ accentColor: "var(--accent)" }}
                />
              </td>
              <td
                className="batch-gen-td-file"
                title={job.originalFilename ?? job.id}
              >
                {job.originalFilename ?? "—"}
              </td>
              <td>{formatEngineLabel(job.engine)}</td>
              <td>
                <StatusBadge job={job} />
              </td>
              <td>Transcrever</td>
              <td>{job.exportFormat ?? "SRT"}</td>
              <td>{formatUtcTimestamp(job.completedAt)}</td>
              <td>{formatUtcTimestamp(job.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  className="batch-gen-notes-input"
                  value={notes[job.id] ?? ""}
                  placeholder="—"
                  onChange={(e) => onNotesChange(job.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
