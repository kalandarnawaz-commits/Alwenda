import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const destructivePatterns = [
  /\bdrop\s+table\b/i,
  /\bdrop\s+schema\b/i,
  /\balter\s+table\b[\s\S]{0,120}\bdrop\s+column\b/i,
  /\btruncate\s+table\b/i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+owned\b/i
];

function fail(message) {
  console.error(`[migration-check] ${message}`);
  process.exitCode = 1;
}

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const identifiers = new Set();
const migrationTexts = new Map();

for (const file of files) {
  const match = file.match(/^(\d{12,14})_[a-z0-9_]+\.sql$/);
  if (!match) fail(`${file} must use a numeric timestamp prefix and snake_case description.`);
  const identifier = match?.[1];
  if (identifier && identifiers.has(identifier)) fail(`${file} duplicates migration identifier ${identifier}.`);
  if (identifier) identifiers.add(identifier);
}

const sorted = [...files].sort();
if (JSON.stringify(files) !== JSON.stringify(sorted)) fail("Migration filenames are not lexicographically ordered.");

for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  migrationTexts.set(file, sql);
  if (!/rollback approach:/i.test(sql)) fail(`${file} must document a rollback approach.`);
  for (const pattern of destructivePatterns) {
    if (pattern.test(sql)) fail(`${file} contains a potentially destructive operation: ${pattern}`);
  }

  const publicTables = [...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map((match) => match[1]);
  const allSql = [...migrationTexts.values(), ...(await Promise.all(files.filter((name) => !migrationTexts.has(name)).map((name) => readFile(path.join(migrationsDir, name), "utf8"))))].join("\n");
  for (const table of publicTables) {
    const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!rlsPattern.test(allSql)) fail(`${file} creates public.${table} without enabling RLS in migrations.`);
  }
}

if (!process.exitCode) {
  console.log(`[migration-check] ${files.length} migrations validated.`);
}
