import pg from "pg";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.dbSsl ? { rejectUnauthorized: true } : undefined,
});

pool.on("error", (err) => {
  // Never let an idle client error crash the whole process silently.
  logger.error({ err }, "Unexpected PostgreSQL pool error");
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
