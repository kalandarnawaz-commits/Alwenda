import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

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

// Category architecture sprint (see test/category-architecture.test.js):
// renderLiveAroundYou/renderEarnToday were rewritten from hand-picked
// mock-item rails into CATEGORY_CONFIG-driven category hub grids. The
// underlying id-based routing infrastructure asserted below
// (HOME_LIVE_OPPORTUNITY_IDS/HOME_EARN_OPPORTUNITY_IDS, findOpportunityById,
// openLiveOpportunityDetail, the bindEvents click delegation) deliberately
// stays in the file — it now backs the fixture-fallback path
// (fixtureOpportunitiesForSurface) instead of the home rails directly, per
// the "no premature deletion" rule for this branch.
//
// Home redesign (see test/home-feed.test.js): renderEarnToday and
// renderCategoryHubGrid were removed entirely — Earn Today's dedicated
// Home rail is gone (the underlying "earn" surface itself is unaffected
// and still reachable via Contribute's opportunities entry point). Live
// Around You survives as a premium single-card-peek carousel instead of a
// category hub grid.
test("Live Around You is a category-driven carousel, not individual mock cards or a grid", () => {
  const liveRail = extractFunction(main, "renderLiveAroundYou");
  assert.match(liveRail, /categoryHubIdsSortedByCount\("live"\)/);
  assert.match(liveRail, /renderCarousel\(/);
  assert.doesNotMatch(main, /function renderEarnToday\(/, "renderEarnToday must stay removed");
  assert.doesNotMatch(main, /function renderCategoryHubGrid\(/, "renderCategoryHubGrid must stay removed");
  // The rail does not render individual opportunity cards directly.
  assert.doesNotMatch(liveRail, /<a class="live-card"/);
});

test("HOME_LIVE_OPPORTUNITY_IDS/HOME_EARN_OPPORTUNITY_IDS still back the fixture-fallback split", () => {
  assert.match(main, /const HOME_LIVE_OPPORTUNITY_IDS = \["airport-pickup", "babysitter", "photo-event", "language-help"\]/);
  assert.match(main, /const HOME_EARN_OPPORTUNITY_IDS = \["deliver-package", "help-move-sofa", "translate-document", "dog-walk", "teach-english", "furniture"\]/);
  const fixtureSplit = extractFunction(main, "fixtureOpportunitiesForSurface");
  assert.match(fixtureSplit, /HOME_EARN_OPPORTUNITY_IDS/);
  assert.match(fixtureSplit, /HOME_LIVE_OPPORTUNITY_IDS/);
  assert.match(main, /id: "deliver-package", title: "Deliver package"/);
  assert.match(main, /id: "help-move-sofa", title: "Help move sofa"/);
  assert.match(main, /id: "translate-document", title: "Translate document"/);
  assert.match(main, /id: "teach-english", title: "Teach English"/);
});

test("live opportunity detail is deep-linkable and opens through one helper", () => {
  const helper = extractFunction(main, "openLiveOpportunityDetail");
  assert.match(helper, /findOpportunityById\(id\)/);
  assert.match(helper, /state\.selectedOpportunityId = item\.id/);
  assert.match(helper, /state\.activeView = "liveOpportunityDetail"/);
  assert.match(helper, /render\(\)/);

  assert.match(extractFunction(main, "liveOpportunityHref"), /view=liveOpportunityDetail/);
  assert.match(extractFunction(main, "liveOpportunityHref"), /encodeURIComponent\(id\)/);
  assert.match(main, /"liveOpportunityDetail"/);
  assert.match(main, /if \(state\.activeView === "liveOpportunityDetail"\) return state\.selectedOpportunityId/);
  assert.match(main, /else if \(view === "liveOpportunityDetail"\) state\.selectedOpportunityId = id/);
});

test("live cards have a dedicated click and keyboard activation path", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /'\[data-view="liveOpportunityDetail"\]\[data-opportunity-id\]'/);
  assert.match(bindEvents, /document\.addEventListener\(\s*"click"/);
  assert.match(bindEvents, /event\.target\.closest\('\[data-view="liveOpportunityDetail"\]\[data-opportunity-id\]'\)/);
  assert.match(bindEvents, /true\s*\)/);
  assert.match(bindEvents, /openLiveOpportunityDetail\(card\.dataset\.opportunityId\)/);
  assert.match(bindEvents, /openLiveOpportunityDetail\(opportunityId\)/);
  assert.match(bindEvents, /event\.stopImmediatePropagation\(\)/);
  assert.match(bindEvents, /event\.key !== "Enter" && event\.key !== " " && event\.key !== "Spacebar"/);
});
