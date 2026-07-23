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

test("home live cards route to matching live opportunity detail records", () => {
  const homeRail = extractFunction(main, "renderLiveAroundYou");
  assert.match(main, /const HOME_LIVE_OPPORTUNITY_IDS = \["airport-pickup", "babysitter", "photo-event", "language-help"\]/);
  assert.match(homeRail, /opportunityForHomeLiveItem\(item\)/);
  assert.match(homeRail, /<a class="live-card" href="\$\{liveOpportunityHref\(opportunity\.id\)\}"/);
  assert.match(homeRail, /data-view="liveOpportunityDetail"/);
  assert.match(homeRail, /data-opportunity-id="\$\{opportunity\.id\}"/);
  assert.match(homeRail, /aria-label="\$\{escapeHtml/);
});

test("earn today cards route to their exact task detail records", () => {
  const earnRail = extractFunction(main, "renderEarnToday");
  assert.match(main, /const HOME_EARN_OPPORTUNITY_IDS = \["deliver-package", "help-move-sofa", "translate-document", "dog-walk", "teach-english", "furniture"\]/);
  assert.match(earnRail, /opportunityForHomeEarnItem\(item\)/);
  assert.match(earnRail, /<a class="earn-card" href="\$\{liveOpportunityHref\(opportunity\.id\)\}"/);
  assert.match(earnRail, /data-view="liveOpportunityDetail"/);
  assert.match(earnRail, /data-opportunity-id="\$\{opportunity\.id\}"/);
  assert.match(main, /id: "deliver-package", title: "Deliver package"/);
  assert.match(main, /id: "help-move-sofa", title: "Help move sofa"/);
  assert.match(main, /id: "translate-document", title: "Translate document"/);
  assert.match(main, /id: "teach-english", title: "Teach English"/);
});

test("live opportunity detail is deep-linkable and opens through one helper", () => {
  const helper = extractFunction(main, "openLiveOpportunityDetail");
  assert.match(helper, /findOpportunityById\(id\)/);
  // Never falls back to LIVE_OPPORTUNITIES[0] — that array is empty in
  // production, so a not-found id must resolve to null, not crash on
  // undefined.id or silently open an unrelated opportunity.
  assert.match(helper, /state\.selectedOpportunityId = item \? item\.id : null/);
  assert.doesNotMatch(helper, /LIVE_OPPORTUNITIES\[0\]/);
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
