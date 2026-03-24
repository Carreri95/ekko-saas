"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Garante scroll até #âncora após navegação client-side (App Router nem sempre faz isso)
 * e quando o conteúdo alvo monta depois (ex.: histórico após carregar dados).
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    function scrollToHash() {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    scrollToHash();
    const t1 = window.setTimeout(scrollToHash, 120);
    const t2 = window.setTimeout(scrollToHash, 450);
    const t3 = window.setTimeout(scrollToHash, 900);

    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [pathname]);

  return null;
}
