"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientDto } from "@/app/types/client";

type Props = {
  /** Nome do cliente (texto do formulário); reservado para extensões futuras. */
  value: string;
  clientId: string | null;
  onChange: (text: string, clientId: string | null) => void;
  onCreateNew: () => void;
  /** Incrementar após criar cliente para recarregar a lista. */
  refreshToken?: number;
  error?: boolean;
  className?: string;
};

export function ClientSelect({
  value: _value,
  clientId,
  onChange,
  onCreateNew,
  refreshToken = 0,
  error,
  className,
}: Props) {
  const [clients, setClients] = useState<ClientDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/clients?status=ACTIVE");
        if (!res.ok || cancelled) {
          if (!cancelled) setClients([]);
          return;
        }
        const raw = await res.text();
        if (!raw.trim()) {
          if (!cancelled) setClients([]);
          return;
        }
        const d = JSON.parse(raw) as { clients?: ClientDto[] };
        if (!cancelled) setClients(d.clients ?? []);
      } catch {
        if (!cancelled) setClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const selected = useMemo(() => {
    if (!clientId) return null;
    return clients.find((x) => x.id === clientId) ?? null;
  }, [clientId, clients]);

  const borderColor = error ? "#E24B4A" : "#2e2e2e";
  const focusClass = error
    ? "focus-within:border-[#E24B4A]"
    : "focus-within:border-[#1D9E75]";

  const wrapCls = className ?? "";

  if (selected) {
    return (
      <div className={wrapCls}>
        <div
          className="flex min-h-[36px] items-center justify-between overflow-hidden rounded-[6px] border bg-[#0d3d2a] px-[10px] py-[7px]"
          style={{ borderColor: "#0F6E56" }}
        >
          <div>
            <span className="text-[13px] font-[500] text-[#5DCAA5]">
              {selected.name}
            </span>
            {selected.email ? (
              <span className="ml-[8px] text-[10px] text-[#1D9E75]">
                {selected.email}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onChange("", null)}
            className="ml-[8px] text-[14px] leading-none text-[#1D9E75] transition-colors hover:text-[#5DCAA5]"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[36px] overflow-hidden rounded-[6px] border transition-colors ${focusClass} ${wrapCls}`}
      style={{ borderColor }}
    >
      <select
        value={clientId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onChange("", null);
            return;
          }
          const c = clients.find((x) => x.id === id);
          if (c) onChange(c.name, c.id);
        }}
        className="flex-1 bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none"
      >
        <option value="">Selecionar cliente cadastrado...</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onCreateNew}
        className="flex flex-shrink-0 items-center gap-[4px] whitespace-nowrap border-l border-[#2e2e2e] bg-[#1D9E75] px-[10px] text-[11px] font-[600] text-white transition-colors hover:bg-[#0F6E56]"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2v12M2 8h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Novo
      </button>
    </div>
  );
}
