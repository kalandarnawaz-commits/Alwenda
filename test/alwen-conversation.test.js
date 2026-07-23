import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ALWEN_INTENTS, classifyAlwenIntent, wantsOpenNowOnly } from "../src/services/alwen/intentRouter.js";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

// Some Alwen 2.0 functions destructure options with default values in
// their parameter list (e.g. `function f(x, { enterLiveMode = false } = {})`),
// which contains its own balanced braces before the real body starts —
// so unlike test/need-help-conversational.test.js's version, this one
// first skips past the parameter list's closing paren before counting
// body braces, or it stops at the destructuring brace instead of the end
// of the function.
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
  throw new Error(`Could not find end of function ${name}`);
}

const main = await readRepoFile("src/main.js");

/* ---------------------------------------------------------------------
   Intent routing — real execution, all 5 intents, correct fallback, no
   cross-routing between similarly-worded requests.
--------------------------------------------------------------------- */

test("classifyAlwenIntent routes place_search for real Explore-style requests", () => {
  assert.equal(classifyAlwenIntent("Find a pharmacy open now"), ALWEN_INTENTS.PLACE_SEARCH);
  assert.equal(classifyAlwenIntent("is there a restaurant near me"), ALWEN_INTENTS.PLACE_SEARCH);
});

test("classifyAlwenIntent routes hire_service for real Hire-style requests", () => {
  assert.equal(classifyAlwenIntent("I need a plumber today"), ALWEN_INTENTS.HIRE_SERVICE);
  assert.equal(classifyAlwenIntent("hire a cleaner for tomorrow"), ALWEN_INTENTS.HIRE_SERVICE);
});

test("classifyAlwenIntent routes translation for translate-style requests", () => {
  assert.equal(classifyAlwenIntent("translate this into Lithuanian"), ALWEN_INTENTS.TRANSLATION);
  assert.equal(classifyAlwenIntent("how do you say thank you"), ALWEN_INTENTS.TRANSLATION);
});

test("classifyAlwenIntent routes live_conversation for two-way conversation requests", () => {
  assert.equal(classifyAlwenIntent("help me speak to this pharmacist"), ALWEN_INTENTS.LIVE_CONVERSATION);
  assert.equal(classifyAlwenIntent("start Lithuanian conversation mode"), ALWEN_INTENTS.LIVE_CONVERSATION);
});

test("classifyAlwenIntent falls back to general_conversation for everything else, including empty input", () => {
  assert.equal(classifyAlwenIntent("what can you help me with"), ALWEN_INTENTS.GENERAL_CONVERSATION);
  assert.equal(classifyAlwenIntent(""), ALWEN_INTENTS.GENERAL_CONVERSATION);
  assert.equal(classifyAlwenIntent(undefined), ALWEN_INTENTS.GENERAL_CONVERSATION);
});

test("classifyAlwenIntent does not cross-route — a clinic is a place, not a hire-service profession", () => {
  assert.equal(classifyAlwenIntent("find a clinic nearby"), ALWEN_INTENTS.PLACE_SEARCH);
});

test("wantsOpenNowOnly only fires on an explicit open-now phrase", () => {
  assert.equal(wantsOpenNowOnly("find a pharmacy open now"), true);
  assert.equal(wantsOpenNowOnly("find a pharmacy"), false);
});

/* ---------------------------------------------------------------------
   Deterministic search — never calls OpenAI, always restores Explore/Hire
   state, always caps at 5, honest empty state.
--------------------------------------------------------------------- */

test("searchAlwenPlaces saves and restores every Explore filter field it touches, in a finally block", () => {
  const fn = extractFunction(main, "searchAlwenPlaces");
  for (const field of ["query", "area", "exploreCategory", "exploreCuisine", "exploreStars", "exploreOpenNowOnly", "exploreVerifiedOnly", "exploreHasPhotoOnly", "exploreSort"]) {
    const saveIdx = fn.search(new RegExp(`const previous\\w+ = state\\.${field};`));
    assert.ok(saveIdx !== -1, `must save state.${field} before searching`);
    const restoreIdx = fn.indexOf(`state.${field} = previous`, fn.indexOf("finally"));
    assert.ok(restoreIdx !== -1, `must restore state.${field} in the finally block`);
  }
  assert.match(fn, /try \{[\s\S]*\} finally \{/, "must use try/finally so restoration happens even if filteredImportedBusinesses() throws");
  assert.match(fn, /return filteredImportedBusinesses\(\)\.slice\(0, 5\)/, "must reuse the real Explore filter and cap at 5");
});

test("searchAlwenProfessionals saves and restores Hire filter state in a finally block, capped at 5", () => {
  const fn = extractFunction(main, "searchAlwenProfessionals");
  assert.match(fn, /previousQuery = state\.query/);
  assert.match(fn, /previousCategory = state\.hireCategory/);
  assert.match(fn, /try \{[\s\S]*\} finally \{/);
  assert.match(fn, /return filteredProfessionals\(\)\.slice\(0, 5\)/);
});

test("submitAlwenStructuredSearchTurn never calls the AI chat client — place/hire search is deterministic-first", () => {
  const fn = extractFunction(main, "submitAlwenStructuredSearchTurn");
  assert.doesNotMatch(fn, /sendAlwenMessage/);
  assert.match(fn, /searchAlwenPlaces\(trimmed\)/);
  assert.match(fn, /searchAlwenProfessionals\(trimmed\)/);
});

test("an empty structured search result shows the honest no-results copy, never a fabricated alternative", () => {
  const fn = extractFunction(main, "submitAlwenStructuredSearchTurn");
  assert.match(fn, /results\.length \? "" : t\("alwen\.noResultsFound"\)/);
});

/* ---------------------------------------------------------------------
   Intent routing wired into the actual submit path.
--------------------------------------------------------------------- */

test("submitAlwenConversationMessage classifies intent once and branches to the right turn handler", () => {
  const fn = extractFunction(main, "submitAlwenConversationMessage");
  assert.match(fn, /const intent = classifyAlwenIntent\(trimmed\)/);
  assert.match(fn, /intent === ALWEN_INTENTS\.PLACE_SEARCH \|\| intent === ALWEN_INTENTS\.HIRE_SERVICE/);
  assert.match(fn, /await submitAlwenStructuredSearchTurn\(trimmed, intent\)/);
  assert.match(fn, /intent === ALWEN_INTENTS\.TRANSLATION \|\| intent === ALWEN_INTENTS\.LIVE_CONVERSATION/);
  assert.match(fn, /await submitAlwenTranslationTurn\(trimmed, \{ enterLiveMode: intent === ALWEN_INTENTS\.LIVE_CONVERSATION \}\)/);
  assert.match(fn, /await submitAlwenGeneralChatTurn\(trimmed\)/);
});

test("an empty or whitespace-only message never starts a turn", () => {
  const fn = extractFunction(main, "submitAlwenConversationMessage");
  assert.match(fn, /if \(!trimmed\) return;/);
});

test("a draft is only cleared on submit, never discarded by a failed turn — every turn handler leaves it alone on error", () => {
  const submit = extractFunction(main, "submitAlwenConversationMessage");
  assert.match(submit, /convo\.draft = "";/);
  for (const name of ["submitAlwenGeneralChatTurn", "submitAlwenTranslationTurn", "submitAlwenStructuredSearchTurn"]) {
    const fn = extractFunction(main, name);
    assert.doesNotMatch(fn, /convo\.draft = /, `${name} must not touch convo.draft — only the initial submit does`);
  }
});

test("retrying a failed turn resubmits the exact original text and re-runs intent classification", () => {
  const fn = extractFunction(main, "retryAlwenConversationMessage");
  assert.match(fn, /convo\.messages\.splice\(index - 1, 2\)/);
  assert.match(fn, /submitAlwenConversationMessage\(userMessage\.text, \{ messageType: userMessage\.messageType \}\)/);
});

/* ---------------------------------------------------------------------
   Translation — native to Alwen chat, structured, auto direction switch.
--------------------------------------------------------------------- */

test("submitAlwenTranslationTurn calls the edge function in translate mode, never a second AI backend", () => {
  const fn = extractFunction(main, "submitAlwenTranslationTurn");
  assert.match(fn, /mode: "translate"/);
  assert.match(fn, /toLanguage: convo\.mode === "liveTranslate" \? convo\.languagePair\.to : "auto"/);
});

test("live two-way mode auto-switches the language pair after every translated turn, chat mode does not", () => {
  const fn = extractFunction(main, "submitAlwenTranslationTurn");
  assert.match(fn, /if \(convo\.mode === "liveTranslate"\) \{\s*convo\.languagePair = \{ from: result\.targetLanguage, to: result\.detectedLanguage \};/);
});

test("live_conversation intent flips the conversation into liveTranslate mode", () => {
  const fn = extractFunction(main, "submitAlwenTranslationTurn");
  assert.match(fn, /if \(enterLiveMode\) convo\.mode = "liveTranslate";/);
});

test("alwenComposerTranscriptionLanguage hints Whisper with the conversation's tracked expected-speaker language during live translate, not the static UI language", () => {
  const fn = extractFunction(main, "alwenComposerTranscriptionLanguage");
  assert.match(fn, /if \(convo\.mode === "liveTranslate" && convo\.languagePair\.from !== "auto"\) return convo\.languagePair\.from;/);
  assert.match(fn, /return getCurrentLanguage\(\);/);
});

test("startAlwenComposerRecording transcribes with alwenComposerTranscriptionLanguage(convo), never a static language hint that would mis-decode the other speaker's language mid live-translate", () => {
  const fn = extractFunction(main, "startAlwenComposerRecording");
  assert.match(fn, /transcribeTranslationAudio\(\{ audioBlob, language: alwenComposerTranscriptionLanguage\(convo\) \}\)/);
});

test("alwenChatClient passes mode/toLanguage through and returns the translation shape distinctly from chat answers", async () => {
  const source = await readRepoFile("src/services/alwenChatClient.js");
  assert.match(source, /mode = "chat", toLanguage = "auto"/);
  assert.match(source, /JSON\.stringify\(\{ message: trimmed, language, city, conversationId, mode, toLanguage \}\)/);
  assert.match(source, /if \(payload\?\.type === "translation"\)/);
  assert.match(source, /type: "translation"/);
});

test("the edge function's translate mode returns strict structured JSON and never injects prior conversation history", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /function translateSystemPrompt\(toLanguage: string\)/);
  assert.match(source, /Respond with ONLY a single JSON object/);
  const translateBranch = source.slice(source.indexOf('if (mode === "translate")'), source.indexOf("const existingConversation = existingConversationForMode;"));
  assert.doesNotMatch(translateBranch, /priorMessages/, "translate mode must not inject prior turns — each translation is self-contained");
  assert.match(translateBranch, /callResponses\(translateInput, undefined\)/, "translate mode must omit the create_hire_request/create_marketplace_listing tools");
});

test("a malformed translation response from OpenAI never reaches the client as raw or partial JSON", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /function parseTranslationResponse\(rawText: string\)/);
  const parseFn = source.slice(source.indexOf("function parseTranslationResponse"), source.indexOf("const HELP_REQUEST_URGENCIES"));
  assert.match(parseFn, /replace\(\/\^```\(json\)\?\/i, ""\)\.replace\(\/```\$\/, ""\)/, "must strip markdown fences before parsing");
  assert.match(parseFn, /catch \{\s*return null;/);
  assert.match(source, /if \(!parsed\) \{\s*return safeError\("Alwen could not translate that\. Please try again\."/);
});

test("a brand-new conversation created from a translate-mode call defaults to chat mode, not liveTranslate", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  const translateBranch = source.slice(source.indexOf('if (mode === "translate")'), source.indexOf("const parsed = parseTranslationResponse"));
  assert.doesNotMatch(translateBranch, /mode: "liveTranslate"/, "a single ad-hoc translation turn is not the same thing as live two-way mode");
});

/* ---------------------------------------------------------------------
   AI context control (Phase 13).
--------------------------------------------------------------------- */

test("chat mode caps context at the 10 most recent messages, not the full history", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  assert.match(source, /const MAX_CONTEXT_MESSAGES = 10;/);
  assert.match(source, /\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(MAX_CONTEXT_MESSAGES\)/);
  assert.match(source, /const priorMessages = \(recentMessagesDesc \|\| \[\]\)\.slice\(\)\.reverse\(\)/);
});

/* ---------------------------------------------------------------------
   Safety — rate limit / injection screen / usage logging apply
   identically before the mode branch, never bypassed by translate mode.
--------------------------------------------------------------------- */

test("rate limiting, daily cost ceiling, and prompt-injection screening all run before the mode branch, mode-agnostic", async () => {
  const source = await readRepoFile("supabase/functions/alwen-chat/index.ts");
  const injectionIdx = source.indexOf("looksLikePromptInjection(message)");
  const rateLimitIdx = source.indexOf("recentRequestCount");
  const costCeilingIdx = source.indexOf("spentTodayUsd >= DAILY_COST_CAP_USD");
  const modeBranchIdx = source.indexOf('if (mode === "translate")');
  assert.ok(injectionIdx > -1 && injectionIdx < modeBranchIdx, "injection screen must run before the mode branch");
  assert.ok(rateLimitIdx > -1 && rateLimitIdx < modeBranchIdx, "rate limit must run before the mode branch");
  assert.ok(costCeilingIdx > -1 && costCeilingIdx < modeBranchIdx, "daily cost ceiling must run before the mode branch");
});

/* ---------------------------------------------------------------------
   Persistence (Phase 11-12) — extends the already-existing tables,
   reuses the throwIfError()/observability pattern, never overwrites an
   in-progress conversation on load.
--------------------------------------------------------------------- */

test("supabaseClient exposes the 5 Alwen conversation persistence functions, all logged via throwIfError", async () => {
  const source = await readRepoFile("src/services/auth/supabaseClient.js");
  for (const name of ["createAlwenConversation", "fetchAlwenConversation", "fetchAlwenMessages", "createAlwenMessage", "updateAlwenConversationMode"]) {
    assert.match(source, new RegExp(`export async function ${name}\\(`), `${name} must exist`);
  }
  const block = source.slice(source.indexOf("export async function createAlwenConversation"));
  assert.match(block, /throwIfError\(error, "createAlwenConversation"\)/);
  assert.match(block, /throwIfError\(error, "fetchAlwenConversation"\)/);
  assert.match(block, /throwIfError\(error, "fetchAlwenMessages"\)/);
  assert.match(block, /throwIfError\(error, "createAlwenMessage"\)/);
  assert.match(block, /throwIfError\(error, "updateAlwenConversationMode"\)/);
});

test("loadAlwenConversation never overwrites an already-loaded or in-flight conversation", () => {
  const fn = extractFunction(main, "loadAlwenConversation");
  assert.match(fn, /if \(convo\.loaded \|\| convo\.status === "sending" \|\| convo\.messages\.length\) return;/);
});

test("mapAlwenMessageRow re-hydrates structured results from live data by id, never a frozen snapshot", () => {
  const fn = extractFunction(main, "mapAlwenMessageRow");
  assert.match(fn, /source\.find\(\(item\) => String\(item\.id\) === String\(id\)\)/);
  assert.match(fn, /row\.result_type === "place" \? importedBusinesses : row\.result_type === "professional" \? serviceProfessionals/);
});

test("persistAlwenStructuredSearchTurn is best-effort — a persistence failure is logged, never thrown to the caller", () => {
  const fn = extractFunction(main, "persistAlwenStructuredSearchTurn");
  assert.match(fn, /try \{[\s\S]*\} catch \(error\) \{\s*logPilotEvent\(OBSERVABILITY_EVENTS\.ALWEN_FAILURE/);
  assert.doesNotMatch(fn, /catch \(error\) \{[\s\S]*throw/, "must never rethrow — the local result is already shown regardless of sync outcome");
});

test("the alwen_conversation_upgrade migration adds message_type/translation/structured-result columns with check constraints, never touches existing RLS", async () => {
  const sql = await readRepoFile("supabase/migrations/202607230001_alwen_conversation_upgrade.sql");
  assert.match(sql, /add column if not exists message_type text not null default 'text'/);
  assert.match(sql, /check \(message_type in \('text', 'voice', 'translation', 'structured_result', 'system'\)\)/);
  assert.match(sql, /add column if not exists result_payload jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /add column if not exists mode text not null default 'chat'/);
  assert.match(sql, /check \(mode in \('chat', 'liveTranslate'\)\)/);
  assert.match(sql, /-- Rollback approach:/i);
  assert.doesNotMatch(sql, /drop table|drop schema|truncate|delete from|alter table.*drop column/i);
});

/* ---------------------------------------------------------------------
   Analytics — payload-only, never message/translation/query content.
--------------------------------------------------------------------- */

test("every Alwen 2.0 trackEvent call site passes only typed metadata, never message/translation/query text", () => {
  const calls = [...main.matchAll(/trackEvent\("alwen_[a-z_]+", \{([^}]*)\}\)/g)];
  assert.ok(calls.length >= 6, "expected at least 6 Alwen 2.0 trackEvent call sites");
  for (const [, propsSource] of calls) {
    // .length is fine (a count, not content) — only flag the raw value itself.
    assert.doesNotMatch(propsSource, /\btrimmed\b(?!\.length)|\bresult\.answer\b(?!\.length)|\bresult\.translated\b(?!\.length)|\bresult\.original\b(?!\.length)/, `trackEvent payload must not include message/translation content: ${propsSource}`);
  }
});

/* ---------------------------------------------------------------------
   One canonical Alwen surface — the Home prompt and the floating dock
   both route into the same alwenConversation screen; there is no second,
   legacy mini-chat left anywhere for either of them to fall back into.
--------------------------------------------------------------------- */

function extractBindEventsBlock(source, startMarker, endMarker) {
  const bindEvents = extractFunction(source, "bindEvents");
  const start = bindEvents.indexOf(startMarker);
  assert.ok(start !== -1, `bindEvents must contain: ${startMarker}`);
  const end = bindEvents.indexOf(endMarker, start);
  assert.ok(end !== -1, `bindEvents must contain after the start marker: ${endMarker}`);
  return bindEvents.slice(start, end);
}

test("classifyAlwenIntent treats a plain greeting like 'hello alwen' as general conversation, never a place/hire search", () => {
  assert.equal(classifyAlwenIntent("hello alwen"), ALWEN_INTENTS.GENERAL_CONVERSATION);
  assert.equal(classifyAlwenIntent("hi Alwen, how are you?"), ALWEN_INTENTS.GENERAL_CONVERSATION);
});

test("Home never renders an in-place Alwen results preview while typing — typed text is only acted on by submitting into the conversation", () => {
  const home = extractFunction(main, "renderHome");
  assert.doesNotMatch(home, /renderAiSearchResults/, "renderHome must not call renderAiSearchResults at all — Home has no local search-as-you-type panel anymore");
});

test("launchAlwenConversationWithQuery preserves the typed text verbatim, guards empty input, and sends immediately after navigating to Alwen", () => {
  const fn = extractFunction(main, "launchAlwenConversationWithQuery");
  assert.match(fn, /const trimmedQuery = String\(rawText \|\| ""\)\.trim\(\);/, "the original typed text must be captured before it is cleared/navigated away from");
  assert.match(fn, /if \(!trimmedQuery\) return;/, "an empty prompt must not navigate away from wherever it was submitted");
  assert.match(fn, /state\.query = "";/, "the shared query field must be cleared so a later visit to that screen doesn't show stale text");
  assert.match(fn, /state\.activeView = "alwen";/, "submitting must navigate into the alwen view");
  assert.match(fn, /render\(\);\s*submitAlwenConversationMessage\(trimmedQuery\);/, "the exact captured text must be sent into the conversation right after the navigation render");
});

test("every 'Tell Alwen' entry point — the shared search bar on every screen it appears on, and TYT's own — routes through the one shared launcher, not a per-screen local search", () => {
  const block = extractBindEventsBlock(
    main,
    `document.querySelectorAll('[data-action="ai-search-submit"]').forEach((button) => {`,
    `document.querySelectorAll('[data-action="toggle-discover"]')`
  );
  assert.match(block, /launchAlwenConversationWithQuery\(state\.query\)/, "the shared search bar (Home/Explore/Hire/Marketplace/Community/Contribute/Businesses/Reservations/Create) must all launch into Alwen the same way");
  assert.match(block, /document\.getElementById\("global-search"\)\?\.addEventListener\("keydown"/, "pressing Enter in the shared search bar must submit too, not just clicking the button");
  assert.match(block, /document\.querySelector\('\[data-action="tyt-ai-search-submit"\]'\)\?\.addEventListener\("click", \(\) => \{\s*launchAlwenConversationWithQuery\(document\.getElementById\("tyt-search"\)\?\.value\)/, "TYT's own search bar must read its own input's actual value and launch the same way, not a stale/unrelated field");
  assert.doesNotMatch(block, /matchExploreSearchCategory|exploreCategoryChosen = true/, "there must be no more per-screen local search branch left for any context");
});

test("TYT's search input is a real, independently-typed field — not silently aliased to the global search state used elsewhere", () => {
  const tytSheet = extractFunction(main, "renderTytSheet");
  assert.doesNotMatch(tytSheet, /data-view="\$\{routeForQuery\(\)\}"/, "the old stale route computed from an unrelated field must be gone");
  assert.match(tytSheet, /id="tyt-search"/);
  assert.match(tytSheet, /data-action="tyt-ai-search-submit"/);
});

test("the floating Tell Alwen launcher opens the same canonical alwen view as the Home prompt, not a local panel toggle", () => {
  const block = extractBindEventsBlock(
    main,
    `document.querySelectorAll("[data-alwen-toggle]").forEach((button) => {`,
    `document.querySelectorAll("[data-quick-translate-toggle]")`
  );
  assert.match(block, /state\.activeView = "alwen";/, "data-alwen-toggle must navigate into the alwen view");
  assert.doesNotMatch(block, /state\.alwenOpen/, "there must be no separate open/closed panel state left to toggle");
});

test("no duplicate legacy mini-chat surface remains anywhere in the app", () => {
  assert.doesNotMatch(main, /state\.alwenChat\b/, "the old single-turn alwenChat state model must be fully removed");
  assert.doesNotMatch(main, /function submitAlwenChat\(/, "the old single-turn submitAlwenChat function must be fully removed");
  assert.doesNotMatch(main, /data-alwen-chat-form/, "the legacy mini-chat form must no longer be rendered or bound");
  assert.doesNotMatch(main, /class="alwen-panel"/, "the floating dock must no longer render its own chat panel");
  assert.doesNotMatch(main, /alwenOpen/, "the open/closed dock-panel state must be fully removed, not just unused");
  const dock = extractFunction(main, "renderAlwenDock");
  assert.doesNotMatch(dock, /alwen-chat-form|alwen-chat-compose|submitAlwenChat/, "renderAlwenDock must be a pure launcher, not a second chat surface");
});
