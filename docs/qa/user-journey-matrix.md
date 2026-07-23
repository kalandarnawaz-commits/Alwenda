# User Journey Matrix

| Journey | Steps Covered | Status | Risk/Gap |
| -- | -- | -- | -- |
| New visitor understands product | Open Home, read hero, scan rails | Partially verified from screenshots/source | Hero is strong but mobile density/floating controls can obscure content. |
| New visitor explores places | Home/Explore/business cards/detail/directions | Needs retest | Direct link/card behavior depends on current deployed assets and SW freshness. |
| New visitor hits protected action | Tap messages/notifications/conversation while signed out | Source-verified | Protected routes route to auth; return-to-task needs manual verification. |
| Google OAuth sign-in | Continue with Google, callback, profile bootstrap | Manual required | Must verify provider consent says Alwenda and callback returns to intended route. |
| Email sign-in | Email OTP/magic link | Manual required | Needs real inbox and callback test. |
| Returning user | Refresh, reopen, profile data, logout | Manual required | Supabase client supports session restoration; needs browser/device proof. |
| Alwen conversation | Open Alwen, submit message, persist context | Partially source-verified | Needs signed-in end-to-end call, timeout/error/rate-limit validation. |
| Translation voice | Lithuanian speech to English, TTS playback | Manual required | Mobile browser permissions are still the active reported pain point. |
| Marketplace browsing | See all, trending, details, seller contact | Partially verified | Trending rail should push categories down and individual cards open details; retest production after PRs merge. |
| Marketplace creation | Create listing with Alwen | Built | Needs validation, photo upload, edit/delete, and no-demo-data verification. |
| Business claim | Claim business, submit evidence | Built/scaffold | Needs backend duplicate/already-claimed/approval-state enforcement. |
| Notifications/messages | Accept/message a task/listing | Incomplete | User expectation is real message creation; current hub needs persistence/linkage. |
| Identity verification | Start provider/user verification | Scaffold | Persona connection is not real yet; must label as pending/future. |

## Manual Journey Acceptance

- The user never loses the original task after sign-in.
- Every card that looks clickable opens a route, detail sheet, external URL, or auth gate.
- Empty states are explicit and honest; demo content is never presented as live activity.
- Sign-out immediately removes private data from visible UI.
