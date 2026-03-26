import { Suspense } from "react";
import { LoginContent } from "./login-content";

function LoginFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
