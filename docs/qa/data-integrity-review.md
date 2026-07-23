# Data Integrity Review

## Data Classification

| Source | Classification | Production Use |
| -- | -- | -- |
| `src/data/seedCityData.js` | Imported/seeded city data | Allowed if source, freshness, and missing fields are shown honestly. |
| `src/data/mockData.js` | Pilot/demo/mock product data | Risky in production unless explicitly demo-gated or replaced. |
| Supabase Auth | Authenticated user data | Production source of truth. |
| Supabase profile/listing/claim/message tables | User-generated/business-managed data | Production source of truth; RLS required. |
| `test/` fixtures | Test-only fixtures | Must never be imported by production UI. |
| Persona service scaffold | System configuration/future integration | Must not be presented as completed verification. |

## Material Risks

- Marketplace items such as MacBook, apartment, BMW, wallet reward, reviews, notifications, and achievements are seeded but can look real.
- Fake ratings/reviews can harm trust and may create regulatory or marketplace integrity issues.
- “Verified seller/professional” labels must always map to a backend verification state.
- Place cards must distinguish unknown hours/photos/ratings from real data; no fake “open”, “rating”, or “review” should be fabricated.

## Acceptance Criteria

- Production mode renders empty states when no real data exists.
- Demo mode, if kept, is visually labeled.
- Every displayed rating/review/hour/photo has an associated source or owner.
- Claim status remains internal unless presented as a subtle owner CTA.
