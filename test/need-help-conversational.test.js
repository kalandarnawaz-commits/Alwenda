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
  // Every intent's matchQuery must be the string actually filtered against
  // serviceProfessionals via the existing hireCategoryMatches — not a
  // disconnected label that would make the AI summary and the results
  // list disagree.
  const intentsBlock = main.slice(main.indexOf("const NEED_HELP_INTENTS = ["), main.indexOf("];", main.indexOf("const NEED_HELP_INTENTS = [")));
  assert.match(intentsBlock, /matchQuery: "ikea assembly"/);
  assert.match(intentsBlock, /matchQuery: "cleaning"/);
  assert.match(intentsBlock, /matchQuery: "painting"/);
});

test("matchNeedHelpIntent only fires on short keyword-like input, never on a full sentence", () => {
  const helper = extractFunction(main, "matchNeedHelpIntent");
  assert.match(helper, /trimmed\.length > 24/);
});

test("the AI summary is computed from real professionals via hireCategoryMatches, not fabricated", () => {
  const helper = extractFunction(main, "needHelpSummaryStats");
  assert.match(helper, /professionalsForIntent\(intent\)/);
  const professionalsForIntent = extractFunction(main, "professionalsForIntent");
  assert.match(professionalsForIntent, /hireCategoryMatches\(item, intent\.matchQuery\)/);
  // Response time and price are parsed from the real fields, not hardcoded.
  assert.match(helper, /parseInt\(item\.responseTime, 10\)/);
  assert.match(helper, /String\(item\.price\)\.match\(\/\\d\+\/\)/);
  assert.match(helper, /verifiedCount: matches\.filter\(\(item\) => item\.verified\)\.length/);
});

test("every serviceProfessionals record has responseTime so no summary stat silently goes blank", () => {
  const ids = [501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511];
  for (const id of ids) {
    const recordStart = mockData.indexOf(`id: ${id},`);
    assert.ok(recordStart !== -1, `professional ${id} must exist`);
    const recordEnd = mockData.indexOf("},", recordStart);
    const record = mockData.slice(recordStart, recordEnd);
    assert.match(record, /responseTime: "\d+ min"/, `professional ${id} must have a real responseTime`);
  }
  // The flagship "paint" example must have a real match, not a 0-result summary.
  assert.match(mockData, /skills: \["painter", "painting"/);
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

test("professional cards reuse the exact opportunity-card premium shell, not a lookalike", () => {
  const card = extractFunction(main, "renderProCard");
  assert.match(card, /class="opportunity-card pro-opportunity-card"/);
  assert.match(card, /class="opportunity-cover opportunity-cover-avatar"/);
  assert.match(card, /class="opportunity-price-row"/);
  assert.match(card, /class="opportunity-meta"/);
  assert.match(card, /class="opportunity-trust"/);
  assert.match(card, /class="opportunity-tags"/);
  assert.match(card, /class="opportunity-actions"/);
  // Book/Contact reuse the existing conversation-starting handler — no new one.
  assert.match(card, /data-action="start-pro-conversation"/);

  const results = extractFunction(main, "renderNeedHelpResults");
  assert.match(results, /class="opportunity-feed"/);
  assert.match(results, /matches\.map\(renderProCard\)/);
});

test("pro cards are keyboard accessible", () => {
  const card = extractFunction(main, "renderProCard");
  assert.match(card, /role="button" tabindex="0"/);
  const bindPublicProfileEvents = extractFunction(main, "bindPublicProfileEvents");
  assert.match(bindPublicProfileEvents, /event\.key !== "Enter" && event\.key !== " " && event\.key !== "Spacebar"/);
});

test("resetting the draft also clears the new intent/typewriter state", () => {
  const helper = extractFunction(main, "resetHelpRequestDraft");
  assert.match(helper, /stopNeedHelpTypewriter\(false\)/);
  assert.match(helper, /state\.needHelpDetectedIntentId = null/);
});
