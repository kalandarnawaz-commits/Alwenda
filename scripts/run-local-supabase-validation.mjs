import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dbUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(dbUrl).hostname;

if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`[local-supabase] Refusing to validate a non-local database host: ${host}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`[local-supabase] ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_LOCAL_DB_URL: dbUrl
    },
    ...options
  });
}

function capture(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_LOCAL_DB_URL: dbUrl
    }
  });
}

async function dumpSchema(filePath) {
  const output = capture("pg_dump", [
    dbUrl,
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-comments"
  ]);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(filePath, output));
}

const workDir = await mkdtemp(path.join(tmpdir(), "alwenda-supabase-validation-"));

try {
  const firstDump = path.join(workDir, "schema-first.sql");
  const secondDump = path.join(workDir, "schema-second.sql");

  run("supabase", ["db", "reset", "--local"]);
  await dumpSchema(firstDump);

  run("supabase", ["db", "reset", "--local"]);
  await dumpSchema(secondDump);

  const firstSchema = await readFile(firstDump, "utf8");
  const secondSchema = await readFile(secondDump, "utf8");

  if (firstSchema !== secondSchema) {
    console.error("[local-supabase] Schema dump changed between clean rebuilds.");
    process.exit(1);
  }

  run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", "supabase/tests/rls_authorization.sql"]);
  console.log("[local-supabase] Clean rebuilds are deterministic and RLS probes passed.");
} finally {
  await rm(workDir, { recursive: true, force: true });
}
