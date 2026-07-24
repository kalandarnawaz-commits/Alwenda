import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression tests locking in the unified Alwen launcher behavior.

   renderAlwenDock() is already a single, compact floating launcher (not
   the old embedded mini-chat panel — that was replaced in an earlier
   change) that opens the one canonical Alwen conversation. This suite
   protects that architecture: Home shows no floating launcher (the Home
   Hero's own AI search bar is the only entry point there), every other
   view shows exactly one, opening it routes into the existing
   alwenConversation screen without resetting state.alwenConversation,
   and there is no duplicated microphone/speech-recognition handler tied
   to the launcher itself.

   renderShell()/bindEvents() have large dependency trees, so — matching
   the pattern already established across this test suite — these are
   structural assertions against the real source text (via extractFunction,
   or targeted whole-file regex/counts) rather than full executions.
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

const main = await readRepoFile("src/main.js");
const styles = await readRepoFile("src/styles.css");

/* ---------------------------------------------------------------------
   1. Home has no floating Alwen launcher
--------------------------------------------------------------------- */

test("renderShell() hides the Alwen dock on Home (and on the Alwen screen itself)", () => {
  const shell = extractFunction(main, "renderShell");
  assert.match(
    shell,
    /state\.activeView !== "alwen" && state\.activeView !== "home" \? renderAlwenDock\(\) : ""/,
    "the dock must be gated off on both home and the alwen screen"
  );
});

/* ---------------------------------------------------------------------
   2. Explore, Market, and Community each show exactly one launcher
--------------------------------------------------------------------- */

test("renderAlwenDock() has exactly one call site in the whole app, inside renderShell()'s single dock slot", () => {
  const callSites = [...main.matchAll(/renderAlwenDock\(\)/g)];
  // One call inside the gating conditional, one inside the function's own
  // definition (`function renderAlwenDock() {`) — anything more would mean
  // some view independently renders a second copy of the dock.
  const definitionSites = [...main.matchAll(/function renderAlwenDock\(\)/g)];
  assert.equal(definitionSites.length, 1, "renderAlwenDock must be defined exactly once");
  assert.equal(callSites.length, 2, "renderAlwenDock() must be invoked from exactly one place (renderShell's gating conditional) plus its own definition line");
});

test("renderAlwenDock() itself renders exactly one launcher button", () => {
  const fn = extractFunction(main, "renderAlwenDock");
  const orbButtons = [...fn.matchAll(/<button[^>]*class="alwen-orb"/g)];
  assert.equal(orbButtons.length, 1, "must render exactly one .alwen-orb button — no duplicate launcher markup");
  assert.doesNotMatch(fn, /alwen-panel|alwen-chat-|alwen-mode-row/, "must not re-embed the old chat panel markup");
});

/* ---------------------------------------------------------------------
   3. Opening the launcher uses the existing Alwen conversation
--------------------------------------------------------------------- */

test("clicking any [data-alwen-toggle] element (the dock orb, Community's 'Ask Alwen', etc.) routes to the one canonical alwen view", () => {
  const idx = main.indexOf('document.querySelectorAll("[data-alwen-toggle]")');
  assert.ok(idx !== -1, "the data-alwen-toggle click handler must exist");
  const snippet = main.slice(idx, idx + 400);
  assert.match(snippet, /state\.activeView = "alwen";/, "must navigate to the shared alwenConversation screen, not a separate surface");
  assert.match(snippet, /state\.activeSheet = null;/, "must close any open sheet so the conversation screen isn't hidden behind it");
  assert.match(snippet, /render\(\);/);
});

test("only one [data-alwen-toggle] handler is registered — no competing/duplicate binding", () => {
  const registrations = [...main.matchAll(/querySelectorAll\("\[data-alwen-toggle\]"\)/g)];
  assert.equal(registrations.length, 1, "there must be exactly one place in bindEvents() that wires up [data-alwen-toggle] elements");
});

test("views.alwen routes to the real conversation screen renderer", () => {
  assert.match(main, /alwen:\s*renderAlwenConversationScreen/, "the 'alwen' view key must map to the actual conversation screen, not a stub");
});

/* ---------------------------------------------------------------------
   4. Navigating between Home/Explore/Market/Community preserves the
      active Alwen conversation
--------------------------------------------------------------------- */

test("state.alwenConversation is never reset by ordinary navigation (only by things that legitimately start a new conversation)", () => {
  // Every assignment to state.alwenConversation as a whole (not a field
  // within it) should only happen at initial state declaration and in the
  // conversation-loading/creation paths — never inside the generic
  // data-view navigation handler, which would wipe an in-progress
  // conversation just from switching bottom-nav tabs.
  const navHandlerIdx = main.indexOf('document.querySelectorAll("[data-view]")');
  assert.ok(navHandlerIdx > -1, "the generic nav click handler must exist");
  const navHandlerSnippet = main.slice(navHandlerIdx, navHandlerIdx + 2600);
  assert.doesNotMatch(
    navHandlerSnippet,
    /state\.alwenConversation\s*=/,
    "ordinary view navigation must never reassign state.alwenConversation"
  );
  // Navigating to the alwen view itself calls loadAlwenConversation(),
  // which is the intended, idempotent way conversation data ever gets
  // fetched — see the next test for its own guard against re-loading an
  // already-active conversation.
  assert.match(navHandlerSnippet, /if \(button\.dataset\.view === "alwen"\) \{\s*loadAlwenConversation\(\);/);
});

test("loadAlwenConversation() is idempotent — it refuses to reload/reset a conversation that's already loaded, sending, or has messages", () => {
  const fn = extractFunction(main, "loadAlwenConversation");
  assert.match(
    fn,
    /if \(convo\.loaded \|\| convo\.status === "sending" \|\| convo\.messages\.length\) return;/,
    "re-navigating to the alwen view must be a no-op for an already-active conversation, not a reset"
  );
});

test("the [data-alwen-toggle] handler only changes activeView/activeSheet — it never touches state.alwenConversation", () => {
  const idx = main.indexOf('document.querySelectorAll("[data-alwen-toggle]")');
  const snippet = main.slice(idx, idx + 400);
  assert.doesNotMatch(snippet, /alwenConversation/, "opening the launcher must preserve whatever conversation is already in state, not reset it");
});

/* ---------------------------------------------------------------------
   5. No duplicated microphone / speech-recognition handlers
--------------------------------------------------------------------- */

test("renderAlwenDock() contains no microphone or speech-recognition logic of its own", () => {
  const fn = extractFunction(main, "renderAlwenDock");
  assert.doesNotMatch(fn, /SpeechRecognition|recordMic|mic-button|voice-toggle/i, "the dock must be a pure launcher — no embedded mic UI to duplicate Home's or Translate's");
});

test("there are exactly two independent SpeechRecognition instantiation sites in the app (Translate's and Home's), neither belonging to the Alwen dock", () => {
  // `const Ctor = window.SpeechRecognition || ...` is the actual
  // instantiation point; homeVoiceSupported()'s own use of the same
  // expression is just a feature-detection boolean check (no recognition
  // instance created), so it's deliberately excluded from this count.
  const instantiations = [...main.matchAll(/const Ctor = window\.SpeechRecognition \|\| window\.webkitSpeechRecognition;/g)];
  assert.equal(instantiations.length, 2, "expected exactly Translate's startVoiceInput and Home's startHomeVoiceSearch — a third would indicate a duplicated handler");
  assert.match(main, /let activeSpeechRecognition = null;/, "Translate's tracked recognition instance must still exist");
  assert.match(main, /let activeHomeSpeechRecognition = null;/, "Home's tracked recognition instance must still exist");
});

/* ---------------------------------------------------------------------
   6. The launcher stays above the bottom navigation on mobile
--------------------------------------------------------------------- */

test("at the ≤430px breakpoint, the dock's bottom offset keeps it above the bottom-nav's top edge", () => {
  const mediaStart = styles.indexOf("@media (max-width: 430px) {\n  .bottom-nav {");
  assert.ok(mediaStart !== -1, "the mobile bottom-nav/alwen-dock breakpoint block must exist");
  const block = styles.slice(mediaStart, mediaStart + 1200);

  const navBottomMatch = block.match(/\.bottom-nav \{[^}]*bottom: max\((\d+)px, env\(safe-area-inset-bottom\)\)/);
  const navHeightMatch = block.match(/\.bottom-nav \{[^}]*height: (\d+)px !important;/);
  const dockBottomMatch = block.match(/\.alwen-dock \{[^}]*bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/);

  assert.ok(navBottomMatch && navHeightMatch && dockBottomMatch, "could not find the expected numeric bottom-nav/alwen-dock values in this breakpoint");

  const navBottomOffset = Number(navBottomMatch[1]);
  const navHeight = Number(navHeightMatch[1]);
  const dockBottomOffset = Number(dockBottomMatch[1]);

  // Both offsets are measured from the viewport's bottom edge, and both
  // grow by the same env(safe-area-inset-bottom) at most (the nav's is
  // max(8, safe-area), which is <= 8 + safe-area) — so comparing the
  // fixed pixel constants alone is the conservative, safe-area-independent
  // check: the dock's bottom edge must sit further from the screen bottom
  // than the nav's top edge, in the worst case (safe-area-inset-bottom: 0).
  const navTopFromScreenBottom = navBottomOffset + navHeight;
  assert.ok(
    dockBottomOffset > navTopFromScreenBottom,
    `dock bottom offset (${dockBottomOffset}px) must exceed the bottom-nav's top edge (${navTopFromScreenBottom}px = ${navBottomOffset}px + ${navHeight}px) so it never overlaps the nav`
  );
});

/* ---------------------------------------------------------------------
   7. The last card can always scroll fully clear of the launcher
      (verified live on Explore/Marketplace/Community — see PR discussion;
      this locks in the underlying invariant so it can't silently regress)
--------------------------------------------------------------------- */

test("the app's scroll-bottom padding always exceeds the dock's own footprint, so scrolled content can clear it", () => {
  // .app-shell's padding-bottom is the space reserved below every screen's
  // real content (in addition to renderPersistentFooter()'s own height,
  // which isn't a fixed CSS number and so isn't part of this check — this
  // test is the conservative floor, not the full live margin). If this
  // padding ever shrank below the dock's own footprint (its fixed offset
  // from the screen bottom plus its own height), the last card on a short
  // page could end up permanently stuck behind the dock with no amount of
  // scrolling able to clear it.
  const appShellMatch = styles.match(/\.app-shell \{\s*padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\) !important;\s*\}/);
  const dockBlockMatch = styles.match(/\.alwen-dock \{\s*position: fixed !important;[\s\S]*?bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\) !important;[\s\S]*?height: (\d+)px !important;/);

  assert.ok(appShellMatch, "could not find .app-shell's padding-bottom rule");
  assert.ok(dockBlockMatch, "could not find the base .alwen-dock rule's bottom offset and height");

  const appShellPaddingBottom = Number(appShellMatch[1]);
  const dockBottomOffset = Number(dockBlockMatch[1]);
  const dockHeight = Number(dockBlockMatch[2]);
  const dockFootprint = dockBottomOffset + dockHeight;

  assert.ok(
    appShellPaddingBottom > dockFootprint,
    `.app-shell padding-bottom (${appShellPaddingBottom}px) must exceed the dock's own footprint (${dockFootprint}px = ${dockBottomOffset}px bottom offset + ${dockHeight}px height) so the last card can always scroll clear of it`
  );
});
