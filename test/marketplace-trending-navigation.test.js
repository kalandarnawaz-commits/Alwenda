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

// Home redesign (see test/home-feed.test.js): renderTrendingMarketplace
// (Home's own "Trending Marketplace" rail) was removed — that content
// still lives on Marketplace's own landing page (renderMarketplacePicker's
// trending rail, tested below) and is now also surfaced honestly through
// the Unified Home Feed's Marketplace source, never duplicated as a
// separate Home rail. renderMarketplaceMiniCard's navigation contract
// (open exact listing detail) is unchanged and still shared by both.
test("renderTrendingMarketplace stays removed; renderMarketplaceMiniCard still opens exact listing details", () => {
  assert.doesNotMatch(main, /function renderTrendingMarketplace\(/, "renderTrendingMarketplace must stay removed");
  const miniCard = extractFunction(main, "renderMarketplaceMiniCard");
  assert.match(miniCard, /data-view="listingDetail"/);
  assert.match(miniCard, /data-listing-id="\$\{item\.id\}"/);
});

test("marketplace landing shows top ten recently-listed cards above category tiles", () => {
  // Real listings have no honest popularity/trending signal (see
  // shapeListingSummaryForDisplay in main.js) — this rail is ordered by
  // genuine createdAt instead, see recentListingItems().
  const picker = extractFunction(main, "renderMarketplacePicker");
  const railIndex = picker.indexOf('marketplaceListingRail("home.rail.recentlyListed"');
  const gridIndex = picker.indexOf('<div class="explore-hub-grid">');

  assert.ok(railIndex !== -1, "marketplace picker should render a recently-listed rail");
  assert.ok(gridIndex !== -1, "marketplace picker should still render category tiles");
  assert.ok(railIndex < gridIndex, "recently-listed items should appear before category tiles");
  assert.match(picker, /recentListingItems\(10\)/);
});

test("marketplace carousel rails use the dedicated shelf shell", () => {
  const carousel = extractFunction(main, "renderCarousel");

  assert.match(carousel, /trackClass\.includes\("marketplace-rail"\)/);
  assert.match(carousel, /carousel-shell-marketplace/);
});
