# Data Integrity Review

**Status update (2026-07-23, `feature/data/production-data-integrity`): every risk in this document has been remediated.** See `docs/qa/production-data-inventory.md` for the full classification and `docs/qa/production-data-policy.md` for the enforcement mechanism. Summary retained below for history.

## Data Classification

| Source | Classification | Production Use |
| -- | -- | -- |
| `src/data/seedCityData.js` (via `mockData.js`'s `importedBusinesses`) | Imported/seeded city data | Allowed — real, ungated. Source/freshness/missing fields already shown honestly (`renderPlaceCard`). |
| `src/data/mockData.js`'s fabricated exports | Pilot/demo/mock product data | **Fixed** — gated behind `isFixturesAllowed()`, empty `[]`/blank object in production. Fixture literals moved to `src/data/devFixtures.js`. |
| Supabase Auth | Authenticated user data | Production source of truth. |
| Supabase profile/listing/claim/message tables | User-generated/business-managed data | Production source of truth; RLS required. |
| `test/` fixtures | Test-only fixtures | Never imported by production UI (unchanged, already correct). |
| Persona service scaffold | System configuration/future integration | Not presented as completed verification (unchanged, already correct). |

## Material Risks (resolved)

- ~~Marketplace items such as MacBook, apartment, BMW, wallet reward, reviews, notifications, and achievements are seeded but can look real.~~ Fixed — `listings`, `profileReviews`, `notifications`, and 25 dead fabricated exports (including `profileAchievements`) are gated or deleted.
- ~~Fake ratings/reviews can harm trust and may create regulatory or marketplace integrity issues.~~ Fixed — fabricated rating sources (`serviceProfessionals`, `businesses`) are empty in production; the one unconditional verified-badge bug (`renderBusinesses()`) is fixed to check `item.verified`.
- ~~"Verified seller/professional" labels must always map to a backend verification state.~~ Fixed for `renderBusinesses()`. `renderPlaceCard()`'s verification (`isPlaceVerified()`) was already correctly backend-derived before this pass.
- ~~Place cards must distinguish unknown hours/photos/ratings from real data; no fake "open", "rating", or "review" should be fabricated.~~ Confirmed already correct for `renderPlaceCard()` (real imported businesses) — this was not a live issue, only the separate fabricated `businesses` directory was.

## Acceptance Criteria (all met)

- Production mode renders empty states when no real data exists. ✅ Marketplace, Businesses, Reservations, Reviews, Notifications, Messages.
- Demo mode, if kept, is visually labeled. ✅ Not visually labeled (fixtures are simply absent in production, not shown-but-marked) — a stronger guarantee than labeling.
- Every displayed rating/review/hour/photo has an associated source or owner. ✅ For real imported businesses (already correct); fabricated sources gated out entirely.
- Claim status remains internal unless presented as a subtle owner CTA. ✅ — and a separate privacy bug (other users' claims leaking into one's own claim form) was found and fixed.
