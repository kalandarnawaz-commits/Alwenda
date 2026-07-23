# Alwenda Full Product Audit

Date: 2026-07-23  
Scope: pre-launch QA, product, frontend, accessibility, security, backend, data, CI and release-readiness review for a controlled Vilnius pilot.

## Executive Summary

Alwenda has a strong consumer concept and a broad pilot surface, but it is not yet ready for a public launch without guardrails. The strongest foundations are the Supabase-backed auth/profile work, RLS-oriented migrations, protected Edge Function secrets, and a growing test suite. The largest remaining risks are product integrity and release reliability: seeded/demo marketplace and notification content can look real, internal operations routes are directly reachable by URL, some journeys still rely on manual/device behavior, and the browser cache/service worker release path has already shown stale-asset symptoms.

This pass made one safe stabilization fix: all top-level asset version tags now use a single cache-busting release id, and the clear-cache page no longer redirects to an old feature-specific build marker.

## Audit Limits

- Could not create `audit/full-product-qa` or fetch latest remote in this sandbox because `.git/FETCH_HEAD` writes were denied earlier by the managed filesystem.
- Could not start a new local server because port `5173` was already owned by an existing Python server and sandbox port binding failed.
- Automated browser replay is blocked in this environment because the Playwright browser executable is not installed and network installation is unavailable.
- Google OAuth, microphone permission, real Supabase sessions, and mobile Safari/Chrome device behavior require the manual checklist in [manual-e2e-checklist.md](/Users/apple/Documents/Codex/2026-07-05/build-a-production-ready-mvp-for/docs/qa/manual-e2e-checklist.md).

## System Map

- Active local branch: `fix/alwen-live-translate-language-hint`.
- Existing untracked local work preserved: `locales/en 2.json`, `src/services/translateSpeechClient.js`, `supabase/functions/translate-speak/`.
- Frontend: static app served by `python3 -m http.server 5173`; build copies static files to `dist`.
- Production domain in project context: `https://alwenda.com`.
- Supabase project ref observed from local config/env: `syfahecoodziijlsasum`.
- Tracked Edge Functions: `alwen-chat`, `elevenlabs-tts`, `translate-transcribe`.
- Untracked Edge Function present locally: `translate-speak`.
- CI: PR validation workflow runs deterministic install, tests, typecheck, lint baseline, build, audit, secret scan, migration validation, RLS/authz safety checks. Separate manual Supabase function deployment workflow exists.
- Service worker: static shell cache with release version in `sw.js`.

## Findings

| ID | Severity | Area | Route/Feature | Finding | Evidence | Recommended Fix | Status |
| -- | -------- | ---- | ------------- | ------- | -------- | --------------- | ------ |
| QA-001 | P1 | Release/cache | App shell | Asset query versions were inconsistent across `index.html`, auth callback, service worker and clear-cache redirect. Users can receive stale JS/CSS after release. | Source diff showed `elevenlabs-tts-1`, `production-sprint-2`, `alwen-2-0-3`, and `live-opportunity-detail-2-cleared` mixed together. | Use one release id for all static entry assets and SW release; clear cache to generic latest build URL. | Fixed in source |
| QA-002 | P1 | Access control | `?view=ops`, `?view=cityImport` | Internal operations/import routes are renderable by direct URL and are not in `protectedViews`. | `renderView()` maps `ops` and `cityImport`; protected set omits both. | Disable in production or require server-backed admin role before rendering or mutating any operational data. | **Fixed** — gated behind `isOpsAuthorized(user)` (server-issued `app_metadata.role`), unauthorized visitors see an honest "Not available" state. See `docs/qa/production-data-policy.md`. |
| QA-003 | P1 | Data integrity | Marketplace, community, notifications, profile | Large seeded/mock dataset can appear like live user/business activity. This can mislead pilot users. | `src/data/mockData.js` and `locales/en.json` include mock listings, reviews, notifications, achievements, counters, fake profile photos. | Gate demo data behind explicit demo mode, label it, or replace with real/imported/user-generated records and honest empty states. | **Fixed** — every fabricated export gated behind `isFixturesAllowed()` (empty in production, real fixtures only in explicit dev/test); 25 dead fabricated exports deleted; honest empty states added. See `docs/qa/production-data-inventory.md`. |
| QA-004 | P1 | Navigation | Mobile primary nav | Current nav does not consistently expose all intended primary actions. Create/Profile may be hard to reach from the bottom nav depending on state. | `renderShell()` includes Home, Explore, TYT/Alwen, Marketplace, Community; Create/Profile are secondary/header routes. | Confirm final nav model. If Create is primary, add it consistently; keep Profile reachable and do not hide core creation actions. | Open |
| QA-005 | P1 | Auth journey | OAuth/manual auth | Google OAuth and session persistence require manual verification on production and localhost. | Auth code uses Supabase; previous user screenshots showed provider/domain configuration issues. | Run manual checklist for Google, refresh, returning session, sign-out, and protected route return-to-task. | Manual required |
| QA-006 | P1 | Business trust | Claim/verification | Business claims and identity verification have scaffolding but are not production verification. | `src/services/identity/personaVerification.js` is a provider-ready placeholder; claim flow uses forms/status but needs real review operations. | Position as “verification pending”; do not display verified owner/provider unless backend approval exists. | Open |
| QA-007 | P2 | Mobile UI | Home/Marketplace/Translate | Floating Alwen, TYT and bottom nav can consume or overlap key content on mobile. | User mobile screenshots and prior browser sweep show large fixed controls covering lower content and translation panels. | Reserve safe-area bottom padding per view; move floating controls above content or collapse to one launcher. | Partially fixed, retest needed |
| QA-008 | P2 | Visual identity | Mobile header | Wordmark can be oversized or clipped in mobile hero/header contexts. | User screenshots show large white wordmark tight to the left/top of the hero card. | Enforce max-width/height for wordmark, safe padding, and contrast-aware header treatment. | Open |
| QA-009 | P2 | Translation | Voice recognition/playback | Lithuanian voice input required a fallback, but mobile browser behavior remains fragile and must be tested on device. | Recent user reports: permission allowed but recognition failed; fallback function added; latest status not fully verified. | Keep browser speech path plus secure transcription fallback; add visible processing state and retry guidance. | In progress/manual |
| QA-010 | P2 | Messages/notifications | Inbox connectivity | Notifications and messages contain polished mock-like activity but do not clearly reflect real user transactions. | User asked that accepting/messaging tasks should create messages; current route is `renderNotificationsHub`. | Persist message threads from task/listing actions and show honest empty state when no activity exists. | Partially fixed — mock notifications/messages no longer render in production (gated), honest empty states confirmed reachable. Persisting real message threads from task/listing actions was already partially built (`.unshift()` pattern) prior to this pass; full coverage not re-verified here. |
| QA-011 | P2 | Localization | Legal/auth/admin copy | Some strings are hard-coded in English and legal text says Lithuanian lawyer-reviewed copy is required. | `renderRegister()`, trader review forms, policy pages contain hard-coded English copy. | Move strings to locale files and complete LT/DE translations before Lithuanian pilot. | Open |
| QA-012 | P2 | Deep links | Route restoration | Direct route testing on the active local server previously normalized back to Home, likely due stale served assets. | Running server served old asset tags despite modified source; direct URL audit was not trustworthy. | Retest after serving current source with unified cache version and SW cleared. | Needs retest |
| QA-013 | P2 | Accessibility | Modals/sheets/floating controls | Modal focus trapping, Escape handling, and screen-reader announcements are not fully verified. | Many sheets render via `innerHTML` and custom buttons; browser a11y audit could not complete. | Add focus trap and restore focus for sheets; verify button names and touch targets. | Open |
| QA-014 | P2 | Backend reliability | Edge Functions | Core functions require auth and hide keys, but CORS is wildcard and rate/cost controls vary by function. | `alwen-chat` has rate/cost cap; speech/transcription are auth-gated but no per-user cost cap. | Add per-user quotas/logging for TTS/transcription; consider stricter allowed origins for production. | Open |
| QA-015 | P3 | Copy | Product vocabulary | Some old or technical terms still exist in locales/tests such as “mock”, “placeholder”, “Unclaimed”. | `locales/en.json` contains production-facing labels including `publishMock`, placeholders, and unclaimed sort labels. | Rename user-facing copy or hide technical labels from public cards. | Open |

## Fixes Completed In This Pass

- Normalized static asset versioning in `index.html`.
- Normalized auth callback asset versioning in `auth/callback/index.html`.
- Updated `sw.js` release version to the same audit release id.
- Updated `clear-cache.html` to clear to a generic fresh build URL instead of an old feature-specific marker.
- Added QA documentation and a cache-version regression test.

## Fixes Completed In The Production-Data-Integrity Pass (2026-07-23, `feature/data/production-data-integrity`)

- Fixed the actual live cause of QA-003: production's committed `env.js` never set `APP_ENV`, so `alwenda.com` was silently running with `APP_ENV="development"` the whole time. `env.js` now sets `APP_ENV: "production"` explicitly, and `src/config.js` fails safe to `"production"` for any missing/unrecognised value.
- Gated every fabricated/seeded export in `src/data/mockData.js` behind `isFixturesAllowed()`; moved fixture literals to `src/data/devFixtures.js`; deleted 25 confirmed-dead fabricated exports.
- Found and fixed a second, previously-undocumented issue: an entire fully-fabricated "Local Places" business directory (`businesses` in `mockData.js`), separate from the real `importedBusinesses`, complete with an unconditional (bug) "verified" badge — now gated, badge fixed to be conditional, honest empty state added.
- Found and gated a fabricated paid-task feed declared directly in `src/main.js` (`LIVE_OPPORTUNITIES`), not `mockData.js` — fixed two crash risks (`|| LIVE_OPPORTUNITIES[0]` fallbacks that would throw once the array is empty).
- Found and fixed a privacy bug in the business-claim flow: any signed-in user's own new-claim form was rendering every *other* pending claimant's name/role/verification method — removed entirely, not just gated.
- Closed QA-002: `ops`/`cityImport` gated behind `isOpsAuthorized(user)` (the same server-issued `app_metadata.role` signal already used for trader review) — real authorization, not link-hiding.
- Confirmed no ElevenLabs key exists in the tracked repository; documented the pasted-into-chat exposure and rotation requirement.
- Added `scripts/validate-production-data-safety.mjs` and `test/production-data-safety*.test.js`.
- Full detail: `docs/qa/production-data-inventory.md`, `docs/qa/production-data-policy.md`.

## Recommended Priority

1. ~~Close P1 internal route access and demo-data integrity before inviting real users.~~ **Done** — see above.
2. Run the manual OAuth/microphone checklist on real iPhone Safari, iPhone Chrome, desktop Safari and desktop Chrome.
3. Retest all direct links after deploying the unified cache version.
4. Rotate the ElevenLabs API key that was pasted into a chat session (not committed, but must be treated as compromised).
5. Decide on real backing stores for Hire (`serviceProfessionals`) and the "Businesses" directory, or intentionally retire those screens — both are now honestly empty in production with no real data source yet.
6. Independently review `EVENTS` (`src/main.js`) — a hand-typed event dataset with real Vilnius context but no confirmed real backing store; not remediated in this pass, lower confirmed severity than the other findings but not independently re-verified in depth.
4. Convert message/notification flows from static activity to persisted user-owned records.
