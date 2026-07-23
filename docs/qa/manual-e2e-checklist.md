# Manual End-to-End Checklist

Use this when testing with a real Google account, production Supabase project, and mobile devices.

## Setup

1. Open `https://alwenda.com/clear-cache.html`.
2. Open `https://alwenda.com/?view=home&v=manual-e2e-20260723`.
3. Open devtools console on desktop; on mobile, use remote Safari/Chrome inspection if available.
4. Confirm no old asset query strings such as `alwen-2-0-3`, `elevenlabs-tts-1`, or `live-opportunity-detail-2` are present in loaded scripts/styles.

## Google OAuth

1. Sign out if already signed in.
2. Open a protected route: `https://alwenda.com/?view=notifications`.
3. Confirm Alwenda routes to sign-in with a clear message.
4. Tap Continue with Google.
5. Confirm Google consent names the app/brand correctly as Alwenda, not the raw Supabase project domain if branding verification is configured.
6. Complete sign-in.
7. Confirm return to the original protected task or a clear Home fallback.
8. Refresh.
9. Confirm session remains signed in.
10. Open Profile and confirm real name/photo are used if Google provides them.
11. Sign out.
12. Confirm private routes no longer show private data and route back to sign-in.

## Email Sign-In

1. Sign out.
2. Enter a real email.
3. Submit OTP/magic link.
4. Confirm no fake success state appears before the email action completes.
5. Complete callback/OTP.
6. Confirm first login profile completion appears only once.
7. Sign out and sign back in; confirm onboarding is skipped.

## Translation Voice

1. On iPhone Safari, open Home and quick translate.
2. Select Lithuanian -> English.
3. Tap the microphone.
4. Grant microphone permission when prompted.
5. Speak a Lithuanian sentence.
6. Confirm processing state is visible and not duplicated as a noisy notification.
7. Confirm recognized Lithuanian text appears.
8. Confirm English translation appears.
9. Tap speaker/playback.
10. Confirm volume is audible and failure is actionable.
11. Repeat on iPhone Chrome, desktop Safari, desktop Chrome.

## Business Discovery

1. Search for a place by exact name.
2. Search by category.
3. Search with a typo.
4. Open a card from every visible rail.
5. Confirm directions, phone, website, reserve/book/menu buttons are present only when valid.
6. Confirm “Claim this business” is secondary and not the main card label.

## Marketplace

1. Open Marketplace from Home and bottom navigation.
2. Click See all from Trending Marketplace.
3. Confirm marketplace opens with trending items at the top and categories below.
4. Click each visible trending card.
5. Confirm exact listing detail opens.
6. Attempt seller contact while signed out; confirm auth transition is clear.

## Business Claim

1. Open an unclaimed business.
2. Tap Claim this business.
3. Submit without required evidence; confirm validation.
4. Submit with evidence placeholder; confirm pending status, not approved.
5. Try duplicate claim; confirm duplicate messaging.

## Mobile Layout

1. Test 320, 375, 390 and 430 px widths.
2. Confirm no horizontal scroll.
3. Confirm bottom nav does not cover CTAs.
4. Confirm floating Alwen does not cover cards or forms.
5. Confirm keyboard does not hide active input.
