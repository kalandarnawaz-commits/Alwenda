# Production Data Policy

## Rule

The deployed Alwenda application (`alwenda.com`) may only present:

- real imported place/business data (`src/data/seedCityData.js` via `mockData.js`'s `importedBusinesses`)
- authenticated user-generated content (Supabase-backed, created through the app's own forms/Alwen tool calls)
- legitimate business-managed content (claimed/verified business profiles)
- explicit, honest empty states when no real records exist
- clearly-labelled development-only fixtures — and only in development/test, never in production

No fabricated activity (invented businesses, listings, reviews, notifications, messages, bookings, reputation numbers, "verified" badges without a real verification, or engagement counts) may render as if it were real.

## Environment model

Three environments: `development`, `test`, `production` (plus `staging`, recognised but not fixture-permitting). Resolved in `src/config.js`:

```js
export function resolveAppEnv(browserValue, nodeValue) {
  if (RECOGNISED_APP_ENVS.includes(browserValue)) return browserValue;
  if (RECOGNISED_APP_ENVS.includes(nodeValue)) return nodeValue;
  return "production";
}
```

- `browserValue` comes from `window.__ALWENDA_ENV__.APP_ENV`, set by `env.js` (see `env.example.js`).
- `nodeValue` comes from `process.env.APP_ENV`, relevant only to `node --test` (there is no `window` under Node) and only when a test explicitly sets it before importing `src/config.js`.
- **Fail-safe default**: anything missing, unset, or not one of the recognised names resolves to `"production"`. This is not hypothetical — it is the fix for a real, live bug: the tracked `env.js` (which is what `alwenda.com` actually serves, since GitHub Pages builds from the `main` branch root, not `dist/`) never set `APP_ENV` at all, so before this change production was silently resolving to `APP_ENV = "development"` via the old `env.APP_ENV || "development"` fallback. `env.js` now explicitly sets `APP_ENV: "production"`, and the fail-safe default means this class of bug cannot recur even if that line is ever accidentally removed again.

```js
development: fixtures allowed
test:        fixtures allowed only when explicitly requested (process.env.APP_ENV="test" before import)
production:  fixtures prohibited
staging / anything else / missing: fixtures prohibited (same as production)
```

`isFixturesAllowed()` is the single gate every fixture-backed export is conditioned on:

```js
export function isFixturesAllowed() {
  return computeIsFixturesAllowed(APP_ENV); // true only for "development" | "test"
}
```

## Enforcement is in code, not in developer discipline

Every fabricated/seeded export in `src/data/mockData.js` follows exactly one pattern:

```js
export const listings = isFixturesAllowed() ? DEV.FIXTURE_listings : [];
```

- Real fixture literals live in `src/data/devFixtures.js`, imported once (`import * as DEV from "./devFixtures.js"`) — never referenced directly by `main.js`, never referenced by any file other than `mockData.js`.
- The empty-value fallback matches each export's real type: `[]` for arrays, a zeroed/blank object for `cityGraph`/`reputationProfile`/`alwenListingDraft`/`alwenBusinessDraft`.
- Arrays that also receive real, user-created content via `.unshift()` (`listings`, `helpRequests`, `businessClaims`, `messageThreads`) keep the exact same array reference — production starts empty, and real submissions still append correctly. No call site had to change.
- Two illustrative "here's what Alwen could draft" preview panels (`renderAlwenListingCreator()`, `renderAlwenBusinessCreator()`) are gated at the render-function level (`if (!isFixturesAllowed()) return "";`) rather than relying on their backing objects being blank, since they are inherently a demo, not real generated output.
- One fabricated dataset lives directly in `src/main.js`, not `mockData.js` (`LIVE_OPPORTUNITIES`, a fake paid-task feed) — gated with the identical pattern: `const LIVE_OPPORTUNITIES = isFixturesAllowed() ? [...] : [];`.

`scripts/validate-production-data-safety.mjs` asserts this structurally (every risky export matches the exact gated pattern) and, more importantly, **executes** the built app's data layer under production-default conditions (no `APP_ENV` set) and asserts every fixture-backed value comes back empty. This is proof by execution, not by trusting source-pattern matching alone.

## A known, honest limitation of this architecture

Alwenda is a zero-bundler static site — there is no build step that strips unused code, and GitHub Pages serves the repository root directly from `main`, not the `dist/` folder `npm run build` produces (confirmed via `gh api repos/.../pages`: `"source":{"branch":"main","path":"/"}`). This means:

- Fixture **string content** (`src/data/devFixtures.js`, and the fabricated literals inside `LIVE_OPPORTUNITIES` in `main.js`) physically exists in the files served by `alwenda.com`, reachable by a sufficiently determined visitor fetching that file directly by URL — there is no way to remove those bytes without either (a) introducing a real bundler/tree-shaking build step, or (b) converting `mockData.js`'s fixture exports to genuinely lazy `import()`s, which would require every one of the ~30 call sites across `main.js` to become async. Both are out of scope for this pass ("do not perform a broad redesign").
- What **is** fully achieved, and is the guarantee this app's production safety actually depends on: no runtime code path ever assigns fixture content into a rendered value, verified by executing the built app's data layer under production defaults (see `scripts/validate-production-data-safety.mjs` and `test/production-data-safety*.test.js`). A visitor could theoretically find `devFixtures.js` at a direct URL; nothing in the running application ever reads, renders, or otherwise acts on it in production.
- The correct long-term fix for full byte-level exclusion is moving to a real build pipeline (or switching GitHub Pages to serve `dist/` with a build step that deletes `devFixtures.js`) — recommended as a future improvement, not attempted here since it would touch the deployment architecture, not just data safety.

## Empty states

Every screen backed by a now-gated fixture array has an honest empty state instead of silently rendering nothing or crashing:

| Screen | Title | Supporting text | Primary action |
| --- | --- | --- | --- |
| Marketplace | "No listings yet" | "Be the first person in your area to sell, rent, or offer a service." | "Create listing" |
| Business profile reviews | "No reviews yet" | — | — |
| Notifications | "You're all caught up." | (pre-existing, unchanged) | — |
| Messages | "No conversations yet." | "Contact a business or another user to start a conversation." | — |
| Reservations/Bookings | "You haven't made any bookings yet" | — | — |
| Businesses directory + business profile (no real business) | "No businesses yet" | "Real local businesses will appear here as owners claim and verify their profiles. Explore already has real places nearby." | "Explore nearby" |

All copy exists in `locales/en.json`/`lt.json`/`de.json`.

## Restricted operational routes

`ops` and `cityImport` are gated behind `isOpsAuthorized(user)`, which checks the same server-issued `app_metadata.role`/`traderPermissions` signal already used for this app's trader-review queue — not client-writable, so this is real authorization, not link-hiding. See `docs/qa/production-data-inventory.md` for detail.
