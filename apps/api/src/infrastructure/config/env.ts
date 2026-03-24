const DEFAULT_API_PORT = 4000;

function parseApiPort(raw: string | undefined): number {
  if (!raw) return DEFAULT_API_PORT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_API_PORT;
  return parsed;
}

export const env = {
  apiPort: parseApiPort(process.env.API_PORT),
};
