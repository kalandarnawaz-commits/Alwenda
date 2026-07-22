import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// analytics.js reads window.localStorage/sessionStorage for device/session
// ids — this repo's test suite runs under plain Node (no DOM), so a
// minimal in-memory stand-in is needed, mirroring how the app's own
// try/catch fallbacks already treat a missing storage API as non-fatal.
function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = createMemoryStorage();
globalThis.window.sessionStorage = createMemoryStorage();

import {
  ANALYTICS_EVENTS,
  validateEventPayload,
  buildAnalyticsEventRecord,
  getOrCreateAnonymousId,
  getOrCreateSessionId
} from "../src/services/analytics.js";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("every known event validates with its correct payload shape", () => {
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.BUSINESS_VIEWED, { businessId: "b1", category: "Food & Drink" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.BUSINESS_VIEWED, { businessId: "b1" }).ok, true, "category is optional");
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.SESSION_STARTED, {}).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.TRANSLATION_COMPLETED, { from: "en", to: "lt", length: 12, chunkCount: 1 }).ok, true);
});

test("all 7 Alwen 2.0 events validate with their real call-site payload shapes", () => {
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_CONVERSATION_STARTED, { mode: "chat" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_CONVERSATION_STARTED, {}).ok, true, "mode is optional");
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_MESSAGE_SUBMITTED, { messageType: "text", intentType: "place_search", hasConversation: true }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_VOICE_INPUT_USED, { messageType: "voice" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_TRANSLATION_COMPLETED, { fromLanguage: "en", toLanguage: "lt" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_STRUCTURED_RESULT_OPENED, { resultType: "place", resultCount: 3 }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_CONTEXTUAL_ACTION_SELECTED, { actionType: "directions", resultType: "place" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_CONTEXTUAL_ACTION_SELECTED, { actionType: "play" }).ok, true, "resultType is optional");
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.ALWEN_FAILURE_SHOWN, { errorCategory: "rate_limited" }).ok, true);
});

test("Alwen 2.0 events reject message/translation/query content passed as an undeclared field", () => {
  const result = validateEventPayload(ANALYTICS_EVENTS.ALWEN_MESSAGE_SUBMITTED, { messageType: "text", intentType: "general_conversation", hasConversation: true, text: "I need a plumber" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /undeclared field/);
});

test("rejects an unknown event name", () => {
  const result = validateEventPayload("totally_made_up_event", {});
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown analytics event name/);
});

test("rejects a missing required field", () => {
  const result = validateEventPayload(ANALYTICS_EVENTS.BUSINESS_VIEWED, {});
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing required field "businessId"/);
});

test("rejects a field with the wrong type", () => {
  const result = validateEventPayload(ANALYTICS_EVENTS.ALWEN_CHAT_SUCCEEDED, { messageLength: "12" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /must be a number/);
});

test("rejects undeclared extra fields — the schema is a real contract, not a suggestion", () => {
  const result = validateEventPayload(ANALYTICS_EVENTS.SIGN_OUT, { unexpectedField: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /undeclared field/);
});

test("business_contacted and session_started exist for the two questions this task named", () => {
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.BUSINESS_CONTACTED, { businessId: "b1" }).ok, true);
  assert.equal(validateEventPayload(ANALYTICS_EVENTS.SESSION_STARTED, {}).ok, true);
});

test("buildAnalyticsEventRecord stamps a stable anonymous/session id and the right shape for the analytics_events table", () => {
  const record = buildAnalyticsEventRecord(ANALYTICS_EVENTS.BUSINESS_VIEWED, { businessId: "b1" }, { userId: "user-1", appEnv: "test", appRelease: "1.0.0" });
  assert.equal(record.name, ANALYTICS_EVENTS.BUSINESS_VIEWED);
  assert.deepEqual(record.props, { businessId: "b1" });
  assert.equal(record.user_id, "user-1");
  assert.equal(record.app_env, "test");
  assert.equal(record.app_release, "1.0.0");
  assert.equal(typeof record.anonymous_id, "string");
  assert.equal(typeof record.session_id, "string");
  assert.equal(record.anonymous_id, getOrCreateAnonymousId(), "anonymous id must be stable across calls in the same environment");
  assert.equal(record.session_id, getOrCreateSessionId(), "session id must be stable within the same session");
});

test("buildAnalyticsEventRecord allows a null user_id for anonymous/pre-login activity", () => {
  const record = buildAnalyticsEventRecord(ANALYTICS_EVENTS.SESSION_STARTED, {});
  assert.equal(record.user_id, null);
});

test("main.js wires the typed schema into trackEvent, ships to Supabase, and fires business_contacted/session_started", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /import \{ validateEventPayload, buildAnalyticsEventRecord, AnalyticsSchemaError \} from "\.\/services\/analytics\.js/);
  assert.match(main, /recordAnalyticsEvent\(record\)/);
  assert.match(main, /trackEvent\("business_contacted", \{ businessId: String\(item\.id\) \}\)/);
  assert.match(main, /function trackSessionStartedOncePerDay\(\)/);
  assert.match(main, /trackSessionStartedOncePerDay\(\);/);
});

test("analytics_events migration exists with RLS, insert-own policy, and admin-only broader access", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220001_analytics_events.sql");
  assert.match(sql, /create table if not exists public\.analytics_events/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /user_id is null or user_id = auth\.uid\(\)/);
  assert.match(sql, /public\.is_trusted_admin\(\)/);
  assert.match(sql, /-- Rollback approach:/i);
  assert.doesNotMatch(sql, /drop table|drop schema|truncate|delete from/i);
});
