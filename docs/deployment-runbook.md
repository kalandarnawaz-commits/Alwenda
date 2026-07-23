# Deployment Runbook

Alwenda is a zero-build static app (`dist/` is just `index.html` + `src/` + a few static folders, copied verbatim by `npm run build` — see `package.json`) plus a set of Supabase Edge Functions. As of this writing **no frontend hosting is configured anywhere in this repository** — no `netlify.toml`, `vercel.json`, GitHub Pages workflow, or `Dockerfile` exists, and the README only documents Edge Function deployment. The frontend section below is therefore a **recommendation**, not a description of existing practice — adapt it to whatever static host you actually pick, and update this doc once it's real.

## ⚠️ There is currently only one Supabase project

`supabase projects list` returns exactly one linked project (`syfahecoodziijlsasum`). There is **no separate staging and production Supabase project** — every migration push, Edge Function deploy, and "staging" test in this repo's docs (including `docs/alwen-2.0-staging-e2e-checklist.md`) runs against this single shared project, which also backs whatever real usage the app currently has.

Practical consequences until a real staging project is provisioned:

- Any `supabase db push` or `supabase functions deploy` against "staging" is a **real deploy to the only environment that exists** — treat every such action with the same care as a production deploy.
- Test accounts created for E2E validation live in the same `auth.users` table as any real users — don't assume a clean, disposable database.
- OpenAI usage from manual testing counts against the real `alwen_chat_usage` daily cost ceiling (`ALWEN_CHAT_DAILY_COST_CAP_USD`, default $2/day) — **do not intentionally exhaust it** (e.g. scripted request floods to trigger the cap) and don't run destructive testing (bulk deletes, schema changes outside reviewed migrations, load testing) against this project.
- Provisioning an actual separate staging project (and updating this doc, `env.js`, and the deploy workflow's `SUPABASE_PROJECT_ID` secret to point at it) should happen before this app has real production traffic to protect.

## Frontend deployment (recommended — not yet in place)

1. Build: `npm run build` — produces `dist/`, deterministic from a given git commit, no environment-specific values baked in (`env.js` is copied as-is if present locally, but production `env.js` should be supplied by the host, never committed — see `env.example.js`).
2. Upload `dist/` to your static host under a **versioned path** tagged by git SHA (e.g. `s3://your-bucket/releases/<git-sha>/`), not overwriting the previous release in place.
3. Atomically repoint your CDN/host's "current" alias (e.g. an S3+CloudFront origin path, a Cloudflare Pages deployment alias, or equivalent) at the new `<git-sha>` path. This is what makes rollback possible — the previous release's files are still sitting there untouched.
4. Invalidate/purge any CDN cache for `index.html` specifically (it references `main.js?v=...` and other cache-busted assets by query string, so `index.html` itself is the one file that must not be served stale).

### Rollback

Because each release lives at its own versioned path, rolling back a bad deploy is re-pointing the "current" alias at the previous git SHA's path — **not** rebuilding or reverting the git history:

```bash
# Whatever your host's equivalent of this is (S3+CloudFront origin path,
# Cloudflare Pages "promote deployment", Netlify "publish deploy", etc.):
your-host-cli promote-deployment --path releases/<previous-good-git-sha>/
your-host-cli purge-cache index.html
```

Keep at least the last 5 release paths around before pruning old ones, so a rollback is always available without rebuilding.

## Edge Function deployment (already in place)

Deploys via `.github/workflows/deploy-supabase-functions.yml` (`workflow_dispatch`, requires `function_name` + a protected `environment`), using the `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID` GitHub Actions secrets. Manually:

```bash
supabase functions deploy alwen-chat
supabase functions deploy elevenlabs-tts
supabase functions deploy translate-transcribe
```

### Rollback

Edge Functions have no built-in "previous version" pointer in this setup — rollback means redeploying the function from the previous good commit:

```bash
git checkout <previous-good-git-sha> -- supabase/functions/<function_name>
supabase functions deploy <function_name>
git checkout HEAD -- supabase/functions/<function_name>   # restore your working tree
```

## Key rotation

Rotate any of these immediately if you suspect exposure (a leaked CI log, a compromised laptop, an ex-employee's access, etc.). All three are read only via `Deno.env.get(...)` inside Edge Functions or `secrets.*` in GitHub Actions — never in `env.js`/`env.example.js`, never in browser-shipped code (enforced by `scripts/validate-authorization-safety.mjs` and `test/alwen-chat.test.js`/`test/elevenlabs-tts.test.js`).

### `SUPABASE_ACCESS_TOKEN`

1. Generate a new personal access token: Supabase Dashboard → Account → Access Tokens → Generate new token.
2. Update the GitHub Actions secret: repo Settings → Environments → `supabase-edge-functions` → update `SUPABASE_ACCESS_TOKEN`.
3. Trigger `deploy-supabase-functions.yml` once for any function to confirm the new token works.
4. Revoke the old token in the Supabase Dashboard.

### `OPENAI_API_KEY`

1. Generate a new key at platform.openai.com → API keys.
2. `supabase secrets set OPENAI_API_KEY=<new-key>`
3. `supabase functions deploy alwen-chat` (secrets take effect on next deploy/cold start — redeploy to be sure).
4. Send one real test message through Alwen and confirm it still answers.
5. Revoke the old key in the OpenAI dashboard.

### `ELEVENLABS_API_KEY`

1. Generate a new key at elevenlabs.io → Profile → API Keys.
2. `supabase secrets set ELEVENLABS_API_KEY=<new-key>`
3. `supabase functions deploy elevenlabs-tts`
4. Trigger a real Speak action from Translation and confirm audio plays (see `docs/elevenlabs-tts.md`'s manual E2E test).
5. Revoke the old key in the ElevenLabs dashboard.

## Backup and restore drill

**This drill has not been executed in this environment** — the sandbox this doc was written in has the Supabase CLI installed but no Docker (`supabase start` requires it) and no real staging project credentials, so nothing below has been run against a real database. Run it for real against your staging project, then fill in the results table at the bottom with actual output and timings.

Mirrors the safety pattern already used by `scripts/run-local-supabase-validation.mjs` — the restore target is validated as a local/non-production host before anything runs against it, so a typo in an environment variable can't accidentally restore into (i.e. overwrite) production.

### 1. Take a real backup of staging

```bash
export STAGING_DB_URL="postgresql://postgres:<password>@db.<staging-project-ref>.supabase.co:5432/postgres"

# Schema + data, full logical dump. --linked (or --db-url) both work;
# --db-url is shown here since it doesn't require `supabase link` first.
time supabase db dump --db-url "$STAGING_DB_URL" -f backup-$(date +%Y%m%d-%H%M%S).sql
```

### 2. Verify the backup is non-empty and structurally sane

```bash
grep -c "^CREATE TABLE" backup-*.sql   # should roughly match the migrated table count
wc -l backup-*.sql
```

### 3. Restore into a disposable **local** database, never staging or production

```bash
# Refuse anything but a local host — same guard as
# scripts/run-local-supabase-validation.mjs, applied manually here.
export RESTORE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
case "$RESTORE_DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "Refusing to restore into a non-local host." && exit 1 ;;
esac

supabase start   # requires Docker; brings up local Postgres on 54322
time psql "$RESTORE_DB_URL" -f backup-*.sql
```

### 4. Verify the restore

```bash
psql "$RESTORE_DB_URL" -c "select count(*) from public.businesses;"
psql "$RESTORE_DB_URL" -c "select count(*) from public.trader_verifications;"
# Compare row counts against what staging reported before the dump.
```

### 5. Tear down

```bash
supabase stop
rm backup-*.sql   # or move it to secure, access-controlled backup storage if this was a real scheduled backup, not just a drill
```

### Results (fill in after a real run)

| Step | Command | Duration | Notes |
|---|---|---|---|
| Dump staging | `supabase db dump` | _not yet run_ | |
| Verify dump | `grep`/`wc` | _not yet run_ | |
| Restore locally | `psql -f backup.sql` | _not yet run_ | |
| Verify restore | `select count(*)` row-count comparison | _not yet run_ | |
| **Total drill time** | | _not yet run_ | |

## Security notes

- Never commit `SUPABASE_ACCESS_TOKEN`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, or any staging/production database connection string.
- The backup-restore drill above only ever writes into a local (127.0.0.1) database — never restore a dump directly into staging or production without a deliberate, separately-reviewed migration plan.
- Treat any database connection string (`STAGING_DB_URL`, etc.) exactly like a password — it contains one.
