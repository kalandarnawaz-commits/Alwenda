# Alwenda Feature Inventory

## Public Surfaces

| Route/View | Purpose | Current Status | Notes |
| -- | -- | -- | -- |
| `home` | Living city entry, city hero, rails, Alwen entry points | Built | Needs mobile overlap and data realism retest. |
| `explore` | Place and business discovery | Built | Real/imported data support exists; card actions need end-to-end retest. |
| `marketplace` | Browse listings and categories | Built | Seeded/trending data can look real; details/navigation recently changed. |
| `listingDetail` | Listing detail | Built | Needs owner/contact/auth journey retest. |
| `liveOpportunities` | All live help/work tasks | Built | “See all” should route here; individual cards should deep-link to detail. |
| `liveOpportunityDetail` | Single nearby task/opportunity | Built | Needs retest from all rails and languages. |
| `events`, `eventDetail` | Event discovery/detail | Built | Verify event cards are actionable and honest about source. |
| `businessProfile` | Business/place profile | Built | Must hide technical imported/unclaimed labels from normal users. |
| `businessClaim` | Claim business flow | Built | Needs auth and duplicate/already-claimed testing. |
| `translate` | Text/voice/camera translation | Built | Voice fallback is active, but mobile browser behavior needs manual device QA. |
| `alwen` | Canonical Alwen conversation | Built | Edge Function requires auth; context/persistence need manual and API tests. |
| `profile` | User profile/identity/settings path | Built | Signed-out/signed-in states need full retest. |
| `settings` | Preferences, legal, trader verification | Built | Some copy is hard-coded English. |
| `notifications`, `messages`, `conversation` | Inbox and activity | Partially built | Current content can feel synthetic; needs real action-to-message linkage. |
| `onboarding`, `auth`, auth subviews | Sign-in and profile completion | Built | Requires real Google/email manual checklist. |

## Internal/Admin Surfaces

| Route/View | Purpose | Current Status | Risk |
| -- | -- | -- | -- |
| `ops` | Platform operations | Built | Direct URL accessible; must be admin gated or disabled in production. |
| `cityImport` | Import/open data workflow | Built | Direct URL accessible; mock/import preview must be admin gated. |
| `businessDashboard` | Business owner dashboard | Protected | Needs ownership checks against backend. |
| `traderVerification`, `traderReview` | Trader verification/review | Protected | Reviewer UI copy is hard-coded; backend role tests exist but manual reviewer flow remains. |

## Integrations

- Supabase Auth, database and storage.
- Supabase Edge Functions: `alwen-chat`, `elevenlabs-tts`, `translate-transcribe`.
- OpenAI in Edge Functions only.
- ElevenLabs in Edge Function only.
- Persona identity verification scaffold only.
- Maps/directions via external URLs.
- Service worker/PWA shell.

## Data Sources

- Imported/seeded Vilnius place data in `src/data/seedCityData.js`.
- Modular mock and pilot demo content in `src/data/mockData.js`.
- Authenticated Supabase user/profile/listing/claim/message data through client service functions.
- Test-only fixtures in `test/`.
