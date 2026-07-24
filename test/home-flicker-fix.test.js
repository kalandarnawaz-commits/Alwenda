import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression tests for the Home Hero v2 post-deploy flicker hotfix.

   Root cause: refreshMyListings(), refreshMyHelpRequests(), and
   loadAlwenConversation() are fire-and-forget background refreshes that
   unconditionally called the global render() when they resolved — even
   though Home's own render output never reads state.myListings,
   state.myHelpRequests, or state.alwenConversation. Each resolution tore
   down and rebuilt the whole app (including Home Hero v2's new, visually
   heavy full-bleed hero) for data Home doesn't display. Separately,
   applySupabaseSession() re-ran those same side effects and forced
   another render() on every onAuthStateChange firing, even when Supabase
   fired more than once for the same already-signed-in user during a
   single page load (observed: INITIAL_SESSION, SIGNED_IN, and an early
   TOKEN_REFRESHED all landing within a few seconds).

   These are structural/regex assertions (matching the pattern already
   used in test/alwen-conversation.test.js for similarly dependency-heavy
   functions like persistAlwenStructuredSearchTurn) rather than full
   executions, since applySupabaseSession pulls in a large dependency
   tree (Supabase client, profile bootstrap, legal acceptance, etc.) that
   isn't worth reconstructing for this fix's specific, narrow claims.
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

/* ---------------------------------------------------------------------
   1. Background refreshes must not rebuild Home for data Home never shows
--------------------------------------------------------------------- */

test("refreshMyListings only renders when the user has navigated away from Home", () => {
  const fn = extractFunction(main, "refreshMyListings");
  assert.match(fn, /if \(state\.activeView !== "home"\) render\(\);/);
});

test("refreshMyHelpRequests only renders when the user has navigated away from Home", () => {
  const fn = extractFunction(main, "refreshMyHelpRequests");
  assert.match(fn, /if \(state\.activeView !== "home"\) render\(\);/);
});

test("loadAlwenConversation only renders when the user has navigated away from Home", () => {
  const fn = extractFunction(main, "loadAlwenConversation");
  assert.match(fn, /if \(state\.activeView !== "home"\) render\(\);/);
});

/* ---------------------------------------------------------------------
   2. Duplicate auth-state-change firings for an already-hydrated user
      must not re-run side effects or force another render
--------------------------------------------------------------------- */

test("applySupabaseSession skips re-running sign-in side effects for a repeat event on the same already-hydrated user", () => {
  const fn = extractFunction(main, "applySupabaseSession");
  assert.match(
    fn,
    /if \(hydratedAuthUserId === session\.user\.id\) return false;/,
    "must bail out before re-running refreshMyListings/refreshMyHelpRequests/refreshTraderAccountState/loadAlwenConversation for a duplicate event"
  );
  const dedupeIndex = fn.indexOf("if (hydratedAuthUserId === session.user.id) return false;");
  const firstSideEffectIndex = fn.indexOf("refreshMyListings();");
  assert.ok(dedupeIndex > -1 && firstSideEffectIndex > -1 && dedupeIndex < firstSideEffectIndex, "the dedupe guard must run before the fire-and-forget side effects, not after");
});

test("applySupabaseSession reports whether anything actually changed, so the caller can skip a redundant render", () => {
  const fn = extractFunction(main, "applySupabaseSession");
  assert.match(fn, /return true;/, "a real transition (sign-in, sign-out, password recovery) must still signal a render is needed");
  assert.match(fn, /return false;/, "a no-op duplicate event must signal no render is needed");
});

test("hydrateSupabaseAuth's onAuthStateChange handler only calls render() when applySupabaseSession reports a real change", () => {
  const fn = extractFunction(main, "hydrateSupabaseAuth");
  assert.match(fn, /shouldRender = await applySupabaseSession\(changedSession, event\);/);
  assert.match(fn, /if \(shouldRender\) render\(\);/);
  // The catch branch still forces a render — an auth error is itself a
  // real, user-visible state change (e.g. bounced to signed-out).
  assert.match(fn, /catch \(error\) \{\s*state\.auth\.authError[\s\S]*applySignedOutState\(\);\s*\}\s*if \(shouldRender\) render\(\);/);
});
