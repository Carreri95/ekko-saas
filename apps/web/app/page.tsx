/**
 * `/` redireciona para `/gerar` via `redirects` em `next.config.ts`.
 * Este componente só existe para satisfazer a rota; não deve ser atingido
 * em navegação normal (o redirect da config corre primeiro).
 */
export default function Home() {
  return null;
}
