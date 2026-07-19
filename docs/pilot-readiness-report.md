# Alwenda Pilot Readiness Report

Date: 2026-07-19
Scope: refresh of the 2026-07-16 audit against the current `main` (post `v0.1.0-pilot`), after the card/overflow UI unification, CI-infrastructure, and legal-compliance/trader-verification branches all merged.

## Pilot-readiness score

**Score: 78 / 100**

Since the last audit, `main` gained a working, required CI pipeline; auditable business lifecycle and trader verification with RLS coverage that has actually been exercised end-to-end; and a legal/compliance baseline (cookie consent, policy pages, moderation reports, privacy requests). The remaining gap is almost entirely operational: there is still no production monitoring, no typed analytics pipeline, no validated backup/recovery procedure, no deployment runbook, and business/search data is still seed-scale rather than real Vilnius coverage. AI (Alwen) is functionally wired but not yet hardened for production load or cost.

## Closed since 2026-07-16

### CI validation on `main`

`.github/workflows/pull-request-validation.yml` runs two jobs — `App validation` (tests, typecheck, lint, lint-baseline, build, `npm audit`, secret scan, migration/authorization/workflow validation, gitleaks) and `Local Supabase migration rebuild` (two clean `supabase db reset` cycles diffed for determinism, then `supabase/tests/rls_authorization.sql` executed against the rebuilt database). Both were verified green against real `main` content as part of merging `agent/trader-verification-compliance`; getting them there for the first time surfaced and fixed 9 real bugs (CI environment issues and genuine RLS/migration gaps) — see `docs/ci-pilot-validation.md` for the pipeline and the CI-infra branch's commit history for the fixes.

### Production CI/CD controls

The former "no branch protection" gap is closed: `main` has a repository ruleset (`required_status_checks`, `non_fast_forward`, `required_linear_history`, branch-deletion protection) that makes the two CI jobs above mandatory before any merge — confirmed via `gh api repos/.../rules/branches/main`. `.github/workflows/deploy-supabase-functions.yml` remains a manual (`workflow_dispatch`) protected-environment deploy for the Alwen edge function.

### Business lifecycle auditing

`supabase/migrations/202607180001_business_lifecycle_audit.sql` is merged: explicit `businesses.lifecycle_state` (`imported | unclaimed | claim_pending | owner_claimed | verification_pending | verified | verification_rejected | temporarily_closed | permanently_closed | suspended`), `business_lifecycle_events` audit trail, `business_ambassador_visits` and `business_claim_links` for the ground-team claim workflow, and the `guard_business_protected_fields()` trigger blocking non-admin mutation of ownership/claim/verification/lifecycle fields (previously flagged as a critical gap — an RLS probe added this pass specifically exercises that a non-owner cannot self-verify a business). Claim evidence storage is also closed: `supabase/migrations/202607180002_business_claim_evidence_storage.sql` created the private `business-claim-evidence` bucket, scoped to the claimant or an admin, previously flagged as missing.

### Trader verification controls

`supabase/migrations/202607180004_trader_verification.sql` is merged: `user_offeror_status` (private/trader classification, confirmed against a terms version), `trader_verifications` with a full review workflow (`draft → submitted → under_review → verified/rejected/more_information_required/suspended`), private per-document storage (`trader_verification_documents`, scoped to claimant/reviewer only, never a public URL), `trader_register_checks`, and a public `trader_public_profiles` view that only exposes verified status. `enforce_listing_offeror_status()` blocks any listing insert/update until the owner has confirmed private/trader status, and blocks publishing as a trader without a current verification — both enforced server-side, not just in the UI.

### Legal/compliance baseline

Cookie consent (necessary/optional split, "Manage choices" panel), standalone legal pages (`/terms`, `/privacy`, `/cookies`, `/safety`) served from a single canonical `src/legal/ALWENDA_LEGAL_POLICIES_EN.md`, `legal_acceptances` recording (policy version + marketing consent) on registration and OAuth, `legal_reports` (the "Report illegal content" flow, usable without authentication), and `privacy_requests` (deletion/export/appeal request capture) from `supabase/migrations/202607180003_legal_compliance.sql`. Note: `privacy_requests` records the *request*; there is still no automated fulfillment workflow behind it (see "Still open").

### RLS authorization coverage

`supabase/tests/rls_authorization.sql` now actually runs in CI and passes — this is a meaningfully stronger claim than the 2026-07-16 report's "early RLS migrations," which had never been executed against a real database. Getting it to pass for the first time found and fixed one real product gap (the `authenticated` role had no table-level grants at all on a from-scratch local rebuild — hosted Supabase sets this up automatically outside migration history, so it was never caught; now explicit via `202607180005_default_privileges.sql`) and one real test-authoring bug (an assertion expecting Postgres to raise where RLS was already correctly, silently filtering the row).

## Still open

### Production monitoring and alerting

`src/services/observability.js` still only supports a pluggable `sink` function and defaults to `console` — no Sentry/Logtail/equivalent is wired up. Failures in the field will not reach operators. *(2026-07-16 report item #12, unchanged.)*

### Analytics and product telemetry

`trackEvent` in `src/main.js` remains local-only (local storage / in-session), with no typed event schema and no ingestion destination. Pilot learning (conversion, retention, field activity) still cannot be trusted. *(2026-07-16 report item #7, unchanged.)*

### Backup and recovery validation

Every migration now documents a rollback *approach* in a comment (enforced by `scripts/validate-migrations.mjs`, no exceptions as of this cleanup), but no actual backup, restore, or rollback drill has been performed against a real or staging Supabase project. The documentation exists; the procedure is unvalidated.

### Deployment/runbook maturity

`docs/ci-pilot-validation.md` documents the CI pipeline itself, but there is no operator-facing deployment runbook: how to deploy the static frontend to production hosting, roll back a bad deploy, rotate secrets (`SUPABASE_ACCESS_TOKEN`, `OPENAI_API_KEY`), or handle an incident. `npm run build` → `dist/` is the only documented deploy step, with no destination.

### Real business onboarding scale

The ground-team ambassador workflow (find/dedupe business → confirm/correct fields → record visit → generate claim link → capture consent → submit evidence → admin review) is fully modeled in the database and covered by an RLS probe, but no real Vilnius business data has been imported through it yet — the app still runs on seed/imported OpenStreetMap+Wikidata data plus mock listings, not a real-scale claimed-business dataset.

### Search/data quality

Explore and Marketplace search/filtering work against whatever data currently exists (seed + imported places), but there has been no relevance tuning, deduplication-at-scale, or data-quality pass suited to a real multi-thousand-business dataset.

### AI production hardening

The Alwen edge function (`supabase/functions/alwen-chat/index.ts`) is real — authenticated, calls the OpenAI Responses API server-side, and now requires/records offeror status when creating listings — but it has no production hardening beyond that: no per-user rate limiting beyond Supabase's own defaults, no cost/usage monitoring, no evaluation harness, and no defense-in-depth against prompt injection beyond normal tool-call validation.

## Business Lifecycle State Coverage

Implemented explicit states in `businesses.lifecycle_state` (unchanged from the original implementation):

- `imported`
- `unclaimed`
- `claim_pending`
- `owner_claimed`
- `verification_pending`
- `verified`
- `verification_rejected`
- `temporarily_closed`
- `permanently_closed`
- `suspended`

These are deliberately not modeled as booleans.

## Ground-Team Workflow

The backend model supports this ambassador flow (unchanged from the original implementation, now RLS-tested):

1. Find or create business in `businesses`.
2. Detect duplicates and record `duplicate_business_ids`.
3. Confirm public information in `confirmed_fields`.
4. Correct public information in `corrected_fields`.
5. Record visit in `business_ambassador_visits`.
6. Invite owner with `business_claim_links`.
7. Generate claim link/QR using a server-generated token and store only `claim_token_hash`.
8. Capture consent with `consent_captured` and `consent_method`.
9. Submit evidence in `evidence`.
10. Send for admin review with `visit_status = submitted_for_review`.
11. Record outcome using review fields and lifecycle events.

## Work Implemented Since 2026-07-16

- Merged `feature/ci/pilot-validation` (#4): made the CI workflows and validation scripts run correctly standalone against bare `main` (checkout depth, pinned `supabase-cli`, PGDG apt repo for a matching `pg_dump`, graceful degradation for not-yet-existing compliance content, and a calibrated lint-warning baseline).
- Merged `claude/global-card-and-overflow-ui` (#3): unified card design system and fixed mobile/Safari overflow across Explore, Marketplace, Alwen, and Live Opportunities.
- Merged `agent/trader-verification-compliance` (#2): legal compliance UI, trader verification, database schema/RLS/edge-function support, legal pages, and test coverage — 11 commits, including 3 real bug fixes (default privileges, RLS test fixture, one assertion type) found while getting the RLS probes to pass for the first time.
- Tagged `v0.1.0-pilot` at the merged state.
- This stabilization pass: tightened `WARNING_BASELINE` from 26 to 0, removed the temporary rollback-documentation grandfather clause (all 8 migrations already document rollback approaches), and refreshed this report.

## Validation Results

Run locally and in CI after this pass:

- `npm test`
- `npm run lint`
- `node scripts/enforce-lint-baseline.mjs`
- `npm run typecheck`
- `npm run build`
- `node scripts/validate-migrations.mjs`

## Recommended Next Steps

In priority order, per the current stabilization → pilot-readiness → business-onboarding → AI roadmap:

1. **Pilot readiness**: wire `src/services/observability.js` to a real sink (Sentry/Logtail), add a typed analytics event schema with an ingestion destination, run and document a backup/restore drill against a staging Supabase project, and write an operator-facing deployment runbook.
2. **Business onboarding**: run the ambassador workflow against real Vilnius businesses at meaningful scale; assess search/data quality once real volume exists.
3. **AI**: add production hardening (rate limiting, cost monitoring, an evaluation harness) to the Alwen edge function before expanding its capabilities or connecting more real data sources.
