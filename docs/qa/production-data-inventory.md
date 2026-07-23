# Production Data Inventory

Date: 2026-07-23
Scope: every mock/demo/seeded/fabricated data source found in the repository, classified per `docs/qa/production-data-policy.md`'s six categories, with its current disposition after the `feature/data/production-data-integrity` remediation.

## Classifications

1. **Trusted imported data** — real, sourced content (OpenStreetMap/Wikidata), never gated.
2. **Real user-generated data** — created by an authenticated user, persisted to Supabase.
3. **Real business-managed data** — created/edited by a claimed business owner.
4. **Development fixture** — fabricated content, gated behind `isFixturesAllowed()`, cannot appear in production.
5. **Production-prohibited mock data** — fabricated content that was rendering as real in production before this remediation; now category 4.
6. **Unknown provenance requiring review** — none found; every risky source traced to a concrete file/export.

## `src/data/mockData.js` / `src/data/devFixtures.js`

| Export | Classification | Consumer(s) | Disposition |
| --- | --- | --- | --- |
| `importedBusinesses` | 1. Trusted imported | Explore, place cards, Home discovery rails, city-import preview | Kept, ungated. Sourced from `seedCityData.js` (OSM/Wikidata), 332 real Vilnius records. |
| `SEED_CITY_META` | 1. Trusted imported | Import status displays | Kept, ungated. Real metadata about the seed dataset (source counts, freshness). |
| `neighbourhoods` | 1. Trusted imported | Area filters | Kept, ungated. Real Vilnius district names, not activity. |
| `city`, `categories`, `marketplaceCapabilities`, `COMMUNITY_POST_TYPES`, `professionalCategories`, `NOTIFICATION_FILTERS` | Taxonomy/config, not data | Filters, labels, routing | Kept, ungated. Static labels/enums, not fabricated activity. |
| `livingCitySignals` | Taxonomy/config (label skeleton), **not** activity | `currentLivingCitySignals()` (Home hero) | Kept, ungated — see "Reclassification" below. |
| `listings` | 5→4. Was public marketplace data (MacBook/BMW/apartment listings, fake sellers, fake reputations) | `renderMarketplace()`, `filteredListings()`, `applyCreatedListing()` (`.unshift()`) | Gated. Empty `[]` in production; real user-created listings still `.unshift()` onto the same array. |
| `serviceProfessionals` | 5→4. Was public Hire directory (fake professionals, fake ratings/reviews) | `renderHire()`, `renderProfessional()`, Home "Professionals Near You" | Gated. Empty in production — Hire has no real backing store yet (see Remaining Blockers). |
| `businesses` | 5→4. **Highest-severity finding.** A second, fully-fabricated "Local Places" directory, separate from `importedBusinesses`, with an unconditional (bug, also fixed) verified badge | `renderBusinesses()`, `renderBusinessProfile()`, `renderReservations()` | Gated. Empty in production; honest empty state added; verified-badge bug fixed to be conditional on `item.verified`. |
| `helpRequests` | 5→4, mixed with real data | `filteredHelpRequests()`, `applyCreatedHelpRequest()` (`.unshift()`) | Gated. Empty in production; real submitted requests still append. |
| `notifications` | 5→4 | `renderNotificationsBody()` | Gated. Empty in production; existing empty state (`notification.emptyTitle`/`emptyHint`) already correct, now actually reachable. |
| `messageThreads` | 5→4, mixed with real data | `renderInboxBody()`, `applyCreatedMessage()`-equivalent (`.unshift()`) | Gated. Empty in production; existing empty state fixed to match required copy. |
| `reservations` | 5→4 | `renderReservations()` | Gated. Empty in production; empty state added ("You haven't made any bookings yet"). |
| `offers` | 5→4 | `renderOffers()` | Gated. Empty in production. |
| `profileReviews` | 5→4 | `renderBusinessProfile()` reviews section | Gated. Empty in production; empty state added ("No reviews yet"). Pre-existing separate bug noted: reviews are global, not scoped per business — out of scope for this pass. |
| `reputationProfile` | 5→4. A fully fictional "Alex Walker" persona (fake trust score, badges, Unsplash photos) | Illustrative Alwen listing-draft preview | Gated. Blanked to zero/empty values in production. |
| `alwenListingDraft`, `alwenBusinessDraft` | 5→4. Static "here's what Alwen could draft" illustrative examples, carrying the fake `reputationProfile` identity as a "verified seller" | `renderAlwenListingCreator()` (public Marketplace), `renderAlwenBusinessCreator()` (public `businessCreate` + internal Ops) | Gated at the render-function level — both functions return `""` entirely when fixtures are disallowed, not just blank data. |
| `businessClaims` | 5→4, and a **privacy bug**: was rendering every pending claimant's name/role/verification method inside any signed-in user's own new-claim form | `renderClaimFlow()` (public `businessClaim` route) | The leaking render call was removed entirely (not just gated) — showing other users' claim submissions inside someone's own submission form is wrong regardless of real/fake data. The array itself stays as a gated, mutable fixture (`.unshift()` still works for real claims) with no current consumer. |
| `cityGraph` | 5→4 | `renderCityGraph()` (Ops only) | Gated. Blanked to zero values; only reachable by admins now (see Operational Routes). |
| `adminStats` | 5→4 | `renderOps()` (Ops only) | Gated. Empty in production; only reachable by admins now. |
| `importSources` | 5→4 | `renderCityImport()` (Ops/cityImport only) | Gated. Empty in production; only reachable by admins now. |
| `feedPosts` | 5→4 | Community feed, Home "Neighbourhood" rail | Gated. Empty in production. |
| `liveAroundYou`, `earnToday`, `exploreHighlights`, `alwenRecommendations` | 5→4 | Home rails | Gated. Empty in production; rails render nothing (existing `.join("")` pattern degrades safely). |
| `contributionActions`, `profileAchievements`, `reputationTimeline`, `cityGraphConnections`, `foodCategories`, `alwenActions`, `alwenCapabilities`, `alwenWorkflows`, `alwenWorkspace`, `alwenAutomationTasks`, `cityMemory`, `businessAiExamples`, `alwenServiceDraft`, `alwenProfileConversation`, `alwenCityCompanionPlan`, `smartAutocompleteExamples`, `contributionScores`, `proactiveBriefing`, `earningOpportunities`, `reputationSignals`, `cityKnowledgeObjects`, `backendTodoPlaceholders`, `events` (mockData's), `economyMetrics`, `trendingMarketplace` (mockData's) | Dead code (confirmed zero references anywhere in `src/`/`test/` outside `mockData.js` itself) | None | **Deleted entirely**, not gated — 25 fabricated exports removed from the codebase. |

### Reclassification note: `livingCitySignals`

Initially misclassified as fixture data and gated to `[]`, which broke Home (`currentLivingCitySignals()` reads `livingCitySignals[0..3]` as a label/detail-key skeleton, always overwriting `value` with real counts from `EVENTS`/`listings`, or the real Open-Meteo response). Reclassified as configuration (translation-key skeleton), not activity, and restored ungated. The one literal value (`"22°C"`) is a transient loading placeholder shown only before the first weather API response — a pre-existing, narrow honesty nit noted as a residual item, not touched in this pass.

## `src/main.js`-local fixtures (not in `mockData.js`)

| Source | Classification | Consumer(s) | Disposition |
| --- | --- | --- | --- |
| `LIVE_OPPORTUNITIES` (~30 lines, fake paid-task listings with invented "trust" scores and "Verified traveller"/"Verified family" requester labels, Unsplash photos) | 5→4 | `renderLiveOpportunities()`, `renderLiveOpportunityDetail()`, `renderOpportunityCard()`, deep-linkable `?view=liveOpportunityDetail&id=...` | Gated to `[]` in production. `openLiveOpportunityDetail()`/`renderLiveOpportunityDetail()` fixed to show an honest "not found" state instead of falling back to `LIVE_OPPORTUNITIES[0]` (which would have crashed on `undefined.id`). |
| `EVENTS` (~7 hand-typed event records with real Vilnius context but no real backing store) | 6. Unknown provenance requiring review | `renderEvents()`, Home "Events" hero tile count | **Not remediated in this pass** — flagged as a remaining item. Lower confirmed severity than the other findings (no fake trust/rating fields, no stock photos found in a first pass), but was not independently re-verified in depth. See Remaining Blockers. |

## Restricted operational routes

| Route | Before | After |
| --- | --- | --- |
| `ops` | Reachable by any visitor via `?view=ops` — no auth check at all. | Gated behind `isOpsAuthorized(user)`, which checks the same server-issued `app_metadata.role`/`traderPermissions` signal already used for the trader-review queue (not client-writable). Unauthorized visitors (signed out or signed in without the role) see an honest "Not available" state, never the real admin content. |
| `cityImport` | Same as `ops`. | Same fix, same `OPS_VIEWS` gate. |

This is real authorization (a signed-in user cannot forge their own `app_metadata.role`), not merely removing a navigation link — the pre-existing gap description ("no backend role system exists to gate against") was inaccurate; the app already has one, it just wasn't applied here.

## Secret handling

- `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` are read only via `Deno.env.get(...)` inside `supabase/functions/elevenlabs-tts/index.ts` — confirmed no literal key value anywhere in the tracked repository (`env.js`, `env.example.js`, `src/`, `docs/`).
- The audit's finding was that a real key was pasted directly into chat during an earlier session, not committed to the repo. That value must be treated as compromised and rotated (see `docs/deployment-runbook.md`'s existing `ELEVENLABS_API_KEY` rotation section) — this is a manual action outside what a code change can remediate.
