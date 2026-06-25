import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { logger } from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((r) => r.filename));
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are zero-padded numeric prefixes, so lexical sort == execution order

  for (const file of files) {
    if (applied.has(file)) {
      logger.info({ file }, "Migration already applied, skipping");
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      logger.info({ file }, "Applied migration");
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ file, err }, "Migration failed, rolled back");
      throw err;
    } finally {
      client.release();
    }
  }
}

// Allow running as a standalone script: `node dist/db/migrate.js`
if (process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => {
      logger.info("All migrations applied successfully");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration run failed");
      process.exit(1);
    });
}
