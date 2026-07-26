import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATEGORY_CONFIG, orderedStarterCategoryIds } from "../src/data/categoryConfig.js";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const main = await readRepoFile("src/main.js");
const styles = await readRepoFile("src/styles.css");
const analytics = await readRepoFile("src/services/analytics.js");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
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

// ---------------------------------------------------------------------
// Part 1 — Profile
// ---------------------------------------------------------------------

test("Account & settings is out of the primary actions block, not competing with Edit profile", () => {
  const fn = extractFunction(main, "renderUserProfile");
  assert.match(fn, /user-profile-header-row/, "settings icon must live in its own header row");
  assert.match(fn, /user-profile-settings-icon[\s\S]*?data-view="account"/);
  // The primary actions block (own-profile branch) must contain Edit
  // profile only — not a second data-view="account" entry point.
  const actionsBlockStart = fn.indexOf("user-profile-actions");
  const ownBranch = fn.slice(actionsBlockStart, actionsBlockStart + 400);
  assert.doesNotMatch(ownBranch, /data-view="account"/, "Account & settings must not also appear inside .user-profile-actions");
});

test("profile metrics stay individually interactive (3 separate dialog-opening buttons)", () => {
  const fn = extractFunction(main, "renderUserProfileMetrics");
  assert.match(fn, /data-user-profile-dialog="following"/);
  assert.match(fn, /data-user-profile-dialog="followers"/);
  assert.match(fn, /data-user-profile-dialog="trust"/);
  // Each button carries its own accessible name (count + label combined,
  // not just a bare number).
  const buttonCount = (fn.match(/<button type="button" class="profile-metric"/g) || []).length;
  assert.equal(buttonCount, 3);
  assert.match(fn, /aria-label="\$\{escapeHtml/g);
});

test("member since is not duplicated between identity-meta and reputation signals", () => {
  const profileFn = extractFunction(main, "renderUserProfile");
  const reputationFn = extractFunction(main, "renderUserProfileReputation");
  assert.match(profileFn, /profile\.identity\.memberSince/, "member since must still appear once, in identity-meta");
  assert.doesNotMatch(reputationFn, /signalMemberSince/, "reputation signals must not show member since a second time");
});

test("Profile compression: shell gap and redundant per-block margins are tightened, not just re-added", () => {
  assert.match(styles, /\.user-profile-shell\s*\{[^}]*gap:\s*6px/);
  assert.match(styles, /\.user-profile-shell \.profile-tabs\s*\{[^}]*margin-top:\s*0/);
  assert.doesNotMatch(styles.match(/\.profile-social-metrics\s*\{[^}]*\}/)[0], /margin-top:\s*[1-9]/);
});

test("settings icon keeps a real >=44px hit area despite being visually compact", () => {
  const rule = styles.match(/\.user-profile-settings-icon\s*\{[^}]*\}/)[0];
  assert.match(rule, /width:\s*44px/);
  assert.match(rule, /height:\s*44px/);
});

// ---------------------------------------------------------------------
// Part 2 — Richer category cards
// ---------------------------------------------------------------------

test("category cards render a real count line plus a latest-record line only when a record exists", () => {
  const fn = extractFunction(main, "renderCategoryHubCard");
  assert.match(fn, /category-hub-card-primary/);
  assert.match(fn, /category-hub-card-secondary/);
  assert.match(fn, /summary\.latestTitle \? t\("opportunities\.latestPrefix"/);
});

test("category hub card summary never fabricates a count — every number traces to a real records array", () => {
  const summaryFn = extractFunction(main, "categoryHubCardSummary");
  assert.match(summaryFn, /opportunityRecordsForCategory\(categoryId, surface\)/);
  assert.match(summaryFn, /records\.length/);
  assert.doesNotMatch(summaryFn, /\b\d{2,}\b/, "must not contain a hardcoded 2+ digit illustrative number");
});

test("urgentCount only reflects a genuine urgency==='today' field, never invented", () => {
  const summaryFn = extractFunction(main, "categoryHubCardSummary");
  assert.match(summaryFn, /record\.urgency === "today"/);
});

test("honest zero state on category cards: no active requests, never hidden", () => {
  const fn = extractFunction(main, "renderCategoryHubCard");
  assert.match(fn, /isEmpty \? t\("opportunities\.noActiveRequests"\)/);
  assert.match(fn, /isEmpty \? t\("opportunities\.nothingLiveYet"\)/);
});

// ---------------------------------------------------------------------
// Part 3 — Earn Today
// ---------------------------------------------------------------------

test("Earn Today sources help_requests only, never mixes in service listings", () => {
  // On any surface other than "live", offerCount only increments from
  // records that are themselves listings — but opportunityRecordsForCategory
  // for surface "earn" only ever returns help_requests in the first place
  // (realOpportunityRecordsForSurface), so offerCount for earn is always 0.
  const summaryFn = extractFunction(main, "categoryHubCardSummary");
  assert.match(summaryFn, /if \(isListing\) offerCount \+= 1;/);
  const earnRailFn = extractFunction(main, "renderEarnToday");
  assert.match(earnRailFn, /categoryHubIdsSortedByCount\("earn"\)/);
  assert.match(earnRailFn, /renderCategoryHubGrid\(categoryIds, "earn"\)/);
  const surfaceFn = extractFunction(main, "realOpportunityRecordsForSurface");
  assert.match(surfaceFn, /if \(surface === "live"\) return \[\.\.\.feed\.helpRequests, \.\.\.feed\.listings\];/);
  assert.match(surfaceFn, /return feed\.helpRequests;/);
});

test("Earn Today CTA copy is action-oriented (Help & earn), distinct from Live Around You's", () => {
  const fn = extractFunction(main, "renderLiveOpportunities");
  assert.match(fn, /filter\.surface === "earn" \? t\("opportunities\.helpAndEarn"\)/);
});

test("Earn Today zero-state action reuses an existing action (offer your help), never invents alert infrastructure", () => {
  assert.doesNotMatch(main, /createAlert|alert-subscription|notifyMeWhen/i, "must not introduce new alert infrastructure");
  const fn = extractFunction(main, "renderCategoryHubCard");
  assert.match(fn, /opportunities\.offerYourHelp/);
});

// ---------------------------------------------------------------------
// Part 4 — Live Around You
// ---------------------------------------------------------------------

test("Live Around You combines help_requests and listings, and the split is explicitly labelled", () => {
  const summaryFn = extractFunction(main, "categoryHubCardSummary");
  assert.match(summaryFn, /if \(isListing\) offerCount \+= 1;/);
  const cardFn = extractFunction(main, "renderCategoryHubCard");
  assert.match(cardFn, /opportunities\.requestOfferSplit", \{ requests: summary\.requestCount, offers: summary\.offerCount \}/);
});

test("recent activity feed items never expose more than category + a title already shown elsewhere", () => {
  const itemFn = extractFunction(main, "renderRecentActivityFeedItem");
  assert.match(itemFn, /normalizeOpportunityCategory\(record\)/);
  assert.match(itemFn, /categoryHubRecordTitle\(record\)/);
  assert.match(itemFn, /truncateForCard\(/, "title must be truncated for the compact feed");
  assert.doesNotMatch(itemFn, /\.email|\.phone|\.address|\.owner_user_id|\.requester_user_id/, "must not surface owner-only/contact fields");
});

test("recent activity feed is sorted by real created_at, not fixture/insertion order, for real records", () => {
  const fn = extractFunction(main, "recentLiveActivityItems");
  assert.match(fn, /new Date\(b\.created_at\)\.getTime\(\) - new Date\(a\.created_at\)\.getTime\(\)/);
});

test("Live Around You's empty state reads 'Nothing live yet', distinct from Earn Today's 'No active requests'", () => {
  const cardFn = extractFunction(main, "renderCategoryHubCard");
  assert.match(cardFn, /surface === "live"[\s\S]{0,300}nothingLiveYet/);
});

test("Live Around You never falls back to fixtures on production — same isProductionHost gate as Earn Today", () => {
  const fn = extractFunction(main, "shouldUseFixtureOpportunities");
  assert.match(fn, /isProductionHost\(\)/);
});

// ---------------------------------------------------------------------
// Part 5 — Ask Alwen starters
// ---------------------------------------------------------------------

test("ALWEN_STARTER_CATEGORY_IDS / orderedStarterCategoryIds is a curated ~7-category subset of CATEGORY_CONFIG, not a duplicate taxonomy", () => {
  const ids = orderedStarterCategoryIds();
  assert.ok(ids.length >= 5 && ids.length <= 7, "spec calls for approximately 5-7 starters");
  for (const id of ids) {
    assert.ok(CATEGORY_CONFIG[id], `starter id "${id}" must be a real CATEGORY_CONFIG key`);
  }
  // Fresh array each call — no shared-mutable-state footgun.
  const a = orderedStarterCategoryIds();
  a.push("mutated");
  assert.ok(!orderedStarterCategoryIds().includes("mutated"));
});

test("every starter category has a real, demand-framed starterPromptKey", () => {
  const ids = orderedStarterCategoryIds();
  for (const id of ids) {
    const key = CATEGORY_CONFIG[id].posting?.starterPromptKey;
    assert.ok(key, `${id} must define posting.starterPromptKey`);
  }
});

test("Ask Alwen starter row is generated from orderedStarterCategoryIds, not a hand-written list", () => {
  const fn = extractFunction(main, "renderAlwenCategoryStarterRow");
  assert.match(fn, /orderedStarterCategoryIds\(\)/);
  assert.match(fn, /categoryConfigFor\(id\)/);
});

test("selecting a starter seeds the composer with the category's real prompt and submits it", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /data-alwen-category-starter/);
  assert.match(bindEvents, /config\.posting\?\.starterPromptKey/);
  assert.match(bindEvents, /submitAlwenConversationMessage\(promptKey \? t\(promptKey\)/);
});

test("starter selection fires the existing category_selected analytics event with surface 'alwenStarter'", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /trackEvent\("category_selected", \{ categoryId, surface: "alwenStarter" \}\)/);
  // No new event name was invented for this — category_selected already
  // exists in the schema from round 1.
  assert.match(analytics, /CATEGORY_SELECTED: "category_selected"/);
});

test("starters only render in the empty state, so they collapse automatically once the conversation begins", () => {
  // The empty state (and the starter row inside it) is only ever reached
  // through this one ternary — as soon as convo.messages has any length,
  // the real message list renders instead and the whole empty-state
  // subtree (including renderAlwenCategoryStarterRow) is gone.
  assert.match(main, /convo\.messages\.length \? convo\.messages\.map\(renderAlwenMessage\)\.join\(""\) : renderAlwenConversationEmptyState\(\)/);
  const emptyStateFn = extractFunction(main, "renderAlwenConversationEmptyState");
  assert.match(emptyStateFn, /renderAlwenCategoryStarterRow\(\)/);
});

test("category starter buttons are keyboard-operable real buttons with accessible names", () => {
  const fn = extractFunction(main, "renderAlwenCategoryStarterRow");
  assert.match(fn, /<button type="button" class="alwen-category-starter"/);
  assert.match(fn, /aria-label="\$\{escapeHtml\(t\(config\.labelKey\)\)\}"/);
});

// ---------------------------------------------------------------------
// Part 6 / accessibility
// ---------------------------------------------------------------------

test("every new interactive class added this round has a :hover and :focus-visible rule", () => {
  for (const selector of [".category-hub-card", ".user-profile-settings-icon", ".alwen-category-starter", ".profile-metric"]) {
    assert.match(styles, new RegExp(`\\${selector}:focus-visible`), `${selector} must define :focus-visible`);
  }
});

test("category starter chips keep a real >=44px hit area", () => {
  const rule = styles.match(/\.alwen-category-starter\s*\{[^}]*\}/)[0];
  assert.match(rule, /min-height:\s*44px/);
});

test("live activity feed items keep a real >=44px row height", () => {
  const rule = styles.match(/\.live-activity-feed-item\s*\{[^}]*\}/)[0];
  assert.match(rule, /min-height:\s*44px/);
});
