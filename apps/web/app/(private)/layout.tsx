import type { ReactNode } from "react";
import { PrivateAuthProvider } from "@/app/components/private-auth-provider";

/**
 * Área privada: valida sessão via BFF (`/api/auth/me`) e só então renderiza filhos.
 * URLs não mudam — o segmento `(private)` é só organização.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <PrivateAuthProvider>{children}</PrivateAuthProvider>;
}
