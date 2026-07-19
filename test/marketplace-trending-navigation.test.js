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

test("home trending marketplace cards open exact listing details while See all opens marketplace", () => {
  const homeTrending = extractFunction(main, "renderTrendingMarketplace");
  const miniCard = extractFunction(main, "renderMarketplaceMiniCard");

  assert.match(homeTrending, /renderLivingSection\(\s*"home\.rail\.trendingMarketplace",\s*"home\.rail\.trendingMarketplaceHint",\s*"marketplace"/);
  assert.match(homeTrending, /trendingListingItems\(10\)/);
  assert.match(homeTrending, /trendingItems\.map\(renderMarketplaceMiniCard\)/);
  assert.match(miniCard, /data-view="listingDetail"/);
  assert.match(miniCard, /data-listing-id="\$\{item\.id\}"/);
});

test("marketplace landing shows top ten trending listing cards above category tiles", () => {
  const picker = extractFunction(main, "renderMarketplacePicker");
  const railIndex = picker.indexOf('marketplaceListingRail("home.rail.trendingMarketplace"');
  const gridIndex = picker.indexOf('<div class="explore-hub-grid">');

  assert.ok(railIndex !== -1, "marketplace picker should render a trending rail");
  assert.ok(gridIndex !== -1, "marketplace picker should still render category tiles");
  assert.ok(railIndex < gridIndex, "trending listings should appear before category tiles");
  assert.match(picker, /trendingListingItems\(10\)/);
});

