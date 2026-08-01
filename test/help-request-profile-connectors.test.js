import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const supabaseClient = await readFile(new URL("../src/services/auth/supabaseClient.js", import.meta.url), "utf8");

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

function extractExportedAsyncFunction(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start !== -1, `export async function ${name} must exist`);
  const signatureEnd = source.indexOf(")", start);
  assert.ok(signatureEnd !== -1, `export async function ${name} must have a complete signature`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = signatureEnd + 1; i < source.length; i += 1) {
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

test("help requests load public author profiles in one bounded batch", () => {
  const fetchOpenHelpRequests = extractExportedAsyncFunction(supabaseClient, "fetchOpenHelpRequests");
  assert.match(fetchOpenHelpRequests, /requester_user_id/, "help request author id must be selected");
  assert.match(fetchOpenHelpRequests, /created_by_alwen/, "system-created records must remain distinguishable");
  assert.match(fetchOpenHelpRequests, /new Set\(requests\.map/, "author ids should be de-duplicated before profile fetch");
  assert.match(fetchOpenHelpRequests, /fetchProfilesByIds\(requesterIds\)/, "profiles should be fetched as one batch");
  assert.doesNotMatch(fetchOpenHelpRequests, /select\("\*"\)/, "public feed must stay column-scoped");
});

test("public profile fetch is reusable and privacy-scoped", () => {
  const fetchProfilesByIds = extractExportedAsyncFunction(supabaseClient, "fetchProfilesByIds");
  assert.match(fetchProfilesByIds, /public_profiles/);
  assert.match(fetchProfilesByIds, /user_id, display_name, avatar_url, handle, verification_status, reputation_score/);
  assert.doesNotMatch(fetchProfilesByIds, /contact_email|contact_phone|private_profiles|select\("\*"\)/, "private profile data must never be selected for request cards");
});

test("help request display model keeps UUID ids as strings and separates author state", () => {
  const shaper = extractFunction(main, "shapeHelpRequestOpportunityForDisplay");
  assert.match(shaper, /id: String\(record\.id\)/, "UUIDs must be preserved as strings");
  assert.doesNotMatch(shaper, /Number\(/, "UUIDs must not be coerced through Number()");
  assert.match(shaper, /author: publicHelpRequestAuthor\(record\)/);
  assert.match(shaper, /sourceType: record\.requester_user_id \? "user" : record\.created_by_alwen \? "system" : "legacy"/);

  const author = extractFunction(main, "publicHelpRequestAuthor");
  assert.match(author, /verification_status === "verified"/, "verified badge must depend on real profile status");
  assert.doesNotMatch(author, /reputation_score|reputation:/, "help request cards should not expose reputation fields they do not render");
  assert.doesNotMatch(author, /Verified user has posted|Alex Walker|iPhone 15 Pro/, "request cards must not invent fixture profile copy");
});

test("real help request cards expose distinct request and profile destinations", () => {
  const card = extractFunction(main, "renderRealOpportunityCard");
  const authorRow = extractFunction(main, "renderHelpRequestAuthorRow");
  assert.match(card, /people-request-card/);
  assert.match(card, /data-view="liveOpportunityDetail"/);
  assert.match(card, /data-opportunity-id/);
  assert.match(card, /renderHelpRequestAuthorRow\(request\)/, "cards must use the shared author row");
  assert.match(authorRow, /data-user-profile-target/, "author/profile controls must link to public profile routing");
  assert.match(card, /opportunities\.viewRequest/);
});

test("help request image resolver prefers uploaded media, category art, then neutral fallback", () => {
  const resolver = extractFunction(main, "resolveHelpRequestImage");
  const categoryArtwork = extractFunction(main, "helpRequestCategoryArtwork");
  const uploaded = extractFunction(main, "firstValidHelpRequestUploadedImage");
  assert.match(main, /const HELP_REQUEST_CATEGORY_IMAGE_MAP = Object\.freeze\(/);
  for (const category of ["cleaning", "transport", "mechanic", "food", "moving", "childcare", "homeRepairs", "repairs", "teaching", "technology", "errands", "other"]) {
    assert.match(main, new RegExp(`${category}:`), `${category} must have a deterministic category image entry`);
  }
  assert.match(uploaded, /image_url/);
  assert.match(uploaded, /photo_url/);
  assert.match(uploaded, /media\.map/);
  assert.match(resolver, /const uploaded = firstValidHelpRequestUploadedImage\(record\)/);
  assert.match(resolver, /if \(uploaded\)/, "uploaded request media must win before category art");
  assert.match(resolver, /HELP_REQUEST_CATEGORY_IMAGE_MAP\[categoryId\]/);
  assert.match(resolver, /helpRequestCategoryArtwork\(categoryId\)/);
  assert.match(categoryArtwork, /HELP_REQUEST_CATEGORY_IMAGE_FALLBACK/);
  assert.doesNotMatch(resolver, /unsplash|pexels|picsum|source\.unsplash/i, "resolver must not fetch arbitrary third-party images");
});

test("help request cards and details render lazy category imagery without leaking private profile fields", () => {
  const card = extractFunction(main, "renderRealOpportunityCard");
  const detail = extractFunction(main, "renderRealHelpRequestDetail");
  const heroImage = extractFunction(main, "renderHelpRequestHeroImage");
  assert.match(card, /renderHelpRequestHeroImage\(request, "people-request-image"\)/);
  assert.match(heroImage, /src="\$\{escapeHtml\(request\.image\.src\)\}"/);
  assert.match(heroImage, /alt="\$\{escapeHtml\(request\.image\.alt\)\}"/);
  assert.match(heroImage, /loading="lazy" decoding="async"/);
  assert.match(detail, /class="opportunity-detail-hero people-request-detail-hero"/);
  assert.match(detail, /renderHelpRequestHeroImage\(request, "people-request-detail-hero-image"\)/);
  assert.match(detail, /people-request-detail-hero-overlay/);
  assert.match(detail, /renderCategoryBadge\(request, "category-badge-overlay"\)/);
  assert.match(detail, /renderUrgencyBadge\(request, "urgency-badge-overlay"\)/);
  assert.match(detail, /renderHelpRequestAuthorRow\(request, "people-request-hero-author"\)/);
  assert.match(detail, /renderHelpRequestMetaRow\(request, "people-request-hero-meta"\)/);
  assert.doesNotMatch(detail, /people-request-detail-author/);
  assert.doesNotMatch(detail, /people-request-detail-title/);
  assert.match(extractFunction(main, "resolveHelpRequestImage"), /requestImageAlt/);
  assert.doesNotMatch(`${card}\n${detail}\n${heroImage}`, /contact_email|contact_phone|private_profiles|auth\.users|reputation_score/);
});

test("help request image clicks do not override author profile navigation", () => {
  const card = extractFunction(main, "renderRealOpportunityCard");
  const imageStart = card.indexOf('renderHelpRequestHeroImage(request, "people-request-image")');
  const authorStart = card.indexOf("renderHelpRequestAuthorRow(request)");
  assert.ok(imageStart !== -1 && authorStart !== -1 && imageStart < authorStart, "image area should be separate from author profile controls");
  const imageMarkup = card.slice(imageStart, authorStart);
  assert.doesNotMatch(imageMarkup, /data-user-profile-target/, "image taps should keep the card's request-detail target");
  assert.match(extractFunction(main, "renderHelpRequestAuthorRow"), /data-user-profile-target/, "author name/avatar retains public-profile navigation");
});

test("fixture help requests use the same resolver and stop rendering external fixture URLs", () => {
  const card = extractFunction(main, "renderOpportunityCard");
  const detail = extractFunction(main, "renderLiveOpportunityDetail");
  const fixtureShape = extractFunction(main, "shapeFixtureHelpRequestOpportunityForDisplay");
  assert.match(fixtureShape, /image: resolveHelpRequestImage\(item\)/);
  assert.match(card, /renderHelpRequestHeroImage\(request, "people-request-image"\)/);
  assert.match(extractFunction(main, "renderHelpRequestHeroImage"), /loading="lazy" decoding="async"/);
  assert.match(detail, /const image = resolveHelpRequestImage\(item\)/);
  assert.match(detail, /class="opportunity-detail-hero opportunity-detail-hero-image"/);
  assert.doesNotMatch(card, /background-image:url\('\$\{item\.image\}'\)/);
  assert.doesNotMatch(detail, /background-image:url\('\$\{item\.image\}'\)/);
});

test("help request cards share premium visual components and reserve stable image space", () => {
  for (const name of ["renderHelpRequestHeroImage", "renderHelpRequestMetaRow", "renderHelpRequestAuthorRow", "renderUrgencyBadge", "renderCategoryBadge"]) {
    assert.match(main, new RegExp(`function ${name}\\(`), `${name} must exist as a shared renderer`);
  }
  assert.match(extractFunction(main, "renderRealOpportunityCard"), /renderCategoryBadge\(request\)/);
  assert.match(extractFunction(main, "renderRealOpportunityCard"), /renderUrgencyBadge\(request\)/);
  assert.match(extractFunction(main, "renderOpportunityCard"), /renderCategoryBadge\(request\)/);
  assert.match(extractFunction(main, "renderOpportunityCard"), /renderUrgencyBadge\(request\)/);
  assert.match(styles, /\.people-request-card\s*\{[\s\S]*min-height:\s*430px/, "cards should reserve stable height");
  assert.match(styles, /\.people-request-image\s*\{[\s\S]*aspect-ratio:\s*16 \/ 10/, "image area should reserve stable space and reduce CLS");
  assert.match(styles, /\.help-request-hero-image img\s*\{[\s\S]*object-fit:\s*cover/, "request images should crop predictably");
});

test("marketplace listing photos remain independent from help-request category artwork", () => {
  const marketplaceCard = extractFunction(main, "renderMarketplaceListing");
  const listingDetail = extractFunction(main, "renderListingDetailBody");
  assert.match(marketplaceCard, /background-image: url\('\$\{item\.image\}'\)/);
  assert.match(listingDetail, /galleryPhotos/);
  assert.doesNotMatch(marketplaceCard, /resolveHelpRequestImage|HELP_REQUEST_CATEGORY_IMAGE_MAP|people-request-image/);
  assert.doesNotMatch(listingDetail, /resolveHelpRequestImage|HELP_REQUEST_CATEGORY_IMAGE_MAP|people-request-image/);
});

test("real help request detail never falls back to the first fixture for unknown ids", () => {
  const detail = extractFunction(main, "renderLiveOpportunityDetail");
  assert.match(detail, /renderRealHelpRequestDetail\(realRequest\)/);
  assert.match(detail, /refreshRemoteHelpRequestDetail\(state\.selectedOpportunityId\)/);
  assert.match(detail, /detailNotFound/);
  assert.match(detail, /const fixtureItem = findOpportunityById\(state\.selectedOpportunityId\)/);
  assert.doesNotMatch(detail, /findOpportunityById\(state\.selectedOpportunityId\) \|\| LIVE_OPPORTUNITIES\[0\]/);
});

test("adaptive page wrappers separate mobile and desktop layout without duplicating business logic", () => {
  assert.match(extractFunction(main, "renderRealHelpRequestDetail"), /adaptive-page adaptive-page-help-request/);
  assert.match(extractFunction(main, "renderMarketplace"), /adaptive-page adaptive-page-marketplace marketplace-shell/);
  assert.match(extractFunction(main, "renderListingDetailBody"), /adaptive-page adaptive-page-marketplace listing-detail-shell/);
  // renderBusinesses/renderBusinessProfile were deleted along with the rest
  // of the fake Businesses/Reservations system — no adaptive wrapper to
  // assert on anymore (see production-honesty-guard.test.js).
  assert.match(extractFunction(main, "renderProfile"), /adaptive-page adaptive-page-profile profile-panel identity-profile/);
  assert.match(extractFunction(main, "renderUserProfile"), /adaptive-page adaptive-page-profile profile-panel user-profile-shell/);
  assert.match(styles, /\.adaptive-page\s*\{[\s\S]*1280px/, "desktop adaptive pages should constrain content around 1280px");
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.adaptive-page/, "mobile adaptive wrappers must have dedicated rules");
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1199px\)/, "tablet adaptive wrappers must have dedicated rules");
  assert.match(styles, /@media \(min-width: 1200px\)/, "desktop adaptive wrappers must have dedicated rules");
});

test("help request detail hero reserves media space and prevents overlay collisions", () => {
  assert.match(styles, /\.people-request-detail-hero\s*\{[\s\S]*aspect-ratio:\s*16 \/ 8/);
  assert.match(styles, /\.people-request-detail-hero\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.people-request-detail-hero-overlay\s*\{[\s\S]*position:\s*relative/);
  assert.match(styles, /\.people-request-detail-hero-overlay\s*\{[\s\S]*justify-content:\s*space-between/);
  assert.match(styles, /\.people-request-detail-hero-copy h1\s*\{[\s\S]*text-wrap:\s*balance/);
  assert.match(styles, /\.people-request-detail-hero-image > img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.doesNotMatch(styles, /\.people-request-detail-hero img\s*\{[\s\S]*position:\s*absolute/, "author avatars inside the hero overlay must not inherit the hero media positioning");
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.people-request-detail-hero\s*\{[\s\S]*aspect-ratio:\s*4 \/ 5/);
});
