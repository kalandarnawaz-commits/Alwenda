# Production Data Migration — Readiness Assessment

**Branch:** `feature/remove-mock-data`
**Assessed commit:** `bd8e86a3834c63a90b9dff44c6dfba7b884318e2` (Phase 9 — Harden production migration tests)
**Diff base:** `origin/main` @ `3104b06` — 9 commits ahead, 0 behind
**Date:** 2026-07-28
**Assessor:** Automated 10-phase migration (Phases 0–10), this document

---

## 1. Summary

All primary user-facing product surfaces in scope for this migration (Marketplace browse, Community feed, Help Requests / Need Help, Hire, Search, Explore/Businesses) now read exclusively from production data sources (Supabase tables via the existing `supabaseClient.js` fetchers, or the Google/OSM business-import pipeline) and render an honest, polished empty state when a table has zero rows. No fabricated marketplace listings, community posts, help requests, businesses, professionals, or reviews can appear on any migrated surface.

Two surfaces were explicitly out of scope for this migration from the original plan (`Recommended next PR: real peer-to-peer messaging`) and remain on mock fixtures: **Notifications** and **Inbox/Messages**. Home's daily-digest greeting line and one static weather tile also retain small amounts of legacy placeholder content predating this branch. These are documented in full in §4.

## 2. Production data source matrix

| Surface | Data source | Real? | Empty-state behaviour |
|---|---|---|---|
| Marketplace browse | `fetchPublicListings()` + own `myListingsPool` merge | Yes | Honest "New here" / no fabricated cards; verified live with 1 real listing |
| Marketplace listing detail | `fetchListingById()` | Yes | UUID-routed, unchanged since a prior session |
| Community feed | `fetchCommunityPosts()` + `createCommunityPost()` write path | Yes | "Be the first to post"; verified live with 0 real posts |
| Need Help / Help Requests | `fetchOpenHelpRequests()` | Yes | Verified live with 5 real open requests |
| Hire | No fake `serviceProfessionals` fallback; honest empty state only | Yes (no professional-listing concept exists) | Verified live — chip search returns "No matches yet" |
| Explore / Businesses | `importedBusinesses` (OSM/Google import pipeline) | Yes | Verified live with real per-category counts |
| Search ("Tell Alwen") | Reads only the above real sources | Yes | No demo/suggested matches |
| Public profiles | `openPublicProfileById()` / real `public_profiles` row | Yes | Verified live — real seller profile, real reputation score |
| Notifications | `mockData.notifications` | **No — deferred** | Out of migration scope (see §4) |
| Inbox / Messages | `mockData.messageThreads` | **No — deferred** | Out of migration scope (see §4) |
| Home digest greeting counts | `liveAroundYou.length` / `earnToday.length` (mock arrays, count-only use) | **No — legacy** | Pre-existing, out of this branch's scope (see §4) |
| Home weather tile | `livingCitySignals[0]` static value | **No — legacy** | Pre-existing, out of this branch's scope (see §4) |
| Internal Ops dashboard | `adminStats` (fabricated) | **No — internal only** | Not public/deep-linkable (`INTERNAL_URL_VIEWS`) |
| Business claims | `businessClaims` (1 seed row + real claims merged) | Mixed | Pre-existing, out of this branch's scope (see §4) |

## 3. Honesty statement (precisely scoped)

**Correct statement:** Zero user-visible fake datasets remain **within the surfaces migrated by Phases 1–9** (Marketplace, Community, Help Requests, Hire, Search, the deleted Businesses/Reservations system).

**Incorrect statement (do not use):** "Zero user-visible fake datasets remain across the entire public application." This is false — Notifications, Inbox/Messages, the Home digest greeting's counts, and the Home weather tile are all real, live, user-visible mock/fixture content that this migration deliberately did not touch, per the original plan's explicit scope boundary.

## 4. Known limitations

| # | Limitation | Severity | Note |
|---|---|---|---|
| 1 | Notifications tab reads `mockData.notifications` | Must-fix-before-full-launch, acceptable-for-controlled-pilot | Explicitly deferred; real messaging is the recommended next PR |
| 2 | Inbox/Messages reads `mockData.messageThreads` | Must-fix-before-full-launch, acceptable-for-controlled-pilot | Same as above — schema already exists (`conversations`/`messages`), unused by client |
| 3 | Community post detail has no fetch-by-ID | Acceptable-for-controlled-pilot | A freshly-created post is visible immediately (merged client-side); a post loaded only via direct link to an ID not in the current session's feed cache renders empty. Architectural — explicitly out of scope for Phases 1-10 |
| 4 | Home digest greeting line's "X requests nearby" / "Y ways to earn today" counts read `liveAroundYou.length`/`earnToday.length` (mock arrays) | Post-pilot-improvement | Cosmetic text only; the actual Home rails below it are real category hubs. Predates this branch (category-architecture sprint) |
| 5 | Home's weather signal tile always shows a static "22°C" | Post-pilot-improvement | The 3 other signal tiles (events/jobs/apartments) are replaced with real computed counts at render time; weather is not. Predates this branch |
| 6 | `businessClaims` mixes 1 hardcoded seed row (`claim-001`) with real claims | Acceptable-for-controlled-pilot | No persisted claims table exists yet; predates this branch |
| 7 | Internal Ops dashboard (`adminStats`) shows fabricated numbers | Unrelated-future-feature | Not public or deep-linkable; internal-tooling-only |
| 8 | Service worker's `RELEASE_VERSION` label (`social-profile-1`) is stale | Post-pilot-improvement | Cosmetic only — the SW uses network-first caching for same-origin GETs, so this never causes a stale-content bug for online users |
| 9 | OAuth production callback configuration cannot be verified from the repository alone | Must-verify-before-launch | Requires checking the actual Supabase project dashboard, outside repo scope |
| 10 | External hero images are Unsplash-hosted (not self-hosted) | Post-pilot-improvement | Reliability depends on a third party; predates this branch |

None of the above are regressions introduced by Phases 1–9 of this migration; all are either explicitly-deferred scope (documented in the original plan) or pre-existing conditions confirmed unrelated to any of this branch's changes.

## 5. Validation results (this assessment, HEAD `bd8e86a`)

| Check | Result |
|---|---|
| `npm test` | 518/518 passing, 0 skipped, 0 failed |
| `npm run lint` | 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `node scripts/validate-migrations.mjs` | 15 migrations validated |
| `node scripts/validate-authorization-safety.mjs` | 17 authorization boundaries validated |
| `node scripts/enforce-lint-baseline.mjs` | 0 errors, 0/0 warnings |
| `node scripts/validate-workflows.mjs` | 2 workflow files validated |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `git diff --check` (vs `origin/main`) | clean |
| Test suite files | 48 |
| mockData.js exports | 17 (all accounted for — see repository-cleanup.test.js and production-honesty-guard.test.js allow-lists) |

## 6. Live browser verification performed

Desktop (1280×800) and mobile (375×812), against the dev preview mirror on this exact HEAD:

- Explore — real imported businesses, correct per-category counts, no console errors
- Need Help — 5 real open Help Requests render, no console errors
- Community (desktop + mobile) — honest "Be the first to post" empty state (0 real posts), real Help Requests cross-surface list still shows, no horizontal overflow, no console errors
- Notifications (mobile) — Phase 9's notif3 dangling-route fix confirmed live: the "Confirm" action's `data-view` is `"notifications"`, not the deleted `"reservations"`; no overflow, no console errors
- Marketplace hub — honest "New here" badges for categories with 0 listings; 1 real listing ("iPhone 15, in condition", €300) renders correctly with no fabricated seller/response-time/distance fields
- Marketplace listing detail — real seller, honest "Overall Reputation 0" (not fabricated), correct trader/private-seller disclosure copy
- Seller public profile — real name, correct "Selling on Marketplace" context hint, real active-listing card
- Browser Back/Forward — round-trip through listing detail → public profile → back → back restores marketplace correctly, no console errors
- Direct UUID deep link (hard reload) — `?view=listingDetail&id=...` restores the correct listing directly, no console errors
- Hire — no fake professional cards at any point; chip search correctly returns the honest "No matches yet" empty state

Additionally discovered (not a defect, a positive confirmation): the dev preview session is authenticated as a real production Supabase user, and the one real Marketplace listing observed belongs to that account — end-to-end real-auth-to-real-data wiring is confirmed beyond static code assertions.

No new defects were found during this session's QA. The one defect found during this migration (the `notifications[2]` dangling `primaryActionView: "reservations"` reference) was already fixed and covered by a regression test in Phase 9 (`bd8e86a`).

## 7. Pilot readiness score

| Category | Points available | Score | Notes |
|---|---|---|---|
| Production data integrity | 20 | 20 | All in-scope surfaces real-only, verified live |
| Security / auth | 15 | 14 | RLS-based, anon-key-only client, auth-gated writes; OAuth callback config unverifiable from repo (−1) |
| Reliability / resilience | 15 | 13 | Network-first SW, error-caught fetchers with no mock fallback; Community fetch-by-ID gap, stale SW version label (−2) |
| Test coverage | 15 | 15 | 518 tests, 48 files, 3× stable full-suite reruns, 5× stable targeted reruns, 0 flaky |
| Routing / navigation | 10 | 10 | Full deep-link/back-forward matrix verified, no dangling routes |
| Deployment readiness | 10 | 9 | Build clean, no secrets in dist; stale SW version label is cosmetic (−1) |
| Accessibility / responsive | 5 | 5 | Mobile QA clean, no overflow, no console errors |
| Observability | 5 | 4 | Sentry + typed analytics wired from a prior sprint; not re-verified in this session (−1, not re-confirmed rather than known-broken) |
| Privacy / compliance | 5 | 5 | No private contact fields ever queried/rendered; consistent with prior sessions' audits |
| **Total** | **100** | **95** | |

## 8. Release decision

**CONDITIONALLY MERGE-READY.**

The migration itself (Phases 1–9) is complete, tested, and live-verified with zero regressions and zero new defects. It is safe to merge as-is. The "conditional" qualifier reflects two items outside this branch's own scope that a Vilnius pilot launch should have an explicit answer for before going fully public, not code defects in this branch:

1. Confirm the Supabase OAuth production callback URL is correctly configured for the pilot domain (cannot be verified from the repository).
2. Decide whether the pilot launches with Notifications/Inbox still on mock data (acceptable for a small controlled pilot where messaging isn't yet load-bearing) or whether the real-messaging follow-up PR should land first.

Neither condition blocks merging this branch into `main`.

## 9. Recommended next PR

Real peer-to-peer messaging: `conversations` / `conversation_participants` / `messages` schema already exists (RLS'd, unused by any client code). Rewiring the ~8 existing `start-*-conversation` call sites plus the Notifications/Inbox UI onto it is a self-contained follow-up.
