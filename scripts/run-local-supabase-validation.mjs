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

function stripRestrictGuards(sql) {
  // pg_dump 17+ wraps output in \restrict/\unrestrict lines carrying a
  // fresh random nonce on every run (a psql meta-command safety feature) —
  // they're not schema content and would make every dump "differ" even
  // when nothing about the schema actually changed.
  return sql
    .split("\n")
    .filter((line) => !/^\\(restrict|unrestrict)\b/.test(line))
    .join("\n");
}

async function dumpSchema(filePath) {
  const output = capture("pg_dump", [
    dbUrl,
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-comments"
  ]);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(filePath, stripRestrictGuards(output)));
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
    const firstLines = firstSchema.split("\n");
    const secondLines = secondSchema.split("\n");
    const maxLines = Math.max(firstLines.length, secondLines.length);
    let shown = 0;
    for (let i = 0; i < maxLines && shown < 40; i += 1) {
      if (firstLines[i] !== secondLines[i]) {
        console.error(`  line ${i + 1}:`);
        console.error(`    first:  ${firstLines[i] ?? "<missing>"}`);
        console.error(`    second: ${secondLines[i] ?? "<missing>"}`);
        shown += 1;
      }
    }
    process.exit(1);
  }

  const rlsProbesPath = "supabase/tests/rls_authorization.sql";
  const rlsProbesExist = await import("node:fs/promises").then(({ access }) =>
    access(path.resolve(rlsProbesPath)).then(() => true, () => false)
  );

  if (rlsProbesExist) {
    run("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", rlsProbesPath]);
    console.log("[local-supabase] Clean rebuilds are deterministic and RLS probes passed.");
  } else {
    console.log(`[local-supabase] Clean rebuilds are deterministic. ${rlsProbesPath} not present on this branch — RLS probes skipped.`);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}
