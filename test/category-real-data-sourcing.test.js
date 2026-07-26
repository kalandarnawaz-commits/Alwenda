import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const main = await readRepoFile("src/main.js");
const supabaseClient = await readRepoFile("src/services/auth/supabaseClient.js");
const analytics = await readRepoFile("src/services/analytics.js");
const migration = await readRepoFile("supabase/migrations/202607250001_category_taxonomy.sql");

/** Brace-matched, unlike a fixed-size slice — a fixed window can spill
 * into the next exported function (bit us once: fetchOpenHelpRequests'
 * neighbour fetchMyHelpRequests legitimately does select("*")). Skips past
 * the parameter list's own parens/braces (destructured params like
 * `{ limit = DEFAULT }` contain a brace) before counting body braces —
 * same convention as this repo's other extractFunction helpers. */
function extractExportedAsyncFunction(source, name) {
  const marker = `export async function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `export async function ${name} must exist`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.ok(paramsEnd !== -1, `Could not find end of parameter list for ${name}`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = paramsEnd; i < source.length; i += 1) {
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

test("opportunityFeed is a real state machine, not a boolean", () => {
  assert.match(main, /opportunityFeed:\s*\{\s*status:\s*"idle",\s*helpRequests:\s*\[\],\s*listings:\s*\[\],\s*loadedAt:\s*null\s*\}/);
  const refresh = extractFunction(main, "refreshOpportunityFeed");
  assert.match(refresh, /status:\s*"loading"/);
  assert.match(refresh, /status:\s*"loaded"/);
  assert.match(refresh, /status:\s*"error"/);
});

test("shouldUseFixtureOpportunities never falls back while loading or on error, and gates on isProductionHost", () => {
  const fn = extractFunction(main, "shouldUseFixtureOpportunities");
  assert.match(fn, /feed\.status !== "loaded"/);
  assert.match(fn, /return false/);
  assert.match(fn, /isProductionHost\(\)/);
});

test("renderLiveOpportunities has distinct loading, error, and empty branches", () => {
  const fn = extractFunction(main, "renderLiveOpportunities");
  assert.match(fn, /state\.opportunityFeed\.status === "loading"/);
  assert.match(fn, /state\.opportunityFeed\.status === "error"/);
  assert.match(fn, /data-action="retry-opportunity-feed"/);
  // The empty state only renders in the branch reached after both the
  // loading and error branches have already returned early.
  const errorBranchIndex = fn.indexOf('state.opportunityFeed.status === "error"');
  const emptyStateIndex = fn.indexOf("opportunities.noActiveYet");
  assert.ok(errorBranchIndex !== -1 && emptyStateIndex !== -1 && errorBranchIndex < emptyStateIndex, "error branch must appear before the empty-state render");
});

test("no hardcoded illustrative opportunity counts in the new render functions", () => {
  // renderCategoryHubCard/renderCategoryHubGrid/renderEarnToday were
  // removed by the Home redesign (Earn Today's grid is gone; Live Around
  // You is now the single-card-peek carousel built from
  // renderOpportunityCarouselCard) — this test now covers their survivors
  // and the new carousel card in their place.
  for (const name of ["renderOpportunityCarouselCard", "renderLiveAroundYou", "renderLiveOpportunities"]) {
    const fn = extractFunction(main, name);
    // Never a literal 2-3 digit number standing in for a count — every
    // count must come from a computed variable (count/opportunityCountForCategory).
    assert.doesNotMatch(fn, />\s*\d{2,}\s*(nearby|active)/i, `${name} must not hardcode an illustrative count`);
  }
});

test("real opportunity cards never claim a distance or fabricate a price", () => {
  const fn = extractFunction(main, "renderRealOpportunityCard");
  assert.doesNotMatch(fn, /\bdistance\b/i, "must not reference distance for real records (no real distance data available)");
  assert.match(fn, /record\.price_amount != null/, "price is only shown when the record actually has one");
});

test("carousel cards give screen readers a full-sentence label, not a bare number", () => {
  // renderCategoryHubCard was removed by the Home redesign — Live Around
  // You's premium carousel (renderOpportunityCarouselCard) keeps the same
  // accessibility contract its predecessor established: the accessible
  // label is built from real, non-empty summary lines, not a bare number.
  const fn = extractFunction(main, "renderOpportunityCarouselCard");
  assert.match(fn, /aria-label="\$\{escapeHtml\(accessibleLabel\)\}"/);
  assert.match(fn, /const accessibleLabel = \[label, primaryLine, secondaryLine\]\.filter\(Boolean\)\.join\(" — "\);/);
});

test("public opportunity fetch functions are bounded, deterministic, and column-scoped", () => {
  for (const name of ["fetchOpenHelpRequests", "fetchPublicListings"]) {
    const fn = extractExportedAsyncFunction(supabaseClient, name);
    assert.match(fn, /Math\.min\(Math\.max\(1, Number\(limit\)/, `${name} must clamp its limit`);
    assert.doesNotMatch(fn, /select\("\*"\)/, `${name} must not select * — explicit columns only`);
    assert.match(fn, /order\("created_at", \{ ascending: false \}\)/, `${name} must sort deterministically`);
  }
});

test("public opportunity fetch functions throw through the observability choke point rather than swallowing silently", () => {
  assert.match(extractExportedAsyncFunction(supabaseClient, "fetchOpenHelpRequests"), /throwIfError\(error, "fetchOpenHelpRequests"\)/);
  assert.match(extractExportedAsyncFunction(supabaseClient, "fetchPublicListings"), /throwIfError\(error, "fetchPublicListings"\)/);
});

test("category_id migration is nullable, additive, and does not touch existing enums or RLS", () => {
  assert.match(migration, /add column if not exists category_id text/);
  assert.doesNotMatch(migration, /drop\s+column/i);
  assert.doesNotMatch(migration, /alter\s+table.*disable row level security/i);
  assert.doesNotMatch(migration, /drop\s+policy/i);
  assert.doesNotMatch(migration, /check\s*\(/i, "must not add a new check constraint on category_id — it stays free-form/nullable");
  assert.match(migration, /create index if not exists help_requests_category_id_idx/);
  assert.match(migration, /create index if not exists listings_category_id_idx/);
});

test("category architecture analytics events carry only categoryId/surface, never message or query content", () => {
  for (const eventName of ["CATEGORY_HUB_VIEWED", "CATEGORY_SELECTED", "OPPORTUNITY_FILTER_APPLIED", "OPPORTUNITY_EMPTY_STATE_VIEWED", "CATEGORY_POST_STARTED", "CATEGORY_POST_SUBMITTED", "CATEGORY_CLASSIFIED_BY_ALWEN"]) {
    const line = analytics.split("\n").find((l) => l.includes(`ANALYTICS_EVENTS.${eventName}]`));
    assert.ok(line, `${eventName} must be declared in SCHEMA`);
    assert.match(line, /categoryId: "string", surface: "string"/);
  }
  // Every category_* trackEvent call site in main.js passes only categoryId/surface.
  const callSites = main.match(/trackEvent\("(category_[a-z_]+|opportunity_(filter_applied|empty_state_viewed))", \{[^}]*\}\)/g) || [];
  assert.ok(callSites.length >= 8, "expected at least 8 category/opportunity trackEvent call sites");
  for (const call of callSites) {
    assert.doesNotMatch(call, /\b(query|text|message|description)\s*:/, `call site must not carry free-text content: ${call}`);
  }
});

test("normalizeOpportunityCategory is used for category matching instead of raw string equality", () => {
  const filtered = extractFunction(main, "filteredLiveOpportunities");
  assert.match(filtered, /normalizeOpportunityCategory\(item\)/);
  const records = extractFunction(main, "opportunityRecordsForCategory");
  assert.match(records, /normalizeOpportunityCategory\(record\)/);
});

// This exact click-to-prefill path could not be exercised live in this
// session's dev preview: renderLiveOpportunities' post-CTA only renders
// once past its loading/error early-returns, and this dev environment's
// Supabase project doesn't have the category_id migration applied yet, so
// the real feed always errors before reaching that CTA. Covered here at
// the source level instead — see the PR's known-limitations note.
test("the category-hub post CTA carries data-category-id, and the [data-view] handler reads it into the right draft", () => {
  const postCta = extractFunction(main, "renderLiveOpportunities");
  assert.match(postCta, /data-view="needHelp" \$\{categoryId !== "all" \? `data-category-id="\$\{categoryId\}"` : ""\}/);

  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /if \(button\.dataset\.categoryId\)/);
  assert.match(bindEvents, /if \(button\.dataset\.view === "createListing"\) state\.listingDraft\.categoryId = button\.dataset\.categoryId;/);
  assert.match(bindEvents, /else if \(button\.dataset\.view === "needHelp"\) state\.helpRequestDraft\.categoryId = button\.dataset\.categoryId;/);
  assert.match(bindEvents, /trackEvent\("category_post_started", \{ categoryId: button\.dataset\.categoryId, surface: state\.opportunityFilter\.surface \}\)/);
});
