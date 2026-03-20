"use client";

import { useCallback, useEffect, useState } from "react";
import type { VersionItem, VersionsResponse } from "../types";

type UseVersionHistoryParams = {
  logBrowserError: (context: string, error: unknown) => void;
};

export function useVersionHistory({ logBrowserError }: UseVersionHistoryParams) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);

  /** #historico-versoes abre o drawer de versões (contexto, sem ocupar o rail). */
  useEffect(() => {
    function fromHash() {
      if (window.location.hash.replace(/^#/, "") === "historico-versoes") {
        setVersionsDrawerOpen(true);
      }
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    if (!versionsDrawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVersionsDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [versionsDrawerOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = versionsDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [versionsDrawerOpen]);

  const loadVersions = useCallback(
    async (id: string) => {
      setVersionsLoading(true);
      try {
        const res = await fetch(
          `/api/subtitle-files/${encodeURIComponent(id)}/versions`,
        );
        const json = await res.json();
        if (!res.ok) {
          setVersions([]);
          return;
        }
        const data = json as VersionsResponse;
        setVersions(data.versions);
      } catch (error) {
        logBrowserError("loadVersions", error);
        setVersions([]);
      } finally {
        setVersionsLoading(false);
      }
    },
    [logBrowserError],
  );

  return {
    versions,
    versionsLoading,
    versionsDrawerOpen,
    setVersionsDrawerOpen,
    loadVersions,
  };
}
