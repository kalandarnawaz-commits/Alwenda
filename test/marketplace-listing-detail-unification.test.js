import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression coverage for the "Home Feed opens a reduced fallback
   instead of the canonical Marketplace listing-detail page" correction.

   Root cause (see the PR description for the full report): a real
   listing published by someone other than the current viewer only ever
   existed in state.opportunityFeed.listings — a lightweight, card-only
   pool (id/title/description/category/price/neighbourhood/created_at,
   no images, no seller, no condition) built for the Home Feed/Live
   Around You carousel, never meant to back a full detail page. The
   previous fix (renderRealListingDetail) papered over that gap with a
   second, reduced template instead of fixing it — exactly the "two
   implementations" anti-pattern this correction removes.

   The fix: fetchListingById() pulls the FULL real listing row (every
   public-safe column, real photos via fetchListingImages, the owner's
   public profile via fetchProfilesByIds) and shapeRemoteListingForDisplay()
   maps it into the exact same shape shapeListingForDisplay already
   produces for a mock/own listing — so there is only ONE render function,
   renderListingDetailBody(), consuming either source identically.
   renderListingDetail() is now a thin router: local `listings` pool
   first (synchronous, full shape already), else an async full fetch via
   refreshRemoteListingDetail(), cached in state.remoteListingDetail.

   Following this repo's established pattern: pure data functions
   (shapeRemoteListingForDisplay, the gallery-selection logic) are
   extracted and actually executed via new Function(...); the render
   template itself is asserted on structurally, since fully executing it
   needs many i18n/DOM collaborators this test doesn't want to hand-mock.
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
const supabaseClient = await readRepoFile("src/services/auth/supabaseClient.js");

/* ---------------------------------------------------------------------
   1 & 2. One canonical route, one canonical body — no duplicate fallback.
--------------------------------------------------------------------- */

test("renderListingDetail() is a thin router with no fallback branch — every resolved item renders through renderListingDetailBody()", () => {
  const router = extractFunction(main, "renderListingDetail");
  assert.match(router, /return renderListingDetailBody\(localItem\)/);
  assert.match(router, /return renderRemoteListingDetail\(\)/);
  // The router itself contains no template markup of its own — that
  // would be the two-implementations pattern this correction removes.
  assert.doesNotMatch(router, /<section/);

  const remoteRouter = extractFunction(main, "renderRemoteListingDetail");
  assert.match(remoteRouter, /return renderListingDetailBody\(cache\.item\)/);
});

test("no duplicate fallback detail renderer remains", () => {
  assert.doesNotMatch(main, /function renderRealListingDetail\(/, "renderRealListingDetail must stay removed");
  // Exactly one function renders the actual detail markup.
  const bodyOccurrences = (main.match(/function renderListingDetailBody\(/g) || []).length;
  assert.equal(bodyOccurrences, 1);
});

test("a Home Feed Marketplace item and a Marketplace card with the same real listing id resolve to the identical renderListingDetail() route — data-view/data-listing-id is the only navigation contract, no Home-Feed-specific view exists", () => {
  const homeFeedItem = extractFunction(main, "renderHomeFeedListingItem");
  assert.match(homeFeedItem, /data-view="listingDetail" data-listing-id="\$\{raw\.id\}"/);
  const marketplaceMiniCard = extractFunction(main, "renderMarketplaceMiniCard");
  assert.match(marketplaceMiniCard, /data-view="listingDetail" data-listing-id="\$\{item\.id\}"/);
  // Both dispatch through the exact same generic [data-view] click handler
  // (bindEvents) into the exact same state.selectedListingId + activeView
  // — there is no separate "home feed listing detail" view anywhere.
  assert.doesNotMatch(main, /"homeFeedListingDetail"|"realListingDetail"/i);
});

/* ---------------------------------------------------------------------
   3 & 4. Full listing data is loaded BY ID (not derived from the partial
   feed card), and UUID/string ids work throughout.
--------------------------------------------------------------------- */

test("refreshRemoteListingDetail loads the full record via fetchListingById(id) — never from state.opportunityFeed.listings' partial rows", () => {
  const refresh = extractFunction(main, "refreshRemoteListingDetail");
  assert.match(refresh, /fetchListingById\(id\)/);
  assert.doesNotMatch(refresh, /opportunityFeed/);
});

test("fetchListingById fetches the full listings row by id, plus real photos and the owner's public profile — no embedded join (verified live against the actual schema not to support one)", () => {
  const marker = "export async function fetchListingById(";
  const start = supabaseClient.indexOf(marker);
  assert.ok(start !== -1);
  const body = supabaseClient.slice(start, supabaseClient.indexOf("\nexport async function fetchCommunityPosts", start));
  assert.match(body, /\.eq\("id", id\)/);
  assert.match(body, /\.eq\("status", "published"\)/);
  assert.match(body, /fetchListingImages\(data\.id\)/);
  assert.match(body, /fetchProfilesByIds\(\[data\.owner_user_id\]\)/);
  assert.doesNotMatch(body, /select\("\*"\)/, "must not select * — explicit columns only");
});

function runShapeRemoteListingForDisplay(raw) {
  const body = [
    extractConst(main, "LISTING_CATEGORY_TO_DB"),
    "function formatListingPrice(amount, period, currency) { return amount != null ? `${amount} ${currency || 'EUR'}` : 'Price on request'; }",
    extractFunction(main, "shapeRemoteListingForDisplay"),
    `return shapeRemoteListingForDisplay(${JSON.stringify(raw)});`
  ].join("\n");
  const fn = new Function(body);
  return fn();
}

test("shapeRemoteListingForDisplay maps a real listing with a UUID id, real photos, and a verified real seller without loss or fabrication", () => {
  const raw = {
    id: "3f6a2e10-aaaa-bbbb-cccc-uuid-example",
    owner_user_id: "7c1e9a20-owner-uuid",
    title: "Vintage bicycle",
    description: "Barely used, well maintained.",
    category: "buy_sell",
    price_amount: 150,
    price_currency: "EUR",
    price_period: "one_time",
    neighbourhood: "Žvėrynas",
    location_label: null,
    metadata: { condition: "used_good", pickupAvailable: true, deliveryAvailable: false },
    offeror_status: "trader",
    created_at: "2026-01-05T00:00:00Z",
    images: [{ publicUrl: "https://example.com/photo1.jpg" }, { publicUrl: "https://example.com/photo2.jpg" }],
    owner: { user_id: "7c1e9a20-owner-uuid", display_name: "Jonas", avatar_url: "https://example.com/avatar.jpg", verification_status: "verified", reputation_score: 42 }
  };
  const item = runShapeRemoteListingForDisplay(raw);
  assert.equal(item.id, "3f6a2e10-aaaa-bbbb-cccc-uuid-example");
  assert.equal(item.sellerId, "7c1e9a20-owner-uuid");
  assert.equal(item.type, "buy-sell");
  assert.equal(item.title, "Vintage bicycle");
  assert.equal(item.area, "Žvėrynas");
  assert.equal(item.condition, "used_good");
  assert.deepEqual(item.gallery, ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]);
  assert.equal(item.image, "https://example.com/photo1.jpg");
  assert.equal(item.seller, "Jonas");
  assert.equal(item.sellerAvatar, "https://example.com/avatar.jpg");
  assert.equal(item.verifiedSeller, true);
  assert.equal(item.sellerReputation, 42);
  assert.equal(item.pickupAvailable, true);
  assert.equal(item.deliveryAvailable, false);
  assert.equal(item.offerorStatus, "trader");
  assert.equal(item.sellerPhone, null, "private contact info must never be populated");
  assert.equal(item.isRealRecord, true);
});

test("shapeRemoteListingForDisplay never crashes and never fabricates a value for a listing with no photos, no neighbourhood, and a default private seller", () => {
  const raw = {
    id: "9b2c-minimal-uuid",
    owner_user_id: "owner-2-uuid",
    title: "Free moving boxes",
    description: null,
    category: "offers",
    price_amount: null,
    price_currency: "EUR",
    price_period: null,
    neighbourhood: null,
    location_label: null,
    metadata: {},
    offeror_status: "private",
    created_at: "2026-01-06T00:00:00Z",
    images: [],
    owner: { user_id: "owner-2-uuid", display_name: "", avatar_url: null, verification_status: "unverified", reputation_score: 0 }
  };
  const item = runShapeRemoteListingForDisplay(raw);
  assert.equal(item.area, "");
  assert.equal(item.condition, null);
  assert.deepEqual(item.gallery, []);
  assert.equal(item.image, "");
  assert.equal(item.verifiedSeller, false);
  assert.equal(item.sellerReputation, 0, "a real 0 reputation is honest, not fabricated — public_profiles.reputation_score defaults to 0");
  assert.equal(item.offerorStatus, "private");
  for (const value of Object.values(item)) {
    assert.notEqual(value, undefined, "no field should ever be literally undefined");
  }
});

test("state.remoteListingDetail caches by id, so re-rendering the same listing while it loads never re-fetches, but navigating to a different listing does", () => {
  const refresh = extractFunction(main, "refreshRemoteListingDetail");
  assert.match(refresh, /state\.remoteListingDetail = \{ status: "loading", id, item: null \};/);
  const remoteRouter = extractFunction(main, "renderRemoteListingDetail");
  assert.match(remoteRouter, /!cacheMatchesId \|\| cache\.status === "idle"/);
});

/* ---------------------------------------------------------------------
   5 & 6. Images — one clean placeholder when genuinely absent, real
   photos render correctly, "No additional photos yet" only appears with
   exactly one photo (a primary but no gallery extras).
--------------------------------------------------------------------- */

test("gallery rendering: real photos render as a rail, zero photos render one placeholder tile, and the 'no additional photos' hint only appears alongside exactly one real photo", () => {
  const bodyFn = extractFunction(main, "renderListingDetailBody");
  assert.match(bodyFn, /const galleryPhotos = \(item\.gallery && item\.gallery\.length \? item\.gallery : \[item\.image\]\)\.filter\(Boolean\);/);
  assert.match(bodyFn, /galleryPhotos\.length\s*\n?\s*\?\s*`<div class="business-gallery-rail listing-gallery-rail">\$\{galleryPhotos/);
  assert.match(bodyFn, /listing-gallery-placeholder/, "must render one intentional placeholder tile when there are zero real photos");
  // Never both a blank gallery rail AND the "no additional photos" text
  // for the zero-photo case — the hint is gated specifically on exactly
  // one photo (a primary exists, there just aren't gallery extras).
  assert.match(bodyFn, /galleryPhotos\.length === 1 \? `<p class="settings-section-hint">\$\{t\("marketplace\.listingDetail\.galleryEmpty"\)\}<\/p>` : ""/);
});

test("the gallery-selection logic actually behaves correctly for 0, 1, and 2+ real photos", () => {
  function select(item) {
    return (item.gallery && item.gallery.length ? item.gallery : [item.image]).filter(Boolean);
  }
  assert.deepEqual(select({ gallery: [], image: "" }), []);
  assert.deepEqual(select({ gallery: ["a.jpg"], image: "a.jpg" }), ["a.jpg"]);
  assert.deepEqual(select({ gallery: ["a.jpg", "b.jpg"], image: "a.jpg" }), ["a.jpg", "b.jpg"]);
  // Older mock-shape record with only .image, no .gallery array at all.
  assert.deepEqual(select({ gallery: undefined, image: "solo.jpg" }), ["solo.jpg"]);
});

/* ---------------------------------------------------------------------
   7. Seller profile, Message CTA, and Share render unconditionally in
   the one canonical body — no Home-Feed-specific limitation copy.
--------------------------------------------------------------------- */

test("the canonical body renders seller identity, Message seller, Call (or its honest disabled state), Share, and Save unconditionally — no architecture-specific fallback copy", () => {
  const bodyFn = extractFunction(main, "renderListingDetailBody");
  assert.match(bodyFn, /data-action="start-listing-conversation" data-listing-id="\$\{item\.id\}"/);
  assert.match(bodyFn, /data-action="share-listing" data-listing-id="\$\{item\.id\}"/);
  assert.match(bodyFn, /data-action="toggle-listing-save" data-listing-id="\$\{item\.id\}"/);
  assert.match(bodyFn, /class="seller-row"/);
  assert.doesNotMatch(main, /limitedProfileNote|aren't available from this view/i, "the Home-Feed-specific 'unavailable from this view' copy must be fully removed");
});

test("startListingConversation resolves a real listing reached only via the remote cache (not present in the local mock listings array), not just local/mock listings", () => {
  const fn = extractFunction(main, "startListingConversation");
  assert.match(fn, /state\.remoteListingDetail\.id/);
  assert.match(fn, /state\.remoteListingDetail\.item/);
});

test("seller messaging is the same pre-existing simulated-conversation flow used everywhere in Marketplace — no new sign-in gate or Home-Feed-specific messaging behaviour was invented", () => {
  // startListingConversation's openGeneratedConversation call (a simulated
  // reply, not a real send) is genuinely how EVERY listing's "Message"
  // button already behaves, mock or real — confirmed before this PR. This
  // correction keeps that one consistent limitation across all entry
  // points rather than inventing a different behaviour for real listings.
  const fn = extractFunction(main, "startListingConversation");
  assert.match(fn, /openGeneratedConversation\(/);
});

/* ---------------------------------------------------------------------
   8 & 9. Browser Back / direct-link restoration — unaffected by this
   correction, still governed by the existing generic routing mechanism.
--------------------------------------------------------------------- */

test("listingDetail stays a real id-linked, deep-linkable view — direct-link restoration for a real (non-local) listing id is unaffected by this correction", () => {
  assert.match(main, /const ID_LINKED_VIEWS = new Set\(\["publicProfile", "userProfile", "listingDetail"/);
  // The generic [data-view] handler sets state.selectedListingId as a
  // plain string (no Number() cast) — already UUID-safe, untouched here.
  assert.match(main, /if \(button\.dataset\.listingId\) \{\s*\n\s*state\.selectedListingId = button\.dataset\.listingId;/);
});

test("the in-app Back control and browser history are unaffected — this correction only changed how the item is resolved, not navigation", () => {
  const bodyFn = extractFunction(main, "renderListingDetailBody");
  assert.match(bodyFn, /data-view="marketplace">\$\{icon\("arrow"\)\}\$\{t\("common\.back"\)\}<\/button>/);
});
