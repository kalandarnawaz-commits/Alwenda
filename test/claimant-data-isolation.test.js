import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression tests for the business-claim-flow claimant isolation fix.

   renderClaimFlow() used to render `businessClaims.map(...)` — every
   pending claimant's ownerName/role/verificationMethod/documentUpload —
   inside a signed-in user's own new-claim submission form, whenever no
   specific place was selected (state.selectedPlaceId falsy). That branch
   is reachable directly via `?view=businessClaim` with no `id` param, and
   via the Contribute screen's generic "Claim a business" CTA (neither
   sets a place id). The fix removes the leaking render entirely — it was
   never gated behind fixture/production mode, since the bug is a
   cross-user exposure regardless of whether the underlying data is fake
   or real.

   renderClaimFlow() has a large dependency tree (state, importedBusinesses,
   t, escapeHtml, businessCategoryLabel), so — matching the pattern already
   established across this test suite (see extractFunction in
   test/home-hero-v2.test.js and friends) — it's extracted as source text
   and executed for real via `new Function(...)` with those dependencies
   stubbed, giving genuine behavioural proof rather than a regex-only check.
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
   1. renderClaimFlow() no longer has any businessClaims consumer
--------------------------------------------------------------------- */

test("renderClaimFlow() contains no businessClaims.map( consumer", () => {
  const fn = extractFunction(main, "renderClaimFlow");
  assert.doesNotMatch(fn, /businessClaims\.map\(/, "the leaking render call must be removed entirely, not just gated");
  assert.doesNotMatch(fn, /businessClaims/, "renderClaimFlow must not reference businessClaims at all after the fix");
});

/* ---------------------------------------------------------------------
   2. Behavioural proof: execute the real (fixed) renderClaimFlow()
--------------------------------------------------------------------- */

const SENTINEL_CLAIMS = [
  { id: "claim-alice", businessId: "biz-1", ownerName: "SENTINEL_ALICE_OWNER", role: "SENTINEL_ALICE_ROLE", verificationMethod: "SENTINEL_ALICE_VERIFY", documentUpload: "SENTINEL_ALICE_DOC", status: "pending" },
  { id: "claim-bob", businessId: "biz-2", ownerName: "SENTINEL_BOB_OWNER", role: "SENTINEL_BOB_ROLE", verificationMethod: "SENTINEL_BOB_VERIFY", documentUpload: "SENTINEL_BOB_DOC", status: "approved" }
];

function runRenderClaimFlow({ selectedPlaceId = null, authStatus = "signedIn", places = [], businessClaimsData = SENTINEL_CLAIMS }) {
  const state = {
    selectedPlaceId,
    auth: authStatus === "signedIn" ? { status: "signedIn", user: { id: "user-1", name: "Test User", email: "test@example.com" } } : { status: "signedOut" }
  };
  const importedBusinesses = places;
  // businessClaims is deliberately still injected (even though the fixed
  // function no longer reads it) so that if a future change reintroduces
  // a reference to it, the sentinel values below would leak into the
  // rendered HTML and the assertions below would catch it.
  const businessClaims = businessClaimsData;
  const t = (key) => key;
  const escapeHtml = (value) => String(value ?? "");
  const businessCategoryLabel = (category) => category;

  const body = [extractFunction(main, "renderClaimFlow"), "return renderClaimFlow();"].join("\n");
  const runFn = new Function("state", "importedBusinesses", "businessClaims", "t", "escapeHtml", "businessCategoryLabel", body);
  return runFn(state, importedBusinesses, businessClaims, t, escapeHtml, businessCategoryLabel);
}

test("seeded claimant details do not appear when no place is selected", () => {
  const html = runRenderClaimFlow({ selectedPlaceId: null });
  assert.doesNotMatch(html, /SENTINEL_ALICE_OWNER/);
  assert.doesNotMatch(html, /SENTINEL_ALICE_ROLE/);
  assert.doesNotMatch(html, /SENTINEL_ALICE_VERIFY/);
  assert.doesNotMatch(html, /SENTINEL_ALICE_DOC/);
});

test("multiple claim records all remain hidden, not just the first", () => {
  const html = runRenderClaimFlow({ selectedPlaceId: null });
  for (const claim of SENTINEL_CLAIMS) {
    assert.doesNotMatch(html, new RegExp(claim.ownerName), `${claim.ownerName} must not appear`);
    assert.doesNotMatch(html, new RegExp(claim.role), `${claim.role} must not appear`);
    assert.doesNotMatch(html, new RegExp(claim.verificationMethod), `${claim.verificationMethod} must not appear`);
    assert.doesNotMatch(html, new RegExp(claim.documentUpload), `${claim.documentUpload} must not appear`);
  }
  assert.doesNotMatch(html, /request-list/, "the container class that used to hold the leaked claims list must not appear either");
});

test("the legitimate claim form still renders normally when a place is selected", () => {
  const places = [{ id: "biz-1", name: "Test Cafe", category: "Food & Drink", address: "Test Street 1" }];
  const html = runRenderClaimFlow({ selectedPlaceId: "biz-1", places });
  assert.match(html, /Test Cafe/, "the selected place's name must still render");
  assert.match(html, /claimStep1/);
  assert.match(html, /claimStep2/);
  assert.match(html, /claimStep3/);
  assert.match(html, /claimStep4/);
  assert.match(html, /submitClaim/, "the submit button/action must still be present");
  assert.doesNotMatch(html, /SENTINEL_/, "no sentinel claimant data should appear even when a place is selected");
});

test("reaching the flow signed out with no place still shows no claimant data (sign-in prompt branch)", () => {
  const html = runRenderClaimFlow({ selectedPlaceId: null, authStatus: "signedOut" });
  assert.doesNotMatch(html, /SENTINEL_/);
});

/* ---------------------------------------------------------------------
   3. submitClaim() is unchanged by this fix
--------------------------------------------------------------------- */

test("submitClaim() still records a real claim via businessClaims.unshift and is otherwise untouched by this fix", () => {
  const fn = extractFunction(main, "submitClaim");
  assert.match(fn, /if \(state\.auth\.status !== "signedIn"\) return;/);
  assert.match(fn, /businessClaims\.unshift\(\{/);
  assert.match(fn, /saveBusinessOverride\(businessId, \{ claimStatus: "Claimed", verificationStatus: "Pending", ownerId: state\.auth\.user\.id \}\);/);
  assert.match(fn, /state\.activeView = "businessDashboard";/);
});
