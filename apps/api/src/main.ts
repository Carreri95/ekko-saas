import "./load-env.js";
import { buildApp } from "./app.js";
import { env } from "./infrastructure/config/env.js";

async function main(): Promise<void> {
  // Diagnóstico rápido: valida carga de env sem expor segredos.
  console.log(
    JSON.stringify({
      scope: "env-debug",
      event: "api_start",
      hasProcessEnvOpenAiKeyEncryptionSecret: Boolean(
        process.env.OPENAI_KEY_ENCRYPTION_SECRET?.trim(),
      ),
      hasEnvOpenAiKeyEncryptionSecret: Boolean(env.openAiKeyEncryptionSecret),
    }),
  );
  const app = await buildApp();
  try {
    await app.listen({ host: "0.0.0.0", port: env.apiPort });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
