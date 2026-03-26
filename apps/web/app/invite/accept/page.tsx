import { Suspense } from "react";
import { InviteAcceptContent } from "./invite-accept-content";

function InviteAcceptFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<InviteAcceptFallback />}>
      <InviteAcceptContent />
    </Suspense>
  );
}
