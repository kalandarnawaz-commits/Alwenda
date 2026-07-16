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
