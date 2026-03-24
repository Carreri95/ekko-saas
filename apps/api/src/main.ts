import "./load-env.js";
import { buildApp } from "./app.js";
import { env } from "./infrastructure/config/env.js";

async function main(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ host: "0.0.0.0", port: env.apiPort });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
