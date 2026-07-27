import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const supabaseClient = await readFile(new URL("../src/services/auth/supabaseClient.js", import.meta.url), "utf8");

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

test("help requests load public author profiles in one bounded batch", () => {
  const fetchOpenHelpRequests = extractExportedAsyncFunction(supabaseClient, "fetchOpenHelpRequests");
  assert.match(fetchOpenHelpRequests, /requester_user_id/, "help request author id must be selected");
  assert.match(fetchOpenHelpRequests, /created_by_alwen/, "system-created records must remain distinguishable");
  assert.match(fetchOpenHelpRequests, /new Set\(requests\.map/, "author ids should be de-duplicated before profile fetch");
  assert.match(fetchOpenHelpRequests, /fetchProfilesByIds\(requesterIds\)/, "profiles should be fetched as one batch");
  assert.doesNotMatch(fetchOpenHelpRequests, /select\("\*"\)/, "public feed must stay column-scoped");
});

test("public profile fetch is reusable and privacy-scoped", () => {
  const fetchProfilesByIds = extractExportedAsyncFunction(supabaseClient, "fetchProfilesByIds");
  assert.match(fetchProfilesByIds, /public_profiles/);
  assert.match(fetchProfilesByIds, /user_id, display_name, avatar_url, handle, verification_status, reputation_score/);
  assert.doesNotMatch(fetchProfilesByIds, /contact_email|contact_phone|private_profiles|select\("\*"\)/, "private profile data must never be selected for request cards");
});

test("help request display model keeps UUID ids as strings and separates author state", () => {
  const shaper = extractFunction(main, "shapeHelpRequestOpportunityForDisplay");
  assert.match(shaper, /id: String\(record\.id\)/, "UUIDs must be preserved as strings");
  assert.doesNotMatch(shaper, /Number\(/, "UUIDs must not be coerced through Number()");
  assert.match(shaper, /author: publicHelpRequestAuthor\(record\)/);
  assert.match(shaper, /sourceType: record\.requester_user_id \? "user" : record\.created_by_alwen \? "system" : "legacy"/);

  const author = extractFunction(main, "publicHelpRequestAuthor");
  assert.match(author, /verification_status === "verified"/, "verified badge must depend on real profile status");
  assert.doesNotMatch(author, /reputation_score|reputation:/, "help request cards should not expose reputation fields they do not render");
  assert.doesNotMatch(author, /Verified user has posted|Alex Walker|iPhone 15 Pro/, "request cards must not invent fixture profile copy");
});

test("real help request cards expose distinct request and profile destinations", () => {
  const card = extractFunction(main, "renderRealOpportunityCard");
  assert.match(card, /people-request-card/);
  assert.match(card, /data-view="liveOpportunityDetail"/);
  assert.match(card, /data-opportunity-id/);
  assert.match(card, /data-user-profile-target/, "author/profile controls must link to public profile routing");
  assert.match(card, /opportunities\.viewRequest/);
  assert.match(card, /common\.viewProfile/);
});

test("real help request detail never falls back to the first fixture for unknown ids", () => {
  const detail = extractFunction(main, "renderLiveOpportunityDetail");
  assert.match(detail, /renderRealHelpRequestDetail\(realRequest\)/);
  assert.match(detail, /refreshRemoteHelpRequestDetail\(state\.selectedOpportunityId\)/);
  assert.match(detail, /detailNotFound/);
  assert.match(detail, /const fixtureItem = findOpportunityById\(state\.selectedOpportunityId\)/);
  assert.doesNotMatch(detail, /findOpportunityById\(state\.selectedOpportunityId\) \|\| LIVE_OPPORTUNITIES\[0\]/);
});
