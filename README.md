# Alwenda MVP

Alwenda is a premium, mobile-first City Operating System foundation. The first launch city is Vilnius, Lithuania, but the data and configuration are structured so the same product can expand to any city.

## Brand

- Alwenda is the platform and consumer city app.
- Alwen is the AI intelligence layer inside Alwenda.
- The Alwenda wordmark is the primary identity for larger surfaces.
- The double “a” icon is the app icon, favicon, compact brand mark, and floating Alwen mark.
- Vilnius launch pricing uses clean euro formatting such as `€25`, `€40/hr`, `€850/mo`, and `€7,900`.

## What is included

- Alwen-powered intent search as the centre of the home experience
- Home screen built around “What do you want to do today?”
- Dedicated Marketplace primary navigation pillar
- Marketplace categories for Buy & Sell, Rentals, Jobs, Local Services, Vehicles, and Business Listings
- “Need Help” flow for posting a task and receiving quotes from nearby verified professionals
- Explore screen backed by imported open-source business/place profiles
- Operations City Import module for OSM/Overpass, government portals, tourism data, registries, Wikidata, and GTFS mock imports
- Claim Business mock flow with owner details, verification method, document placeholder, and claim statuses
- Natural neighbourhood pulse below primary actions
- Local professionals for plumbing, cleaning, electrical, tutoring, childcare, photography, moving, legal, accounting, IT support, and more
- Future-ready trust layer placeholders for AI search, chat, booking, maps, reviews, ratings, availability, and secure payments
- Local places, offers, reservations, profile, translation, and operations screens
- Modular mock city data and launch-city config
- Multi-language UI foundation
- Placeholder modules for maps, AI translation, payments, bookings, and notifications
- Real Supabase authentication with Google OAuth, email magic links, persistent sessions, sign out, and first-login profile creation
- Consumer-grade mobile-first layout with bottom navigation and one-handed interactions

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

If you prefer the current in-app browser port, the same static app also works with:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Structure

- `src/data/mockData.js`: launch-city config, city graph, imported places, claims, neighbourhoods, professionals, listings, offers, reservations
- `src/i18n/translations.js`: language list and UI strings
- `src/services/integrationPlaceholders.js`: future API integration targets
- `src/main.js`: state, routing, rendering, and event binding
- `src/styles.css`: premium responsive product UI

## Expansion model

To launch another city, replace the `city`, `neighbourhoods`, and mock content exports in `src/data/mockData.js`. Later, those exports can become API clients without changing the screen architecture.

## Authentication

The frontend uses Supabase Auth only. Configure `window.__ALWENDA_ENV__` in `env.js` with `SUPABASE_URL` and either `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`. Never place a service-role key in the static frontend.

OAuth redirects return to `/auth/callback`, which loads the same app and lets the Supabase SDK restore the session. New users are routed to profile completion once; returning users go straight to Home.

Expected profile tables:

- `public_profiles`: `user_id`, `display_name`, `avatar_url`, `city`, `profession`, `languages`, `verification_status`, `reputation_score`, `created_at`, `updated_at`
- `private_profiles`: `user_id`, `contact_email`, `contact_phone`, `preferred_language`, `onboarding_complete`, `notification_preferences`, `created_at`, `updated_at`

Row Level Security should allow authenticated users to read public profiles, upsert only their own public profile row, and read/upsert only their own private profile row. Policies should use `auth.uid() = user_id`; the frontend never supplies or trusts an arbitrary user id for profile ownership.

For the production database schema, RLS matrix, release/cache runbook, observability foundation, and Supabase migration notes, see `docs/production-foundation.md`. The migration file is `supabase/migrations/202607150001_production_foundation.sql`.

## Backend (Alwen chat)

The frontend above is a zero-build static app and stays that way — it never talks to OpenAI, and never holds a service-role Supabase key or the OpenAI key. The secret-holding logic lives in a Supabase Edge Function, `supabase/functions/alwen-chat/index.ts`, deployed to the connected Supabase project.

The function requires a Supabase access token (`Authorization: Bearer <token>`) and responds with a clear "not configured" error — not a fake reply — if `OPENAI_API_KEY` is missing from its Edge Function secrets. Deploy/update it with:

```bash
supabase functions deploy alwen-chat
supabase secrets set OPENAI_API_KEY=sk-...
```
