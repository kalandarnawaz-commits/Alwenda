import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Merge-readiness focused tests for the Home Hero v2 change.

   main.js is a single large file with top-level DOM/module side effects,
   so — matching the pattern already established across this test suite
   (see extractFunction in test/alwen-conversation.test.js and friends) —
   the functions under test here are extracted as source text and either
   (a) executed in isolation via `new Function(...)` with their handful of
   free variables (state, collaborator functions, data consts) injected as
   parameters/mocks, giving real behavioural coverage without importing
   the whole module, or (b) asserted on structurally where the function's
   dependency tree is too large to reasonably reconstruct (renderShell).
--------------------------------------------------------------------- */

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

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
  assert.ok(paramsEnd !== -1, `could not find end of parameter list for ${name}`);
  let depth = 0;
  for (let i = paramsEnd; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`could not find end of function ${name}`);
}

function extractConst(source, name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `const ${name} must exist`);
  const valueStart = start + marker.length;
  let depth = 0;
  for (let i = valueStart; i < source.length; i += 1) {
    const ch = source[i];
    if ("[{(".includes(ch)) depth += 1;
    else if ("]})".includes(ch)) depth -= 1;
    else if (ch === ";" && depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`could not find end of const ${name}`);
}

const main = await readRepoFile("src/main.js");

/* ---------------------------------------------------------------------
   1. Recent-query privacy filtering (recordRecentQuery)
--------------------------------------------------------------------- */

function runRecordRecentQuery(existingQueries, query) {
  const state = { recentQueries: existingQueries };
  const writeLocalStorageCalls = [];
  const writeLocalStorage = (key, value) => writeLocalStorageCalls.push([key, value]);
  const body = [
    extractConst(main, "RECENT_QUERIES_KEY"),
    extractConst(main, "RECENT_QUERIES_MAX"),
    extractConst(main, "RECENT_QUERY_MAX_LENGTH"),
    extractConst(main, "SENSITIVE_QUERY_PATTERN"),
    extractFunction(main, "recordRecentQuery"),
    `recordRecentQuery(${JSON.stringify(query)});`,
    "return { recentQueries: state.recentQueries, writeLocalStorageCalls };"
  ].join("\n");
  const fn = new Function("state", "writeLocalStorage", "writeLocalStorageCalls", body);
  return fn(state, writeLocalStorage, writeLocalStorageCalls);
}

test("recordRecentQuery excludes sensitive-looking queries (health, emergency, legal, financial, identity) from persisted history", () => {
  const sensitiveExamples = [
    "Find a dentist near me",
    "Need emergency help now",
    "I need a lawyer for my divorce",
    "Where can I get a loan",
    "Renew my passport",
    "Looking for a domestic violence shelter"
  ];
  for (const query of sensitiveExamples) {
    const { recentQueries, writeLocalStorageCalls } = runRecordRecentQuery([], query);
    assert.deepEqual(recentQueries, [], `sensitive query must not be stored: "${query}"`);
    assert.equal(writeLocalStorageCalls.length, 0, `localStorage must not be touched for a sensitive query: "${query}"`);
  }
});

test("recordRecentQuery stores ordinary, non-sensitive queries", () => {
  const { recentQueries } = runRecordRecentQuery([], "Sell my old bicycle");
  assert.deepEqual(recentQueries, ["Sell my old bicycle"]);
});

test("recordRecentQuery deduplicates case-insensitively, moving the repeat to the front instead of storing a duplicate", () => {
  const { recentQueries } = runRecordRecentQuery(["Sell my old bicycle"], "sell my old bicycle");
  assert.deepEqual(recentQueries, ["sell my old bicycle"]);
});

test("recordRecentQuery caps stored history at 3, dropping the oldest", () => {
  const { recentQueries } = runRecordRecentQuery(["a", "b", "c"], "d");
  assert.deepEqual(recentQueries, ["d", "a", "b"]);
});

test("recordRecentQuery rejects empty and overlong queries without touching storage", () => {
  // recordRecentQuery's own parameter is named "trimmedQuery" and its one
  // real call site (launchAlwenConversationWithQuery) always trims and
  // already returns early on an empty result before ever calling this —
  // so "" (not a whitespace-only string, which is outside this unit's
  // documented contract) is the correct empty case to exercise here.
  const empty = runRecordRecentQuery(["existing"], "");
  assert.deepEqual(empty.recentQueries, ["existing"]);
  assert.equal(empty.writeLocalStorageCalls.length, 0);

  const overlong = runRecordRecentQuery(["existing"], "x".repeat(121));
  assert.deepEqual(overlong.recentQueries, ["existing"]);
  assert.equal(overlong.writeLocalStorageCalls.length, 0);
});

/* ---------------------------------------------------------------------
   2. Deterministic chip ordering (selectHomeIntentChips)
--------------------------------------------------------------------- */

function runSelectHomeIntentChips({ daySuffix, weatherCode = null, isSignedIn, hasEarnInventory, dayOfWeek, count = 5 }) {
  const state = {
    localWeather: weatherCode != null ? { weather_code: weatherCode } : null,
    auth: { status: isSignedIn ? "signedIn" : "signedOut" }
  };
  const earnToday = hasEarnInventory ? [{ id: "fixture-earn-1" }] : [];
  const timeOfDaySuffix = () => daySuffix;
  class FakeDate {
    getDay() {
      return dayOfWeek;
    }
  }
  const body = [
    extractConst(main, "HOME_INTENT_CHIPS"),
    extractConst(main, "RAIN_SNOW_WEATHER_CODES"),
    extractFunction(main, "selectHomeIntentChips"),
    `return selectHomeIntentChips(${count}).map((chip) => chip.id);`
  ].join("\n");
  const fn = new Function("state", "earnToday", "timeOfDaySuffix", "Date", body);
  return fn(state, earnToday, timeOfDaySuffix, FakeDate);
}

test("selectHomeIntentChips is deterministic — identical signals always produce the identical chip order, never shuffled", () => {
  const params = { daySuffix: "", weatherCode: null, isSignedIn: true, hasEarnInventory: false, dayOfWeek: 3 };
  const first = runSelectHomeIntentChips(params);
  const second = runSelectHomeIntentChips(params);
  const third = runSelectHomeIntentChips(params);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("selectHomeIntentChips falls back to stable pool order when no contextual signal favours any chip", () => {
  // Wednesday, no weather, signed in (kills the guest-only "translate" boost;
  // "nearbyOffers" boosts for signed-in, which is the one real signal left).
  const order = runSelectHomeIntentChips({ daySuffix: "", weatherCode: null, isSignedIn: true, hasEarnInventory: false, dayOfWeek: 3 });
  assert.deepEqual(order, ["nearbyOffers", "doctor", "translate", "weekendPlans", "sellSomething"]);
});

test("selectHomeIntentChips re-ranks chips upward when their real signal is present (guest + real earn inventory)", () => {
  const order = runSelectHomeIntentChips({ daySuffix: "", weatherCode: null, isSignedIn: false, hasEarnInventory: true, dayOfWeek: 3 });
  assert.deepEqual(order, ["translate", "findWork", "doctor", "weekendPlans", "sellSomething"]);
});

/* ---------------------------------------------------------------------
   3. Home-only floating dock visibility (renderShell)
--------------------------------------------------------------------- */

test("renderShell hides the Alwen dock and Quick Translate dock on Home (in addition to their existing screens); the TYT orb stays unconditional everywhere including Home", () => {
  const shell = extractFunction(main, "renderShell");
  assert.match(shell, /\$\{renderTytOrb\(\)\}/, "TYT orb must render with no surrounding view guard");
  assert.match(
    shell,
    /state\.activeView !== "alwen" && state\.activeView !== "home" \? renderAlwenDock\(\) : ""/,
    "Alwen dock must be hidden on both the Alwen screen and Home"
  );
  assert.match(
    shell,
    /state\.activeView !== "translate" && state\.activeView !== "community" && state\.activeView !== "home" \? renderQuickTranslateDock\(\) : ""/,
    "Quick Translate dock must be hidden on Translate, Community, and Home"
  );
});

/* ---------------------------------------------------------------------
   4. Pharmacy-status fallback behaviour (pharmacySignal)
--------------------------------------------------------------------- */

function runPharmacySignal(pharmacies, isOpenNowImpl) {
  const body = [extractFunction(main, "pharmacySignal"), "return pharmacySignal();"].join("\n");
  const fn = new Function("importedBusinesses", "isOpenNow", body);
  return fn(pharmacies, isOpenNowImpl);
}

test("pharmacySignal returns null when there is not a single real pharmacy in the imported dataset", () => {
  const result = runPharmacySignal([{ category: "Shops" }, { category: "Food & Drink" }], () => true);
  assert.equal(result, null);
});

test("pharmacySignal reports a real open-now count only when isOpenNow can actually determine at least one status", () => {
  const pharmacies = [
    { category: "Pharmacy", openingHours: "OPEN" },
    { category: "Pharmacy", openingHours: "CLOSED" },
    { category: "Pharmacy", openingHours: null }
  ];
  const isOpenNowImpl = (hours) => (hours === "OPEN" ? true : hours === "CLOSED" ? false : null);
  const result = runPharmacySignal(pharmacies, isOpenNowImpl);
  assert.deepEqual(result, { labelKey: "home.signals.pharmacyLabel", value: "1", detailKey: "home.signals.pharmacyOpenDetail" });
});

test("pharmacySignal falls back to a plain, truthful nearby count — never an open/closed claim — when no pharmacy record has determinable hours", () => {
  const pharmacies = [
    { category: "Pharmacy", openingHours: null },
    { category: "Pharmacy", openingHours: "garbled data" }
  ];
  const isOpenNowImpl = () => null;
  const result = runPharmacySignal(pharmacies, isOpenNowImpl);
  assert.deepEqual(result, { labelKey: "home.signals.pharmacyLabel", value: "2", detailKey: "home.signals.pharmacyNearbyDetail" });
});

/* ---------------------------------------------------------------------
   5. Home-voice-status reset on navigation (render)
--------------------------------------------------------------------- */

function runRender({ initialLastRenderedView, activeView, homeVoiceState, activeSheet = null }) {
  const state = { activeView, homeVoiceState, activeSheet, hasOnboarded: true };
  const body = [
    `let lastRenderedView = ${JSON.stringify(initialLastRenderedView)};`,
    extractFunction(main, "render"),
    "render();",
    "return { homeVoiceState: state.homeVoiceState, lastRenderedView };"
  ].join("\n");
  const fn = new Function(
    "state",
    "document",
    "window",
    "renderOnboarding",
    "renderWelcomeSequence",
    "renderShell",
    "bindEvents",
    "bindCarousels",
    "bindCoverflow",
    "bindHeaderTheme",
    "syncUrlToState",
    body
  );
  const noop = () => {};
  const fakeDocument = { getElementById: () => ({ innerHTML: "" }), body: { classList: { toggle: noop } } };
  const fakeWindow = { scrollTo: noop };
  return fn(state, fakeDocument, fakeWindow, () => "", () => "", () => "", noop, noop, noop, noop, noop);
}

test("render() clears a stale terminal homeVoiceState when navigating away from Home", () => {
  for (const staleState of ["denied", "cancelled", "error"]) {
    const { homeVoiceState } = runRender({ initialLastRenderedView: "home", activeView: "explore", homeVoiceState: staleState });
    assert.equal(homeVoiceState, "idle", `expected "${staleState}" to reset when leaving Home`);
  }
});

test("render() clears a stale terminal homeVoiceState when Home is freshly (re)opened", () => {
  for (const staleState of ["denied", "cancelled", "error"]) {
    const { homeVoiceState } = runRender({ initialLastRenderedView: "explore", activeView: "home", homeVoiceState: staleState });
    assert.equal(homeVoiceState, "idle", `expected "${staleState}" to reset when re-entering Home`);
  }
});

test("render() never resets homeVoiceState while a recognition session is genuinely \"listening\", even across a Home navigation", () => {
  const leaving = runRender({ initialLastRenderedView: "home", activeView: "explore", homeVoiceState: "listening" });
  assert.equal(leaving.homeVoiceState, "listening");

  const entering = runRender({ initialLastRenderedView: "explore", activeView: "home", homeVoiceState: "listening" });
  assert.equal(entering.homeVoiceState, "listening");
});

test("render() leaves homeVoiceState untouched when navigating between two non-Home views", () => {
  const { homeVoiceState } = runRender({ initialLastRenderedView: "explore", activeView: "marketplace", homeVoiceState: "error" });
  assert.equal(homeVoiceState, "error");
});

test("render() does not reset homeVoiceState on a re-render that keeps the same activeView (e.g. typing, opening a sheet)", () => {
  const { homeVoiceState } = runRender({ initialLastRenderedView: "home", activeView: "home", homeVoiceState: "denied" });
  assert.equal(homeVoiceState, "denied");
});
