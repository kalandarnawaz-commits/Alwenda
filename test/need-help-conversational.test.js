import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const mockData = await readFile(new URL("../src/data/mockData.js", import.meta.url), "utf8");

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

test("the real submit pipeline is untouched — manual Need Help still posts a real help request", () => {
  // This mirrors the existing pinned assertion in test/alwen-chat.test.js —
  // the conversational redesign must not have renamed or bypassed it.
  assert.match(main, /async function submitHelpRequest\(\)/);
  assert.match(main, /await createHelpRequest\(/);
  assert.doesNotMatch(main, /function submitHelpRequest\(\) \{[\s\S]{0,200}id: Date\.now\(\)/);
});

test("ten curated intents exist with real matchQuery values, no live AI call per keystroke", () => {
  assert.match(main, /const NEED_HELP_INTENTS = \[/);
  const ids = ["furniture", "cleaning", "painting", "plumbing", "electrical", "moving", "tutoring", "babysitting", "petcare", "mechanic"];
  for (const id of ids) {
    assert.match(main, new RegExp(`id: "${id}"`), `intent ${id} must exist`);
  }
  // Every intent's matchQuery becomes the real help_requests.category on
  // submit (see startNeedHelpTypewriter) — not a disconnected label.
  const intentsBlock = main.slice(main.indexOf("const NEED_HELP_INTENTS = ["), main.indexOf("];", main.indexOf("const NEED_HELP_INTENTS = [")));
  assert.match(intentsBlock, /matchQuery: "ikea assembly"/);
  assert.match(intentsBlock, /matchQuery: "cleaning"/);
  assert.match(intentsBlock, /matchQuery: "painting"/);
});

test("matchNeedHelpIntent only fires on short keyword-like input, never on a full sentence", () => {
  const helper = extractFunction(main, "matchNeedHelpIntent");
  assert.match(helper, /trimmed\.length > 24/);
});

test("the AI summary is honestly always empty — there is no real professional-listing concept yet", () => {
  const helper = extractFunction(main, "needHelpSummaryStats");
  assert.match(helper, /professionalsForIntent\(intent\)/);
  const professionalsForIntent = extractFunction(main, "professionalsForIntent");
  assert.match(professionalsForIntent, /return \[\];/, "professionalsForIntent must always be honestly empty, never fabricated");
  // Response time and price are still parsed from whatever real fields a
  // future real source would provide, not hardcoded.
  assert.match(helper, /parseInt\(item\.responseTime, 10\)/);
  assert.match(helper, /String\(item\.price\)\.match\(\/\\d\+\/\)/);
  assert.match(helper, /verifiedCount: matches\.filter\(\(item\) => item\.verified\)\.length/);
});

test("mockData.js no longer exports serviceProfessionals", () => {
  assert.doesNotMatch(mockData, /export const serviceProfessionals/);
});

test("submitting sets state.hireCategory to the same matchQuery the summary/results already used", () => {
  const helper = extractFunction(main, "startNeedHelpTypewriter");
  assert.match(helper, /state\.hireCategory = intent\.matchQuery/);
});

test("typewriter reveal respects prefers-reduced-motion and interrupts cleanly on real typing", () => {
  const helper = extractFunction(main, "startNeedHelpTypewriter");
  assert.match(helper, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches/);

  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /if \(state\.needHelpTypewriter\) stopNeedHelpTypewriter\(false\)/);
});

test("the same expansion path drives both typing-detected and chip-tap triggers", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /data-need-help-intent/);
  assert.match(bindEvents, /startNeedHelpTypewriter\(intent\)/);
});

test("the CTA reads Find professionals and the transition stays in-place (no data-view navigation)", () => {
  const renderNeedHelp = extractFunction(main, "renderNeedHelp");
  assert.match(renderNeedHelp, /t\("needHelp\.findProfessionalsCta"\)/);
  assert.doesNotMatch(renderNeedHelp, /state\.activeView = /);
  assert.match(renderNeedHelp, /renderNeedHelpResults\(intent\)/);
});

test("renderProCard/renderProfessional and the fabricated-conversation start-pro-conversation handler are fully removed, not just unused", () => {
  assert.doesNotMatch(main, /function renderProCard\(/);
  assert.doesNotMatch(main, /function renderProfessional\(/);
  assert.doesNotMatch(main, /function startProfessionalConversation\(/);
  assert.doesNotMatch(main, /data-action="start-pro-conversation"/);
});

test("Need Help results after posting show the real, always-honest empty state — never a fabricated pro card", () => {
  const results = extractFunction(main, "renderNeedHelpResults");
  assert.match(results, /class="opportunity-feed"/);
  assert.match(results, /renderEmptyState\(t\("common\.noResults"\), "people"\)/);
  assert.doesNotMatch(results, /renderProCard/);
});

test("resetting the draft also clears the new intent/typewriter state", () => {
  const helper = extractFunction(main, "resetHelpRequestDraft");
  assert.match(helper, /stopNeedHelpTypewriter\(false\)/);
  assert.match(helper, /state\.needHelpDetectedIntentId = null/);
});
