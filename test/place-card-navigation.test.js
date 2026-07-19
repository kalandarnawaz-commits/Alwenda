import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

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

test("a single shared helper opens the place detail sheet — no duplicated route construction", () => {
  const helper = extractFunction(main, "openPlaceDetail");
  assert.match(helper, /state\.selectedPlaceId = placeId/);
  assert.match(helper, /state\.activeSheet = "place"/);
  assert.match(helper, /render\(\)/);

  // The two call sites (coverflow rail, generic sheet handler) delegate to
  // the helper instead of re-assigning state.selectedPlaceId/activeSheet
  // themselves.
  const openCalls = [...main.matchAll(/openPlaceDetail\(/g)].length;
  assert.ok(openCalls >= 3, `expected the helper to be defined once and called from at least 2 sites, found ${openCalls} occurrences`);

  const directPlaceStateAssignments = [...main.matchAll(/state\.activeSheet = "place"/g)].length;
  assert.equal(directPlaceStateAssignments, 1, "only openPlaceDetail itself should set state.activeSheet to \"place\" — every card renderer/handler must go through it");
});

test("missing or unknown place id is refused without throwing", () => {
  const helper = extractFunction(main, "openPlaceDetail");
  assert.match(helper, /if \(!placeId\)/);
  assert.match(helper, /console\.warn/);
  // Guard clauses return before any state mutation or render() call.
  const guardSection = helper.slice(0, helper.indexOf("state.selectedPlaceId"));
  assert.match(guardSection, /return;[\s\S]*return;/, "both the missing-id and unknown-id branches must return before mutating state");
});

test("place cards omit navigation attributes when the item has no id", () => {
  const compact = extractFunction(main, "renderPlaceCardCompact");
  assert.match(compact, /const hasValidId = Boolean\(item\.id\)/);
  assert.match(compact, /const navAttrs = hasValidId/);

  const grid = extractFunction(main, "renderPlaceCard");
  assert.match(grid, /const hasValidId = Boolean\(item\.id\)/);
  assert.match(grid, /const photoNavAttrs = hasValidId/);
  assert.match(grid, /const bodyNavAttrs = hasValidId/);
});

test("card root elements carry data-sheet/data-place-id so the whole body is clickable", () => {
  const compact = extractFunction(main, "renderPlaceCardCompact");
  assert.match(compact, /<article class="place-card place-card--compact" \$\{navAttrs\}>/);

  const grid = extractFunction(main, "renderPlaceCard");
  assert.match(grid, /<div class="place-card-photo" \$\{photoNavAttrs\}>/);
  assert.match(grid, /<div class="place-card-body" \$\{bodyNavAttrs\}>/);
});

test("keyboard accessibility: cards get role=button, tabindex=0, and an accessible name", () => {
  const compact = extractFunction(main, "renderPlaceCardCompact");
  assert.match(compact, /role="button" tabindex="0" aria-label="\$\{escapeHtml\(item\.name\)\}"/);

  const grid = extractFunction(main, "renderPlaceCard");
  assert.match(grid, /role="button" tabindex="0" aria-label="\$\{escapeHtml\(item\.name\)\}"/);

  // A real keydown handler exists for Enter and Space, for both the
  // coverflow rail (viewport-delegated) and the grid card (per-element).
  assert.match(main, /viewport\.addEventListener\("keydown"/);
  const keydownHandlers = [...main.matchAll(/event\.key !== "Enter" && event\.key !== " " && event\.key !== "Spacebar"/g)].length;
  assert.ok(keydownHandlers >= 2, "expected keyboard activation guards for interactive cards");

  // [role="button"] gets a visible focus outline so Tab is actually usable,
  // not just technically present in the tab order.
  assert.match(styles, /\[role="button"\]:focus-visible/);
});

test("clicking the main body opens the correct place, for both the coverflow rail and the grid card", () => {
  // Coverflow rail: the viewport's delegated click handler matches the
  // closest data-sheet="place" ancestor of whatever was actually clicked
  // (title, photo, etc.), so any point on the card body opens it.
  assert.match(main, /event\.target\.closest\('\[data-sheet="place"\]\[data-place-id\]'\)/);
  assert.match(main, /if \(!card \|\| !viewport\.contains\(card\)\) return;/);

  // Grid card: both the photo and body carry the navigation attributes
  // directly (already covered above), so a direct per-element click
  // listener on either opens the same place.
  assert.match(main, /if \(button\.dataset\.sheet === "place"\) \{\s*openPlaceDetail\(button\.dataset\.placeId\);/);
});

test("side cards and center (active) cards both navigate — the coverflow handler is not restricted to .is-active", () => {
  const bindCoverflow = extractFunction(main, "bindCoverflow");
  // The click/keydown handlers select by data-sheet/data-place-id alone —
  // no is-active condition gates activation, so a non-centered side slide
  // opens on a single tap exactly like the centered one.
  assert.doesNotMatch(bindCoverflow.split('addEventListener("click"')[1].split("});")[0], /is-active/);
  assert.doesNotMatch(bindCoverflow.split('addEventListener("keydown"')[1].split("});")[0], /is-active/);
});

test("favourite button and category badge do not trigger card navigation", () => {
  const toggleSaveHandler = main.slice(main.indexOf('document.querySelectorAll(\'[data-action="toggle-save"]\')'));
  assert.match(toggleSaveHandler.slice(0, toggleSaveHandler.indexOf("});")), /event\.stopPropagation\(\)/);

  // Category badges are marked non-interactive at the CSS layer so a tap
  // on them can't ride through to the card's own navigation trigger.
  assert.match(styles, /\.place-photo-overlay \.category-chip \{\s*pointer-events: none;/);
  assert.match(styles, /pointer-events: none;\s*\}/); // present at least once (compact badge)
  const compactBadgeRule = styles.slice(styles.indexOf(".place-card-category-badge {"), styles.indexOf(".place-card-category-badge {") + 600);
  assert.match(compactBadgeRule, /pointer-events: none;/);
});

test("dragging the coverflow rail does not spuriously navigate", () => {
  const bindCoverflow = extractFunction(main, "bindCoverflow");
  // Activation only fires for a real match on a data-sheet="place"
  // descendant of the click target — a drag-release over empty track/gap
  // space (event.target = .coverflow-track itself, not a card) fails the
  // closest() match and returns without navigating. There is no separate
  // custom touch/pointer drag simulation here: the rail is a native
  // overflow-x: auto scroller, and browsers do not fire a `click` event
  // after a real drag/scroll gesture, so no artificial movement-threshold
  // logic is needed to distinguish a tap from a swipe.
  assert.match(bindCoverflow, /if \(!card \|\| !viewport\.contains\(card\)\) return;/);
  assert.doesNotMatch(bindCoverflow, /addEventListener\("touchmove"/);
  assert.doesNotMatch(bindCoverflow, /addEventListener\("pointermove"/);
});

test("coverflow hit-testing regression: preserve-3d removed from the track/slide pair that broke pointer events", () => {
  const trackRule = styles.slice(styles.indexOf(".coverflow-track {"), styles.indexOf(".coverflow-track {") + 400);
  const slideRule = styles.slice(styles.indexOf(".coverflow-slide {"), styles.indexOf(".coverflow-slide {") + 900);
  assert.doesNotMatch(trackRule.split("}")[0], /transform-style:\s*preserve-3d/);
  assert.doesNotMatch(slideRule.split("cursor: pointer;")[0] + "cursor: pointer;", /transform-style:\s*preserve-3d/);
});
