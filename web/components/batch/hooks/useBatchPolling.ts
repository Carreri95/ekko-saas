"use client";

import { useEffect, useRef } from "react";

import type { BatchStatusPayload } from "../types";

const POLL_MS = 2000;

export function useBatchPolling(
  batchId: string | null,
  onUpdate: (data: BatchStatusPayload) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!batchId) return;
    const id = batchId;

    let cancelled = false;

    async function pollOnce() {
      try {
        const res = await fetch(`/api/batch-jobs/${encodeURIComponent(id)}`);
        const json = (await res.json()) as BatchStatusPayload & { error?: string };
        if (!res.ok || !json.jobs) {
          return;
        }
        if (cancelled) return;
        onUpdateRef.current(json);
      } catch {
        /* ignore */
      }
    }

    void pollOnce();
    const timer = setInterval(() => void pollOnce(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [batchId]);
}
