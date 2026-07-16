# Alwenda Production Foundation

This sprint intentionally avoids customer-facing redesign work. Claude can continue UI journeys while this branch supplies the database, auth, config, release, observability, and test foundation underneath.

## Runtime Configuration

Public frontend configuration lives in `env.js` via `window.__ALWENDA_ENV__`.

Required for real auth:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Recommended:

- `APP_ENV`: `development`, `staging`, `production`, or `test`
- `APP_RELEASE_VERSION`
- `PUBLIC_FEATURE_FLAGS`

Never put these in frontend code:

- Supabase service-role key
- OpenAI API key
- Google OAuth client secret
- SMTP, SMS, payment, map, or booking provider secrets

Backend secrets belong in server-only deployment configuration.

## Supabase Migration

Apply `supabase/migrations/202607150001_production_foundation.sql` after reviewing it against the live project.

The migration creates:

- User data: `public_profiles`, `private_profiles`, `notification_preferences`
- Commerce/community: `listings`, `listing_images`, `saved_listings`, `community_posts`, `comments`, `reviews`
- Places/businesses: `businesses`, `business_claims`, `business_claim_evidence`
- Messaging: `conversations`, `conversation_participants`, `messages`
- Alwen: `alwen_conversations`, `alwen_messages`
- Safety/moderation: `user_blocks`, `reports`, `audit_events`

## RLS Test Matrix

| Area | Anonymous | Authenticated owner | Authenticated non-owner | Trusted admin/backend |
| --- | --- | --- | --- | --- |
| `public_profiles` | Read all | Read/update own | Read all, no update | Read all |
| `private_profiles` | No access | Read/update own | No access | Read/update |
| Published listings | Read | Read | Read | Read |
| Draft listings | No access | Read/update/delete own | No access | Read/update/delete |
| `saved_listings` | No access | Read/write own saves | No access | No client policy needed |
| Business claims | No access | Create/view own, withdraw pending | No access | Review/approve/reject |
| Claim evidence | No access | Manage own evidence | No access | Review evidence |
| Conversations/messages | No access | Participant only; sender must equal auth user | No access unless participant | Moderation access |
| Alwen conversations | No access | Own conversations only | No access | Backend/admin access |
| Reports | No access | Create/view own reports | No access | Moderate |
| Blocks | No access | Manage own blocks | No access | Moderate |
| Audit events | No access | Append own safe events | No access | Read audit stream |

Manual Supabase checks to run before launch:

1. Create two test users and one admin user with `app_metadata.role = admin`.
2. Verify user A cannot read user B's `private_profiles`.
3. Verify user A cannot update user B's listing, draft, claim, Alwen conversation, or messages.
4. Verify a claimant cannot set a claim to `approved`.
5. Verify a message insert fails when `sender_user_id` does not equal `auth.uid()`.
6. Verify public read works for `public_profiles`, published listings, businesses, public posts, and published reviews.

## Auth Verification

The frontend auth client uses Supabase Auth only:

- Google sign-in calls `supabase.auth.signInWithOAuth`.
- Email sign-in calls `supabase.auth.signInWithOtp`.
- Session restore calls `supabase.auth.getSession`.
- Sign out calls `supabase.auth.signOut`.
- Missing config throws `AuthNotConfiguredError`; it does not create a fake account.

Profile bootstrap now has a dedicated data-layer service at `src/services/auth/profileBootstrap.js`. It preserves user edits, fills provider name/avatar only when missing, and returns `nextStep` as `complete_profile` or `home`.

## Deep-Link Coverage

Automated guardrails currently cover the direct routes already present in `src/main.js`:

- Home
- Marketplace
- Business profile
- Translate
- Messages
- Notifications
- Community
- Profile
- Settings
- Auth
- Public profile
- Business dashboard

Known route-support gaps to coordinate with Claude before launch:

- Listing detail currently needs confirmation as a stable direct route.
- Business claim currently appears tied to business/profile/dashboard flows rather than a dedicated direct route.
- TYT may be represented by the current `contribute`/opportunity flows, but the public URL contract should be named explicitly before launch.

## Release And Service Worker Runbook

Build:

```bash
npm run build
```

Deploy static output from `dist/`.

Cache update process:

1. Change `APP_RELEASE_VERSION` in deployment `env.js`.
2. Change the service-worker `RELEASE_VERSION` when shell assets change.
3. Deploy.
4. In a browser, send `ALWENDA_RELEASE_DIAGNOSTICS` to the service worker and confirm the expected cache version.
5. Hard refresh only for debugging; users should receive the new shell through normal SW activation.

Rollback:

1. Re-deploy the previous static artifact.
2. Restore the previous `env.js` release version.
3. If shell files changed, restore the previous service-worker `RELEASE_VERSION` or bump to a rollback-specific version.

OAuth callback safety:

- `/auth/callback` has its own cached fallback.
- Same-origin navigation remains network-first.
- Stale caches are deleted on service-worker activation.

## Observability Foundation

`src/services/observability.js` provides structured events for:

- Route errors
- Supabase failures
- Auth events and OAuth errors
- Profile bootstrap failures
- Business import failures
- Alwen failures
- Uncaught JavaScript exceptions
- Unhandled promise rejections

The logger redacts common secrets, tokens, OTPs, emails, phone numbers, message bodies, and credential fields. It is ready to connect to Sentry or another provider later.

## Data Error Handling

`src/services/dataErrors.js` normalizes common failures into:

- `network_unavailable`
- `supabase_unavailable`
- `unauthenticated`
- `forbidden`
- `missing_record`
- `invalid_input`
- `rate_limited`
- `stale_session`
- `provider_config_missing`

UI code can consume `safeErrorPayload(error)` without exposing secrets.

## Alwen Edge Function

`supabase/functions/alwen-chat/index.ts` is the first secure text-chat connection.

Security model:

- `OPENAI_API_KEY` is read only inside the Edge Function with `Deno.env.get("OPENAI_API_KEY")`.
- Browser JavaScript never references `OPENAI_API_KEY`.
- The browser sends the current Supabase access token to `/functions/v1/alwen-chat`.
- The Edge Function verifies the authenticated user with `supabase.auth.getUser()`.
- Signed-out or expired sessions receive `401`.
- Missing OpenAI configuration receives `503`.
- Empty prompts receive `400`.
- OpenAI failures return a safe generic error without key, token, or prompt leakage.

Deploy once authenticated with Supabase CLI:

```bash
supabase login
supabase functions deploy alwen-chat
```

For CI:

```bash
SUPABASE_ACCESS_TOKEN=... supabase functions deploy alwen-chat
```

Manual smoke tests after deploy:

- Signed-in user can send `Labas, ką galiu nuveikti Vilniuje šiandien?` and receives Lithuanian.
- Signed-out request returns `401`.
- Empty `message` returns `400`.
- Temporarily unset `OPENAI_API_KEY` in a non-production project and confirm `503`.
- Inspect browser network responses and confirm no OpenAI key appears.

## Performance Baseline

Measured from source files in this zero-build static app:

- Main renderer is still large and should be split after Claude's UI work settles.
- Largest static image assets are PWA icons and the Vilnius hero image.
- `src/data/seedCityData.js` and `src/data/mockData.js` are imported client-side; future API-backed data should lazy-load by route.
- Service-worker shell cache is intentionally small: root, `index.html`, `manifest.json`, and auth callback shell.
- No new runtime dependencies were added in this sprint.

Suggested post-merge measurements:

- Run Lighthouse mobile on production.
- Capture initial JS transfer size after deployment compression.
- Measure first route render and auth callback restore time.
- Count Supabase calls during session restore and first profile render.

## Merge Order

Recommended order:

1. Merge Claude's customer-facing UI branch first if it touches `src/main.js`, `src/styles.css`, routing, locales, cards, or profile/business screens.
2. Rebase this foundation work onto that result.
3. Resolve only expected conflicts in auth/config/service-worker docs/tests.
4. Apply the Supabase migration after frontend deploy config is ready.

Likely conflict areas:

- `src/main.js` if Claude changes routing/auth UI.
- `src/styles.css` if Claude changes global shell behavior.
- `sw.js` if Claude updates PWA handling.
- `README.md` if Claude updates product documentation.
