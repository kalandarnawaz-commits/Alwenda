# Security Review

## Positive Findings

- Tracked OpenAI and ElevenLabs keys are read only inside Supabase Edge Functions.
- `alwen-chat`, `elevenlabs-tts`, and `translate-transcribe` require a Bearer session and call `supabase.auth.getUser()`.
- RLS-oriented migrations and authorization tests exist for private profiles, business evidence, reviewer records, lifecycle transitions, and conversations.
- Observability tests redact personal data and tokens from analytics payloads.
- External links inspected in `src/main.js` include `rel="noopener noreferrer"`.

## Risks

| Area | Severity | Finding | Recommendation |
| -- | -- | -- | -- |
| Internal routes | P1 | `ops` and `cityImport` are direct-route renderable and not protected by `protectedViews`. | Disable from production public builds or add server-verified admin authorization before render/mutation. |
| Demo data | P1 | Fake listings, ratings, reviews, notifications and profile achievements can create trust and consumer-law risk. | Gate behind demo mode or replace with real/empty states. |
| Speech cost | P2 | TTS/transcription functions require auth but do not show the same per-user daily cost cap pattern as `alwen-chat`. | Add usage logging, per-user throttles, and daily spend caps. |
| CORS | P2 | Edge Functions use wildcard CORS. | For production, restrict origins to `https://alwenda.com` and localhost dev origins if Supabase platform allows. |
| Fallback auth client | P2 | Hand-rolled Supabase fallback stores session-like data in localStorage when SDK import fails. | Keep as resilience path but verify no private data beyond tokens and that logout clears it. |
| Untracked function | P2 | `supabase/functions/translate-speak/` exists locally untracked and uses OpenAI speech synthesis. | Decide whether to delete, track, or ignore explicitly so it does not deploy accidentally. |
| Secrets hygiene | P1 | A real ElevenLabs API key was pasted into the chat history by the user. | Rotate that key in ElevenLabs, update Supabase secret, and treat the pasted value as compromised. |

## Required Security Validation

- `npm audit --audit-level=high`
- Gitleaks/secret scan
- Supabase local migration rebuild
- `scripts/validate-authorization-safety.mjs`
- Manual direct URL probes for protected/admin routes
