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

test("create_marketplace_listing tool supports condition, pickup/delivery, and tags", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /condition: \{ type: "string", enum: LISTING_CONDITIONS/);
  assert.match(source, /pickupAvailable: \{ type: "boolean"/);
  assert.match(source, /deliveryAvailable: \{ type: "boolean"/);
  assert.match(source, /tags: \{\s*type: "array"/);
});

test("listing photo storage migration creates a public bucket with owner-scoped write policies", async () => {
  const source = await readRepoFile("supabase/migrations/202607170001_listing_photos_storage.sql");
  assert.match(source, /insert into storage\.buckets \(id, name, public\)/);
  assert.match(source, /values \('listing-photos', 'listing-photos', true\)/);
  assert.match(source, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
});

test("supabaseClient exposes real listing photo upload/fetch, not a mock", async () => {
  const source = await readRepoFile("src/services/auth/supabaseClient.js");
  assert.match(source, /export async function uploadListingPhoto/);
  assert.match(source, /supabase\.storage\.from\("listing-photos"\)\.upload/);
  assert.match(source, /export async function fetchListingImages/);
});

test("supabaseClient exposes a real help_requests insert/fetch, not a mock", async () => {
  const source = await readRepoFile("src/services/auth/supabaseClient.js");
  assert.match(source, /export async function createHelpRequest/);
  assert.match(source, /\.from\("help_requests"\)\s*\.insert/);
  assert.match(source, /export async function fetchMyHelpRequests/);
  assert.match(source, /\.from\("help_requests"\)\s*\.select/);
});

test("the manual Need Help form posts a real help request instead of only updating local state", async () => {
  const source = await readRepoFile("src/main.js");
  assert.match(source, /async function submitHelpRequest\(\)/);
  assert.match(source, /await createHelpRequest\(/);
  assert.doesNotMatch(source, /function submitHelpRequest\(\) \{[\s\S]{0,200}id: Date\.now\(\)/);
});

test("Alwen Edge Function enforces a per-user rate limit and daily cost ceiling before calling OpenAI", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /ALWEN_CHAT_RATE_LIMIT_PER_MINUTE/);
  assert.match(source, /ALWEN_CHAT_DAILY_COST_CAP_USD/);

  const rateLimitIdx = source.indexOf("recentRequestCount");
  const costCeilingIdx = source.indexOf("spentTodayUsd");
  const firstCallResponsesIdx = source.indexOf("let payload = await callResponses(input)");
  assert.ok(rateLimitIdx > -1 && rateLimitIdx < firstCallResponsesIdx, "rate limit must be checked before the first OpenAI call");
  assert.ok(costCeilingIdx > -1 && costCeilingIdx < firstCallResponsesIdx, "cost ceiling must be checked before the first OpenAI call");
  assert.match(source, /recentRequestCount \|\| 0\) >= RATE_LIMIT_PER_MINUTE/);
  assert.match(source, /spentTodayUsd >= DAILY_COST_CAP_USD/);
});

test("Alwen Edge Function screens for prompt injection before any OpenAI call, and logs flagged attempts", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /function looksLikePromptInjection/);
  assert.match(source, /ignore\\s\+\(all\\s\+\|previous\\s\+\|prior\\s\+\)\?instructions/);
  const injectionCheckIdx = source.indexOf("looksLikePromptInjection(message)");
  const firstCallResponsesIdx = source.indexOf("let payload = await callResponses(input)");
  assert.ok(injectionCheckIdx > -1 && injectionCheckIdx < firstCallResponsesIdx, "the injection screen must run before any OpenAI call");
  assert.match(source, /flagged_injection: true/);
});

test("Alwen Edge Function logs real per-request token usage and cost using verified gpt-4.1-mini pricing", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /function estimateCostUsd/);
  assert.match(source, /INPUT_TOKEN_USD_PER_MILLION = 0\.40/);
  assert.match(source, /OUTPUT_TOKEN_USD_PER_MILLION = 1\.60/);
  assert.match(source, /trackUsage\(payload\)/);
  assert.match(source, /payload\.usage\?\.input_tokens/);
  assert.match(source, /from\("alwen_chat_usage"\)\.insert/);
  // Usage must be tracked after every callResponses() call, not just the first
  // — translate mode's own call uses its own `translatePayload` variable
  // rather than the chat-mode `payload`, so match either.
  const trackUsageCalls = source.match(/trackUsage\(\w*[Pp]ayload\);/g) || [];
  const callResponsesCalls = source.match(/await callResponses\(/g) || [];
  assert.equal(trackUsageCalls.length, callResponsesCalls.length, "every callResponses() call must be followed by trackUsage()");
});

test("alwen_chat_usage migration exists with RLS scoped to the requesting user", async () => {
  const source = await readRepoFile("supabase/migrations/202607220002_alwen_chat_usage.sql");
  assert.match(source, /create table if not exists public\.alwen_chat_usage/);
  assert.match(source, /enable row level security/);
  assert.match(source, /user_id = auth\.uid\(\)/);
  assert.match(source, /flagged_injection boolean not null default false/);
  assert.match(source, /-- Rollback approach:/i);
  assert.doesNotMatch(source, /drop table|drop schema|truncate|delete from/i);
});
