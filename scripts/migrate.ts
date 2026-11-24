import nextEnv from "@next/env";
import { sql } from "drizzle-orm";
import { execFile } from "node:child_process";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());
const execFileAsync = promisify(execFile);

async function createPreMigrationBackup(): Promise<void> {
  if (process.env.BACKUP_BEFORE_MIGRATION === "false") return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName) throw new Error("DATABASE_NAME_MISSING");

  const directory = path.resolve(process.env.BACKUP_DIR ?? "./data/backups");
  await mkdir(directory, { recursive: true });
  const backupFile = path.join(
    directory,
    `cosmetics-pre-migration-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.dump`,
  );

  try {
    await execFileAsync(
      "pg_dump",
      [
        "-Fc",
        "-h", url.hostname,
        "-p", url.port || "5432",
        "-U", decodeURIComponent(url.username),
        "-d", databaseName,
        "-f", backupFile,
      ],
      {
        env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    console.log(`Pre-migration backup created: ${backupFile}`);
  } catch (error) {
    await unlink(backupFile).catch(() => undefined);
    if (process.env.NODE_ENV === "production" || process.env.BACKUP_BEFORE_MIGRATION === "true") {
      throw new Error(`PRE_MIGRATION_BACKUP_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn("Pre-migration backup unavailable locally; continuing with migration.", error);
  }
}

await createPreMigrationBackup();

const [{ migrate }, { db }] = await Promise.all([
  import("drizzle-orm/node-postgres/migrator"),
  import("../src/server/db"),
]);

await migrate(db, { migrationsFolder: "./drizzle" });

// Repair deployments whose migration journal or startup previously missed 0007/0008.
// This is intentionally run after Drizzle migrations and uses IF NOT EXISTS,
// so it is safe for both new and existing databases.
await db.execute(sql`
  ALTER TABLE "party_ledger"
  ADD COLUMN IF NOT EXISTS "cash_transaction_id" uuid
`);
await db.execute(sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'party_ledger_cash_transaction_id_cash_transactions_id_fk'
    ) THEN
      ALTER TABLE "party_ledger"
      ADD CONSTRAINT "party_ledger_cash_transaction_id_cash_transactions_id_fk"
      FOREIGN KEY ("cash_transaction_id")
      REFERENCES "public"."cash_transactions"("id")
      ON DELETE set null;
    END IF;
  END $$;
`);
await db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "party_ledger_cash_transaction_uq"
  ON "party_ledger" ("cash_transaction_id")
`);
console.log("Database migrations applied.");
