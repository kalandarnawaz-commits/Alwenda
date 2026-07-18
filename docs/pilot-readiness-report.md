# Alwenda Pilot Readiness Report

Date: 2026-07-16  
Scope: repository audit plus one isolated backend workstream for controlled public pilot readiness in Vilnius.

## Pilot-readiness score

**Score: 66 / 100**

Alwenda has a strong static frontend, real Supabase auth wiring, early RLS migrations, a secure Alwen Edge Function path, and broad unit tests. It is not yet ready to onboard real users, real businesses, and field ambassadors without controlled constraints because several core operational surfaces remain incomplete: business lifecycle auditing, manual moderation workflow, account deletion/export, production CI/CD, e2e coverage, and admin verification tooling.

## Architecture Summary

- Frontend: static zero-build app served from `index.html`, with routing/rendering in `src/main.js`, styles in `src/styles.css`, locale JSON in `locales/`, and browser runtime config in `env.js` via `src/config.js`.
- Auth: Supabase Auth client in `src/services/auth/supabaseClient.js`; profiles bootstrap via `src/services/auth/profileBootstrap.js`.
- Database: SQL migrations in `supabase/migrations/`, covering profiles, listings, businesses, claims, messages, Alwen conversations, help requests, and listing-photo storage.
- Edge Functions: `supabase/functions/alwen-chat/index.ts` verifies a Supabase JWT and calls the OpenAI Responses API server-side.
- Tests: Node test runner covers config, i18n key parity, validators, data import helpers, auth/no-fake-user paths, Alwen function source contracts, migration expectations, and pilot lifecycle contracts.
- Deployment: static `npm run build` copies files into `dist/`; no CI workflow is present in the repository.

## Critical before external pilot

### 1. Business lifecycle and claim verification were under-modeled

- Evidence: `supabase/migrations/202607150001_production_foundation.sql` originally modeled `businesses.claim_status` as `unclaimed | pending | claimed | rejected` and `businesses.verification_status` as `unverified | pending | verified | rejected`, but did not represent temporary closure, permanent closure, suspension, imported state, or auditable transitions.
- Affected files: `supabase/migrations/202607150001_production_foundation.sql`, `src/data/mockData.js`.
- Impact: businesses can move from imported data to public pilot states without a complete audit trail; owner trust and moderation disputes become hard to resolve.
- Severity: Critical.
- Recommended fix: implemented in `supabase/migrations/202607180001_business_lifecycle_audit.sql`.
- Complexity: Medium.
- Dependencies: Supabase migration review, admin role assignment, future admin UI.

### 2. Business owner update surface could allow protected-state mutation if not guarded

- Evidence: base migration policy `"Owners manage their businesses"` permits owners to update rows where `auth.uid() = owner_user_id`; RLS alone cannot restrict individual protected columns such as `verification_status`, `claim_status`, `owner_user_id`, or lifecycle state.
- Affected files: `supabase/migrations/202607150001_production_foundation.sql`.
- Impact: a claimed owner could self-verify or alter ownership/claim state if a client path exposed those fields.
- Severity: Critical.
- Recommended fix: implemented database trigger `guard_business_protected_fields()` in `202607180001_business_lifecycle_audit.sql`.
- Complexity: Medium.
- Dependencies: trusted admin role policy using `public.is_trusted_admin()`.

### 3. No complete account deletion or data export workflow

- Evidence: `src/main.js` has settings UI affordances for delete-account confirmation, but no backend deletion/export process or storage cleanup workflow was found.
- Affected files: `src/main.js`, Supabase migrations, future Edge Functions.
- Impact: privacy/compliance risk for real users; support team lacks a safe operating procedure.
- Severity: Critical.
- Recommended fix: create account export/delete Edge Functions using authenticated user ID, audit events, storage cleanup, and delayed hard-delete policy.
- Complexity: High.
- Dependencies: legal retention policy, storage buckets, admin moderation rules.

### 4. No production CI/CD workflow in repo

- Evidence: no `.github/workflows` files were present; validation currently relies on local manual commands.
- Affected files: repository root.
- Impact: regressions can reach production without tests, typecheck, build, or secret scanning.
- Severity: Critical.
- Recommended fix: implemented pull-request validation and protected manual Edge Function deployment workflows. Remaining work is to enable GitHub branch protection and required checks.
- Complexity: Low.
- Dependencies: GitHub Actions or deployment provider.

### 5. Supabase Edge Function deployment depends on operator auth

- Evidence: Supabase CLI deploy previously failed without `SUPABASE_ACCESS_TOKEN`; `supabase/.temp/linked-project.json` exists but local CLI auth is not guaranteed.
- Affected files: `supabase/functions/alwen-chat/index.ts`, deployment environment.
- Impact: launch builds can ship frontend chat UI before the backend function is deployed.
- Severity: High.
- Recommended fix: CI deploy step with `SUPABASE_ACCESS_TOKEN`, plus smoke test for signed-in and signed-out chat.
- Complexity: Medium.
- Dependencies: Supabase access token, project ref, secrets.

## Important Within First 30 Days

### 6. Admin/moderation tooling is incomplete

- Evidence: migrations include reports, audit events, claim review policies, and business lifecycle events, but there is no production admin interface or moderation queue.
- Impact: pilot operators cannot reliably review claims, reports, evidence, or ambassador visits.
- Severity: High.
- Recommended fix: admin-only operations view backed by RLS/admin role, or a temporary Supabase Studio operating guide.
- Complexity: Medium.
- Dependencies: role assignment, staff process.

### 7. Analytics schema is not typed end-to-end

- Evidence: `trackEvent` exists in `src/main.js` using local UI state/local storage patterns, but no typed event schema or ingestion destination is present.
- Impact: pilot learning is incomplete; conversion/retention/field activity cannot be trusted.
- Severity: High.
- Recommended fix: add `src/services/analytics/events.js` with allowed event names and redaction, then route to Supabase `audit_events` or a dedicated analytics table.
- Complexity: Medium.
- Dependencies: analytics vendor/data warehouse decision.

### 8. Real data and mock/demo data coexist

- Evidence: README still describes `src/data/mockData.js` as launch-city config and mock content; app imports large mock datasets directly.
- Impact: users can confuse mock listings/profiles with real marketplace/business activity.
- Severity: High.
- Recommended fix: mark pilot seed data clearly, separate demo mode from production mode, and API-load real entities by route.
- Complexity: Medium.
- Dependencies: content policy and pilot data import plan.

### 9. Business claim evidence storage needed private access controls

- Evidence: `202607170001_listing_photos_storage.sql` creates `listing-photos`; before this pass no comparable business-claim evidence bucket policy was present.
- Impact: claim documents/photos may be stored ad hoc or not at all.
- Severity: High.
- Recommended fix: implemented in `supabase/migrations/202607180002_business_claim_evidence_storage.sql`; remaining work is to wire upload UI/admin review to this bucket.
- Complexity: Medium.
- Dependencies: file retention and evidence review policy.

### 10. E2E coverage is absent

- Evidence: package scripts include unit/lint/typecheck/build only; no Playwright/Cypress config was found.
- Impact: auth callback, mobile layout, language switching, and claim flows are not validated in a real browser.
- Severity: Medium.
- Recommended fix: add Playwright smoke tests for Home, auth, Alwen chat signed-out, language switch, marketplace, business profile, and profile.
- Complexity: Medium.
- Dependencies: test accounts and seeded Supabase project.

## Post-Pilot Improvements

### 11. Performance needs route-level splitting

- Evidence: `src/main.js` holds most rendering/routing logic; mock data imports are client-side.
- Impact: startup cost will grow as city data expands.
- Severity: Medium.
- Recommended fix: route-split rendering modules and lazy-load city data/API clients.
- Complexity: High.
- Dependencies: UI stabilization.

### 12. Observability foundation needs production sink

- Evidence: `src/services/observability.js` creates safe events but currently defaults to console.
- Impact: failures in the field may not reach operators.
- Severity: Medium.
- Recommended fix: connect to Sentry/Logtail/Supabase logs with redaction preserved.
- Complexity: Low.
- Dependencies: vendor selection.

## Business Lifecycle State Coverage

Implemented explicit states in `businesses.lifecycle_state`:

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

The new backend model supports this ambassador flow:

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

## Work Implemented

- Added migration: `supabase/migrations/202607180001_business_lifecycle_audit.sql`.
- Added migration: `supabase/migrations/202607180002_business_claim_evidence_storage.sql`.
- Added pull-request validation workflow: `.github/workflows/pull-request-validation.yml`.
- Added protected manual Edge Function deployment workflow: `.github/workflows/deploy-supabase-functions.yml`.
- Added CI validation scripts in `scripts/`.
- Added CI documentation: `docs/ci-pilot-validation.md`.
- Added tests: `test/pilot-readiness.test.js`.
- Added this report: `docs/pilot-readiness-report.md`.

## Migration Details

The migration adds:

- `businesses.lifecycle_state`
- `businesses.last_transition_reason`
- `businesses.last_transition_evidence`
- `businesses.last_verified_at`
- `businesses.suspended_at`
- `businesses.closed_at`
- `business_lifecycle_events`
- `business_ambassador_visits`
- `business_claim_links`
- private `business-claim-evidence` storage bucket
- protected-field guard trigger
- lifecycle event recording trigger
- RLS policies for new tables
- storage policies for claimant/admin-only claim evidence access

Rollback approach is documented at the top of the migration file. No destructive schema changes are included.

## Validation Results

Run locally after implementation:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `node scripts/enforce-lint-baseline.mjs`
- `npm run build`
- `npm audit --audit-level=high`
- `node scripts/secret-scan-smoke.mjs`
- `node scripts/validate-migrations.mjs`
- `node scripts/validate-authorization-safety.mjs`
- `node scripts/validate-workflows.mjs`

See final handoff for command results.

## Remaining Risks

- Branch creation is blocked by filesystem permissions in this Codex environment.
- `.claude/settings.local.json` was already dirty and was not touched.
- `src/main.js` still has lint warnings for unused symbols unrelated to this workstream.
- `README.md` contains example `sk-...` syntax for setting an OpenAI key; it is not a real secret but may trip naïve secret scanners.
- Production Supabase migrations still need to be applied and manually verified.
- GitHub branch protection must be configured in repository settings for CI to become mandatory.

## Recommended Next Codex Task

Add CI and a pilot secret/migration validation workflow:

- run test/typecheck/lint/build on every PR
- detect committed real secrets
- verify migrations include RLS for new public tables
- verify Supabase Edge Function source does not log secrets or prompt content
- optionally deploy Edge Functions from CI with `SUPABASE_ACCESS_TOKEN`

## Merge Instructions

1. Merge Claude’s narrative/copy branch first if it touches `src/main.js`, locales, or visual files.
2. Rebase this backend-only migration/test/doc change afterward.
3. Expected conflicts are low because this work adds `docs/pilot-readiness-report.md`, `test/pilot-readiness.test.js`, and a new migration file.
4. Do not overwrite `.claude/settings.local.json`; it was pre-existing local state.
