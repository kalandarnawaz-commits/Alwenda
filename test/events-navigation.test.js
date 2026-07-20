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

test("the Home hero Events tile points at a real events destination", () => {
  assert.match(main, /const LIVING_SIGNAL_DESTINATION = \[\s*\{ view: "explore" \},\s*\{ view: "events" \},/);
});

test("Events/Jobs/Apartments hero values are computed from real data, never hardcoded", () => {
  const helper = extractFunction(main, "currentLivingCitySignals");
  assert.match(helper, /EVENTS\.filter\(\(event\) => event\.outdoor && event\.distanceMinutes <= 25\)\.length/);
  assert.match(helper, /listings\.filter\(\(listing\) => listing\.type === "jobs"\)\.length/);
  assert.match(helper, /listings\.filter\(\(listing\) => listing\.type === "rentals"\)\.length/);
  // The static livingCitySignals[1..3].value mock strings must never be
  // returned as-is — every call site overrides them with a computed count.
  assert.doesNotMatch(helper, /return livingCitySignals;/);
});

test("exactly 7 events satisfy the 'near you' filter the hero tile's count is drawn from", () => {
  const eventsMatch = main.match(/const EVENTS = \[([\s\S]*?)\n\];/);
  assert.ok(eventsMatch, "EVENTS array must exist");
  const body = eventsMatch[1];
  const entries = body.match(/\{ id: "[^"]+"/g) || [];
  assert.ok(entries.length >= 7, "EVENTS should contain enough items to back both the near-you and explore-other sections");

  // Each event is authored as one object literal per line, so a same-line
  // check for both flags is a reliable, resilient way to verify the count
  // without depending on key ordering inside the object.
  const lines = body.split("\n").filter((line) => line.trim().startsWith("{ id:"));
  const nearYou = lines.filter((line) => {
    const outdoor = /outdoor: true/.test(line);
    const distanceMatch = line.match(/distanceMinutes: (\d+)/);
    return outdoor && distanceMatch && Number(distanceMatch[1]) <= 25;
  });
  assert.equal(nearYou.length, 7, "exactly 7 events must be outdoor and within 25 minutes to back the hero tile's honest count");
});

test("events feature is deep-linkable and opens through one helper", () => {
  const helper = extractFunction(main, "openEventDetail");
  assert.match(helper, /findEventById\(id\)/);
  assert.match(helper, /state\.selectedEventId = item\.id/);
  assert.match(helper, /state\.activeView = "eventDetail"/);
  assert.match(helper, /render\(\)/);

  assert.match(extractFunction(main, "eventHref"), /view=eventDetail/);
  assert.match(main, /"events",\s*\n\s*"eventDetail",/);
  assert.match(main, /const ID_LINKED_VIEWS = new Set\(\[.*"eventDetail".*\]\);/);
  assert.match(main, /if \(state\.activeView === "eventDetail"\) return state\.selectedEventId/);
  assert.match(main, /else if \(view === "eventDetail"\) state\.selectedEventId = id;/);
  assert.match(main, /events: renderEvents,\s*\n\s*eventDetail: renderEventDetail,/);
});

test("event cards have a dedicated click and keyboard activation path", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.match(bindEvents, /'\[data-view="eventDetail"\]\[data-event-id\]'/);
  assert.match(bindEvents, /event\.target\.closest\('\[data-view="eventDetail"\]\[data-event-id\]'\)/);
  assert.match(bindEvents, /openEventDetail\(card\.dataset\.eventId\)/);
  assert.match(bindEvents, /openEventDetail\(eventId\)/);
  assert.match(bindEvents, /'\[data-action="toggle-event-save"\]'/);
});

test("renderEvents shows the near-you set above a distinct 'explore other events' section", () => {
  const renderEvents = extractFunction(main, "renderEvents");
  assert.match(renderEvents, /const nearYou = EVENTS\.filter\(\(event\) => event\.outdoor && event\.distanceMinutes <= 25\)/);
  assert.match(renderEvents, /const otherEvents = EVENTS\.filter\(\(event\) => !nearYou\.includes\(event\)\)/);
  const nearYouHeadingIndex = renderEvents.indexOf('t("events.nearYouHeading")');
  const otherHeadingIndex = renderEvents.indexOf('t("events.otherHeading")');
  assert.ok(nearYouHeadingIndex !== -1 && otherHeadingIndex !== -1 && nearYouHeadingIndex < otherHeadingIndex, "the near-you section must render above the explore-other-events section");
});

test("event cards reuse the opportunity-card CSS shell (no new card CSS needed)", () => {
  const card = extractFunction(main, "renderEventCard");
  assert.match(card, /class="opportunity-card"/);
  assert.match(card, /class="opportunity-cover"/);
  assert.match(card, /class="opportunity-trust"/);
  assert.match(card, /class="opportunity-tags"/);
  assert.match(card, /class="opportunity-actions"/);
});

test("marketplace listing cards gained a trust row, tag chips, and a working View details link", () => {
  const card = extractFunction(main, "renderMarketplaceListing");
  assert.match(card, /class="opportunity-trust"/);
  assert.match(card, /class="opportunity-tags"/);
  assert.match(card, /data-view="listingDetail" data-listing-id="\$\{item\.id\}">\$\{t\("common\.viewDetails"\)\}<\/a>/);
  // The existing primary action and favourite/save button must survive untouched.
  assert.match(card, /data-action="start-listing-conversation"/);
  assert.match(card, /data-action="toggle-listing-save"/);
});
