# Release Readiness

## Scorecard

Baseline (after the 2026-07-23 audit pass): **59/100**. Updated below after the same-day `feature/data/production-data-integrity` remediation.

| Category | Baseline | After Data-Integrity Pass | Notes |
| -- | --: | --: | -- |
| Product clarity | 70 | 75 | The audit's explicit "live/demo boundaries blur" concern is resolved — production shows only real data or honest empty states. |
| Visual consistency | 63 | 63 | Unchanged — out of scope for this pass. |
| Core journey completion | 59 | 64 | Marketplace/Businesses/Reservations no longer present misleading fabricated flows; auth/messaging/claim end-to-end proof still outstanding. |
| Mobile usability | 56 | 56 | Unchanged — out of scope for this pass. |
| Accessibility | 48 | 48 | Unchanged — out of scope for this pass. |
| Data integrity | 42 | **85** | Core fix: every fabricated export gated and proven empty in production by execution (`scripts/validate-production-data-safety.mjs`), not just by review. 25 dead fabricated exports deleted. Residual: fixture *bytes* remain fetchable at a direct URL (architectural limitation of a zero-bundler static site, documented in `docs/qa/production-data-policy.md`); `EVENTS` not independently re-verified. |
| Authentication | 64 | 64 | Unchanged — manual OAuth/session checklist still required. |
| Authorization | 58 | **78** | `ops`/`cityImport` closed with real server-issued-role authorization (not link-hiding). RLS tests already existed. |
| Backend reliability | 62 | 62 | Unchanged — out of scope for this pass. |
| Performance | 56 | 56 | Unchanged — out of scope for this pass. |
| Security | 58 | 64 | Confirmed no ElevenLabs key committed anywhere in the tracked repo; rotation requirement clearly documented (rotation itself is a manual action outside a code change). |
| Observability | 60 | 60 | Unchanged — out of scope for this pass. |
| Deployment readiness | 58 | 62 | Fixed a real, live misconfiguration: production's `env.js` never set `APP_ENV`, so `alwenda.com` was silently running in "development" mode (confirmed via the deployed `env.js`'s content). Now explicit, with a fail-safe default. |
| Production credibility | 49 | **80** | The core ask of this task — mock-looking activity is now provably absent from production, including a second undocumented fabricated business directory and a fabricated paid-task feed found during this pass. |

**Overall pilot readiness: 65/100** (flat average across all 14 categories). This is a meaningful jump from 59, concentrated exactly where this task targeted: Data integrity (+43), Authorization (+20), Production credibility (+31). The remaining gap to a strong launch-ready score is now almost entirely in categories this task did not touch — Accessibility, Mobile usability, Performance, and manual Authentication/microphone verification — matching the task's own closing note that the next jump comes from real-device OAuth, microphone, responsive, and production smoke testing, not further data-integrity work.

## Remaining Release Blockers

- ~~Gate or remove internal operations/import routes from public production.~~ **Done.**
- Rotate the ElevenLabs API key pasted into a chat session (not committed, but must be treated as compromised) — manual action, cannot be completed by a code change.
- ~~Complete production-mode data strategy: real data or honest empty states, not fake activity.~~ **Done** for every screen inventoried; `EVENTS` (`src/main.js`) not independently re-verified in this pass.
- Decide on a real backing store for Hire (`serviceProfessionals`) and the "Businesses" directory, or intentionally retire those screens — both are now honestly empty in production with no real data source yet.
- Run real Google OAuth and mobile microphone checklist.
- Confirm deployed static assets and service worker update correctly after cache fix.
- Accessibility, mobile usability, and performance passes remain the largest untouched categories.

## Validation Results

### 2026-07-23 audit pass

| Check | Result | Notes |
| -- | -- | -- |
| `npm test` | Pass | 203 tests passed, including the new release cache-version regression test. |
| `npm run typecheck` | Pass | TypeScript completed without errors. |
| `npm run lint` | Pass | ESLint completed without errors. |
| `npm run build` | Pass | Static `dist` build completed. |
| `node scripts/validate-migrations.mjs` | Pass | 12 migrations validated. |
| `node scripts/validate-authorization-safety.mjs` | Pass | 9 authorization boundaries validated. |
| `node scripts/secret-scan-smoke.mjs` | Pass | Temporary fake fixture was detected successfully. |
| `node scripts/validate-workflows.mjs` | Pass | 2 workflow files validated. |
| `git diff --check` | Pass | No whitespace errors. |
| `npm audit --audit-level=high` | Blocked | Sandbox DNS could not resolve `registry.npmjs.org`. Run in a networked environment. |
| `node scripts/run-local-supabase-validation.mjs` | Blocked | Re-run with Docker Desktop running; retry with writable temp home confirmed the blocker is Docker daemon unavailable. |
| Browser E2E | Blocked | Playwright browser executable is not installed in this sandbox and cannot be downloaded here. Use the manual checklist or install Playwright browsers locally. |

### 2026-07-23 production-data-integrity pass (`feature/data/production-data-integrity`)

| Check | Result | Notes |
| -- | -- | -- |
| `npm test` | Pass | 230/230 (27 new tests added across `test/production-data-safety*.test.js`, `test/production-foundation.test.js`, `test/live-opportunity-navigation.test.js`, `test/need-help-conversational.test.js`). |
| `npm run typecheck` | Pass | |
| `npm run lint` | Pass | |
| `node scripts/enforce-lint-baseline.mjs` | Pass | 0 errors, 0/0 warnings. |
| `npm run build` | Pass | |
| `node scripts/validate-migrations.mjs` | Pass | 12 migrations validated (no migration changes in this branch). |
| `node scripts/validate-authorization-safety.mjs` | Pass | 9 authorization boundaries validated. |
| `node scripts/secret-scan-smoke.mjs` | Pass | |
| `node scripts/validate-workflows.mjs` | Pass | 2 workflow files validated. |
| `node scripts/validate-production-data-safety.mjs` (new) | Pass | Structural gating check + executed dist/ import under production defaults: all 18 fixture arrays empty, `reputationProfile`/`alwenListingDraft`/`alwenBusinessDraft` blank, `importedBusinesses` (332 real places) intact, ops/cityImport confirmed authorization-gated. |
| `git diff --check` | Pass | |
| Live browser verification | Pass | Marketplace/Businesses/Reservations empty states confirmed with exact required copy; `?view=ops`/`?view=cityImport` confirmed blocked for an unauthorized visitor; real imported businesses confirmed still visible in Explore/Home discovery rails; Home hero fixed after a real regression was found and corrected mid-pass (see completion report). |

## Pilot-Safe Limitations

- Treat bookings, payments, verification, and business claims as request/submission flows, not guaranteed completed services.
- Use manual support review for any business claim or provider verification.
- Hire and the "Businesses" directory are now honestly empty in production — no real backing store exists yet for either.

## Next Highest-Priority Isolated Task

Real-device manual verification: Google OAuth, microphone/voice input, and responsive layout on iPhone Safari, iPhone Chrome, desktop Safari, and desktop Chrome — the production-data-integrity and authorization work that was blocking this is now closed.
