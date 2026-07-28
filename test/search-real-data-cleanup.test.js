import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 7 of the mock-data-removal plan: Search (topMatches/renderMatch,
   the cross-entity "Tell Alwen" results panel reused across Home,
   Marketplace, Community, Explore, Hire, Contribute, and Create) and
   Alwen's structured hire_service search now aggregate real production
   sources only.

   topMatches() already read exclusively from real sources for listings
   (filteredListings), help requests (filteredHelpRequests), and imported
   businesses (filteredImportedBusinesses) since Phases 3/5 landed — the
   one remaining fabricated branch was proMatches, built from
   filteredProfessionals() (Phase 6 made that always return [], but the
   branch itself, plus filteredProfessionals() and Alwen's parallel
   searchAlwenProfessionals()/hireCategoryForQuery() helpers, were left
   for this phase to remove outright, per the original plan's own Phase 6
   note: "topMatches()'s proMatches branch ... sheds its fake branches
   naturally" in Phase 7).

   Note: Community post search is not yet a topMatches() source — the
   plan's Phase 7D result-type list is a ceiling ("recommended retained
   result types"), not a requirement that every real source already be
   wired into every aggregator; Community's own real feed already has
   its own honest search-free real-only path (Phase 4), and topMatches()
   never fabricated Community results before this phase either. Adding a
   new Community-matches branch to topMatches() would be new search
   surface area, not a mock-removal cleanup, so it's out of this phase's
   scope. */

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
  let bodyStart = -1;
  let bodyEnd = -1;
  for (let i = paramsEnd; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (depth === 0) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  assert.ok(bodyStart !== -1 && bodyEnd !== -1, `could not find body for ${name}`);
  return source.slice(start, bodyEnd + 1);
}

let main;
let en;
let lt;
let de;
let styles;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  en = JSON.parse(await readRepoFile("locales/en.json"));
  lt = JSON.parse(await readRepoFile("locales/lt.json"));
  de = JSON.parse(await readRepoFile("locales/de.json"));
  styles = await readRepoFile("src/styles.css");
});

/* ---------------------------------------------------------------------
   1. topMatches() aggregates real sources only — no professional branch,
      no reference to a deleted mock array, at any limit/context.
--------------------------------------------------------------------- */

test("topMatches has no proMatches branch and never calls filteredProfessionals — every remaining match source is a real, already-converted pool", () => {
  const fn = extractFunction(main, "topMatches");
  assert.doesNotMatch(fn, /proMatches|filteredProfessionals|entity\.professional/);
  assert.match(fn, /filteredHelpRequests\(\)/);
  assert.match(fn, /filteredImportedBusinesses\(\)/);
  assert.match(fn, /filteredListings\(\)/);
});

test("every branch of topMatches's routed ordering only ever spreads helpMatches/listingMatches/importedMatches/translationMatches — no dead fourth array", () => {
  const fn = extractFunction(main, "topMatches");
  const orderedBlock = fn.slice(fn.indexOf("const ordered ="), fn.indexOf("return ordered"));
  const spreadNames = [...orderedBlock.matchAll(/\.\.\.(\w+)/g)].map((m) => m[1]);
  assert.ok(spreadNames.length > 0, "must find at least one spread source");
  for (const name of spreadNames) {
    assert.ok(
      ["helpMatches", "listingMatches", "importedMatches", "translationMatches"].includes(name),
      `unexpected match source "${name}" — every source topMatches spreads must be one of the 4 real, retained pools`
    );
  }
});

test("topMatches's help/listing/imported match shapes expose only real fields already established in Phases 3/5 — title, area/neighbourhood, real status/price/distance — never a rating, review count, or availability claim", () => {
  const fn = extractFunction(main, "topMatches");
  assert.doesNotMatch(fn, /rating|reviews|availability|responseTime|verified\b/i);
});

/* ---------------------------------------------------------------------
   2. filteredProfessionals() and hireCategoryForQuery() are fully
      deleted, not just emptied — their sole remaining callers
      (topMatches's proMatches, searchAlwenProfessionals) no longer
      exist either.
--------------------------------------------------------------------- */

test("filteredProfessionals and hireCategoryForQuery are fully deleted from main.js — Phase 6 made them honestly empty, Phase 7 removes them outright once nothing calls them", () => {
  assert.doesNotMatch(main, /function filteredProfessionals\(/);
  assert.doesNotMatch(main, /function hireCategoryForQuery\(/);
  assert.doesNotMatch(main, /filteredProfessionals\(\)/);
  assert.doesNotMatch(main, /hireCategoryForQuery\(/);
});

test("searchAlwenProfessionals is a standalone honest-empty function — no dead state save/restore left behind now that it never calls filteredProfessionals", () => {
  const fn = extractFunction(main, "searchAlwenProfessionals");
  assert.match(fn, /return \[\];/);
  assert.doesNotMatch(fn, /previousQuery|previousCategory|state\.hireCategory/);
});

/* ---------------------------------------------------------------------
   3. renderMatch() has no dead visual branch for a match type that can
      no longer exist (proMatches was the only initials-bearing match).
--------------------------------------------------------------------- */

test("renderMatch no longer branches on match.initials — image or a neutral fallback icon are the only two visual states now that no match source ever sets initials", () => {
  const fn = extractFunction(main, "renderMatch");
  assert.doesNotMatch(fn, /match\.initials/);
  assert.match(fn, /match\.image/);
  assert.match(fn, /match-tile-fallback-icon/);
});

test("no match-producing function anywhere in main.js sets an initials field — renderMatch's dead branch removal is safe, not just currently unreachable", () => {
  assert.doesNotMatch(main, /initials:\s*initials\(/);
});

/* ---------------------------------------------------------------------
   4. Dead locale keys and CSS tied only to the removed professional
      match type are gone from all 3 locales / styles.css.
--------------------------------------------------------------------- */

test("entity.professional is removed from every locale — it was the kind label for the now-deleted proMatches branch and nothing else reads it", () => {
  for (const [name, dict] of [["en", en], ["lt", lt], ["de", de]]) {
    assert.equal(dict.entity?.professional, undefined, `locales/${name}.json still has entity.professional`);
  }
  assert.doesNotMatch(main, /t\("entity\.professional"\)/);
});

test("entity.helpRequest, entity.importedPlace, and entity.listing remain in every locale — the 3 real match kinds topMatches still produces", () => {
  for (const [name, dict] of [["en", en], ["lt", lt], ["de", de]]) {
    assert.ok(dict.entity?.helpRequest, `locales/${name}.json missing entity.helpRequest`);
    assert.ok(dict.entity?.importedPlace, `locales/${name}.json missing entity.importedPlace`);
    assert.ok(dict.entity?.listing, `locales/${name}.json missing entity.listing`);
  }
});

test(".match-tile-initials CSS rule is removed — .match-tile-fallback-icon (still used) and .match-tile-photo remain", () => {
  assert.doesNotMatch(styles, /\.match-tile-initials\s*\{/);
  assert.match(styles, /\.match-tile-fallback-icon\s*\{/);
  assert.match(styles, /\.match-tile-photo\s*\{/);
});

/* ---------------------------------------------------------------------
   5. Alwen's hire_service intent still classifies and routes real
      queries (protected conversational behaviour, unchanged), but can
      never produce a fabricated professional result — already covered
      in depth by test/hire-honest-empty-state.test.js section 5 and
      test/alwen-conversation.test.js; this is one direct end-to-end
      check that the two stay consistent after this phase's edits.
--------------------------------------------------------------------- */

test("submitAlwenStructuredSearchTurn still routes hire_service queries through searchAlwenProfessionals (now a plain honest-empty function) exactly as it routes place_search through the real searchAlwenPlaces", () => {
  const fn = extractFunction(main, "submitAlwenStructuredSearchTurn");
  assert.match(fn, /searchAlwenPlaces\(trimmed\)/);
  assert.match(fn, /searchAlwenProfessionals\(trimmed\)/);
  assert.doesNotMatch(fn, /serviceProfessionals/);
});
