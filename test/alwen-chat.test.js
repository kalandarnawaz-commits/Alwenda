import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

async function readSourceTree(dir) {
  const entries = await readdir(`${rootDir}${dir}`, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return readSourceTree(path);
      if (!entry.isFile()) return [];
      return [{ path, text: await readRepoFile(path) }];
    })
  );
  return files.flat();
}

test("Alwen chat client validates empty and overlong messages before network calls", async () => {
  const { validateAlwenMessage } = await import("../src/services/alwenChatClient.js");
  assert.equal(validateAlwenMessage("  Need a plumber  "), "Need a plumber");
  assert.throws(() => validateAlwenMessage(" "), /Tell Alwen/);
  assert.throws(() => validateAlwenMessage("x".repeat(2001)), /under 2000/);
});

test("browser source never references OPENAI_API_KEY", async () => {
  const sourceFiles = await readSourceTree("src");
  for (const file of sourceFiles) {
    assert.ok(!file.text.includes("OPENAI_API_KEY"), `${file.path} must not expose OPENAI_API_KEY`);
  }

  const envExample = await readRepoFile("env.example.js");
  assert.ok(!envExample.includes("OPENAI_API_KEY"), "env.example.js must not ask for the OpenAI key");
});

test("Alwen Edge Function requires auth, secret env key, and OpenAI Responses API", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(source, /Authorization: `Bearer \$\{OPENAI_API_KEY\}`/);
  assert.match(source, /Authentication required\.", 401/);
  assert.match(source, /A message is required\.", 400/);
  assert.match(source, /Alwen is not configured yet\.", 503/);
  assert.match(source, /If the user writes in Lithuanian, answer in Lithuanian/);
  assert.ok(!source.includes("console.log(OPENAI_API_KEY"));
});

test("Alwen Edge Function only recommends Alwenda's own features", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /never send them to an outside site/);
  assert.match(source, /Skelbiu\.lt/);
});

test("Alwen Edge Function persists conversation history and only creates a hire request after confirmation", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /from\("alwen_conversations"\)/);
  assert.match(source, /from\("alwen_messages"\)/);
  assert.match(source, /create_hire_request/);
  assert.match(source, /only call this AFTER the user has explicitly confirmed/i);
  assert.match(source, /from\("help_requests"\)/);
  assert.match(source, /requester_user_id: authData\.user\.id/);
});

test("help_requests migration exists with RLS scoped to the requester", async () => {
  const source = await readRepoFile("supabase/migrations/202607160001_alwen_help_requests.sql");
  assert.match(source, /create table if not exists public\.help_requests/);
  assert.match(source, /enable row level security/);
  assert.match(source, /auth\.uid\(\) = requester_user_id/);
});

test("Alwen Edge Function can also create a marketplace listing after confirmation", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /create_marketplace_listing/);
  assert.match(source, /from\("listings"\)/);
  assert.match(source, /owner_user_id: authData\.user\.id/);
  assert.match(source, /status: "published"/);
});

test("Alwen chat client passes through createdHelpRequest and createdListing", async () => {
  const source = await readRepoFile("src/services/alwenChatClient.js");
  assert.match(source, /createdHelpRequest: payload\.createdHelpRequest \|\| null/);
  assert.match(source, /createdListing: payload\.createdListing \|\| null/);
});
