import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { checkDatabaseConnection } from "./db/pool.js";
import { pool } from "./db/pool.js";

async function main(): Promise<void> {
  await checkDatabaseConnection();
  logger.info("Database connection verified");

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, "AxisVault server listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
      pool.end().then(() => process.exit(0));
    });
    // Force-exit if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
