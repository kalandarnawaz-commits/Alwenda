import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

// Same brace-walking convention as the other test files in this repo —
// skips past the parameter list before counting body braces.
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

function extractConst(source, name) {
  const start = source.indexOf(`const ${name} = `);
  assert.ok(start !== -1, `const ${name} must exist`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of const ${name}`);
}

function extractBindEventsBlock(source, startMarker, endMarker) {
  const bindEvents = extractFunction(source, "bindEvents");
  const start = bindEvents.indexOf(startMarker);
  assert.ok(start !== -1, `bindEvents must contain: ${startMarker}`);
  const end = bindEvents.indexOf(endMarker, start);
  assert.ok(end !== -1, `bindEvents must contain after the start marker: ${endMarker}`);
  return bindEvents.slice(start, end);
}

const main = await readRepoFile("src/main.js");
const styles = await readRepoFile("src/styles.css");

/* ---------------------------------------------------------------------
   Issue 1 — TYT intent routing. The bug: "Teach" (a supply-side action —
   the user offers to teach) silently landed on "hire" (a demand-side
   view — find/hire a professional), because TYT tiles used to carry only
   an icon/label/view with no classification at all. TYT_ACTIONS is now
   the single source of truth: every tile has explicit intent (supply/
   demand), type, route, and view.
--------------------------------------------------------------------- */

const TYT_ACTIONS_SUPPLY = ["earnMoney", "offerService", "sellSomething", "shareKnowledge", "volunteer", "teach", "deliver", "createListing"];
const TYT_ACTIONS_DEMAND = ["getHelp", "findOpportunities"];
// hire and createListing are each exclusively one-sided (hire has no
// supply-side content at all — no "offer your service" entry point
// anywhere on it; createListing has no browse/demand content). needHelp
// and contribute are deliberately shared between both directions
// (needHelp: post a request [demand] vs. browse and volunteer for one
// [supply]; contribute: earn money [supply] vs. find paid opportunities
// [demand, framed as browsing]) — that sharing is intentional design,
// not the bug, so only the two exclusively-one-sided views are asserted
// here.

test("TYT_ACTIONS gives every tile an explicit intent, type, route, and view — no tile can silently fall back to an unclassified destination", () => {
  const block = extractConst(main, "TYT_ACTIONS");
  for (const key of [...TYT_ACTIONS_SUPPLY, ...TYT_ACTIONS_DEMAND]) {
    const entryMatch = block.match(new RegExp(`${key}: \\{([^}]*)\\}`));
    assert.ok(entryMatch, `TYT_ACTIONS must define an entry for "${key}"`);
    const entry = entryMatch[1];
    assert.match(entry, /intent: "(supply|demand)"/, `${key} must declare an explicit intent`);
    assert.match(entry, /type: "[a-z]+"/, `${key} must declare an explicit type`);
    assert.match(entry, /route: "[a-z-]+"/, `${key} must declare an explicit route`);
    assert.match(entry, /view: "[a-zA-Z]+"/, `${key} must declare an explicit view`);
  }
});

test("Teach is classified as supply and routes to createListing (category services) — never to hire, the demand-side 'find/hire a professional' view", () => {
  const block = extractConst(main, "TYT_ACTIONS");
  const teach = block.match(/teach: \{([^}]*)\}/)[1];
  assert.match(teach, /intent: "supply"/, "Teach must be classified as a supply-side action");
  assert.match(teach, /type: "teaching"/);
  assert.match(teach, /view: "createListing"/, "Teach must route to createListing");
  assert.match(teach, /category: "services"/);
  assert.doesNotMatch(teach, /view: "hire"/, "Teach must never route to hire — that was the original bug");
});

test("every supply-classified TYT action stays classified as supply and never routes to hire (the demand-exclusive 'find/hire a professional' view)", () => {
  const block = extractConst(main, "TYT_ACTIONS");
  for (const key of TYT_ACTIONS_SUPPLY) {
    const entry = block.match(new RegExp(`${key}: \\{([^}]*)\\}`))[1];
    assert.match(entry, /intent: "supply"/, `${key} must remain classified as supply`);
    assert.doesNotMatch(entry, /view: "hire"/, `${key} is supply but routes to hire, a demand-exclusive view`);
  }
});

test("every demand-classified TYT action stays classified as demand and never routes to createListing (the supply-exclusive 'post an offering' view)", () => {
  const block = extractConst(main, "TYT_ACTIONS");
  for (const key of TYT_ACTIONS_DEMAND) {
    const entry = block.match(new RegExp(`${key}: \\{([^}]*)\\}`))[1];
    assert.match(entry, /intent: "demand"/, `${key} must remain classified as demand`);
    assert.doesNotMatch(entry, /view: "createListing"/, `${key} is demand but routes to createListing, a supply-exclusive view`);
  }
});

test("renderTytSheet renders every tile from TYT_ACTIONS with data-view, data-intent, and (where declared) both data-category AND its paired data-target-view — no tile is hand-written outside the central config", () => {
  const fn = extractFunction(main, "renderTytSheet");
  assert.match(fn, /Object\.values\(TYT_ACTIONS\)\.map\(\(action\) => `/, "tiles must be generated from TYT_ACTIONS, not a separate hard-coded list");
  assert.match(fn, /data-view="\$\{action\.view\}"/);
  assert.match(fn, /data-intent="\$\{action\.type\}"/);
  assert.match(
    fn,
    /\$\{action\.category \? `data-category="\$\{action\.category\}" data-target-view="\$\{action\.view\}"` : ""\}/,
    "data-category must always be paired with data-target-view — there is a separate, unrelated [data-category] click handler (built for Explore/Create-hub category tiles) that ALSO fires on any element carrying data-category, and it falls back to state.activeView = \"marketplace\" whenever data-target-view is missing, silently overwriting whatever the [data-view] handler just set. This is exactly how Teach/Offer a Service/Sell Something/Deliver ended up on Marketplace instead of createListing during manual verification, despite TYT_ACTIONS and the [data-view] handler both being correct."
  );
});

test("the [data-category] click handler's marketplace fallback can never silently override a TYT tile's real destination — every TYT_ACTIONS entry with a category produces a tile where data-target-view matches data-view exactly", () => {
  const fn = extractFunction(main, "renderTytSheet");
  const block = extractConst(main, "TYT_ACTIONS");
  for (const key of ["offerService", "sellSomething", "teach", "deliver"]) {
    const entry = block.match(new RegExp(`${key}: \\{([^}]*)\\}`))[1];
    assert.match(entry, /category: "[a-z-]+"/, `${key} must declare a category (this test only makes sense for category-bearing tiles)`);
  }
  // The template itself uses one shared expression for every tile, so
  // asserting it once (above) covers all of them — this test exists to
  // make the invariant explicit and named, so a future refactor that
  // reintroduces per-tile markup can't silently drop the pairing for
  // just one tile.
  assert.match(fn, /data-target-view="\$\{action\.view\}"/);
});

test("the Create hub's 'Offer a Service' entry is fixed to match TYT_ACTIONS.offerService (createListing, category services) — it had the exact same hire-routing bug as a second, separate entry point into the same action", () => {
  const fn = extractFunction(main, "renderCreate");
  const serviceEntry = fn.match(/\["service", "common\.offerService", "common\.offerServiceHint", ([^\]]*)\]/);
  assert.ok(serviceEntry, "the 'Offer a Service' secondary action must still exist");
  assert.match(serviceEntry[1], /"createListing"/, "must route to createListing");
  assert.match(serviceEntry[1], /"services"/, "must preset category to services");
  assert.doesNotMatch(fn, /"service", "common\.offerService", "common\.offerServiceHint", "hire"/, "must never route to hire");
});

test("no TYT tile or Create-hub secondary action routes to 'hire' anymore — hire is reachable only through its own direct navigation, never as an unrelated action's silent fallback", () => {
  const tytBlock = extractConst(main, "TYT_ACTIONS");
  assert.doesNotMatch(tytBlock, /view: "hire"/, "TYT_ACTIONS must contain no entry routing to hire");
  const createFn = extractFunction(main, "renderCreate");
  const actionTables = createFn
    .slice(createFn.indexOf("const primaryCreationActions"), createFn.indexOf("return `"))
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(actionTables, /"hire"/, "renderCreate's action tables must contain no route to hire (checking the action-table data only, not surrounding prose comments)");
});

test("state.tytIntent is set from data-intent by the one generic [data-view] click handler, so any navigation without an explicit intent clears it — no stale intent can leak into an unrelated later visit", () => {
  const block = extractBindEventsBlock(
    main,
    'document.querySelectorAll("[data-view]").forEach((button) => {',
    "document.querySelectorAll(\"[data-alwen-toggle]\")"
  );
  assert.match(block, /state\.tytIntent = button\.dataset\.intent \|\| null;/);
});

test("createListing, needHelp, and contribute each show action-specific hero copy when arriving from a matching TYT intent, falling back to their existing generic copy otherwise", () => {
  const createListingFn = extractFunction(main, "renderCreateListingForm");
  assert.match(createListingFn, /const intentCopy = LISTING_INTENT_COPY\[state\.tytIntent\] \|\| null;/);
  assert.match(createListingFn, /t\("createListing\.createListingTitle"\)/, "must still fall back to the generic title for a direct visit");

  const needHelpFn = extractFunction(main, "renderNeedHelp");
  assert.match(needHelpFn, /const isVolunteerVisit = state\.tytIntent === "volunteer";/);
  assert.match(needHelpFn, /"needHelp\.volunteerHeroTitle"/);

  const contributeFn = extractFunction(main, "renderContribute");
  assert.match(contributeFn, /const isFindOpportunitiesVisit = state\.tytIntent === "opportunities";/);
  assert.match(contributeFn, /"contribute\.opportunitiesHeroTitle"/);
});

/* ---------------------------------------------------------------------
   Issue 2 / 5 — hero search click-through bug. Every page hero uses a
   "*-photo" background class with the search/Tell Alwen composer nested
   directly inside it; a capture-phase, document-wide click listener
   (bindPhotoZoom) opened the hero's own background photo in a full-
   screen viewer for ANY click landing inside that hero — including
   clicks straight on the search input — because it only excluded
   buttons and links, not real form controls or the composer containers
   themselves.
--------------------------------------------------------------------- */

test("bindPhotoZoom excludes real form controls and every composer container before it ever looks for a hero photo — search interaction always wins over the hero's background image", () => {
  const fn = extractFunction(main, "bindPhotoZoom");
  assert.match(
    fn,
    /event\.target\.closest\('button, a\[href\], input, textarea, select, \.ai-search, \.home-command-bar, \.tyt-ai-search'\)/,
    "must exclude form controls (input/textarea/select) and every known composer container, not just buttons and links"
  );
});

test("the marketplace hero's search input sits inside .marketplace-hero-photo, and Home's composer sits inside .home-command-bar — both are covered by bindPhotoZoom's exclusion selector", () => {
  const marketplaceFn = extractFunction(main, "renderMarketplace");
  assert.match(marketplaceFn, /class="city-hero page-hero marketplace-hero-photo"/, "the marketplace hero must still use a *-photo background class");
  assert.match(marketplaceFn, /\$\{renderAiSearch\("marketplace"\)\}/, "the search composer must still be nested directly inside that hero");

  const homeComposerFn = extractFunction(main, "renderHomeAiComposer");
  assert.match(homeComposerFn, /data-role="home-command-bar"/, "Home's composer wrapper must carry the class bindPhotoZoom excludes");
});

test("Tell Alwen buttons (data-alwen-toggle, ai-search-submit) are real <button> elements, already covered by bindPhotoZoom's button exclusion, so they can never open the hero photo instead of submitting", () => {
  assert.match(main, /<button class="alwen-mini-toggle"|data-alwen-toggle[^>]*>/, "at least one data-alwen-toggle button must exist");
  const searchFn = extractFunction(main, "renderAiSearch");
  assert.match(searchFn, /<button type="button" data-action="ai-search-submit">/, "the shared search bar's submit control must be a real <button>, covered by bindPhotoZoom's exclusion");
});

/* ---------------------------------------------------------------------
   Issue 3 — floating Alwen "eyes" FAB removed entirely (not hidden with
   CSS). Legitimate entry points (Home's AI command bar, Ask Alwen /
   Tell Alwen buttons, bottom navigation, the TYT centre button, and the
   Alwen logo inside search/composer fields) must all remain.
--------------------------------------------------------------------- */

test("the floating Alwen dock is fully removed — no renderAlwenDock function, no call site, no .alwen-dock/.alwen-orb CSS left behind", () => {
  assert.doesNotMatch(main, /function renderAlwenDock\(/, "renderAlwenDock's definition must not exist");
  assert.doesNotMatch(main, /renderAlwenDock\(\)/, "there must be no call site left anywhere");
  assert.doesNotMatch(styles, /\.alwen-dock\s*\{/, "the .alwen-dock CSS rule must be removed, not just orphaned");
  assert.doesNotMatch(styles, /\.alwen-orb\s*[,{]/, "the .alwen-orb CSS rules must be removed, not just orphaned");
});

test("legitimate Alwen entry points are preserved: the data-alwen-toggle handler still exists (used by real Ask Alwen buttons), Home's AI command bar still exists, bottom navigation is untouched, and the Alwen logo inside search fields (.alwen-mini) is untouched", () => {
  const block = extractBindEventsBlock(
    main,
    'document.querySelectorAll("[data-alwen-toggle]").forEach((button) => {',
    "document.querySelector(\"[data-alwen-toggle-live-translate]\")"
  );
  assert.match(block, /state\.activeView = "alwen";/, "data-alwen-toggle must still navigate into the Alwen conversation");

  assert.match(main, /data-role="home-command-bar"/, "Home's AI command bar must still exist");
  assert.match(main, /class="community-header-secondary" data-alwen-toggle/, "Community's real 'Ask Alwen' button must still exist");
  assert.match(main, /class="notification-rail-button" data-alwen-toggle/, "the notification rail's real 'Ask Alwen' button must still exist");
  assert.match(main, /class="bottom-nav /, "bottom navigation markup must be untouched");
  assert.match(main, /function renderTytOrb\(/, "the TYT centre button must be untouched — it is a separate Trade Your Time hub, not an Alwen surface");
  assert.match(styles, /\.alwen-mini\s*\{/, "the Alwen logo mark used inside search/composer fields (.alwen-mini) must remain styled");
});

/* ---------------------------------------------------------------------
   Issue 4 — verified badge consistency. verifiedCheck() is the one
   shared component; two other call sites used to hand-roll their own
   version (an unstyled raw "✓" with no accessible label, and
   .conversation-verified, a bare colored glyph with no badge shape),
   and a second, conflicting 19px CSS override of .verified-check
   existed elsewhere in the file and silently won by cascade order,
   causing inconsistent sizing wherever the badge appeared.
--------------------------------------------------------------------- */

test("verifiedCheck() is the single shared badge component — always includes an accessible label, and is used consistently across profiles, community, marketplace, pro cards, business headers, and conversation rows", () => {
  const fn = extractFunction(main, "verifiedCheck");
  assert.match(fn, /aria-label="\$\{escapeHtml\(label\)\}"/);
  assert.match(fn, /class="verified-check"/);
  const siteCount = [...main.matchAll(/verifiedCheck\(/g)].length;
  assert.ok(siteCount >= 10, `verifiedCheck() must be reused at many call sites (found ${siteCount})`);
});

test("the old hand-rolled duplicates are gone: no raw unstyled checkmark span, no .conversation-verified markup or CSS left anywhere", () => {
  assert.doesNotMatch(main, /<span>✓ \$\{t\("common\.verifiedSeller"\)\}<\/span>/, "the marketplace card's duplicate raw checkmark (redundant with its own verifiedCheck() badge on the same card) must be removed, not just restyled");
  assert.doesNotMatch(main, /class="conversation-verified"/, "conversation rows must use verifiedCheck(), not their own conversation-verified span");
  assert.doesNotMatch(styles, /\.conversation-verified\s*[,{]/, "the now-unused .conversation-verified CSS must be removed");
});

test("there is exactly one .verified-check size definition in styles.css — the conflicting 19px override (which silently won over the canonical 20px rule by cascade order alone, the actual cause of inconsistent sizing) has been removed, not merged", () => {
  const definitions = [...styles.matchAll(/^\.verified-check \{/gm)];
  assert.equal(definitions.length, 1, `expected exactly one .verified-check rule, found ${definitions.length}`);
  assert.doesNotMatch(styles, /width: 19px/, "the conflicting 19px override must be gone");
});

test(".verified-check has its own margin so it never sits flush against the preceding name (every call site places it immediately adjacent in the markup, with no separating space) — this was the actual cause of the badge overlapping names", () => {
  const rule = styles.match(/\.verified-check \{[^}]*\}/)[0];
  assert.match(rule, /margin-left: 6px/);
});
