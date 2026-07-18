# CI And Pilot Validation

This repository now has two isolated GitHub Actions workflows:

- `.github/workflows/pull-request-validation.yml`
- `.github/workflows/deploy-supabase-functions.yml`

The pull-request workflow is mandatory for code validation. The deployment workflow is manual and protected; it does not deploy during pull requests.

## Pull-Request Pipeline

Job: `App validation`

Runs:

1. `npm ci`
2. `npm test`
3. `npm run typecheck`
4. `npm run lint`
5. `node scripts/enforce-lint-baseline.mjs`
6. `npm run build`
7. `npm audit --audit-level=high`
8. `node scripts/secret-scan-smoke.mjs`
9. `node scripts/validate-migrations.mjs`
10. `node scripts/validate-authorization-safety.mjs`
11. `node scripts/validate-workflows.mjs`
12. Gitleaks secret scan

Job: `Local Supabase migration rebuild`

Runs:

1. `supabase start`
2. `node scripts/run-local-supabase-validation.mjs`
3. `supabase stop --no-backup`

This uses a disposable local Supabase stack only. It must never connect to production.

The local validation script:

1. Refuses to run against a non-local database host.
2. Applies every migration from zero with `supabase db reset --local`.
3. Captures a schema-only dump.
4. Resets and rebuilds from zero a second time.
5. Compares both schema dumps for deterministic migration behavior.
6. Runs `supabase/tests/rls_authorization.sql` against the local database.

## Lint Baseline

The current lint baseline is:

- 0 errors
- 10 warnings

`scripts/enforce-lint-baseline.mjs` rejects new lint errors or any warning count above 10. This preserves the current `src/main.js` baseline without requiring cleanup during Claude’s active UI/copy work.

## Secret Scanning

The PR workflow uses Gitleaks via `gitleaks/gitleaks-action@v2`.

`scripts/secret-scan-smoke.mjs` validates local scanner patterns by creating a temporary fake `sk-...` fixture under the OS temp directory, detecting it, then deleting the fixture before completion.

No fake secret fixture is committed to the repository.

## Migration And RLS Validation

`scripts/validate-migrations.mjs` checks:

- migration filename format
- duplicate migration identifiers
- lexicographic ordering
- rollback documentation
- destructive-operation patterns
- RLS coverage for new `public.*` tables

`scripts/validate-authorization-safety.mjs` checks:

- private profile owner isolation
- claimants cannot approve their own claims
- messages require participants
- protected business lifecycle fields require trusted admin/reviewer role
- reviewer-only records are not public
- business claim evidence is private and claimant/admin scoped
- Edge Function authentication guardrails

`supabase/tests/rls_authorization.sql` verifies against a real local database:

- one user cannot read or update another user’s private profile
- a claimant cannot approve their own business claim
- a normal client cannot directly create a verified business state
- another user cannot read private claim evidence metadata
- one user cannot edit another user’s listing
- a trusted reviewer can approve a claim and create an auditable lifecycle event

Limitations:

- Static checks cannot prove every runtime policy behavior.
- The local Supabase rebuild and SQL probes are the runtime validation layer when Docker, Supabase CLI, `psql`, and `pg_dump` are available.
- Production data is never touched by these checks.

## Required Repository Secrets

Only the manual deployment workflow needs secrets:

- `SUPABASE_ACCESS_TOKEN`: Supabase CLI access token with permission to deploy Edge Functions.
- `SUPABASE_PROJECT_ID`: Supabase project reference for the target environment.

Do not expose:

- `OPENAI_API_KEY`
- Supabase service-role key
- OAuth client secrets
- SMTP/SMS/payment provider secrets

Those belong in Supabase/project runtime secret stores, not GitHub PR workflows.

## Branch Protection

Recommended protected branch: `main`.

Require these status checks:

- `App validation`
- `Local Supabase migration rebuild`

Recommended branch rules:

- Require pull request before merge.
- Require branches to be up to date before merge.
- Require conversation resolution.
- Require at least one reviewer.
- Block force pushes.
- Block deletions.
- Restrict who can bypass required checks.
- Do not allow deployments from forked pull requests.

## Manual Edge Function Deployment

Workflow: `Deploy Supabase Edge Functions`

Trigger:

1. Open GitHub Actions.
2. Select `Deploy Supabase Edge Functions`.
3. Choose `Run workflow`.
4. Enter `function_name`, e.g. `alwen-chat`.
5. Use protected environment `supabase-edge-functions`.
6. Approve the environment deployment if required.

The workflow runs:

```bash
supabase functions deploy "$FUNCTION_NAME" --project-ref "$SUPABASE_PROJECT_ID"
```

This workflow is intentionally not connected to `pull_request`.

## Local Equivalents

Run before opening or merging a PR:

```bash
npm ci
npm test
npm run typecheck
npm run lint
node scripts/enforce-lint-baseline.mjs
npm run build
npm audit --audit-level=high
node scripts/secret-scan-smoke.mjs
node scripts/validate-migrations.mjs
node scripts/validate-authorization-safety.mjs
node scripts/validate-workflows.mjs
```

When Supabase CLI and Docker are available:

```bash
supabase start
node scripts/run-local-supabase-validation.mjs
supabase stop --no-backup
```

## Current Pilot Score Impact

CI and validation workflow work raises the pilot-readiness score from 61/100 to **66/100**, assuming branch protection is enabled in GitHub and the Supabase local migration job passes in CI.
