import type { Role } from "./role.js";

/** Corpo de `POST /api/auth/login` — partilhável com UI/BFF. */
export type AuthLoginBody = {
  email: string;
  password: string;
};

/** Utilizador público (sem segredos) — resposta de login e `GET /api/auth/me`. */
export type AuthMeResponse = {
  id: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
};

export type AuthLoginResponse = {
  user: AuthMeResponse;
};
