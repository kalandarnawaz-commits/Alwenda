import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Real (Supabase-backed) 1:1 messaging for Marketplace listings and Help
   Requests, replacing the old mock messageThreads system that fabricated
   an instant reply and never persisted anything. Scope, decided across
   three rounds with the user: Listing and Help Request messaging go real
   (both have a real owner/author user id); Business messaging's only
   reachable entry point was the legacy fake businesses profile page, so
   it's removed rather than faked; Professional/Hire messaging is removed
   outright — serviceProfessionals is fabricated placeholder data with no
   real user account behind it. The Inbox tab now reads real conversations
   only. ---------------------------------------------------------------*/

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (bodyStart === -1) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

function extractExportedAsyncFunction(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start !== -1, `export async function ${name} must exist`);
  const signatureEnd = source.indexOf(")", start);
  assert.ok(signatureEnd !== -1, `export async function ${name} must have a complete signature`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = signatureEnd + 1; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (bodyStart === -1) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

let main;
let mockData;
let supabaseClient;
let migrationSql;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  mockData = await readRepoFile("src/data/mockData.js");
  supabaseClient = await readRepoFile("src/services/auth/supabaseClient.js");
  migrationSql = await readRepoFile("supabase/migrations/202608010001_help_request_messaging.sql");
});

/* ---------------------------------------------------------------------
   1. Migration — idempotent, additive-only, documents a rollback.
--------------------------------------------------------------------- */

test("the help_request_messaging migration adds 'help_request' to the context_type check constraint idempotently", () => {
  assert.match(migrationSql, /do \$\$/, "the constraint swap must be wrapped in a DO block for idempotency");
  assert.match(migrationSql, /drop constraint %I/);
  assert.match(migrationSql, /context_type in \('listing', 'business', 'booking', 'support', 'help_request'\)/);
});

test("the migration adds a unique index making find-or-create atomic against double-clicks", () => {
  assert.match(migrationSql, /create unique index if not exists conversations_context_creator_unique_idx/);
  assert.match(migrationSql, /on public\.conversations \(context_type, context_id, created_by\)/);
});

test("the migration documents a rollback approach", () => {
  assert.match(migrationSql, /Rollback approach:/i);
});

/* ---------------------------------------------------------------------
   2. supabaseClient.js — new real messaging functions are column-scoped,
      auth-checked, and never fabricate data.
--------------------------------------------------------------------- */

test("findOrCreateConversation is auth-gated, blocks self-messaging, and never selects *", () => {
  const fn = extractExportedAsyncFunction(supabaseClient, "findOrCreateConversation");
  assert.match(fn, /throw new AuthNotConfiguredError\(\)/);
  assert.match(fn, /user\.id === recipientUserId/, "must guard against messaging yourself");
  assert.doesNotMatch(fn, /select\("\*"\)/);
});

test("findOrCreateConversation is atomic — upserts on the unique index for both the conversation row and both participant rows", () => {
  const fn = extractExportedAsyncFunction(supabaseClient, "findOrCreateConversation");
  assert.match(fn, /\.upsert\(\s*\{ created_by: user\.id, subject, context_type: contextType, context_id: contextId \},\s*\{ onConflict: "context_type,context_id,created_by" \}/);
  assert.match(fn, /onConflict: "conversation_id,user_id", ignoreDuplicates: true/);
});

test("fetchMyConversations and fetchLatestMessagesByConversationIds are auth-scoped and column-scoped", () => {
  const conversations = extractExportedAsyncFunction(supabaseClient, "fetchMyConversations");
  assert.match(conversations, /throw new AuthNotConfiguredError\(\)/);
  assert.doesNotMatch(conversations, /select\("\*"\)/);

  const latest = extractExportedAsyncFunction(supabaseClient, "fetchLatestMessagesByConversationIds");
  assert.doesNotMatch(latest, /select\("\*"\)/);
  assert.match(latest, /order\("created_at", \{ ascending: false \}\)/);
});

test("fetchConversationMessages and sendMessage are column-scoped; sendMessage is auth-checked and rejects an empty body", () => {
  const fetchMessages = extractExportedAsyncFunction(supabaseClient, "fetchConversationMessages");
  assert.doesNotMatch(fetchMessages, /select\("\*"\)/);

  const send = extractExportedAsyncFunction(supabaseClient, "sendMessage");
  assert.match(send, /throw new AuthNotConfiguredError\(\)/);
  assert.match(send, /if \(!trimmed\) throw new Error/);
  assert.doesNotMatch(send, /select\("\*"\)/);
});

/* ---------------------------------------------------------------------
   3. Help Request detail page — the actual fix for the original bug
      report: a working Message button instead of "Reply coming soon".
--------------------------------------------------------------------- */

test("renderRealHelpRequestDetail shows a real Message button for signed-in non-authors, hides it on your own request, and drops the dead 'reply coming soon' placeholder", () => {
  const fn = extractFunction(main, "renderRealHelpRequestDetail");
  assert.match(fn, /data-action="message-help-request-author"/);
  assert.match(fn, /data-help-request-id="\$\{escapeHtml\(request\.id\)\}"/);
  assert.match(fn, /state\.auth\.user\?\.id === request\.author\.userId/, "must hide the CTA on your own request");
  assert.doesNotMatch(fn, /opportunities\.replyComingSoon/);
  assert.doesNotMatch(fn, /disabled aria-disabled="true"/);
});

test("opportunities.replyComingSoon is fully removed from every locale, not just unused", async () => {
  for (const locale of ["en", "lt", "de"]) {
    const json = JSON.parse(await readRepoFile(`locales/${locale}.json`));
    assert.equal(json.opportunities?.replyComingSoon, undefined, `locales/${locale}.json must not keep opportunities.replyComingSoon`);
  }
});

test("startHelpRequestConversation resolves the real author id from the loaded detail record and opens a real conversation", () => {
  const fn = extractFunction(main, "startHelpRequestConversation");
  assert.match(fn, /state\.auth\.status !== "signedIn"/);
  assert.match(fn, /publicHelpRequestAuthor\(record\)/);
  assert.match(fn, /author\.userId === state\.auth\.user\.id/, "must not let a requester message themselves");
  assert.match(fn, /openRealConversation\(/);
});

/* ---------------------------------------------------------------------
   4. The old mock messaging system is fully deleted, not left half-used.
--------------------------------------------------------------------- */

test("the mock messaging system (messageThreads, openGeneratedConversation, and every start*Conversation helper it powered) is fully gone from main.js", () => {
  for (const symbol of [
    "messageThreads",
    "openGeneratedConversation",
    "createConversationNotification",
    "startProfessionalConversation",
    "startBusinessConversation",
    "startOpportunityConversation",
    "CONVERSATION_TYPE_META",
    "CONVERSATION_CONTEXT_LABEL_KEY"
  ]) {
    assert.doesNotMatch(main, new RegExp(`\\b${symbol}\\b`), `${symbol} must not remain anywhere in main.js`);
  }
});

test("messageThreads is fully deleted from mockData.js, not just unused", () => {
  assert.doesNotMatch(mockData, /export const messageThreads/);
});

test("no dead click target remains for the removed Professional/Business message-and-book buttons", () => {
  assert.doesNotMatch(main, /data-action="start-pro-conversation"/);
  assert.doesNotMatch(main, /data-action="start-business-conversation"/);
  assert.doesNotMatch(main, /data-action="start-opportunity-conversation"/);
  assert.doesNotMatch(main, /data-person-action="request-booking"/);
});

test("business_contacted analytics event is fully removed — its sole firer no longer exists", async () => {
  const analytics = await readRepoFile("src/services/analytics.js");
  assert.doesNotMatch(analytics, /BUSINESS_CONTACTED/);
  assert.doesNotMatch(analytics, /business_contacted/);
});

/* ---------------------------------------------------------------------
   5. Inbox — reads real conversations only, never the deleted mock array.
--------------------------------------------------------------------- */

test("renderInboxBody and renderConversationRow read from state.inbox, never a literal mock array", () => {
  const inboxBody = extractFunction(main, "renderInboxBody");
  assert.match(inboxBody, /state\.inbox\.conversations/);
  assert.doesNotMatch(inboxBody, /messageThreads/);

  const row = extractFunction(main, "renderConversationRow");
  assert.match(row, /state\.inbox\.previews\.get\(conversation\.id\)/);
  assert.doesNotMatch(row, /messageThreads/);
});

test("renderConversationDetail reads from state.conversationDetail (real data), never the deleted mock thread lookup", () => {
  const detail = extractFunction(main, "renderConversationDetail");
  assert.match(detail, /state\.conversationDetail/);
  assert.doesNotMatch(detail, /messageThreads\.find/);
});

test("real conversation messages render sender identity from message.sender_user_id (real column), not a fabricated 'from' field", () => {
  const detail = extractFunction(main, "renderConversationDetail");
  assert.match(detail, /message\.sender_user_id === state\.auth\.user\?\.id/);
  assert.doesNotMatch(detail, /message\.from === "me"/);
});
